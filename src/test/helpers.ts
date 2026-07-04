import { expect } from 'vitest';
import type { Transaction } from '../lib/converter/index';

/**
 * Generic regression guard applied across every adapter/preset test. Catches
 * the exact bug class that shipped undetected: a transaction with the right
 * shape but a silently-wrong amount (NaN leaking through a `?? 0` guard, or
 * both Outflow/Inflow ending up 0 because parsing failed). A shallow
 * `expect(result).not.toHaveLength(0)` check can't catch this — the row
 * count is correct even when every value in it is garbage.
 */
export function expectValidTransactions(transactions: Transaction[]): void {
    expect(transactions.length).toBeGreaterThan(0);

    for (const [i, t] of transactions.entries()) {
        expect(Number.isFinite(t.Outflow), `row ${i}: Outflow is not finite (${t.Outflow})`).toBe(true);
        expect(Number.isFinite(t.Inflow), `row ${i}: Inflow is not finite (${t.Inflow})`).toBe(true);
        expect(
            t.Outflow !== 0 || t.Inflow !== 0,
            `row ${i}: both Outflow and Inflow are 0 — likely a silent parse failure`,
        ).toBe(true);
        expect(t.Date instanceof Date && !Number.isNaN(t.Date.getTime()), `row ${i}: Date is invalid`).toBe(true);
    }
}
