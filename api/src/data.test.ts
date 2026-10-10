import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RecipeSchema } from '@recipes/shared';
import { defaultDataDir } from './store/index.js';

const recipes = RecipeSchema.array().parse(
  JSON.parse(readFileSync(`${defaultDataDir()}/recipes.json`, 'utf8')),
);

describe('data/recipes.json', () => {
  it('contains the migrated recipes (8 templated + 11 snapshots)', () => {
    expect(recipes).toHaveLength(19);
  });
  it('has unique (category, slug) pairs', () => {
    const keys = recipes.map((r) => `${r.category.join('/')}/${r.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it('has ingredients and instructions on every recipe', () => {
    for (const r of recipes) {
      expect(r.ingredients.length, r.slug).toBeGreaterThan(0);
      expect(r.instructions.length, r.slug).toBeGreaterThan(0);
    }
  });
  it('uses image keys of the form <category path>/<slug>.<ext>', () => {
    for (const r of recipes.filter((x) => x.image)) {
      expect(r.image, r.slug).toMatch(
        new RegExp(`^${r.category.join('/')}/${r.slug}\\.(jpg|png|webp|gif)$`),
      );
    }
  });
});
