# AGENTS.md - JB's Kitchen

Personal recipe backup site. Svelte 5 + Vite SPA, Hono TS API, shared zod schema, npm workspaces, Taskfile.
Recipes are not mine; see the disclaimer in README.md.

## Layout

- `shared/` - `@recipes/shared`: zod `RecipeSchema` + types (`src/recipe.ts`). Single source of truth. Also the new-format Supabase key helper (`src/supabase-key.ts`): `sb_publishable_` / `sb_secret_` keys stay on the `apikey` header and are never sent as Bearer tokens.
- `api/` - `@recipes/api`: Hono app factory `createApp({store, auth, extractor})` (`src/app.ts`), env parsing (`src/config.ts`), auth (`src/auth.ts`), recipe-from-image extractor (`src/extract/`), Node entry (`src/server.ts`, PORT default 3000).
- `web/` - `@recipes/web`: Svelte 5 SPA (Vite). Bootstrap 5.3.2 stays so the look is unchanged (markup/classes copied from `archive/`).
  - `src/App.svelte` (routes + loading/error/404), `src/lib/` (`router.svelte.ts` history-API router with legacy `.html` redirect, `auth.svelte.ts`, `api.ts`, `tree.ts`), `src/components/` (`Layout`, `IndexTree`, `RecipePage`, `UploadDialog`, `AuthButton`, `StatusMessage`).
  - Auth: `VITE_AUTH_MODE=dev|supabase`. Dev login (token `dev-token`) exists only under `vite dev` (`import.meta.env.DEV`), it is stripped from production builds. Prod uses Supabase Google OAuth (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`). `VITE_SUPABASE_ANON_KEY` is the publishable key (`sb_publishable_…`), not a JWT. Only the upload button is gated.
  - Hosting must fall back to `index.html` for unknown paths (SPA, URLs are `/routes/<cat>/<slug>`).
- `e2e/` - Playwright (chromium) tests; config starts API (:3101, temp copy of `data/`, dev auth, stub extractor) + `vite dev` (:5273). `e2e/baselines/` holds PNGs of the OLD site (1280x900 and 390x844) used for visual regression (macOS-only, skipped elsewhere unless `E2E_VISUAL=1`; `index-*-clip.png` = cropped top of the index); the toolbar is hidden via `hide-toolbar.css`. Never regenerate baselines.
- `docker/` - `backend.Dockerfile` (esbuild bundle, `node server.mjs`), `frontend.Dockerfile` + `nginx.conf` + `security-headers.conf` (SPA fallback, legacy `.html` 301, `/api` proxy, CSP/security headers). `docker-compose.yml` is local-only (file store + dev auth).
- `.github/workflows/` - `ci.yaml` (PR gate: `task lint`, unit, e2e), `release.yaml` (master push -> tags `backend/vX.Y.Z`, `frontend/vX.Y.Z` via `.github/scripts/next-tag.sh`), `docker.yaml` ("Docker Build and Push" -> `ghcr.io/<owner>/recipes-backend|recipes-frontend`).
- `data/` - local store: `recipes.json` (tracked seed) and `data/images/` (gitignored). Prod uses Supabase.
- `archive/` - the legacy static site (old `src/`), kept only as input for `task seed` and phase 4 screenshot comparison. Do not edit; excluded from Docker/eslint/prettier.
- `supabase/migrations/` - SQL for the recipes table, RLS and the `recipe-images` bucket.
- `.github/prompts/examples/` - kept for the image-to-recipe flow.

## Commands (always via Taskfile)

- `task dev` - API (:3000) + web (:5173, proxies /api). Defaults: AUTH_MODE=dev, DEV_AUTH_TOKEN=dev-token, STORE=file, CLAUDE_STUB=1 if ANTHROPIC_API_KEY is unset
- `task build` - build all workspaces
- `task test` / `task test:unit` - vitest in every workspace
- `task test:e2e` - seeds data, installs chromium, runs Playwright. `task test` = unit + e2e
- `task lint` - eslint, prettier --check, typecheck. Run before declaring any task done; never use `any`/`@ts-ignore` to silence errors.
- `task seed` - archive/ -> data/recipes.json + data/images/ (idempotent)
- `task seed:supabase` - push data/ into Supabase (needs SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- `task docker` - `docker compose up --build` (web :8080, api :3000; local dev auth only; the prod frontend has no dev sign-in, use curl with `Bearer dev-token`). `task docker:build` builds both images

## Data

- `RecipeStore` (`api/src/store/`): `FileStore` (STORE=file, default, `data/`) and `SupabaseStore` (STORE=supabase). `createStore(env)` picks one.
- `Recipe.image` is a storage key like `dinner/quick/meatloaf.jpg`; resolve with `store.imageUrl(key)`.
- Migration hand fixes live in `api/src/seed/overrides.ts`.

## API

- Public: `GET /api/health`, `/api/recipes[?category=a/b]`, `/api/recipes/<category...>/<slug>`, `/api/images/<key>`. Recipes carry `image` as a URL plus `path`.
- `POST /api/extract` (multipart field `image`, max 8MB, jpeg/png/webp/gif checked by magic bytes) needs `Authorization: Bearer <token>`. Returns 201 + recipe; duplicate slugs get `-2`, `-3` suffixes.
- Errors are always `{error: {code, message, details?}}`. Env vars: see `.env.example`.
- Fail closed: dev auth and `CLAUDE_STUB` throw at startup when `NODE_ENV=production`; supabase auth without `SUPABASE_URL` (JWKS) or a legacy `SUPABASE_JWT_SECRET` throws; production also requires `ALLOWED_EMAILS`. JWKS-only auth (no `SUPABASE_JWT_SECRET`) is the production path for asymmetric signing keys. Anonymous Supabase sessions are rejected. Supabase RLS is read-only for clients: all writes use the API service role (`SUPABASE_SERVICE_ROLE_KEY`, an `sb_secret_…` key or a legacy service_role JWT).
- Claude Sonnet 5.5 rejects forced `tool_choice`, so the extractor uses `auto` + prompt and zod-validates the output.

## Conventions

- TypeScript strict, ESM only. Relative imports use `.js` extensions in api/shared.
- Prettier: single quotes, width 100. ESLint flat config at root.
- Recipe `category` is a non-empty array of slug segments (`["dinner","salad"]`),
  not a string. Use `categoryToPath` / `categoryFromPath` for `a/b` form.
- Validate all external data (API input, JSON store, Supabase rows) with `RecipeSchema`.
- Let tools generate lockfiles/manifests; do not hand-write `package-lock.json`.
- Wrap CLIs in Taskfile tasks rather than documenting raw commands.
- Do not commit unless asked. Use conventional commits.

## Testing pyramid

1. Unit (many): vitest per workspace, colocated `*.test.ts`. Schema, store, route handlers via `app.request()`.
2. Component/integration (some): vitest for web components, API against the file store.
3. E2E (few): Playwright against the full stack with the local file store.

## Phases

1 foundation (done), 2 data layer + migration of `src/`, 3 API, 4 frontend (done), 5 E2E + CI, 6 hardening.
