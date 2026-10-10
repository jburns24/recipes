import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FileStore } from './file-store.js';
import { RecipeConflictError } from './types.js';
import { salad, soup, tea } from './fixtures.js';

let dir: string;
let store: FileStore;
beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'file-store-'));
  store = new FileStore(dir);
});
afterEach(() => rm(dir, { recursive: true, force: true }));

describe('FileStore', () => {
  it('starts empty when recipes.json is missing', async () => {
    expect(await store.list()).toEqual([]);
    expect(await store.getByPath(['dinner'], 'x')).toBeNull();
  });

  it('creates, lists sorted, and gets by exact category + slug', async () => {
    await store.create(tea);
    await store.create(soup);
    await store.create(salad);
    expect((await store.list()).map((r) => r.slug)).toEqual(['soup', 'salad', 'tea']);
    expect(await store.getByPath(['dinner', 'quick'], 'soup')).toEqual(soup);
    expect(await store.getByPath(['dinner'], 'soup')).toBeNull();
  });

  it('filters by category prefix', async () => {
    await Promise.all([store.create(soup), store.create(salad), store.create(tea)]);
    expect((await store.list({ category: ['dinner'] })).map((r) => r.slug)).toEqual([
      'soup',
      'salad',
    ]);
    expect((await store.list({ category: ['dinner', 'salad'] })).map((r) => r.slug)).toEqual([
      'salad',
    ]);
  });

  it('rejects duplicates and invalid recipes', async () => {
    await store.create(soup);
    await expect(store.create(soup)).rejects.toBeInstanceOf(RecipeConflictError);
    await expect(store.create({ ...soup, slug: 'Bad Slug' })).rejects.toThrow();
  });

  it('upsert replaces by (category, slug)', async () => {
    await store.create(soup);
    await store.upsert({ ...soup, title: 'Better Soup' });
    const all = await store.list();
    expect(all).toHaveLength(1);
    expect(all[0]?.title).toBe('Better Soup');
  });

  it('persists to disk as validated JSON and re-validates on read', async () => {
    await store.create(soup);
    expect(JSON.parse(await readFile(path.join(dir, 'recipes.json'), 'utf8'))).toEqual([soup]);
    await writeFile(path.join(dir, 'recipes.json'), JSON.stringify([{ slug: 'x' }]));
    await expect(store.list()).rejects.toThrow();
  });

  it('serializes concurrent creates', async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) => store.create({ ...soup, slug: `soup-${i}` })),
    );
    expect(await store.list()).toHaveLength(10);
  });

  it('saves and reads images, and rejects bad keys', async () => {
    const key = await store.saveImage(
      'dinner/salad/salad.jpg',
      new Uint8Array([1, 2, 3]),
      'image/jpeg',
    );
    expect(key).toBe('dinner/salad/salad.jpg');
    const img = await store.getImage(key);
    expect(Array.from(img?.data ?? [])).toEqual([1, 2, 3]);
    expect(img?.contentType).toBe('image/jpeg');
    expect(await store.getImage('dinner/salad/none.jpg')).toBeNull();
    await expect(store.saveImage('../evil.jpg', new Uint8Array(), 'image/jpeg')).rejects.toThrow(
      /Invalid image key/,
    );
    await expect(store.getImage('a/../../etc/passwd.jpg')).rejects.toThrow();
  });

  it('builds API image urls', () => {
    expect(store.imageUrl('a/b.jpg')).toBe('/api/images/a/b.jpg');
    expect(new FileStore(dir, 'https://cdn.test/i').imageUrl('a/b.jpg')).toBe(
      'https://cdn.test/i/a/b.jpg',
    );
  });
});
