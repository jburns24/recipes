import { z } from 'zod';

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/**
 * Category is a non-empty ARRAY of lowercase slug segments forming a path,
 * e.g. ["dinner", "salad"]. Chosen over "a/b" strings so the tree index can be
 * built without string parsing and segments can never contain separators.
 * Serialize to a URL path with `categoryToPath`.
 */
export const CategorySchema = z.array(z.string().regex(slugPattern)).min(1);

export const IngredientGroupSchema = z.object({
  group: z.string().min(1).optional(),
  items: z.array(z.string().min(1)).min(1),
});

export const InstructionSchema = z.object({
  lead: z.string().min(1).optional(),
  text: z.string().min(1),
});

export const RecipeSchema = z.object({
  slug: z.string().regex(slugPattern),
  category: CategorySchema,
  title: z.string().min(1),
  subtitle: z.string().optional(),
  prepTime: z.string().optional(),
  cookTime: z.string().optional(),
  totalTime: z.string().optional(),
  serves: z.string().optional(),
  ingredients: z.array(IngredientGroupSchema),
  instructions: z.array(InstructionSchema),
  tips: z.array(z.string().min(1)),
  image: z.string().optional(),
  // http(s) only: the URL is rendered as a link, so `javascript:` etc. must never validate.
  source_url: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'must be an http(s) URL')
    .optional(),
});

export type Category = z.infer<typeof CategorySchema>;
export type IngredientGroup = z.infer<typeof IngredientGroupSchema>;
export type Instruction = z.infer<typeof InstructionSchema>;
export type Recipe = z.infer<typeof RecipeSchema>;

/** ["dinner","salad"] -> "dinner/salad" */
export const categoryToPath = (category: Category): string => category.join('/');

/** "dinner/salad" -> ["dinner","salad"] */
export const categoryFromPath = (path: string): Category =>
  CategorySchema.parse(path.split('/').filter(Boolean));
