import Anthropic, { APIError } from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  AnthropicExtractor,
  ExtractedRecipeSchema,
  EXTRACTOR_MODEL,
  ExtractionError,
  NotARecipeError,
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

  it('guides category choice without anchoring on a real category', () => {
    // The example call must not carry a real or common category: at low effort the
    // model copies it (a hoisin sauce was saved under dinner/quick).
    const example = SYSTEM_PROMPT.slice(SYSTEM_PROMPT.indexOf('Shape of a'));
    const category = /"category":(\[[^\]]*\])/.exec(example)?.[1];
    expect(category).toBe('["example-category"]');
    for (const real of ['dinner', 'quick', 'dessert', 'breakfast', 'snacks', 'drinks']) {
      expect(example).not.toContain(`"${real}"`);
    }
    expect(SYSTEM_PROMPT).toContain('Category rules:');
    expect(SYSTEM_PROMPT).toContain('do NOT pick the closest one');
    expect(SYSTEM_PROMPT).toContain('Never copy its category');
    expect(SYSTEM_PROMPT).toContain('a sauce or a dessert is not a dinner');
  });

  it('sends an explicit model override', async () => {
    const create = vi
      .fn()
      .mockResolvedValue(message({ content: [toolUse(recipe)], stop_reason: 'tool_use' }));
    await new AnthropicExtractor({ messages: { create } }, 'claude-haiku-4-5').extract(input);
    const params = create.mock.calls[0]?.[0] as Anthropic.MessageCreateParamsNonStreaming;
    expect(params.model).toBe('claude-haiku-4-5');
  });

  it('wraps SDK failures, refusals and truncated replies in ExtractionError', async () => {
    const run = (create: ReturnType<typeof mockCreate>) =>
      new AnthropicExtractor({ messages: { create } }).extract(input);
    await expect(
      run(mockCreate().mockRejectedValue(new Error('secret key leaked'))),
    ).rejects.toThrow(/request failed$/);
    const refused = run(mockCreate().mockResolvedValue(message({ stop_reason: 'refusal' })));
    await expect(refused).rejects.toBeInstanceOf(ExtractionError);
    await expect(refused).rejects.not.toBeInstanceOf(NotARecipeError);
    const truncated = mockCreate().mockResolvedValue(
      message({
        content: [{ type: 'text', text: 'hi', citations: null }],
        stop_reason: 'max_tokens',
      }),
    );
    const missing = run(truncated);
    await expect(missing).rejects.toBeInstanceOf(ExtractionError);
    await expect(missing).rejects.not.toBeInstanceOf(NotARecipeError);
    await expect(missing).rejects.toThrow(/did not return/);
    expect(truncated).toHaveBeenCalledTimes(1);
  });

  it('keeps the Anthropic status and drops the upstream body', async () => {
    const create = mockCreate().mockRejectedValue(
      new APIError(401, { message: 'invalid x-api-key sk-ant-secret' }, 'sk-ant-secret', undefined),
    );
    const failed = new AnthropicExtractor({ messages: { create } }).extract(input);
    await expect(failed).rejects.toBeInstanceOf(ExtractionError);
    await expect(failed).rejects.toMatchObject({
      message: 'Recipe extraction request failed (status 401)',
      status: 401,
    });
    await expect(failed).rejects.not.toThrow(/sk-ant-secret/);
  });

  it('throws NotARecipeError when the model ends the turn without a tool', async () => {
    const create = vi.fn().mockResolvedValue(
      message({
        content: [{ type: 'text', text: 'No recipe was found.', citations: null }],
        stop_reason: 'end_turn',
      }),
    );
    const failed = new AnthropicExtractor({ messages: { create } }).extract(input);
    await expect(failed).rejects.toBeInstanceOf(NotARecipeError);
    await expect(failed).rejects.not.toBeInstanceOf(ExtractionError);
    await expect(failed).rejects.toThrow(/did not return a recipe/);
    expect(create).toHaveBeenCalledTimes(1);
  });

  it('throws NotARecipeError when the retry ends without a tool', async () => {
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
        .mockResolvedValueOnce(
          message({
            content: [{ type: 'text', text: 'No recipe was found.', citations: null }],
            stop_reason: 'end_turn',
          }),
        );
      const failed = new AnthropicExtractor({ messages: { create } }).extract(input);
      await expect(failed).rejects.toBeInstanceOf(NotARecipeError);
      expect(create).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
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
