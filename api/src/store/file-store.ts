import { promises as fs } from 'node:fs';
import path from 'node:path';
import { RecipeSchema, type Category, type Recipe } from '@recipes/shared';
import {
  RecipeConflictError,
  assertValidImageKey,
  contentTypeForKey,
  hasCategoryPrefix,
  sortRecipes,
  type RecipeStore,
  type StoredImage,
} from './types.js';

const sameRecipe = (r: Recipe, category: Category, slug: string): boolean =>
  r.slug === slug && r.category.join('/') === category.join('/');

/**
 * Local store: `<dir>/recipes.json` (array of Recipe) and `<dir>/images/<key>`.
 * Writes are serialized and atomic (tmp file + rename).
 */
export class FileStore implements RecipeStore {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly dir: string,
    private readonly imageBaseUrl = '/api/images',
  ) {}

  private get file(): string {
    return path.join(this.dir, 'recipes.json');
  }

  private async read(): Promise<Recipe[]> {
    let raw: string;
    try {
      raw = await fs.readFile(this.file, 'utf8');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return [];
      throw err;
    }
    return RecipeSchema.array().parse(JSON.parse(raw));
  }

  private async write(recipes: Recipe[]): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(sortRecipes(recipes), null, 2) + '\n');
    await fs.rename(tmp, this.file);
  }

  /** Run a read-modify-write cycle one at a time. */
  private mutate<T>(
    fn: (recipes: Recipe[]) => Promise<{ recipes: Recipe[]; result: T }>,
  ): Promise<T> {
    const run = this.queue.then(async () => {
      const { recipes, result } = await fn(await this.read());
      await this.write(recipes);
      return result;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }

  async list(options: { category?: Category } = {}): Promise<Recipe[]> {
    const all = sortRecipes(await this.read());
    const prefix = options.category;
    return prefix ? all.filter((r) => hasCategoryPrefix(r.category, prefix)) : all;
  }

  async getByPath(category: Category, slug: string): Promise<Recipe | null> {
    return (await this.read()).find((r) => sameRecipe(r, category, slug)) ?? null;
  }

  async create(input: Recipe): Promise<Recipe> {
    const recipe = RecipeSchema.parse(input);
    return this.mutate(async (recipes) => {
      if (recipes.some((r) => sameRecipe(r, recipe.category, recipe.slug))) {
        throw new RecipeConflictError(recipe.category, recipe.slug);
      }
      return { recipes: [...recipes, recipe], result: recipe };
    });
  }

  async upsert(input: Recipe): Promise<Recipe> {
    const recipe = RecipeSchema.parse(input);
    return this.mutate(async (recipes) => ({
      recipes: [...recipes.filter((r) => !sameRecipe(r, recipe.category, recipe.slug)), recipe],
      result: recipe,
    }));
  }

  private imagePath(key: string): string {
    assertValidImageKey(key);
    return path.join(this.dir, 'images', ...key.split('/'));
  }

  async saveImage(key: string, data: Uint8Array, _contentType: string): Promise<string> {
    const target = this.imagePath(key);
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.writeFile(target, data);
    return key;
  }

  async getImage(key: string): Promise<StoredImage | null> {
    try {
      const data = await fs.readFile(this.imagePath(key));
      return { data, contentType: contentTypeForKey(key) };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
      throw err;
    }
  }

  imageUrl(key: string): string {
    return `${this.imageBaseUrl}/${key}`;
  }
}
