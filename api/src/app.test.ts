import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Hono } from 'hono';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_UPLOAD_BYTES, createApp } from './app.js';
import { createDevAuthenticator, type AppEnv } from './auth.js';
import {
  ExtractionError,
  NotARecipeError,
  StubExtractor,
  type Extractor,
} from './extract/extractor.js';
import { FileStore } from './store/file-store.js';
import { RecipeConflictError, type RecipeStore } from './store/types.js';
import { salad, soup } from './store/fixtures.js';
import { JPEG, PNG } from './testing.js';

let dir: string;
let store: FileStore;
let app: Hono<AppEnv>;
const extracted = {
  slug: 'pie',
  category: ['dessert'],
  title: 'Pie',
  ingredients: [{ items: ['apples'] }],
  instructions: [{ text: 'Bake.' }],
  tips: [],
};
let extractor: Extractor;
const extractFn = vi.fn<Extractor['extract']>();

const build = (over: { extractor?: Extractor | undefined; store?: RecipeStore } = {}) =>
  createApp({
    store: over.store ?? store,
    auth: createDevAuthenticator('dev-token'),
    extractor: 'extractor' in over ? over.extractor : extractor,
  });

beforeEach(async () => {
  dir = await mkdtemp(path.join(tmpdir(), 'api-'));
  store = new FileStore(dir);
  extractFn.mockReset().mockResolvedValue(extracted);
  extractor = { extract: extractFn };
  app = build();
});
afterEach(() => rm(dir, { recursive: true, force: true }));

const authed = { Authorization: 'Bearer dev-token' };
const upload = (
  bytes: Uint8Array<ArrayBuffer> = PNG,
  type = 'image/png',
  name = 'pie.png',
  headers: Record<string, string> = authed,
) => {
  const body = new FormData();
  body.set('image', new File([bytes], name, { type }));
  return app.request('/api/extract', { method: 'POST', body, headers });
};

describe('basics', () => {
  it('health', async () => {
    const res = await app.request('/api/health');
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('unknown routes use the uniform error shape', async () => {
    const res = await app.request('/api/nope');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: 'not_found', message: 'Not found' } });
  });

  it('unexpected errors are 500 with no leaked details', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const broken = { ...store, list: () => Promise.reject(new Error('db password=hunter2')) };
    const res = await build({ store: broken as unknown as RecipeStore }).request('/api/recipes');
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({
      error: { code: 'internal_error', message: 'Internal server error' },
    });
    expect(text).not.toContain('hunter2');
    spy.mockRestore();
  });

  it('maps RecipeConflictError to 409', async () => {
    const conflicting = {
      ...store,
      list: () => Promise.reject(new RecipeConflictError(['a'], 'b')),
    };
    const res = await build({ store: conflicting as unknown as RecipeStore }).request(
      '/api/recipes',
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ error: { code: 'conflict' } });
  });
});

describe('GET /api/recipes', () => {
  beforeEach(async () => {
    await store.create(soup);
    await store.create(salad);
  });

  it('lists with image urls and paths', async () => {
    const res = await app.request('/api/recipes');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Array<Record<string, unknown>>;
    expect(body.map((r) => r['path'])).toEqual(['dinner/quick/soup', 'dinner/salad/salad']);
    expect(body[0]).not.toHaveProperty('image');
    expect(body[1]?.['image']).toBe('/api/images/dinner/salad/salad.jpg');
  });

  it('filters by category prefix and rejects bad categories', async () => {
    const ok = await app.request('/api/recipes?category=dinner/salad');
    expect(((await ok.json()) as unknown[]).length).toBe(1);
    const bad = await app.request('/api/recipes?category=Bad%20Cat');
    expect(bad.status).toBe(400);
    expect(await bad.json()).toMatchObject({ error: { code: 'validation_error' } });
  });

  it('gets one recipe by category path + slug', async () => {
    const res = await app.request('/api/recipes/dinner/salad/salad');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      slug: 'salad',
      path: 'dinner/salad/salad',
      image: '/api/images/dinner/salad/salad.jpg',
    });
  });

  it('404s for missing, wrong-category, slug-only and malformed paths', async () => {
    for (const p of [
      '/api/recipes/dinner/salad/nope',
      '/api/recipes/dinner/soup',
      '/api/recipes/soup',
      '/api/recipes/',
      '/api/recipes/Bad%20Cat/x',
      '/api/recipes/%E0%A4%A/x',
    ]) {
      const res = await app.request(p);
      expect(res.status, p).toBe(404);
    }
  });

  it('is public (no auth required)', async () => {
    expect((await app.request('/api/recipes')).status).toBe(200);
  });
});

describe('GET /api/images/*', () => {
  it('serves stored images with type and cache headers', async () => {
    await store.saveImage('dinner/salad/salad.jpg', JPEG, 'image/jpeg');
    const res = await app.request('/api/images/dinner/salad/salad.jpg');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('image/jpeg');
    expect(res.headers.get('Cache-Control')).toMatch(/max-age=\d+/);
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(Array.from(new Uint8Array(await res.arrayBuffer()))).toEqual(Array.from(JPEG));
  });

  it('404s for missing images and any traversal attempt', async () => {
    expect((await app.request('/api/images/dinner/none.jpg')).status).toBe(404);
    for (const p of [
      '/api/images/../recipes.json',
      '/api/images/%2e%2e/recipes.json',
      '/api/images/a/..%2f..%2fetc/passwd',
      '/api/images/%2Fetc%2Fpasswd',
      '/api/images/a%5C..%5Cb.jpg',
      '/api/images/',
      '/api/images/%ZZ.jpg',
    ]) {
      const res = await app.request(p);
      expect(res.status, p).toBe(404);
    }
  });
});

describe('POST /api/extract', () => {
  it('requires auth', async () => {
    expect((await upload(PNG, 'image/png', 'a.png', {})).status).toBe(401);
    expect(
      (await upload(PNG, 'image/png', 'a.png', { Authorization: 'Bearer wrong' })).status,
    ).toBe(401);
    expect(extractFn).not.toHaveBeenCalled();
  });

  it('extracts, stores the image and recipe, and returns the DTO', async () => {
    const res = await upload();
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      slug: 'pie',
      path: 'dessert/pie',
      image: '/api/images/dessert/pie.png',
    });
    expect(extractFn.mock.calls[0]?.[0]).toMatchObject({
      mediaType: 'image/png',
      filename: 'pie.png',
      existingCategories: [],
    });
    expect((await store.getByPath(['dessert'], 'pie'))?.image).toBe('dessert/pie.png');
    expect((await store.getImage('dessert/pie.png'))?.data.length).toBe(PNG.length);
    expect((await app.request('/api/recipes/dessert/pie')).status).toBe(200);
  });

  it('passes existing categories to the extractor', async () => {
    await store.create(soup);
    await upload();
    expect(extractFn.mock.calls[0]?.[0].existingCategories).toEqual(['dinner/quick']);
  });

  it('suffixes the slug on conflict instead of failing', async () => {
    expect(((await (await upload()).json()) as { slug: string }).slug).toBe('pie');
    expect(((await (await upload()).json()) as { slug: string }).slug).toBe('pie-2');
    const third = (await (await upload()).json()) as { slug: string; image: string };
    expect(third).toMatchObject({ slug: 'pie-3', image: '/api/images/dessert/pie-3.png' });
    expect(await store.list()).toHaveLength(3);
  });

  it('retries with a new slug when create races', async () => {
    const realCreate = store.create.bind(store);
    let first = true;
    vi.spyOn(store, 'create').mockImplementation((r) => {
      if (first) {
        first = false;
        return Promise.reject(new RecipeConflictError(r.category, r.slug));
      }
      return realCreate(r);
    });
    const res = await upload();
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({ slug: 'pie-2' });
  });

  it('does not overwrite the winner image when create loses a race', async () => {
    const save = vi.spyOn(store, 'saveImage');
    vi.spyOn(store, 'create').mockRejectedValueOnce(new RecipeConflictError(['dessert'], 'pie'));
    expect((await upload()).status).toBe(201);
    expect(save.mock.calls.map((c) => c[0])).toEqual(['dessert/pie-2.png']);
  });

  it('falls back to an image-less recipe when the image cannot be stored', async () => {
    vi.spyOn(store, 'saveImage').mockRejectedValue(new Error('disk full'));
    const res = await upload();
    expect(res.status).toBe(201);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body['image']).toBeUndefined();
    expect((await store.getByPath(['dessert'], 'pie'))?.image).toBeUndefined();
  });

  it('works end-to-end with the stub extractor', async () => {
    const stub = build({ extractor: new StubExtractor() });
    const body = new FormData();
    body.set('image', new File([JPEG], 'Soup Night.jpg', { type: 'image/jpeg' }));
    const res = await stub.request('/api/extract', { method: 'POST', body, headers: authed });
    expect(res.status).toBe(201);
    expect(await res.json()).toMatchObject({
      slug: 'stub-soup-night',
      path: 'dinner/quick/stub-soup-night',
      image: '/api/images/dinner/quick/stub-soup-night.jpg',
    });
  });

  it('rejects unsupported declared types', async () => {
    const res = await upload(PNG, 'image/svg+xml', 'a.svg');
    expect(res.status).toBe(415);
    expect(await res.json()).toMatchObject({ error: { code: 'unsupported_media_type' } });
    expect((await upload(PNG, 'application/pdf', 'a.pdf')).status).toBe(415);
  });

  it('rejects contents that do not match the declared type (magic bytes)', async () => {
    const res = await upload(new TextEncoder().encode('<script>alert(1)</script>'), 'image/png');
    expect(res.status).toBe(415);
    expect(await res.json()).toMatchObject({ error: { code: 'image_type_mismatch' } });
    expect((await upload(JPEG, 'image/png')).status).toBe(415);
    expect(extractFn).not.toHaveBeenCalled();
  });

  it('rejects oversized uploads', async () => {
    const big = new Uint8Array(MAX_UPLOAD_BYTES + 1);
    big.set(PNG);
    const res = await upload(big);
    expect(res.status).toBe(413);
    expect(await res.json()).toMatchObject({ error: { code: 'payload_too_large' } });
    // far beyond the body limit is also stopped before parsing
    const huge = new Uint8Array(MAX_UPLOAD_BYTES + 200_000);
    huge.set(PNG);
    expect((await upload(huge)).status).toBe(413);
  });

  it('rejects missing/empty/non-multipart bodies', async () => {
    const none = await app.request('/api/extract', {
      method: 'POST',
      body: new FormData(),
      headers: authed,
    });
    expect(none.status).toBe(400);
    expect((await upload(new Uint8Array(), 'image/png')).status).toBe(400);
    const json = await app.request('/api/extract', {
      method: 'POST',
      body: '{}',
      headers: { ...authed, 'Content-Type': 'application/json' },
    });
    expect(json.status).toBe(400);
    const text = new FormData();
    text.set('image', 'not a file');
    const res = await app.request('/api/extract', { method: 'POST', body: text, headers: authed });
    expect(res.status).toBe(400);
  });

  it('502s when the model output fails schema validation, and stores nothing', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      extractFn.mockResolvedValue({ ...extracted, slug: 'Bad Slug' });
      const res = await upload();
      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({ error: { code: 'invalid_extraction' } });
      extractFn.mockResolvedValue('nonsense');
      expect((await upload()).status).toBe(502);
      expect(await store.list()).toEqual([]);
      expect(error).toHaveBeenCalledTimes(2);
      const logged = error.mock.calls.map((call) => JSON.stringify(call)).join('\n');
      expect(logged).toContain('invalid_extraction');
      expect(logged).toContain('The model returned an invalid recipe');
      expect(logged).toContain('image/png');
      expect(logged).toContain(`size=${String(PNG.length)}`);
      expect(logged).not.toContain('Bad Slug');
      expect(logged).not.toContain(Buffer.from(PNG).toString('base64'));
    } finally {
      error.mockRestore();
    }
  });

  it('422s when the image is not a recipe and logs one line', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      extractFn.mockRejectedValue(new NotARecipeError());
      const res = await upload();
      expect(res.status).toBe(422);
      expect(await res.json()).toEqual({
        error: {
          code: 'not_a_recipe',
          message: "That image doesn't look like a recipe. Try a photo of a recipe card or page.",
        },
      });
      expect(await store.list()).toEqual([]);
      expect(error).not.toHaveBeenCalled();
      expect(warn).toHaveBeenCalledTimes(1);
      const line = JSON.stringify(warn.mock.calls[0]);
      expect(line).toContain('not_a_recipe');
      expect(line).toContain('Model did not return a recipe');
      expect(line).toContain('mediaType=image/png');
      expect(line).toContain(`size=${String(PNG.length)}`);
      expect(line).not.toContain('status=');
      expect(line).not.toContain(Buffer.from(PNG).toString('base64'));
    } finally {
      warn.mockRestore();
      error.mockRestore();
    }
  });

  it('502s on extractor failures without leaking internals', async () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      extractFn.mockRejectedValue(new ExtractionError('Model declined the request'));
      const declined = await upload();
      expect(declined.status).toBe(502);
      expect(await declined.json()).toEqual({
        error: { code: 'extraction_failed', message: 'Model declined the request' },
      });
      extractFn.mockRejectedValue(
        new ExtractionError('Recipe extraction request failed (status 529)', 529),
      );
      const overloaded = await upload();
      expect(overloaded.status).toBe(502);
      expect(await overloaded.json()).toMatchObject({ error: { code: 'extraction_failed' } });
      extractFn.mockRejectedValue(new Error('sk-ant-secret'));
      const res = await upload();
      expect(res.status).toBe(502);
      expect(await res.text()).not.toContain('sk-ant-secret');
      const logged = spy.mock.calls.map((call) => JSON.stringify(call)).join('\n');
      expect(logged).toContain('extraction_failed');
      expect(logged).toContain('Model declined the request');
      expect(logged).toContain('status=529');
      expect(logged).toContain('mediaType=image/png');
      expect(logged).toContain(`size=${String(PNG.length)}`);
      expect(logged).toContain('unexpected extractor failure (Error)');
      expect(logged).not.toContain('sk-ant-secret');
      expect(logged).not.toContain(Buffer.from(PNG).toString('base64'));
      expect(spy).toHaveBeenCalledTimes(3);
    } finally {
      spy.mockRestore();
    }
  });

  it('503s when no extractor is configured', async () => {
    app = build({ extractor: undefined });
    const res = await upload();
    expect(res.status).toBe(503);
    expect(await res.json()).toMatchObject({ error: { code: 'extractor_unavailable' } });
  });
});
