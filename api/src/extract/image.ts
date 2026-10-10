export type ImageType = 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';

export const IMAGE_EXTENSIONS: Record<ImageType, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export const isAllowedImageType = (t: string): t is ImageType => t in IMAGE_EXTENSIONS;

const startsWith = (b: Uint8Array, sig: number[], offset = 0): boolean =>
  b.length >= offset + sig.length && sig.every((v, i) => b[offset + i] === v);

/** Identify an image by magic bytes (never trust the client-declared type). */
export function sniffImageType(b: Uint8Array): ImageType | null {
  if (startsWith(b, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(b, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return 'image/png';
  if (
    startsWith(b, [0x47, 0x49, 0x46, 0x38, 0x37, 0x61]) ||
    startsWith(b, [0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
  ) {
    return 'image/gif';
  }
  if (startsWith(b, [0x52, 0x49, 0x46, 0x46]) && startsWith(b, [0x57, 0x45, 0x42, 0x50], 8)) {
    return 'image/webp';
  }
  return null;
}
