import { mkdtemp, mkdir, readFile, writeFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { RecipeSchema } from '@recipes/shared';
import { convertAll, writeData } from './convert.js';

const card = (title: string, img: string) => `<div class="card-body"><h1>${title}</h1>
<h5>Ingredients</h5><ul><li>a</li></ul><h5>Instructions</h5><ol><li>b</li></ol></div>
<img src="${img}">`;

let dir: string;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'convert-'));
  await mkdir(path.join(dir, 'routes/dinner/quick'), { recursive: true });
  await writeFile(path.join(dir, 'routes/dinner/quick/soup.html'), card('Soup', 'soup.jpg'));
  await writeFile(path.join(dir, 'routes/dinner/quick/soup.jpg'), 'jpegbytes');
  await mkdir(path.join(dir, 'routes/drinks'), { recursive: true });
  await writeFile(path.join(dir, 'routes/drinks/tea.html'), card('Tea', 'tea.jpg'));
  await writeFile(path.join(dir, 'routes/drinks/tea.jpg'), 'teabytes');
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('convertAll / writeData', () => {
  it('derives category and slug from the path and validates with the schema', async () => {
    const out = await convertAll(path.join(dir, 'routes'));
    expect(out.map((c) => [c.recipe.category, c.recipe.slug, c.recipe.image])).toEqual([
      [['dinner', 'quick'], 'soup', 'dinner/quick/soup.jpg'],
      [['drinks'], 'tea', 'drinks/tea.jpg'],
    ]);
    out.forEach((c) => RecipeSchema.parse(c.recipe));
  });

  it('is idempotent and prunes stale images', async () => {
    const data = path.join(dir, 'data');
    const converted = await convertAll(path.join(dir, 'routes'));
    await writeData(converted, data);
    await mkdir(path.join(data, 'images/old'), { recursive: true });
    await writeFile(path.join(data, 'images/old/stale.jpg'), 'x');
    const first = await readFile(path.join(data, 'recipes.json'), 'utf8');
    await writeData(converted, data);
    expect(await readFile(path.join(data, 'recipes.json'), 'utf8')).toBe(first);
    expect(await readdir(path.join(data, 'images'))).toEqual(['dinner', 'drinks']);
    expect(await readFile(path.join(data, 'images/drinks/tea.jpg'), 'utf8')).toBe('teabytes');
  });
});
