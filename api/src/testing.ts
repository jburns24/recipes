import { SignJWT } from 'jose';

export const JWT_SECRET = 'test-secret-test-secret-test-secret-1234';

export async function signToken(
  claims: Record<string, unknown> = {},
  opts: { secret?: string; expiresIn?: string | number; aud?: string; alg?: string } = {},
): Promise<string> {
  return new SignJWT({ email: 'cook@example.com', ...claims })
    .setProtectedHeader({ alg: opts.alg ?? 'HS256' })
    .setSubject('user-1')
    .setAudience(opts.aud ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(opts.expiresIn ?? '1h')
    .sign(new TextEncoder().encode(opts.secret ?? JWT_SECRET));
}

export const PNG: Uint8Array<ArrayBuffer> = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3,
]);
export const JPEG: Uint8Array<ArrayBuffer> = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
