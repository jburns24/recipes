/**
 * Publishable and secret keys (`sb_publishable_…` / `sb_secret_…`) replaced the
 * legacy anon / service_role JWTs. They are opaque strings: nothing should
 * decode them, and they must not be sent as `Authorization: Bearer`.
 */
export function isNewSupabaseApiKey(key: string): boolean {
  return key.startsWith('sb_publishable_') || key.startsWith('sb_secret_');
}

/**
 * supabase-js copies the project key into `Authorization: Bearer` whenever there
 * is no user session. The API then tries to parse that header as a JWT and
 * rejects a new-format key (`Invalid JWT` / PGRST301). Keep the key on `apikey`
 * only. A real user access token is left in place. Legacy JWT API keys are not
 * rewritten: older gateways still expect them in `Authorization`.
 */
export function createSupabaseFetch(key: string, base: typeof fetch = fetch): typeof fetch {
  if (!isNewSupabaseApiKey(key)) return base;
  return async (input, init) => {
    const headers = new Headers(init?.headers);
    if (headers.get('Authorization') === `Bearer ${key}`) headers.delete('Authorization');
    if (!headers.has('apikey')) headers.set('apikey', key);
    return base(input, { ...init, headers });
  };
}
