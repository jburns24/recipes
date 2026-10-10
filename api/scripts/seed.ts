import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { convertAll, writeData } from '../src/seed/convert.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
// After phase 2 the legacy site lives in archive/; before that it is src/.
const routesDir =
  process.env['SEED_ROUTES_DIR'] ??
  [path.join(root, 'archive/routes'), path.join(root, 'src/routes')].find(existsSync);
const dataDir = process.env['DATA_DIR'] ?? path.join(root, 'data');

if (!routesDir) throw new Error('No legacy routes directory found (archive/routes or src/routes)');

const converted = await convertAll(routesDir);
await writeData(converted, dataDir);

for (const c of converted) {
  const id = `${c.recipe.category.join('/')}/${c.recipe.slug}`;
  const flags = [c.gaps.length ? `gaps: ${c.gaps.join(',')}` : '', c.overridden ? 'override' : '']
    .filter(Boolean)
    .join('; ');
  console.log(`${c.kind.padEnd(9)} ${id}${flags ? `  [${flags}]` : ''}`);
}
const by = (k: string): number => converted.filter((c) => c.kind === k).length;
console.log(
  `\nConverted ${converted.length} recipes (${by('templated')} templated, ${by('snapshot')} snapshots) -> ${path.relative(root, dataDir)}/`,
);
