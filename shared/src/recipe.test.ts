import { describe, expect, it } from 'vitest';
import { RecipeSchema, categoryFromPath, categoryToPath } from './recipe.js';

const valid = {
  slug: 'mediterranean-salad',
  category: ['dinner', 'salad'],
  title: 'Mediterranean Salad',
  ingredients: [{ items: ['1 cucumber'] }, { group: 'Dressing', items: ['olive oil'] }],
  instructions: [{ lead: 'Chop', text: 'Chop everything.' }, { text: 'Toss.' }],
  tips: [],
};

describe('RecipeSchema', () => {
  it('accepts a minimal valid recipe', () => {
    expect(RecipeSchema.parse(valid)).toEqual(valid);
  });

  it('accepts all optional fields', () => {
    const full = {
      ...valid,
      subtitle: 's',
      prepTime: '10 min',
      cookTime: '0',
      totalTime: '10 min',
      serves: '4',
      image: 'mediterranean-salad.jpg',
      source_url: 'https://example.com/r',
    };
    expect(RecipeSchema.parse(full)).toEqual(full);
  });

  it.each([
    ['bad slug', { slug: 'Not A Slug' }],
    ['empty category', { category: [] }],
    ['string category', { category: 'dinner/salad' }],
    ['empty title', { title: '' }],
    ['empty ingredient group', { ingredients: [{ items: [] }] }],
    ['instruction without text', { instructions: [{ lead: 'x' }] }],
    ['bad source_url', { source_url: 'nope' }],
    ['javascript: source_url', { source_url: 'javascript:alert(1)' }],
    ['data: source_url', { source_url: 'data:text/html,hi' }],
  ])('rejects %s', (_name, patch) => {
    expect(RecipeSchema.safeParse({ ...valid, ...patch }).success).toBe(false);
  });

  it('rejects missing required fields', () => {
    const { title: _t, ...rest } = valid;
    expect(RecipeSchema.safeParse(rest).success).toBe(false);
  });
});

describe('category helpers', () => {
  it('round-trips', () => {
    expect(categoryToPath(['dinner', 'salad'])).toBe('dinner/salad');
    expect(categoryFromPath('dinner/salad')).toEqual(['dinner', 'salad']);
  });
  it('rejects empty path', () => {
    expect(() => categoryFromPath('')).toThrow();
  });
});
