import type { SupabaseClient } from '@supabase/supabase-js';
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

export const RECIPES_TABLE = 'recipes';
export const IMAGE_BUCKET = 'recipe-images';

/** Row shape in `public.recipes` (see supabase/migrations). */
export interface RecipeRow {
  slug: string;
  category: string[];
  title: string;
  /** Everything else from Recipe (times, ingredients, instructions, tips, image, ...). */
  body: Omit<Recipe, 'slug' | 'category' | 'title'>;
}

export function toRow(recipe: Recipe): RecipeRow {
  const { slug, category, title, ...body } = recipe;
  return { slug, category, title, body };
}

/** Rows come from the database: always re-validate. */
export function fromRow(row: RecipeRow): Recipe {
  return RecipeSchema.parse({
    ...row.body,
    slug: row.slug,
    category: row.category,
    title: row.title,
  });
}

const PG_UNIQUE_VIOLATION = '23505';

/** Supabase-backed store using a service-role client (bypasses RLS). */
export class SupabaseStore implements RecipeStore {
  constructor(
    private readonly client: SupabaseClient,
    private readonly options: { publicBaseUrl: string; bucket?: string },
  ) {}

  private get bucket(): string {
    return this.options.bucket ?? IMAGE_BUCKET;
  }

  async list(options: { category?: Category } = {}): Promise<Recipe[]> {
    let query = this.client.from(RECIPES_TABLE).select('slug, category, title, body');
    // `cs` = array contains; a category prefix is NOT a contains match on position,
    // so filter by containment in SQL and by prefix below.
    if (options.category) query = query.contains('category', options.category);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase list failed: ${error.message}`);
    const recipes = (data as RecipeRow[]).map(fromRow);
    const prefix = options.category;
    return sortRecipes(
      prefix ? recipes.filter((r) => hasCategoryPrefix(r.category, prefix)) : recipes,
    );
  }

  async getByPath(category: Category, slug: string): Promise<Recipe | null> {
    // `contains` narrows in SQL; the exact-equality check below makes it a precise match.
    const { data, error } = await this.client
      .from(RECIPES_TABLE)
      .select('slug, category, title, body')
      .eq('slug', slug)
      .contains('category', category);
    if (error) throw new Error(`Supabase get failed: ${error.message}`);
    const row = (data as RecipeRow[]).find((r) => r.category.join('/') === category.join('/'));
    return row ? fromRow(row) : null;
  }

  async create(input: Recipe): Promise<Recipe> {
    const recipe = RecipeSchema.parse(input);
    const { error } = await this.client.from(RECIPES_TABLE).insert(toRow(recipe));
    if (error) {
      if (error.code === PG_UNIQUE_VIOLATION)
        throw new RecipeConflictError(recipe.category, recipe.slug);
      throw new Error(`Supabase insert failed: ${error.message}`);
    }
    return recipe;
  }

  async upsert(input: Recipe): Promise<Recipe> {
    const recipe = RecipeSchema.parse(input);
    const { error } = await this.client
      .from(RECIPES_TABLE)
      .upsert(toRow(recipe), { onConflict: 'category,slug' });
    if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
    return recipe;
  }

  async saveImage(key: string, data: Uint8Array, contentType: string): Promise<string> {
    assertValidImageKey(key);
    const { error } = await this.client.storage
      .from(this.bucket)
      .upload(key, data, { contentType, upsert: true });
    if (error) throw new Error(`Supabase image upload failed: ${error.message}`);
    return key;
  }

  async getImage(key: string): Promise<StoredImage | null> {
    assertValidImageKey(key);
    const { data, error } = await this.client.storage.from(this.bucket).download(key);
    if (error || !data) return null;
    return {
      data: new Uint8Array(await data.arrayBuffer()),
      contentType: data.type || contentTypeForKey(key),
    };
  }

  imageUrl(key: string): string {
    const base = this.options.publicBaseUrl.replace(/\/+$/, '');
    return `${base}/storage/v1/object/public/${this.bucket}/${key}`;
  }
}
