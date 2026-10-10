import type { Context } from 'hono';
import type { ContentfulStatusCode } from 'hono/utils/http-status';
import { ZodError } from 'zod';
import { RecipeConflictError } from './store/index.js';

/** An error whose message is safe to show to API clients. */
export class HttpError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export interface ErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export const errorBody = (code: string, message: string, details?: unknown): ErrorBody => ({
  error: details === undefined ? { code, message } : { code, message, details },
});

/** Uniform JSON error handler. Unknown errors are logged server-side and never leak. */
export function handleError(err: unknown, c: Context): Response {
  if (err instanceof HttpError) {
    return c.json(errorBody(err.code, err.message, err.details), err.status);
  }
  if (err instanceof RecipeConflictError) {
    return c.json(errorBody('conflict', err.message), 409);
  }
  if (err instanceof ZodError) {
    const details = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return c.json(errorBody('validation_error', 'Invalid request', details), 400);
  }
  // Malformed JSON bodies etc. surface from hono as HTTPException-like objects.
  if (err instanceof Error && 'getResponse' in err && typeof err.getResponse === 'function') {
    const res: unknown = err.getResponse();
    if (res instanceof Response && res.status < 500) {
      return c.json(errorBody('bad_request', 'Bad request'), res.status as 400);
    }
  }
  console.error('Unhandled error:', err instanceof Error ? err.message : String(err));
  return c.json(errorBody('internal_error', 'Internal server error'), 500);
}
