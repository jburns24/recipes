import { rmSync } from 'node:fs';

export default function globalTeardown(): void {
  const dir = process.env['E2E_DATA_DIR'];
  if (dir && dir.includes('recipes-e2e-')) rmSync(dir, { recursive: true, force: true });
}
