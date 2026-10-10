import { describe, expect, it } from 'vitest';
import { createApp } from './app.js';
import { createAuthenticator } from './auth.js';
import { loadConfig } from './config.js';
import { createExtractor } from './extract/factory.js';
import { createStore } from './store/index.js';

const production = {
  NODE_ENV: 'production',
  STORE: 'supabase',
  AUTH_MODE: 'supabase',
  ALLOWED_EMAILS: 'owner@example.com',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'sb_secret_dummy',
};

describe('production startup', () => {
  it('boots with JWKS-only supabase auth and a new-format service key', async () => {
    const config = loadConfig(production);
    expect(config.supabaseJwtSecret).toBeUndefined();
    expect(config.supabaseUrl).toBe('https://example.supabase.co');
    const app = createApp({
      store: createStore(production),
      auth: createAuthenticator(config),
      extractor: createExtractor(config),
    });
    expect((await app.request('/api/health')).status).toBe(200);
    const extract = await app.request('/api/extract', { method: 'POST' });
    expect(extract.status).toBe(401);
    expect(extract.headers.get('WWW-Authenticate')).toBe('Bearer');
  });

  it('refuses dev auth, the Claude stub, and an empty allowlist', () => {
    expect(() =>
      loadConfig({ ...production, AUTH_MODE: 'dev', DEV_AUTH_TOKEN: 'dev-token' }),
    ).toThrow(/forbidden/);
    expect(() => loadConfig({ ...production, CLAUDE_STUB: '1' })).toThrow(/CLAUDE_STUB/);
    expect(() => loadConfig({ ...production, ALLOWED_EMAILS: '' })).toThrow(/ALLOWED_EMAILS/);
    expect(() => loadConfig({ ...production, ALLOWED_EMAILS: ' , ' })).toThrow(/ALLOWED_EMAILS/);
  });
});
