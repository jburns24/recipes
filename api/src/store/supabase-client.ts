import { createSupabaseFetch } from '@recipes/shared';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Service-role client. The key is passed through unchanged (new `sb_secret_` keys
 * are not JWTs and must not be decoded). `createSupabaseFetch` stops supabase-js
 * from also sending that key as `Authorization: Bearer`.
 */
export function createSupabaseClient(
  url: string,
  key: string,
  fetchImpl: typeof fetch = fetch,
): SupabaseClient {
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: createSupabaseFetch(key, fetchImpl) },
  });
}
