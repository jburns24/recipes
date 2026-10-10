/// <reference types="svelte" />
/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** `dev` (local only, ignored in production builds) or `supabase`. Defaults to dev under `vite dev`. */
  readonly VITE_AUTH_MODE?: 'dev' | 'supabase';
  readonly VITE_DEV_AUTH_TOKEN?: string;
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}
