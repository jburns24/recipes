import { expect, test } from '@playwright/test';
import { openUploadDialog, PNG_BYTES, signIn } from './helpers';

test('upload button is hidden when signed out and shown after dev sign-in', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('sign-in')).toHaveText('Sign in (dev)');
  await expect(page.getByTestId('upload-button')).toHaveCount(0);
  await signIn(page);
  await expect(page.getByTestId('sign-out')).toBeVisible();
});

test('upload via file input creates a recipe that appears in the index', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  await openUploadDialog(page);
  await expect(page.getByTestId('upload-submit')).toBeDisabled();
  await page
    .getByTestId('upload-file-input')
    .setInputFiles({ name: 'Soup Night.jpg', mimeType: 'image/png', buffer: PNG_BYTES });
  await expect(page.getByTestId('upload-file-name')).toContainText('Soup Night.jpg');
  await page.getByTestId('upload-submit').click();

  await expect(page).toHaveURL(/\/routes\/dinner\/quick\/stub-soup-night$/);
  await expect(page.getByTestId('upload-dialog')).toBeHidden();
  await expect(page.getByTestId('recipe-title')).toHaveText('Stub Recipe: soup-night');

  await page.getByTestId('home-link').click();
  await expect(page.getByTestId('index-link').filter({ hasText: 'stub-soup-night' })).toBeVisible();
});

test('upload via paste creates a recipe', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  await openUploadDialog(page);
  await page.evaluate(
    ({ bytes }) => {
      const data = new DataTransfer();
      data.items.add(new File([new Uint8Array(bytes)], 'Pasted Pie.png', { type: 'image/png' }));
      document.dispatchEvent(
        new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true }),
      );
    },
    { bytes: [...PNG_BYTES] },
  );
  await expect(page.getByTestId('upload-file-name')).toContainText('Pasted Pie.png');
  await page.getByTestId('upload-submit').click();
  await expect(page).toHaveURL(/\/routes\/dinner\/quick\/stub-pasted-pie$/);
  await expect(page.getByTestId('recipe-title')).toBeVisible();
});

test('a non-image upload shows an error', async ({ page }) => {
  await page.goto('/');
  await signIn(page);
  await openUploadDialog(page);
  await page.getByTestId('upload-file-input').setInputFiles({
    name: 'notes.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('definitely not an image'),
  });
  // Either the client rejects it up front or the server answers 4xx; both surface upload-error.
  const submit = page.getByTestId('upload-submit');
  if (await submit.isEnabled()) await submit.click();
  await expect(page.getByTestId('upload-error')).toBeVisible();
  await expect(page.getByTestId('upload-dialog')).toBeVisible();
});

test('POST /api/extract without a token is 401', async ({ request }) => {
  const res = await request.post('/api/extract', {
    multipart: { image: { name: 'a.png', mimeType: 'image/png', buffer: PNG_BYTES } },
  });
  expect(res.status()).toBe(401);
  const body = (await res.json()) as { error: { code: string } };
  expect(body.error.code).toBeTruthy();
});
