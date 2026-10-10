import type Anthropic from '@anthropic-ai/sdk';
import { describe, expect, it, vi } from 'vitest';
import {
  AnthropicExtractor,
  ExtractedRecipeSchema,
  ExtractionError,
  RECIPE_TOOL_NAME,
  StubExtractor,
  recipeToolInputSchema,
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
  model: 'claude-sonnet-5-5',
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
    expect(params.model).toBe('claude-sonnet-5-5');
    expect(params.tool_choice).toEqual({ type: 'auto' });
    expect(params.tools?.[0]).toMatchObject({ name: RECIPE_TOOL_NAME });
    expect(params.system).toMatch(/faithfully/);
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
    await expect(
      run(
        vi
          .fn()
          .mockResolvedValue(message({ content: [{ type: 'text', text: 'hi', citations: null }] })),
      ),
    ).rejects.toThrow(/did not return/);
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
