import { createSupabaseFetch } from '@recipes/shared';
import { createClient, type Session, type SupabaseClient } from '@supabase/supabase-js';

export interface AuthState {
  /** 'dev' only ever happens under `vite dev`; production builds are always 'supabase'. */
  mode: 'dev' | 'supabase';
  ready: boolean;
  signedIn: boolean;
  email: string | null;
  error: string | null;
}

const DEV_KEY = 'recipes.dev-auth';

// import.meta.env.DEV is statically false in production builds, so the dev branch and the
// dev token are removed from the bundle.
const mode: 'dev' | 'supabase' =
  import.meta.env.DEV && import.meta.env.VITE_AUTH_MODE !== 'supabase' ? 'dev' : 'supabase';

export const auth = $state<AuthState>({
  mode,
  ready: false,
  signedIn: false,
  email: null,
  error: null,
});

let client: SupabaseClient | null = null;
let session: Session | null = null;

function applySession(s: Session | null): void {
  session = s;
  auth.signedIn = !!s;
  auth.email = s?.user.email ?? null;
}

function getClient(): SupabaseClient | null {
  if (client) return client;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    auth.error = 'Sign-in is not configured';
    return null;
  }
  // VITE_SUPABASE_ANON_KEY is the publishable key (`sb_publishable_…`). It is not a
  // JWT; the fetch wrapper keeps it on the apikey header only.
  client = createClient(url, key, { global: { fetch: createSupabaseFetch(key) } });
  return client;
}

/** Restore any existing session. Safe to call more than once. */
export async function initAuth(): Promise<void> {
  if (import.meta.env.DEV && auth.mode === 'dev') {
    try {
      auth.signedIn = localStorage.getItem(DEV_KEY) === '1';
    } catch {
      auth.signedIn = false;
    }
    auth.email = auth.signedIn ? 'dev@localhost' : null;
    auth.ready = true;
    return;
  }
  const c = await getClient();
  if (c) {
    const { data } = await c.auth.getSession();
    applySession(data.session);
    c.auth.onAuthStateChange((_event, s) => applySession(s));
  }
  auth.ready = true;
}

export async function signIn(): Promise<void> {
  auth.error = null;
  if (import.meta.env.DEV && auth.mode === 'dev') {
    try {
      localStorage.setItem(DEV_KEY, '1');
    } catch {
      /* storage unavailable: session lasts until reload */
    }
    auth.signedIn = true;
    auth.email = 'dev@localhost';
    return;
  }
  const c = await getClient();
  if (!c) return;
  const { error } = await c.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + window.location.pathname },
  });
  if (error) auth.error = error.message;
}

export async function signOut(): Promise<void> {
  if (import.meta.env.DEV && auth.mode === 'dev') {
    try {
      localStorage.removeItem(DEV_KEY);
    } catch {
      /* ignore */
    }
    auth.signedIn = false;
    auth.email = null;
    return;
  }
  if (client) await client.auth.signOut();
  applySession(null);
}

/** Bearer token for API calls, or null when signed out. */
export async function getToken(): Promise<string | null> {
  if (!auth.signedIn) return null;
  if (import.meta.env.DEV && auth.mode === 'dev') {
    return import.meta.env.VITE_DEV_AUTH_TOKEN || 'dev-token';
  }
  if (client) {
    const { data } = await client.auth.getSession();
    session = data.session;
  }
  return session?.access_token ?? null;
}
