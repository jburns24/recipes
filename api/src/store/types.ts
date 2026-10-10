import type { Category, Recipe } from '@recipes/shared';

export interface StoredImage {
  data: Uint8Array;
  contentType: string;
}

export class RecipeConflictError extends Error {
  constructor(category: Category, slug: string) {
    super(`Recipe already exists: ${category.join('/')}/${slug}`);
    this.name = 'RecipeConflictError';
  }
}

/**
 * Persistence boundary for recipes and their images. All methods are async so
 * the file and Supabase implementations are interchangeable.
 *
 * Images are addressed by a storage KEY (`Recipe.image`), e.g.
 * "dinner/quick/meatloaf.jpg". Use `imageUrl(key)` to get a browser-loadable URL.
 */
export interface RecipeStore {
  /** All recipes, sorted by category path then slug. Optional category prefix filter. */
  list(options?: { category?: Category }): Promise<Recipe[]>;
  getByPath(category: Category, slug: string): Promise<Recipe | null>;
  /** Insert a validated recipe. Throws RecipeConflictError if (category, slug) exists. */
  create(recipe: Recipe): Promise<Recipe>;
  /** Insert or replace by (category, slug). Used by seeding. */
  upsert(recipe: Recipe): Promise<Recipe>;
  /** Store image bytes under `key` (overwrites). Returns the key. */
  saveImage(key: string, data: Uint8Array, contentType: string): Promise<string>;
  getImage(key: string): Promise<StoredImage | null>;
  /**
   * Public URL for an image key. File store: `/api/images/<key>` (served by the
   * API). Supabase: the bucket's public object URL.
   */
  imageUrl(key: string): string;
}

export const sortRecipes = (recipes: Recipe[]): Recipe[] =>
  [...recipes].sort((a, b) =>
    `${a.category.join('/')}/${a.slug}`.localeCompare(`${b.category.join('/')}/${b.slug}`),
  );

export const hasCategoryPrefix = (category: Category, prefix: Category): boolean =>
  prefix.length <= category.length && prefix.every((seg, i) => category[i] === seg);

const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

export const contentTypeForKey = (key: string): string =>
  CONTENT_TYPES[key.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream';

/** Reject path traversal / odd keys. Keys are slash-separated kebab paths + extension. */
export function assertValidImageKey(key: string): void {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*\.[a-z0-9]+$/.test(key)) {
    throw new Error(`Invalid image key: ${key}`);
  }
}
