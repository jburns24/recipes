import { expect, test } from '@playwright/test';

test('browse the index, open a recipe', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('index-tree')).toBeVisible();
  await page.getByTestId('index-link').filter({ hasText: 'meatloaf' }).first().click();
  await expect(page).toHaveURL(/\/routes\/dinner\/quick\/meatloaf$/);
  await expect(page.getByTestId('recipe-title')).toHaveText(/meatloaf/i);
  await page.getByTestId('home-link').click();
  await expect(page).toHaveURL(/\/$/);
});

test('legacy .html URL redirects to the clean path', async ({ page }) => {
  await page.goto('/routes/dinner/quick/meatloaf.html');
  await expect(page).toHaveURL(/\/routes\/dinner\/quick\/meatloaf$/);
  await expect(page.getByTestId('recipe-title')).toBeVisible();
});

test('unknown recipe and unknown route show not-found', async ({ page }) => {
  await page.goto('/routes/dinner/quick/does-not-exist');
  await expect(page.getByTestId('status-not-found')).toBeVisible();
  await page.goto('/nope/at/all');
  await expect(page.getByTestId('status-not-found')).toBeVisible();
});
