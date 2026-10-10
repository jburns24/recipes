# E2E (Playwright, chromium)

`task test:e2e` starts the API (:3101, file store on a temp copy of `data/`, dev auth, stub
extractor) and `vite dev` (:5273) via `playwright.config.ts`, then runs `tests/`.

- `tests/browse.spec.ts`, `tests/upload.spec.ts`: critical flows.
- `tests/visual.spec.ts`: compares recipe pages (and the top 225px of the index) with PNGs of the
  OLD site in `baselines/` (threshold `maxDiffPixelRatio` 0.01, toolbar hidden). Baselines are macOS
  renders, so the suite is skipped on other platforms unless `E2E_VISUAL=1`. The
  `index-*-clip.png` files are the top 225px of `index-*.png`. Do not regenerate baselines.
