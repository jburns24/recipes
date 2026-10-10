import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { RecipeSchema, categoryToPath, type Recipe } from '@recipes/shared';
import { parseTemplatedPage } from './templated.js';
import { parseSnapshot, type ExtractedImage } from './snapshot.js';
import { overrides, type Override } from './overrides.js';

export interface ConvertedRecipe {
  recipe: Recipe;
  image?: { key: string; data: Buffer };
  /** Human-readable gaps found by the parser (before overrides were applied). */
  gaps: string[];
  overridden: boolean;
  kind: 'templated' | 'snapshot';
}

const SEED_ASSETS = fileURLToPath(new URL('../../seed-assets', import.meta.url));
const SNAPSHOT_THRESHOLD = 100_000;

async function walk(dir: string): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(full)));
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out.sort();
}

function gapsOf(r: Partial<Recipe>, hasImage: boolean): string[] {
  const gaps: string[] = [];
  if (!r.title) gaps.push('title');
  if (!r.ingredients?.length) gaps.push('ingredients');
  if (!r.instructions?.length) gaps.push('instructions');
  if (!hasImage) gaps.push('image');
  return gaps;
}

function applyOverride(base: Partial<Recipe>, o: Override | undefined): Partial<Recipe> {
  return o?.patch ? { ...base, ...o.patch } : base;
}

/** Convert one legacy html file. `rel` is the path under routes/, e.g. dinner/quick/meatloaf.html */
export async function convertFile(file: string, rel: string): Promise<ConvertedRecipe> {
  const parts = rel.replace(/\.html$/, '').split(path.sep);
  const slug = parts.pop() as string;
  const category = parts;
  const id = [...category, slug].join('/');
  const override = overrides[id];
  const html = await fs.readFile(file, 'utf8');
  const isSnapshot =
    html.length > SNAPSHOT_THRESHOLD || html.includes('Page saved with SingleFile');

  let parsed: Partial<Recipe>;
  let extracted: ExtractedImage | undefined;
  if (isSnapshot) {
    const r = parseSnapshot(html, override?.imageMatch ? { imageMatch: override.imageMatch } : {});
    parsed = r.recipe;
    extracted = r.image;
  } else {
    const r = parseTemplatedPage(html);
    parsed = r.recipe;
    if (r.imageSrc && !/^(https?:|data:)/.test(r.imageSrc)) {
      const imgPath = path.resolve(path.dirname(file), r.imageSrc);
      const data = await fs.readFile(imgPath);
      extracted = { data, ext: path.extname(imgPath).slice(1).toLowerCase(), note: r.imageSrc };
    }
  }

  if (!extracted && override?.imageFile) {
    const file = path.join(SEED_ASSETS, override.imageFile);
    extracted = {
      data: await fs.readFile(file),
      ext: path.extname(file).slice(1).toLowerCase(),
      note: override.imageFile,
    };
  }

  const gaps = gapsOf(parsed, Boolean(extracted));
  const merged = applyOverride(parsed, override);
  const key = extracted ? `${[...category, slug].join('/')}.${extracted.ext}` : undefined;
  const recipe = RecipeSchema.parse({
    ...merged,
    slug,
    category,
    ...(key ? { image: key } : {}),
  });
  return {
    recipe,
    ...(extracted && key ? { image: { key, data: extracted.data } } : {}),
    gaps,
    overridden: Boolean(override),
    kind: isSnapshot ? 'snapshot' : 'templated',
  };
}

export async function convertAll(routesDir: string): Promise<ConvertedRecipe[]> {
  const files = await walk(routesDir);
  const out: ConvertedRecipe[] = [];
  for (const file of files) out.push(await convertFile(file, path.relative(routesDir, file)));
  out.sort((a, b) =>
    (categoryToPath(a.recipe.category) + '/' + a.recipe.slug).localeCompare(
      categoryToPath(b.recipe.category) + '/' + b.recipe.slug,
    ),
  );
  return out;
}

/** Write recipes.json + images under dataDir. Idempotent: rewrites only changed files. */
export async function writeData(converted: ConvertedRecipe[], dataDir: string): Promise<void> {
  await fs.mkdir(path.join(dataDir, 'images'), { recursive: true });
  const writeIfChanged = async (file: string, data: Buffer | string): Promise<void> => {
    const buf = typeof data === 'string' ? Buffer.from(data) : data;
    const existing = await fs.readFile(file).catch(() => undefined);
    if (existing && existing.equals(buf)) return;
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, buf);
  };
  for (const c of converted) {
    if (c.image) await writeIfChanged(path.join(dataDir, 'images', c.image.key), c.image.data);
  }
  await pruneImages(
    path.join(dataDir, 'images'),
    new Set(converted.flatMap((c) => (c.image ? [c.image.key] : []))),
  );
  const json = JSON.stringify(
    converted.map((c) => c.recipe),
    null,
    2,
  );
  await writeIfChanged(path.join(dataDir, 'recipes.json'), json + '\n');
}

/** Remove files under imagesDir that no recipe references (keeps re-runs idempotent). */
async function pruneImages(imagesDir: string, keep: Set<string>): Promise<void> {
  const visit = async (dir: string): Promise<void> => {
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        await visit(full);
        if (!(await fs.readdir(full)).length) await fs.rmdir(full);
      } else if (!keep.has(path.relative(imagesDir, full).split(path.sep).join('/'))) {
        await fs.rm(full);
      }
    }
  };
  await visit(imagesDir);
}
