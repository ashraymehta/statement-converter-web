import { test, expect } from 'playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, 'fixtures/date-error-check.csv');

/**
 * Fixture has 3 rows; the 2nd has an unparseable "not-a-date" value in the
 * date column. Regression coverage for the per-row date-error UI: a row
 * whose date can't be parsed must never be silently included in the export.
 */
async function uploadAndMapColumns(page: import('playwright/test').Page) {
  await page.goto('/');
  await page.locator('input[type="file"]').setInputFiles(FIXTURE);
  await page.waitForSelector('table');

  const roleSelects = page.locator('table thead select');
  await roleSelects.nth(0).selectOption('date');
  await roleSelects.nth(1).selectOption('payee');
  await roleSelects.nth(2).selectOption('amount');

  return page.locator('tbody tr');
}

test('unparseable date row is flagged and its checkbox disabled', async ({ page }) => {
  const rows = await uploadAndMapColumns(page);
  const errorRow = rows.nth(1);
  const checkbox = errorRow.locator('input[type="checkbox"]');

  await expect(errorRow).toHaveClass(/ledger-row--error/);
  await expect(errorRow.locator('.cell-error')).toBeVisible();
  await expect(checkbox).toBeDisabled();
  await expect(checkbox).not.toBeChecked();

  // The two valid rows are unaffected.
  await expect(rows.nth(0)).not.toHaveClass(/ledger-row--error/);
  await expect(rows.nth(2)).not.toHaveClass(/ledger-row--error/);
  await expect(rows.nth(0).locator('input[type="checkbox"]')).toBeChecked();
  await expect(rows.nth(2).locator('input[type="checkbox"]')).toBeChecked();
});

test('exported QIF excludes the errored row', async ({ page }) => {
  const rows = await uploadAndMapColumns(page);
  void rows;

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download \.qif/i }).click(),
  ]);
  const qif = await readDownload(download);

  expect(qif).toContain('Freelance payment');
  expect(qif).toContain('Rent');
  expect(qif).not.toContain('Coffee shop');
});

test('fixing the date re-enables the row and includes it in the export', async ({ page }) => {
  const rows = await uploadAndMapColumns(page);
  const errorRow = rows.nth(1);
  const checkbox = errorRow.locator('input[type="checkbox"]');

  const dateCell = errorRow.locator('td').nth(1);
  await dateCell.locator('input[type="date"]').fill('2024-06-05');
  await dateCell.locator('input[type="date"]').dispatchEvent('change');

  await expect(errorRow).not.toHaveClass(/ledger-row--error/);
  await expect(checkbox).toBeEnabled();
  await expect(checkbox).toBeChecked();

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: /Download \.qif/i }).click(),
  ]);
  const qif = await readDownload(download);

  expect(qif).toContain('Freelance payment');
  expect(qif).toContain('Coffee shop');
  expect(qif).toContain('Rent');
});

async function readDownload(download: import('playwright/test').Download): Promise<string> {
  const stream = await download.createReadStream();
  const chunks: Buffer[] = [];
  for await (const chunk of stream) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf-8');
}
