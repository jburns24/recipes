import { describe, expect, it } from 'vitest';
import { createSupabaseFetch, isNewSupabaseApiKey } from './supabase-key.js';

function captureFetch(): { fetch: typeof fetch; headers: Headers[] } {
  const headers: Headers[] = [];
  const fetchImpl: typeof fetch = async (_input, init) => {
    headers.push(new Headers(init?.headers));
    return new Response('[]', { status: 200 });
  };
  return { fetch: fetchImpl, headers };
}

describe('new-format Supabase API keys', () => {
  it('recognizes publishable and secret keys and ignores legacy JWTs', () => {
    expect(isNewSupabaseApiKey('sb_secret_abc')).toBe(true);
    expect(isNewSupabaseApiKey('sb_publishable_abc')).toBe(true);
    expect(isNewSupabaseApiKey('eyJhbGciOiJIUzI1NiJ9.e30.sig')).toBe(false);
    expect(isNewSupabaseApiKey('sb_temp_abc')).toBe(false);
  });

  it('sends a new key only on apikey, never as a Bearer token', async () => {
    const key = 'sb_secret_example';
    const base = captureFetch();
    await createSupabaseFetch(key, base.fetch)('https://proj.supabase.co/rest/v1/recipes', {
      headers: { Authorization: `Bearer ${key}`, apikey: key },
    });
    expect(base.headers[0]?.get('apikey')).toBe(key);
    expect(base.headers[0]?.get('Authorization')).toBeNull();
  });

  it('keeps a user access token and a legacy service-role JWT', async () => {
    const user = 'eyJhbGciOiJFUzI1NiJ9.payload.sig';
    const base = captureFetch();
    await createSupabaseFetch('sb_publishable_web', base.fetch)(
      'https://proj.supabase.co/auth/v1/user',
      {
        headers: { Authorization: `Bearer ${user}`, apikey: 'sb_publishable_web' },
      },
    );
    const legacy = 'eyJhbGciOiJIUzI1NiJ9.e30.sig';
    await createSupabaseFetch(legacy, base.fetch)('https://proj.supabase.co/rest/v1/recipes', {
      headers: { Authorization: `Bearer ${legacy}`, apikey: legacy },
    });
    expect(base.headers.map((headers) => headers.get('Authorization'))).toEqual([
      `Bearer ${user}`,
      `Bearer ${legacy}`,
    ]);
  });

  it('adds apikey when the caller only set the bearer key', async () => {
    const key = 'sb_publishable_browser';
    const base = captureFetch();
    await createSupabaseFetch(key, base.fetch)('https://proj.supabase.co/rest/v1/recipes', {
      headers: { Authorization: `Bearer ${key}` },
    });
    expect(base.headers[0]?.get('apikey')).toBe(key);
    expect(base.headers[0]?.get('Authorization')).toBeNull();
  });
});
