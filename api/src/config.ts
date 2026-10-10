import { z } from 'zod';

type Env = Record<string, string | undefined>;

/** Treat empty strings (`FOO=` in .env files) as unset. */
const opt = z.preprocess((v) => (v === '' ? undefined : v), z.string().optional());

const EnvSchema = z.object({
  NODE_ENV: opt,
  PORT: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.coerce.number().int().min(0).max(65535).default(3000),
  ),
  AUTH_MODE: z.preprocess(
    (v) => (v === '' ? undefined : v),
    z.enum(['supabase', 'dev']).default('supabase'),
  ),
  DEV_AUTH_TOKEN: opt,
  SUPABASE_URL: opt,
  SUPABASE_JWT_SECRET: opt,
  ALLOWED_EMAILS: opt,
  ANTHROPIC_API_KEY: opt,
  CLAUDE_STUB: opt,
});

export interface Config {
  isProduction: boolean;
  port: number;
  authMode: 'supabase' | 'dev';
  devAuthToken?: string;
  supabaseUrl?: string;
  supabaseJwtSecret?: string;
  /** Lower-cased. Empty means "any authenticated user". */
  allowedEmails: string[];
  anthropicApiKey?: string;
  claudeStub: boolean;
}

export const MIN_DEV_TOKEN_LENGTH = 8;

/**
 * Parse and cross-validate environment config. Throws on anything unsafe or
 * incomplete so the server fails at startup rather than running open:
 *  - AUTH_MODE=dev with NODE_ENV=production
 *  - AUTH_MODE=dev without DEV_AUTH_TOKEN (>= 8 chars)
 *  - AUTH_MODE=supabase (the default) without SUPABASE_URL (JWKS) or a legacy SUPABASE_JWT_SECRET
 *  - NODE_ENV=production with AUTH_MODE=supabase and an empty ALLOWED_EMAILS (any Google
 *    account could otherwise upload and spend Anthropic credits)
 *  - CLAUDE_STUB enabled with NODE_ENV=production
 */
export function loadConfig(env: Env = process.env): Config {
  const e = EnvSchema.parse(env);
  const isProduction = e.NODE_ENV === 'production';

  if (e.AUTH_MODE === 'dev') {
    if (isProduction) throw new Error('AUTH_MODE=dev is forbidden when NODE_ENV=production');
    if (!e.DEV_AUTH_TOKEN || e.DEV_AUTH_TOKEN.length < MIN_DEV_TOKEN_LENGTH) {
      throw new Error(`AUTH_MODE=dev requires DEV_AUTH_TOKEN (min ${MIN_DEV_TOKEN_LENGTH} chars)`);
    }
  } else if (!e.SUPABASE_URL && !e.SUPABASE_JWT_SECRET) {
    // Asymmetric signing keys (the current Supabase default) verify via JWKS at
    // SUPABASE_URL and do not have a SUPABASE_JWT_SECRET. The secret is only for
    // legacy HS256 projects.
    throw new Error('AUTH_MODE=supabase requires SUPABASE_URL (JWKS) and/or SUPABASE_JWT_SECRET');
  }

  const allowedEmails = (e.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (isProduction && e.AUTH_MODE === 'supabase' && allowedEmails.length === 0) {
    throw new Error('ALLOWED_EMAILS is required when NODE_ENV=production');
  }

  const claudeStub = e.CLAUDE_STUB === '1' || e.CLAUDE_STUB?.toLowerCase() === 'true';
  if (claudeStub && isProduction) {
    throw new Error('CLAUDE_STUB is forbidden when NODE_ENV=production');
  }

  return {
    isProduction,
    port: e.PORT,
    authMode: e.AUTH_MODE,
    devAuthToken: e.DEV_AUTH_TOKEN,
    supabaseUrl: e.SUPABASE_URL?.replace(/\/+$/, ''),
    supabaseJwtSecret: e.SUPABASE_JWT_SECRET,
    allowedEmails,
    anthropicApiKey: e.ANTHROPIC_API_KEY,
    claudeStub,
  };
}
