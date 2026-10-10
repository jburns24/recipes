import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  AnthropicExtractor,
  ExtractedRecipeSchema,
  EXTRACTOR_MODEL,
  ExtractionError,
  RECIPE_TOOL_NAME,
  SYSTEM_PROMPT,
  StubExtractor,
  normalizeExtractedInput,
  recipeToolInputSchema,
  recipeToolStrictBlockers,
} from './extractor.js';
import { PNG } from '../testing.js';

const input = {
  image: PNG,
  mediaType: 'image/png' as const,
  filename: 'Grandma Pie.PNG',
  existingCategories: ['dinner/quick', 'dessert'],
};

const recipe = {
  slug: 'pie',
  category: ['dessert'],
  title: 'Pie',
  ingredients: [{ items: ['apples'] }],
  instructions: [{ text: 'Bake.' }],
  tips: [],
};

const message = (over: {
  content?: Anthropic.ContentBlock[];
  stop_reason?: Anthropic.StopReason;
}): Anthropic.Message => ({
  id: 'msg_1',
  type: 'message',
  role: 'assistant',
  model: EXTRACTOR_MODEL,
  content: [],
  stop_reason: 'end_turn',
  stop_sequence: null,
  container: null,
  diagnostics: null,
  stop_details: null,
  usage: { input_tokens: 1, output_tokens: 1 } as Anthropic.Usage,
  ...over,
});

const mockCreate = () =>
  vi.fn<(p: Anthropic.MessageCreateParamsNonStreaming) => Promise<Anthropic.Message>>();

const toolUse = (inputObj: unknown): Anthropic.ToolUseBlock => ({
  type: 'tool_use',
  id: 'tu_1',
  name: RECIPE_TOOL_NAME,
  input: inputObj,
  caller: { type: 'direct' },
});

describe('AnthropicExtractor', () => {
  it('sends the image + tool and returns the tool input', async () => {
    const create = vi
      .fn()
      .mockResolvedValue(message({ content: [toolUse(recipe)], stop_reason: 'tool_use' }));
    const out = await new AnthropicExtractor({ messages: { create } }).extract(input);
    expect(out).toEqual(recipe);

    const params = create.mock.calls[0]?.[0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(EXTRACTOR_MODEL).toBe('claude-haiku-5-5');
    expect(params.model).toBe(EXTRACTOR_MODEL);
    expect(params.tool_choice).toEqual({ type: 'auto' });
    expect(params.tools?.[0]).toMatchObject({ name: RECIPE_TOOL_NAME });
    expect(params.tools?.[0]).not.toHaveProperty('strict');
    expect(params.system).toBe(SYSTEM_PROMPT);
    expect(params.system).toContain('do NOT call any tool');
    expect(params.system).toContain('½ ¼ ¾ ⅓ ⅔ ⅛');
    expect(params.system).toContain(`call the ${RECIPE_TOOL_NAME} tool exactly once`);
    const content = params.messages[0]?.content;
    expect(Array.isArray(content) && content[0]).toMatchObject({
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: Buffer.from(PNG).toString('base64'),
      },
    });
    expect(JSON.stringify(content)).toContain('- dinner/quick');
    expect(JSON.stringify(content)).toContain(
      `If this image shows a recipe, transcribe it by calling ${RECIPE_TOOL_NAME}; otherwise reply without calling any tool.`,
    );
  });

  it('sends an explicit model override', async () => {
    const create = vi
      .fn()
      .mockResolvedValue(message({ content: [toolUse(recipe)], stop_reason: 'tool_use' }));
    await new AnthropicExtractor({ messages: { create } }, 'claude-haiku-4-5').extract(input);
    const params = create.mock.calls[0]?.[0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.model).toBe('claude-haiku-4-5');
  });

  it('wraps SDK failures, refusals and missing tool calls in ExtractionError', async () => {
    const run = (create: ReturnType<typeof mockCreate>) =>
      new AnthropicExtractor({ messages: { create } }).extract(input);
    await expect(
      run(mockCreate().mockRejectedValue(new Error('secret key leaked'))),
    ).rejects.toThrow(/request failed$/);
    await expect(
      run(mockCreate().mockResolvedValue(message({ stop_reason: 'refusal' }))),
    ).rejects.toBeInstanceOf(ExtractionError);
    const noTool = vi
      .fn()
      .mockResolvedValue(message({ content: [{ type: 'text', text: 'hi', citations: null }] }));
    await expect(run(noTool)).rejects.toThrow(/did not return/);
    expect(noTool).toHaveBeenCalledTimes(1);
  });

  it('does not retry when the model replies without a tool', async () => {
    const create = vi.fn().mockResolvedValue(
      message({
        content: [{ type: 'text', text: 'No recipe was found.', citations: null }],
        stop_reason: 'end_turn',
      }),
    );
    await expect(new AnthropicExtractor({ messages: { create } }).extract(input)).rejects.toThrow(
      /did not return a recipe/,
    );
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('normalizes a slash category and nested items without retrying', async () => {
    const create = vi.fn().mockResolvedValue(
      message({
        content: [
          toolUse({
            ...recipe,
            category: ['Dinner/Quick'],
            ingredients: [{ items: [['1 cucumber', '2 tomatoes'], 'salt'] }],
          }),
        ],
        stop_reason: 'tool_use',
      }),
    );
    const out = await new AnthropicExtractor({ messages: { create } }).extract(input);
    expect(out).toEqual({
      ...recipe,
      category: ['dinner', 'quick'],
      ingredients: [{ items: ['1 cucumber', '2 tomatoes', 'salt'] }],
    });
    expect(ExtractedRecipeSchema.safeParse(out).success).toBe(true);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('retries the API call once when normalized tool input still fails validation', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const create = vi
        .fn()
        .mockResolvedValueOnce(
          message({
            content: [toolUse({ ...recipe, slug: 'Bad Slug' })],
            stop_reason: 'tool_use',
          }),
        )
        .mockResolvedValueOnce(message({ content: [toolUse(recipe)], stop_reason: 'tool_use' }));
      const out = await new AnthropicExtractor({ messages: { create } }).extract(input);
      expect(out).toEqual(recipe);
      expect(create).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn.mock.calls[0]).toEqual([
        'Recipe extraction output failed validation; retrying once',
      ]);
      expect(JSON.stringify(warn.mock.calls)).not.toMatch(/sk-ant|Bad Slug|base64/i);
    } finally {
      warn.mockRestore();
    }
  });

  it('returns the second invalid payload after one retry', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const second = { ...recipe, category: ['Not A Slug'] };
      const create = vi
        .fn()
        .mockResolvedValueOnce(
          message({ content: [toolUse({ ...recipe, slug: 'Nope' })], stop_reason: 'tool_use' }),
        )
        .mockResolvedValueOnce(message({ content: [toolUse(second)], stop_reason: 'tool_use' }));
      const out = await new AnthropicExtractor({ messages: { create } }).extract(input);
      expect(out).toEqual({ ...second, category: ['not a slug'] });
      expect(ExtractedRecipeSchema.safeParse(out).success).toBe(false);
      expect(create).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('normalizeExtractedInput', () => {
  it('splits category paths and lowercases segments', () => {
    expect(
      normalizeExtractedInput({
        category: [' Dinner/Quick ', 'Snacks', 3],
        ingredients: [{ group: 'Sauce', items: [['1 cucumber']] }],
      }),
    ).toEqual({
      category: ['dinner', 'quick', 'snacks', 3],
      ingredients: [{ group: 'Sauce', items: ['1 cucumber'] }],
    });
  });

  it('drops empty category segments and leaves non-objects alone', () => {
    expect(normalizeExtractedInput({ category: [' / ', ''] })).toEqual({ category: [] });
    expect(normalizeExtractedInput('nope')).toBe('nope');
    expect(normalizeExtractedInput(null)).toBe(null);
  });
});

describe('recipeToolInputSchema', () => {
  it('is an object schema derived from the zod schema, without image or $schema', () => {
    const s = recipeToolInputSchema();
    expect(s.type).toBe('object');
    expect(s).not.toHaveProperty('$schema');
    expect(Object.keys(s.properties ?? {})).toEqual(
      expect.arrayContaining(['slug', 'category', 'title', 'ingredients', 'instructions', 'tips']),
    );
    expect(s.properties).not.toHaveProperty('image');
    expect(recipeToolStrictBlockers(s)).toEqual(['pattern', 'minLength', 'additionalProperties']);
  });
});

describe('StubExtractor', () => {
  it('is deterministic and schema-valid', async () => {
    const a = await new StubExtractor().extract(input);
    expect(a).toEqual(await new StubExtractor().extract(input));
    expect(a.slug).toBe('stub-grandma-pie');
    expect(ExtractedRecipeSchema.safeParse(a).success).toBe(true);
  });
});
