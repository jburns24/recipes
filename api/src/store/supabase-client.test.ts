import { describe, expect, it } from 'vitest';
import { createSupabaseClient } from './supabase-client.js';

describe('createSupabaseClient', () => {
  it('does not decode an sb_secret key or send it as a Bearer JWT', async () => {
    const key = 'sb_secret_not_a_jwt';
    const seen: Array<{ url: string; authorization: string | null; apikey: string | null }> = [];
    const fetchImpl: typeof fetch = async (input, init) => {
      const headers = new Headers(init?.headers);
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
      seen.push({
        url,
        authorization: headers.get('Authorization'),
        apikey: headers.get('apikey'),
      });
      return new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };

    const client = createSupabaseClient('https://proj.supabase.co', key, fetchImpl);
    const { error } = await client.from('recipes').select('slug');
    expect(error).toBeNull();

    const rest = seen.filter((call) => call.url.includes('/rest/v1/'));
    expect(rest.length).toBeGreaterThan(0);
    for (const call of rest) {
      expect(call.apikey).toBe(key);
      expect(call.authorization).toBeNull();
    }
    expect(seen.some((call) => call.authorization === `Bearer ${key}`)).toBe(false);
  });

  it('still sends a legacy service-role JWT as a Bearer token', async () => {
    const key = 'eyJhbGciOiJIUzI1NiJ9.e30.sig';
    let authorization: string | null = null;
    const fetchImpl: typeof fetch = async (_input, init) => {
      authorization = new Headers(init?.headers).get('Authorization');
      return new Response('[]', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    };
    const client = createSupabaseClient('https://proj.supabase.co', key, fetchImpl);
    await client.from('recipes').select('slug');
    expect(authorization).toBe(`Bearer ${key}`);
  });
});
