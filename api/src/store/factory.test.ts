import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { createStore, defaultDataDir } from './factory.js';
import { FileStore } from './file-store.js';
import { SupabaseStore } from './supabase-store.js';

describe('createStore', () => {
  it('defaults to the file store', () => {
    expect(createStore({})).toBeInstanceOf(FileStore);
  });

  it('honours STORE=file and DATA_DIR', async () => {
    const s = createStore({ STORE: 'file', DATA_DIR: '/tmp/nonexistent-recipes-dir' });
    expect(s).toBeInstanceOf(FileStore);
    expect(await s.list()).toEqual([]);
  });

  it('is case-insensitive', () => {
    expect(createStore({ STORE: 'FILE' })).toBeInstanceOf(FileStore);
  });

  it('builds a Supabase store from env', () => {
    const s = createStore({
      STORE: 'supabase',
      SUPABASE_URL: 'https://proj.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'service-key',
    });
    expect(s).toBeInstanceOf(SupabaseStore);
    expect(s.imageUrl('a/b.jpg')).toBe(
      'https://proj.supabase.co/storage/v1/object/public/recipe-images/a/b.jpg',
    );
  });

  it('requires credentials for supabase', () => {
    expect(() => createStore({ STORE: 'supabase' })).toThrow(/SUPABASE_URL/);
  });

  it('rejects unknown stores', () => {
    expect(() => createStore({ STORE: 'redis' })).toThrow(/Unknown STORE/);
  });

  it('default data dir is <repo>/data', () => {
    expect(defaultDataDir()).toBe(path.resolve(import.meta.dirname, '../../../data'));
  });
});
