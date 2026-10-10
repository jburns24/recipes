import { createHash, timingSafeEqual } from 'node:crypto';
import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { createMiddleware } from 'hono/factory';
import type { Config } from './config.js';
import { HttpError } from './errors.js';

export interface AuthUser {
  id: string;
  email?: string;
}

/** Verifies a bearer token. Throws HttpError(401|403) on failure. */
export type Authenticator = (token: string) => Promise<AuthUser>;

export type AppEnv = { Variables: { user: AuthUser } };

const sha256 = (s: string): Buffer => createHash('sha256').update(s).digest();

/** Constant-time string equality (hashes first so lengths do not leak). */
export const safeEqual = (a: string, b: string): boolean => timingSafeEqual(sha256(a), sha256(b));

const unauthorized = (message = 'Invalid or missing credentials'): HttpError =>
  new HttpError(401, 'unauthorized', message);

export function isEmailAllowed(email: string | undefined, allowed: string[]): boolean {
  if (allowed.length === 0) return true;
  return email !== undefined && allowed.includes(email.trim().toLowerCase());
}

export function createDevAuthenticator(token: string, allowedEmails: string[] = []): Authenticator {
  return async (presented) => {
    if (!safeEqual(presented, token)) throw unauthorized();
    // Dev tokens carry no identity; an allowlist cannot be satisfied by them.
    if (allowedEmails.length > 0) {
      throw new HttpError(403, 'forbidden', 'Account is not allowed');
    }
    return { id: 'dev' };
  };
}

export interface SupabaseAuthOptions {
  jwtSecret?: string;
  supabaseUrl?: string;
  allowedEmails?: string[];
  /** Test seam: override JWKS key resolver. */
  jwks?: JWTVerifyGetKey;
}

/**
 * Supabase access-token verification. HS256 tokens verify against
 * SUPABASE_JWT_SECRET; asymmetric (ES256/RS256) tokens against the project's
 * JWKS when SUPABASE_URL is set. Algorithms are pinned by key availability, so
 * `alg: none` and key-confusion tokens are rejected.
 */
export function createSupabaseAuthenticator(opts: SupabaseAuthOptions): Authenticator {
  const secret = opts.jwtSecret ? new TextEncoder().encode(opts.jwtSecret) : undefined;
  const base = opts.supabaseUrl?.replace(/\/+$/, '');
  const jwks =
    opts.jwks ??
    (base ? createRemoteJWKSet(new URL(`${base}/auth/v1/.well-known/jwks.json`)) : undefined);
  if (!secret && !jwks) {
    throw new Error('Supabase auth needs SUPABASE_JWT_SECRET and/or SUPABASE_URL');
  }
  const allowed = (opts.allowedEmails ?? []).map((e) => e.toLowerCase());

  const getKey: JWTVerifyGetKey = async (header, token) => {
    if (header.alg === 'HS256' && secret) return secret;
    if ((header.alg === 'ES256' || header.alg === 'RS256') && jwks) return jwks(header, token);
    throw new joseErrors.JOSEAlgNotAllowed('Algorithm not allowed');
  };

  return async (token) => {
    let payload;
    try {
      ({ payload } = await jwtVerify(token, getKey, {
        algorithms: ['HS256', 'ES256', 'RS256'],
        audience: 'authenticated',
        ...(base ? { issuer: `${base}/auth/v1` } : {}),
        requiredClaims: ['sub', 'exp'],
      }));
    } catch (err) {
      if (err instanceof joseErrors.JWTExpired) throw unauthorized('Token expired');
      throw unauthorized();
    }
    // Supabase anonymous sign-ins mint valid `authenticated` tokens with no identity.
    if (payload['is_anonymous'] === true) throw unauthorized('Anonymous sessions are not allowed');
    const email = typeof payload['email'] === 'string' ? payload['email'] : undefined;
    if (!isEmailAllowed(email, allowed)) {
      throw new HttpError(403, 'forbidden', 'Account is not allowed');
    }
    return { id: String(payload.sub), ...(email ? { email } : {}) };
  };
}

/** Build the authenticator for a validated config. Refuses dev mode in production. */
export function createAuthenticator(config: Config): Authenticator {
  if (config.authMode === 'dev') {
    if (config.isProduction) throw new Error('AUTH_MODE=dev is forbidden when NODE_ENV=production');
    if (!config.devAuthToken) throw new Error('AUTH_MODE=dev requires DEV_AUTH_TOKEN');
    return createDevAuthenticator(config.devAuthToken, config.allowedEmails);
  }
  return createSupabaseAuthenticator({
    jwtSecret: config.supabaseJwtSecret,
    supabaseUrl: config.supabaseUrl,
    allowedEmails: config.allowedEmails,
  });
}

/** Require `Authorization: Bearer <token>`; sets `c.get('user')`. */
export const requireAuth = (authenticate: Authenticator) =>
  createMiddleware<AppEnv>(async (c, next) => {
    const match = /^Bearer\s+(\S+)$/i.exec(c.req.header('Authorization') ?? '');
    if (!match?.[1]) {
      c.header('WWW-Authenticate', 'Bearer');
      throw unauthorized();
    }
    try {
      c.set('user', await authenticate(match[1]));
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) c.header('WWW-Authenticate', 'Bearer');
      throw err;
    }
    await next();
  });
