import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';

const dev = { AUTH_MODE: 'dev', DEV_AUTH_TOKEN: 'dev-token' };

describe('loadConfig', () => {
  it('parses dev mode and defaults', () => {
    const c = loadConfig(dev);
    expect(c).toMatchObject({ authMode: 'dev', port: 3000, claudeStub: false, allowedEmails: [] });
  });

  it('refuses dev auth in production', () => {
    expect(() => loadConfig({ ...dev, NODE_ENV: 'production' })).toThrow(/forbidden/);
  });

  it('refuses dev auth without a token or with a weak one', () => {
    expect(() => loadConfig({ AUTH_MODE: 'dev' })).toThrow(/DEV_AUTH_TOKEN/);
    expect(() => loadConfig({ AUTH_MODE: 'dev', DEV_AUTH_TOKEN: 'abc' })).toThrow(/DEV_AUTH_TOKEN/);
  });

  it('fails closed: supabase is the default and needs credentials', () => {
    expect(() => loadConfig({})).toThrow(/SUPABASE_JWT_SECRET/);
    expect(() => loadConfig({ AUTH_MODE: '' })).toThrow(/SUPABASE_JWT_SECRET/);
    expect(() => loadConfig({ AUTH_MODE: 'bogus', DEV_AUTH_TOKEN: 'dev-token' })).toThrow();
  });

  it('accepts production JWKS-only auth with no SUPABASE_JWT_SECRET', () => {
    const c = loadConfig({
      NODE_ENV: 'production',
      AUTH_MODE: 'supabase',
      SUPABASE_URL: 'https://proj.supabase.co/',
      ALLOWED_EMAILS: 'Owner@Example.com',
    });
    expect(c.supabaseJwtSecret).toBeUndefined();
    expect(c.supabaseUrl).toBe('https://proj.supabase.co');
    expect(c.allowedEmails).toEqual(['owner@example.com']);
    expect(c.isProduction).toBe(true);
  });

  it('accepts supabase with a secret or a URL, normalizing emails', () => {
    expect(
      loadConfig({ SUPABASE_JWT_SECRET: 's', ALLOWED_EMAILS: ' A@x.com, b@Y.com ,' }),
    ).toMatchObject({
      authMode: 'supabase',
      allowedEmails: ['a@x.com', 'b@y.com'],
    });
    expect(loadConfig({ SUPABASE_URL: 'https://p.supabase.co/' }).supabaseUrl).toBe(
      'https://p.supabase.co',
    );
  });

  it('refuses the Claude stub in production', () => {
    const prod = { SUPABASE_JWT_SECRET: 's', NODE_ENV: 'production', ALLOWED_EMAILS: 'a@x.com' };
    expect(() => loadConfig({ ...prod, CLAUDE_STUB: '1' })).toThrow(/CLAUDE_STUB/);
    expect(loadConfig({ ...dev, CLAUDE_STUB: '1' }).claudeStub).toBe(true);
    expect(loadConfig(prod).claudeStub).toBe(false);
  });

  it('requires ALLOWED_EMAILS in production', () => {
    const prod = { SUPABASE_JWT_SECRET: 's', NODE_ENV: 'production' };
    expect(() => loadConfig(prod)).toThrow(/ALLOWED_EMAILS/);
    expect(() => loadConfig({ ...prod, ALLOWED_EMAILS: ' , ' })).toThrow(/ALLOWED_EMAILS/);
    expect(loadConfig({ ...prod, ALLOWED_EMAILS: 'a@x.com' }).isProduction).toBe(true);
  });

  it('validates PORT', () => {
    expect(loadConfig({ ...dev, PORT: '8080' }).port).toBe(8080);
    expect(() => loadConfig({ ...dev, PORT: 'x' })).toThrow();
  });
});
