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

## Status

The rewrite is in progress. The legacy static nginx site in `src/` is still present and will be archived once recipes are migrated into the data store. The old Copilot prompt workflows have been removed; recipe ingestion will be reintroduced through the new API.
