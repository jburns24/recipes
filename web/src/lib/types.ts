import type { Recipe } from '@recipes/shared';

/** Recipe as served by the API: `image` is a URL, `path` is "cat/egory/slug". */
export type RecipeDto = Omit<Recipe, 'image'> & { image?: string; path: string };

export interface ApiErrorBody {
  error: { code: string; message: string };
}
