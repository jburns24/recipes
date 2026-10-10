import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import {
  createAuthenticator,
  createDevAuthenticator,
  createSupabaseAuthenticator,
  requireAuth,
  type AppEnv,
} from './auth.js';
import { loadConfig } from './config.js';
import { handleError } from './errors.js';
import { JWT_SECRET, signToken } from './testing.js';

function appWith(auth: ReturnType<typeof createAuthenticator>) {
  const app = new Hono<AppEnv>();
  app.onError(handleError);
  app.get('/p', requireAuth(auth), (c) => c.json(c.get('user')));
  return app;
}
const get = (app: ReturnType<typeof appWith>, authorization?: string) =>
  app.request('/p', authorization ? { headers: { Authorization: authorization } } : {});

describe('supabase auth', () => {
  const app = appWith(createSupabaseAuthenticator({ jwtSecret: JWT_SECRET }));

  it('accepts a valid token and exposes the user', async () => {
    const res = await get(app, `Bearer ${await signToken()}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ id: 'user-1', email: 'cook@example.com' });
  });

  it('rejects missing, malformed and non-bearer headers', async () => {
    for (const h of [undefined, 'Bearer', 'Basic abc', 'Bearer a b']) {
      const res = await get(app, h);
      expect(res.status).toBe(401);
      expect(res.headers.get('WWW-Authenticate')).toBe('Bearer');
    }
  });

  it('rejects garbage, wrong-secret and wrong-audience tokens', async () => {
    expect((await get(app, 'Bearer not.a.jwt')).status).toBe(401);
    expect(
      (await get(app, `Bearer ${await signToken({}, { secret: 'x'.repeat(40) })}`)).status,
    ).toBe(401);
    expect((await get(app, `Bearer ${await signToken({}, { aud: 'other' })}`)).status).toBe(401);
  });

  it('rejects alg=none tokens', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const none = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: 'x', aud: 'authenticated', exp: 9999999999 })}.`;
    expect((await get(app, `Bearer ${none}`)).status).toBe(401);
  });

  it('rejects expired tokens with a helpful message', async () => {
    const res = await get(
      app,
      `Bearer ${await signToken({}, { expiresIn: Math.floor(Date.now() / 1000) - 60 })}`,
    );
    expect(res.status).toBe(401);
    expect(await res.json()).toMatchObject({
      error: { code: 'unauthorized', message: 'Token expired' },
    });
  });

  it('enforces a case-insensitive email allowlist', async () => {
    const gated = appWith(
      createSupabaseAuthenticator({ jwtSecret: JWT_SECRET, allowedEmails: ['Cook@Example.com'] }),
    );
    expect((await get(gated, `Bearer ${await signToken()}`)).status).toBe(200);
    const other = await get(gated, `Bearer ${await signToken({ email: 'evil@example.com' })}`);
    expect(other.status).toBe(403);
    const noEmail = await get(gated, `Bearer ${await signToken({ email: undefined })}`);
    expect(noEmail.status).toBe(403);
  });

  it('rejects anonymous Supabase sessions', async () => {
    const res = await get(app, `Bearer ${await signToken({ is_anonymous: true })}`);
    expect(res.status).toBe(401);
  });

  it('rejects tokens without sub or exp, and tokens from another issuer', async () => {
    const issuer = appWith(
      createSupabaseAuthenticator({
        jwtSecret: JWT_SECRET,
        supabaseUrl: 'https://p.supabase.co',
        jwks: async () => {
          throw new Error('no jwks');
        },
      }),
    );
    // signToken sets no issuer, so an issuer-pinned verifier must refuse it.
    expect((await get(issuer, `Bearer ${await signToken()}`)).status).toBe(401);
    const { SignJWT } = await import('jose');
    const noExp = await new SignJWT({ email: 'cook@example.com' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject('u')
      .setAudience('authenticated')
      .sign(new TextEncoder().encode(JWT_SECRET));
    expect((await get(app, `Bearer ${noExp}`)).status).toBe(401);
  });

  it('refuses to build without any key material', () => {
    expect(() => createSupabaseAuthenticator({})).toThrow();
  });

  it('only accepts asymmetric algs when JWKS is configured', async () => {
    const hsOnly = appWith(createSupabaseAuthenticator({ jwtSecret: JWT_SECRET }));
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const es = `${b64({ alg: 'ES256' })}.${b64({ sub: 'x' })}.c2ln`;
    expect((await get(hsOnly, `Bearer ${es}`)).status).toBe(401);
  });
});

describe('dev auth', () => {
  const app = appWith(createDevAuthenticator('dev-token'));

  it('accepts the matching token only', async () => {
    expect((await get(app, 'Bearer dev-token')).status).toBe(200);
    expect((await get(app, 'bearer dev-token')).status).toBe(200);
    expect((await get(app, 'Bearer dev-tokeN')).status).toBe(401);
    expect((await get(app, 'Bearer dev-token-longer')).status).toBe(401);
    expect((await get(app)).status).toBe(401);
  });

  it('cannot satisfy an email allowlist', async () => {
    const gated = appWith(createDevAuthenticator('dev-token', ['a@b.com']));
    expect((await get(gated, 'Bearer dev-token')).status).toBe(403);
  });
});

describe('createAuthenticator', () => {
  it('refuses dev mode in production even if config was hand-built', () => {
    const cfg = loadConfig({ AUTH_MODE: 'dev', DEV_AUTH_TOKEN: 'dev-token' });
    expect(() => createAuthenticator({ ...cfg, isProduction: true })).toThrow(/forbidden/);
  });

  it('builds the right authenticator for each mode', async () => {
    const dev = createAuthenticator(loadConfig({ AUTH_MODE: 'dev', DEV_AUTH_TOKEN: 'dev-token' }));
    expect(await dev('dev-token')).toEqual({ id: 'dev' });
    const sb = createAuthenticator(loadConfig({ SUPABASE_JWT_SECRET: JWT_SECRET }));
    expect((await sb(await signToken())).id).toBe('user-1');
  });
});
