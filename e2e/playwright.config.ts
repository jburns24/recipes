import { cpSync, mkdirSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, devices } from '@playwright/test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Non-default ports so a running `task dev` (3000/5173) does not clash.
const API_PORT = 3101;
const WEB_PORT = 5273;
const BASE_URL = `http://localhost:${WEB_PORT}`;

// Tests run against a throwaway copy of data/, never the repo's own. The config is loaded once
// in the main process before workers start, so the env var is inherited by all of them.
if (!process.env['E2E_DATA_DIR']) {
  const dir = mkdtempSync(path.join(tmpdir(), 'recipes-e2e-'));
  cpSync(path.join(root, 'data', 'recipes.json'), path.join(dir, 'recipes.json'));
  mkdirSync(path.join(dir, 'images'), { recursive: true });
  cpSync(path.join(root, 'data', 'images'), path.join(dir, 'images'), { recursive: true });
  process.env['E2E_DATA_DIR'] = dir;
}
const dataDir = process.env['E2E_DATA_DIR'];

export default defineConfig({
  testDir: './tests',
  // The upload tests mutate the shared temp store, so run serially.
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env['CI'],
  retries: process.env['CI'] ? 1 : 0,
  reporter: process.env['CI'] ? [['list'], ['html', { open: 'never' }]] : 'list',
  globalTeardown: './global-teardown.ts',
  // Visual baselines are PNGs of the OLD site, compared directly (never auto-updated).
  snapshotPathTemplate: '{testDir}/../baselines/{arg}{ext}',
  use: { baseURL: BASE_URL, trace: 'retain-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run dev -w api',
      cwd: root,
      url: `http://localhost:${API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        NODE_ENV: 'test',
        PORT: String(API_PORT),
        STORE: 'file',
        DATA_DIR: dataDir ?? '',
        AUTH_MODE: 'dev',
        DEV_AUTH_TOKEN: 'dev-token',
        CLAUDE_STUB: '1',
      },
    },
    {
      // `vite dev` (not preview): dev sign-in is stripped from production builds.
      command: `npm run dev -w web -- --port ${WEB_PORT} --strictPort`,
      cwd: root,
      url: BASE_URL,
      reuseExistingServer: false,
      timeout: 60_000,
      env: {
        API_URL: `http://localhost:${API_PORT}`,
        VITE_AUTH_MODE: 'dev',
        VITE_DEV_AUTH_TOKEN: 'dev-token',
      },
    },
  ],
});
