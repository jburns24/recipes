import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { SupabaseStore, fromRow, toRow, type RecipeRow } from './supabase-store.js';
import { RecipeConflictError } from './types.js';
import { salad, soup, tea } from './fixtures.js';

type Result = { data?: unknown; error?: { code?: string; message: string } | null };

/** Chainable, awaitable stand-in for a postgrest query builder. Records calls. */
function fakeClient(result: Result, storage?: Record<string, unknown>) {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'upsert', 'eq', 'contains']) {
    builder[m] = (...args: unknown[]) => {
      calls.push([m, args]);
      return builder;
    };
  }
  builder['then'] = (resolve: (r: Result) => unknown) => resolve({ error: null, ...result });
  const from = vi.fn((table: string) => {
    calls.push(['from', [table]]);
    return builder;
  });
  const client = { from, storage: { from: vi.fn(() => storage) } } as unknown as SupabaseClient;
  return { client, calls, from };
}

const store = (client: SupabaseClient) =>
  new SupabaseStore(client, { publicBaseUrl: 'https://proj.supabase.co/' });

describe('row mapping', () => {
  it('splits slug/category/title from body and round-trips', () => {
    const row = toRow(salad);
    expect(row).toMatchObject({ slug: 'salad', category: ['dinner', 'salad'], title: 'Salad' });
    expect(row.body).toEqual({
      serves: '2',
      ingredients: salad.ingredients,
      instructions: salad.instructions,
      tips: salad.tips,
      image: salad.image,
    });
    expect(fromRow(row)).toEqual(salad);
  });

  it('re-validates rows from the database', () => {
    expect(() =>
      fromRow({ slug: 'x', category: [], title: 't', body: {} } as unknown as RecipeRow),
    ).toThrow();
  });
});

describe('SupabaseStore', () => {
  it('lists, validates and sorts rows', async () => {
    const { client, calls } = fakeClient({ data: [toRow(tea), toRow(soup)] });
    const out = await store(client).list();
    expect(out.map((r) => r.slug)).toEqual(['soup', 'tea']);
    expect(calls[0]).toEqual(['from', ['recipes']]);
  });

  it('list with a category uses containment then prefix-filters', async () => {
    const { client, calls } = fakeClient({
      data: [toRow(soup), toRow({ ...soup, slug: 's2', category: ['x', 'dinner'] })],
    });
    const out = await store(client).list({ category: ['dinner'] });
    expect(out.map((r) => r.slug)).toEqual(['soup']);
    expect(calls).toContainEqual(['contains', ['category', ['dinner']]]);
  });

  it('getByPath matches the exact category, not just containment', async () => {
    const { client, calls } = fakeClient({
      data: [toRow({ ...soup, category: ['dinner'] }), toRow(soup)],
    });
    const got = await store(client).getByPath(['dinner', 'quick'], 'soup');
    expect(got?.category).toEqual(['dinner', 'quick']);
    expect(calls).toContainEqual(['eq', ['slug', 'soup']]);
  });

  it('getByPath returns null when nothing matches', async () => {
    const { client } = fakeClient({ data: [] });
    expect(await store(client).getByPath(['dinner'], 'nope')).toBeNull();
  });

  it('create inserts a row and maps unique violations to RecipeConflictError', async () => {
    const ok = fakeClient({});
    await expect(store(ok.client).create(soup)).resolves.toEqual(soup);
    expect(ok.calls).toContainEqual(['insert', [toRow(soup)]]);

    const dup = fakeClient({ error: { code: '23505', message: 'duplicate key' } });
    await expect(store(dup.client).create(soup)).rejects.toBeInstanceOf(RecipeConflictError);

    const boom = fakeClient({ error: { code: 'XX', message: 'kaboom' } });
    await expect(store(boom.client).create(soup)).rejects.toThrow(/kaboom/);
  });

  it('upsert conflicts on category,slug', async () => {
    const { client, calls } = fakeClient({});
    await store(client).upsert(soup);
    expect(calls).toContainEqual(['upsert', [toRow(soup), { onConflict: 'category,slug' }]]);
  });

  it('propagates list errors', async () => {
    const { client } = fakeClient({ error: { message: 'nope' } });
    await expect(store(client).list()).rejects.toThrow(/nope/);
  });

  it('uploads and downloads images via the bucket', async () => {
    const upload = vi.fn().mockResolvedValue({ error: null });
    const download = vi
      .fn()
      .mockResolvedValueOnce({
        data: new Blob([new Uint8Array([9, 8])], { type: 'image/webp' }),
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: { message: 'Object not found' } });
    const { client } = fakeClient({}, { upload, download });
    const s = store(client);
    await s.saveImage('a/b.webp', new Uint8Array([1]), 'image/webp');
    expect(upload).toHaveBeenCalledWith('a/b.webp', new Uint8Array([1]), {
      contentType: 'image/webp',
      upsert: true,
    });
    const img = await s.getImage('a/b.webp');
    expect(Array.from(img?.data ?? [])).toEqual([9, 8]);
    expect(img?.contentType).toBe('image/webp');
    expect(await s.getImage('a/missing.webp')).toBeNull();
  });

  it('surfaces upload errors and rejects bad keys', async () => {
    const upload = vi.fn().mockResolvedValue({ error: { message: 'denied' } });
    const { client } = fakeClient({}, { upload });
    await expect(
      store(client).saveImage('a/b.jpg', new Uint8Array(), 'image/jpeg'),
    ).rejects.toThrow(/denied/);
    await expect(
      store(client).saveImage('../x.jpg', new Uint8Array(), 'image/jpeg'),
    ).rejects.toThrow(/Invalid/);
  });

  it('builds public object urls without double slashes', () => {
    const { client } = fakeClient({});
    expect(store(client).imageUrl('dinner/x.jpg')).toBe(
      'https://proj.supabase.co/storage/v1/object/public/recipe-images/dinner/x.jpg',
    );
  });
});
