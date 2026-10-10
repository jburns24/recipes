import { expect, type Page } from '@playwright/test';

/** Smallest valid PNG (1x1). The stub extractor only looks at the filename. */
export const PNG_BYTES = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
);

export async function signIn(page: Page): Promise<void> {
  await page.getByTestId('sign-in').click();
  await expect(page.getByTestId('upload-button')).toBeVisible();
}

export async function openUploadDialog(page: Page): Promise<void> {
  await page.getByTestId('upload-button').click();
  await expect(page.getByTestId('upload-dialog')).toBeVisible();
}
