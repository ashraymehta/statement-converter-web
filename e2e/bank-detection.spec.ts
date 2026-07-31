import { test, expect } from 'playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Reuses the same fixtures as the vitest adapter/detect suites (src/test/fixtures)
// rather than duplicating them here.
const FIXTURES_DIR = path.join(__dirname, '../src/test/fixtures');

/**
 * One case per known-bank adapter/preset. Each of these is an independent
 * parsing code path (its own third-party dependency, its own column mapping),
 * so each can independently break without the others noticing.
 *
 * These run against the production build (see playwright.config.ts's
 * webServer), unlike the vitest unit tests — which exercise the same parsing
 * logic but through Vite's dev/test module transform, not the bundler's
 * production output. A bundler-level regression (e.g. broken CJS/ESM interop
 * silently turning a dependency's default export into the wrong value) can
 * pass every unit test and still break every one of these adapters in
 * production. See git history for two real instances of exactly that.
 */
const knownBankCases = [
  { fixture: 'AxisBankStatement.xls', bankLabel: 'Axis Bank', minTransactions: 1 },
  { fixture: 'ICICIBankStatement.xls', bankLabel: 'ICICI Bank', minTransactions: 1 },
  { fixture: 'ICICIBankMiniStatement.xls', bankLabel: 'ICICI Bank', minTransactions: 1 },
  { fixture: 'ICICICreditCardStatement.xls', bankLabel: 'ICICI Credit Card', minTransactions: 1 },
  { fixture: 'ICICICreditCardPastStatement.csv', bankLabel: 'ICICI Credit Card', minTransactions: 1 },
  { fixture: 'StandardCharteredStatement.xls', bankLabel: 'Standard Chartered', minTransactions: 4 },
  { fixture: 'ABNStatement.xls', bankLabel: 'ABN AMRO', minTransactions: 4 },
  { fixture: 'N26Statement.csv', bankLabel: 'N26', minTransactions: 1 },
  { fixture: 'WiseTransactionHistory.csv', bankLabel: 'Wise', minTransactions: 1 },
  { fixture: 'MT940Statement.txt', bankLabel: 'Generic MT940', minTransactions: 3 },
  { fixture: 'TradeRepublicStatement.json', bankLabel: 'Trade Republic', minTransactions: 3 },
];

for (const { fixture, bankLabel, minTransactions } of knownBankCases) {
  test(`${fixture} is auto-detected as ${bankLabel} and exports`, async ({ page }) => {
    await page.goto('/');
    await page.locator('input[type="file"]').setInputFiles(path.join(FIXTURES_DIR, fixture));

    // A misdetected file falls through to the raw column-mapping view instead
    // (see PreviewTable.svelte) — asserting the bank label is what actually
    // distinguishes "parsed correctly" from "silently fell back".
    await expect(page.locator('.preview-header .eyebrow')).toContainText(bankLabel);

    const rowCount = await page.locator('tbody tr').count();
    expect(rowCount).toBeGreaterThanOrEqual(minTransactions);

    // Only enabled once real transactions have made it all the way to the
    // export bar — the same signal that caught the original regression.
    await expect(page.getByRole('button', { name: /Download \.qif/i })).toBeEnabled();
  });
}
