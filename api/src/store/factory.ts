import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { FileStore } from './file-store.js';
import { SupabaseStore, IMAGE_BUCKET } from './supabase-store.js';
import type { RecipeStore } from './types.js';

type Env = Record<string, string | undefined>;

/** Repo-root data/ (works from api/src/store and api/dist/store). */
export const defaultDataDir = (): string =>
  fileURLToPath(new URL('../../../data', import.meta.url));

/**
 * Choose a store from environment:
 *  - STORE=file (default): DATA_DIR (default <repo>/data)
 *  - STORE=supabase: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY, optional SUPABASE_BUCKET
 */
export function createStore(env: Env = process.env): RecipeStore {
  const kind = (env['STORE'] ?? 'file').toLowerCase();
  if (kind === 'file') {
    return new FileStore(env['DATA_DIR'] ? path.resolve(env['DATA_DIR']) : defaultDataDir());
  }
  if (kind === 'supabase') {
    const url = env['SUPABASE_URL'];
    const key = env['SUPABASE_SERVICE_ROLE_KEY'];
    if (!url || !key) {
      throw new Error('STORE=supabase requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    }
    const client = createClient(url, key, { auth: { persistSession: false } });
    return new SupabaseStore(client, {
      publicBaseUrl: url,
      bucket: env['SUPABASE_BUCKET'] ?? IMAGE_BUCKET,
    });
  }
  throw new Error(`Unknown STORE "${kind}" (expected "file" or "supabase")`);
}
