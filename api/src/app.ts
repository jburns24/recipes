import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import {
  RecipeSchema,
  categoryFromPath,
  categoryToPath,
  type Category,
  type Recipe,
} from '@recipes/shared';
import { requireAuth, type AppEnv, type Authenticator } from './auth.js';
import { HttpError, errorBody, handleError } from './errors.js';
import { ExtractedRecipeSchema, ExtractionError, type Extractor } from './extract/extractor.js';
import { IMAGE_EXTENSIONS, isAllowedImageType, sniffImageType } from './extract/image.js';
import { RecipeConflictError, assertValidImageKey, type RecipeStore } from './store/index.js';

export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;
/** Multipart framing overhead allowed on top of the file itself. */
const MULTIPART_OVERHEAD = 64 * 1024;
const MAX_SLUG_ATTEMPTS = 50;

export interface AppDeps {
  store: RecipeStore;
  auth: Authenticator;
  /** Absent => POST /api/extract answers 503. */
  extractor?: Extractor;
}

/** Recipe as sent to clients: `image` is a loadable URL (not a storage key); `path` is "cat/egory/slug". */
export type RecipeDto = Omit<Recipe, 'image'> & { image?: string; path: string };

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const { store, auth, extractor } = deps;
  const app = new Hono<AppEnv>();

  const toDto = (r: Recipe): RecipeDto => {
    const { image, ...rest } = r;
    return {
      ...rest,
      ...(image ? { image: store.imageUrl(image) } : {}),
      path: `${categoryToPath(r.category)}/${r.slug}`,
    };
  };

  app.onError(handleError);
  app.notFound((c) => c.json(errorBody('not_found', 'Not found'), 404));

  app.get('/api/health', (c) => c.json({ status: 'ok' }));

  app.get('/api/recipes', async (c) => {
    const raw = c.req.query('category');
    const category = raw ? categoryFromPath(raw) : undefined; // ZodError -> 400
    const recipes = await store.list(category ? { category } : {});
    return c.json(recipes.map(toDto));
  });

  app.get('/api/recipes/*', async (c) => {
    const segments = c.req.path
      .slice('/api/recipes/'.length)
      .split('/')
      .filter(Boolean)
      .map((s) => {
        try {
          return decodeURIComponent(s);
        } catch {
          return '';
        }
      });
    const slug = segments.pop();
    const parsed = RecipeSchema.shape.category.safeParse(segments);
    if (!slug || !parsed.success) throw new HttpError(404, 'not_found', 'Recipe not found');
    const recipe = await store.getByPath(parsed.data, slug);
    if (!recipe) throw new HttpError(404, 'not_found', 'Recipe not found');
    return c.json(toDto(recipe));
  });

  app.get('/api/images/*', async (c) => {
    let key: string;
    try {
      key = decodeURIComponent(c.req.path.slice('/api/images/'.length));
      assertValidImageKey(key);
    } catch {
      throw new HttpError(404, 'not_found', 'Image not found');
    }
    const image = await store.getImage(key);
    if (!image) throw new HttpError(404, 'not_found', 'Image not found');
    const contentType = image.contentType.startsWith('image/')
      ? image.contentType
      : 'application/octet-stream';
    return new Response(Buffer.from(image.data), {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(image.data.byteLength),
        'Cache-Control': 'public, max-age=86400',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });

  app.post(
    '/api/extract',
    requireAuth(auth),
    bodyLimit({
      maxSize: MAX_UPLOAD_BYTES + MULTIPART_OVERHEAD,
      onError: (c) => c.json(errorBody('payload_too_large', 'Upload too large (max 8MB)'), 413),
    }),
    async (c) => {
      if (!extractor) {
        throw new HttpError(503, 'extractor_unavailable', 'Recipe extraction is not configured');
      }
      let form: FormData;
      try {
        form = await c.req.formData();
      } catch {
        throw new HttpError(
          400,
          'invalid_form',
          'Expected multipart/form-data with an "image" file',
        );
      }
      const file = form.get('image');
      if (!(file instanceof File)) {
        throw new HttpError(400, 'missing_image', 'Missing "image" file field');
      }
      if (file.size === 0) throw new HttpError(400, 'empty_image', 'Image is empty');
      if (file.size > MAX_UPLOAD_BYTES) {
        throw new HttpError(413, 'payload_too_large', 'Image too large (max 8MB)');
      }
      const declared = file.type.toLowerCase();
      if (!isAllowedImageType(declared)) {
        throw new HttpError(415, 'unsupported_media_type', 'Image must be JPEG, PNG, WebP or GIF');
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (sniffImageType(bytes) !== declared) {
        throw new HttpError(415, 'image_type_mismatch', 'File contents do not match its type');
      }

      const existing = await store.list();
      const existingCategories = [...new Set(existing.map((r) => categoryToPath(r.category)))];

      let raw: unknown;
      try {
        raw = await extractor.extract({
          image: bytes,
          mediaType: declared,
          filename: file.name,
          existingCategories,
        });
      } catch (err) {
        if (err instanceof ExtractionError) {
          throw new HttpError(502, 'extraction_failed', err.message);
        }
        console.error('Extractor error:', err instanceof Error ? err.message : String(err));
        throw new HttpError(502, 'extraction_failed', 'Recipe extraction failed');
      }
      const extracted = ExtractedRecipeSchema.safeParse(raw);
      if (!extracted.success) {
        throw new HttpError(502, 'invalid_extraction', 'The model returned an invalid recipe');
      }

      // Slug uniqueness policy: suffix (-2, -3, ...) rather than 409, so a re-upload
      // of the same dish never fails. A concurrent create race is retried the same way.
      const base = extracted.data;
      const ext = IMAGE_EXTENSIONS[declared];
      for (let n = 1; n <= MAX_SLUG_ATTEMPTS; n++) {
        const slug = n === 1 ? base.slug : `${base.slug}-${n}`;
        if (await store.getByPath(base.category, slug)) continue;
        const image = `${categoryToPath(base.category as Category)}/${slug}.${ext}`;
        const candidate = RecipeSchema.parse({ ...base, slug, image });
        // Create first: a concurrent upload losing the slug race must not overwrite the
        // winner's image (keys derive from the slug). If the image then fails to store, fall
        // back to an image-less recipe rather than leaving a dangling image reference.
        let created: Recipe;
        try {
          created = await store.create(candidate);
        } catch (err) {
          if (err instanceof RecipeConflictError) continue;
          throw err;
        }
        try {
          await store.saveImage(image, bytes, declared);
        } catch (err) {
          console.error('Image save failed:', err instanceof Error ? err.message : String(err));
          const { image: _dropped, ...withoutImage } = created;
          created = await store.upsert(withoutImage);
        }
        return c.json(toDto(created), 201);
      }
      throw new HttpError(409, 'conflict', 'Could not find a free slug for this recipe');
    },
  );

  return app;
}
