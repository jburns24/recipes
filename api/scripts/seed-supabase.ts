/**
 * Load data/recipes.json (+ data/images/) into Supabase.
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (see `task seed:supabase`).
 * Idempotent: recipes are upserted by (category, slug), images overwritten.
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { RecipeSchema } from '@recipes/shared';
import { createStore, contentTypeForKey, defaultDataDir } from '../src/store/index.js';

const dataDir = process.env['DATA_DIR'] ? path.resolve(process.env['DATA_DIR']) : defaultDataDir();
const store = createStore({ ...process.env, STORE: 'supabase' });

const recipes = RecipeSchema.array().parse(
  JSON.parse(await fs.readFile(path.join(dataDir, 'recipes.json'), 'utf8')),
);

let images = 0;
for (const recipe of recipes) {
  if (recipe.image) {
    const data = await fs.readFile(path.join(dataDir, 'images', ...recipe.image.split('/')));
    await store.saveImage(recipe.image, data, contentTypeForKey(recipe.image));
    images++;
  }
  await store.upsert(recipe);
  console.log(`upserted ${recipe.category.join('/')}/${recipe.slug}`);
}
console.log(`\nSeeded ${recipes.length} recipes and ${images} images into Supabase.`);
