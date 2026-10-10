import type { ApiErrorBody, RecipeDto } from './types';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const isErrorBody = (v: unknown): v is ApiErrorBody =>
  typeof v === 'object' &&
  v !== null &&
  'error' in v &&
  typeof (v as { error: unknown }).error === 'object' &&
  (v as { error: object | null }).error !== null &&
  typeof (v as ApiErrorBody).error.message === 'string';

async function parse<T>(res: Response): Promise<T> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  if (!res.ok) {
    if (isErrorBody(body)) throw new ApiError(res.status, body.error.code, body.error.message);
    throw new ApiError(res.status, 'http_error', `Request failed (${res.status})`);
  }
  return body as T;
}

const network = (err: unknown): never => {
  if (err instanceof ApiError) throw err;
  throw new ApiError(0, 'network_error', 'Could not reach the server');
};

export async function fetchRecipes(): Promise<RecipeDto[]> {
  try {
    return await parse<RecipeDto[]>(await fetch('/api/recipes'));
  } catch (err) {
    return network(err);
  }
}

export async function fetchRecipe(path: string): Promise<RecipeDto> {
  try {
    const encoded = path.split('/').map(encodeURIComponent).join('/');
    return await parse<RecipeDto>(await fetch(`/api/recipes/${encoded}`));
  } catch (err) {
    return network(err);
  }
}

export async function extractRecipe(image: File, token: string): Promise<RecipeDto> {
  const form = new FormData();
  form.append('image', image);
  try {
    return await parse<RecipeDto>(
      await fetch('/api/extract', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      }),
    );
  } catch (err) {
    return network(err);
  }
}
