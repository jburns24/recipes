# Recipe Site

## Disclaimer

**None of the recipes backed up in this repository are my own. They are simply recipes I have tried and liked, preserved here for personal use and convenience. All credit goes to the original authors and sources.**

## Purpose

A simple website to preserve and organize recipes I have used and liked. The intent is to create a backup of recipes, which may include content from other websites.

## Architecture

Svelte 5 + Vite single-page app (`web/`), Hono TypeScript API (`api/`), and a shared zod recipe schema (`shared/`), managed as npm workspaces and orchestrated with [Task](https://taskfile.dev). Bootstrap 5.3.2 provides the styling. Production data lives in Supabase; local development uses a flat JSON store (`data/recipes.json` plus `data/images/`).

See [AGENTS.md](AGENTS.md) for layout, conventions and the testing pyramid.

## Getting Started

Prerequisites: Node.js 20+, npm, [Task](https://taskfile.dev), Docker (optional).

```sh
npm install
task dev        # API on :3000, web on :5173
task build
task test:unit
task lint
```

Other tasks: `task test` (unit + Playwright e2e), `task seed`, `task docker` (local compose; see `docker-compose.yml`).

## Configuration

Copy `.env.example` to `.env`. `task dev` does not need Supabase: it uses `AUTH_MODE=dev` and the file store.

Production uses Supabase's publishable and secret keys. They are not JWTs and they replace the legacy `anon` and `service_role` keys:

- `SUPABASE_SERVICE_ROLE_KEY` — secret key (`sb_secret_...`), server only. The API and `task seed:supabase` send it on the `apikey` header, not as `Authorization: Bearer`.
- `VITE_SUPABASE_ANON_KEY` — publishable key (`sb_publishable_...`), baked into the web build. Same value as `SUPABASE_ANON_KEY`.
- User access tokens are verified with the project's JWKS (`$SUPABASE_URL/auth/v1/.well-known/jwks.json`). Leave `SUPABASE_JWT_SECRET` empty unless the project still signs those tokens with the legacy shared HS256 secret.

The frontend image reads `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` as Docker build-args. In GitHub Actions those come from repository variables of the same name.

## Status

The rewrite is in progress. The legacy static nginx site in `src/` is still present and will be archived once recipes are migrated into the data store. The old Copilot prompt workflows have been removed; recipe ingestion will be reintroduced through the new API.
