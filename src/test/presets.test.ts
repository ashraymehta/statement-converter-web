import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import * as XLSX from 'xlsx';
import { applyMapping } from '../lib/converter/generic';
import { resolvePresetMapping, BANK_PRESETS, type BankPreset } from '../lib/converter/presets';
import { Bank } from '../lib/converter/models/Bank';
import { expectValidTransactions } from './helpers';

const fixture = (name: string): ArrayBuffer => {
    const buf = readFileSync(join(__dirname, 'fixtures', name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

function makeSheet(rows: (string | number)[][]): ArrayBuffer {
    const ws = XLSX.utils.aoa_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
    return XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
}

/** Resolves and applies whichever preset for `bank` matches the fixture (trying each candidate layout in order). */
function parseWithPresets(bank: Bank, buffer: ArrayBuffer) {
    for (const preset of BANK_PRESETS.filter((p) => p.bank === bank)) {
        const resolved = resolvePresetMapping(buffer, preset);
        if (resolved) {
            const transactions = applyMapping(resolved.table, resolved.mapping);
            if (transactions.length > 0) return transactions;
        }
    }
    return [];
}

describe('presets — value-level regression coverage', () => {
    it('Axis: split CR/DR columns', () => {
        const transactions = parseWithPresets(Bank.Axis, fixture('AxisBankStatement.xls'));
        expectValidTransactions(transactions);
        expect(transactions).toHaveLength(4);
        expect(transactions[0]).toMatchObject({ Payee: 'SALARY JUNE', Inflow: 85000, Outflow: 0 });
        expect(transactions[1]).toMatchObject({ Payee: 'GROCERIES SUPERMART', Outflow: 2340.5, Inflow: 0 });
    });

    it('ICICI (bank): combined Amount(INR) + CR/DR indicator column', () => {
        const transactions = parseWithPresets(Bank.ICICI, fixture('ICICIBankStatement.xls'));
        expectValidTransactions(transactions);
        expect(transactions).toHaveLength(4);
        expect(transactions[0]).toMatchObject({ Payee: 'SALARY CREDIT', Inflow: 90000, Outflow: 0 });
        expect(transactions[1]).toMatchObject({ Payee: 'ATM WITHDRAWAL', Outflow: 5000, Inflow: 0 });
        // Legend row must not become a bogus 5th transaction.
        expect(transactions.some((t) => t.Payee.includes('Legends'))).toBe(false);
    });

    it('ICICI (bank): falls back to split Withdrawal/Deposit columns when there is no combined Amount column', () => {
        const transactions = parseWithPresets(Bank.ICICI, fixture('ICICIBankMiniStatement.xls'));
        expectValidTransactions(transactions);
        expect(transactions).toHaveLength(3);
        expect(transactions[0]).toMatchObject({ Payee: 'NEFT FROM XYZ CO', Inflow: 45000, Outflow: 0 });
        expect(transactions[1]).toMatchObject({ Payee: 'ELECTRICITY BILL', Outflow: 2800, Inflow: 0 });
    });

    it('ICICI Credit Card (.xls): separate BillingAmountSign indicator column', () => {
        const transactions = parseWithPresets(Bank.ICICICreditCard, fixture('ICICICreditCardStatement.xls'));
        expectValidTransactions(transactions);
        expect(transactions).toHaveLength(4);
        expect(transactions[0]).toMatchObject({ Payee: 'AMAZON SHOPPING', Outflow: 3499, Inflow: 0, Memo: 'REF001' });
        expect(transactions[1]).toMatchObject({ Payee: 'REWARD CASHBACK', Inflow: 150, Outflow: 0 });
    });

    it('ICICI Credit Card (.csv "past statement"): indicator embedded in the amount cell, DD-MMM-YY dates', () => {
        const transactions = parseWithPresets(Bank.ICICICreditCard, fixture('ICICICreditCardPastStatement.csv'));
        expectValidTransactions(transactions);
        expect(transactions).toHaveLength(3);
        expect(transactions[0]).toMatchObject({ Payee: 'ZARA SHOPPING', Outflow: 1499, Inflow: 0 });
        expect(transactions[1]).toMatchObject({ Payee: 'REFUND MYNTRA', Inflow: 500, Outflow: 0 });
    });

    it('Standard Chartered: split Deposit/Withdrawal columns', () => {
        const transactions = parseWithPresets(Bank.StandardChartered, fixture('StandardCharteredStatement.xls'));
        expectValidTransactions(transactions);
        expect(transactions).toHaveLength(4);
        expect(transactions[0]).toMatchObject({ Payee: 'Salary credit', Inflow: 75000, Outflow: 0 });
        expect(transactions[1]).toMatchObject({ Payee: 'Utility bill payment', Outflow: 3200, Inflow: 0 });
    });

    it('ABN AMRO: signed amount column', () => {
        const transactions = parseWithPresets(Bank.ABN, fixture('ABNStatement.xls'));
        expectValidTransactions(transactions);
        expect(transactions).toHaveLength(4);
        expect(transactions[0]).toMatchObject({ Payee: 'Salary payment', Inflow: 2450, Outflow: 0 });
        expect(transactions[1]).toMatchObject({ Payee: 'Supermarket purchase', Outflow: 58.3, Inflow: 0 });
    });

    it('N26: signed amount column', () => {
        const transactions = parseWithPresets(Bank.N26, fixture('N26Statement.csv'));
        expectValidTransactions(transactions);
        expect(transactions).toHaveLength(4);
        expect(transactions[0]).toMatchObject({ Payee: 'Supermarket GmbH', Outflow: 67.45, Inflow: 0 });
        expect(transactions[1]).toMatchObject({ Payee: 'Employer AG', Inflow: 2850, Outflow: 0 });
    });

    it('Wise: separate Direction indicator column with OUT/IN convention', () => {
        const transactions = parseWithPresets(Bank.Wise, fixture('WiseTransactionHistory.csv'));
        expectValidTransactions(transactions);
        expect(transactions).toHaveLength(3);
        expect(transactions[0]).toMatchObject({ Payee: 'Alice Receiver', Outflow: 120, Inflow: 0 });
        expect(transactions[1]).toMatchObject({ Payee: 'Bob Sender', Inflow: 250, Outflow: 0 });
    });

    it('regression: currency-code-prefixed ICICI amount column no longer zeroes out', () => {
        // Reproduces the reported bug's exact shape with fabricated numbers —
        // "INR 11,225.00" previously parsed to NaN, which rendered as a
        // silent 0. See NumberUtil.test.ts for the underlying parser coverage.
        const table = {
            headers: ['Column 1', 'Column 2', 'Column 3', 'Column 4'],
            rows: [['01/06/2024', 'Salary credit', 'INR 11,225.00', 'CR']],
        };
        const mapping = {
            pattern: 'indicator' as const,
            roles: ['date', 'payee', 'amount', 'indicator'] as const,
            negativeIsOutflow: true,
            dateFormat: 'DD/MM/YYYY',
        };
        const transactions = applyMapping(table, { ...mapping, roles: [...mapping.roles] });
        expectValidTransactions(transactions);
        expect(transactions[0].Inflow).toBe(11225);
    });
});

describe('resolvePresetMapping — approximate header fallback', () => {
    it('matches a simpler/shorter header when no exact alias matches (e.g. "Transaction Date" -> "Date")', () => {
        const sheet = makeSheet([
            ['Date', 'Payee', 'Amount'],
            ['2024-06-01', 'Salary', '100.00'],
        ]);
        const preset: BankPreset = {
            bank: Bank.Axis, // arbitrary — isolating just the header-resolution behavior
            dateHeaderAliases: ['Transaction Date'], // not present verbatim in the sheet
            dateFormat: 'YYYY-MM-DD',
            payeeHeaderAliases: ['Payee'],
            amountPattern: 'signed',
            amountHeaderAliases: ['Amount'],
        };

        const resolved = resolvePresetMapping(sheet, preset);
        expect(resolved).not.toBeNull();
        const transactions = applyMapping(resolved!.table, resolved!.mapping);
        expectValidTransactions(transactions);
        expect(transactions[0]).toMatchObject({ Payee: 'Salary', Inflow: 100, Outflow: 0 });
    });

    it('regression: does not match a MORE specific header than the alias ("Amount" must not match "Withdrawal Amount(INR)")', () => {
        // This is the exact collision an earlier (reverted) substring-based
        // implementation produced: "Amount (INR)" is textually contained in
        // "Withdrawal Amount(INR)", but they are meaningfully different
        // columns. The fallback must only allow a *simpler* header than
        // expected, never a *more specific* one.
        const sheet = makeSheet([
            ['Date', 'Payee', 'Withdrawal Amount(INR)'],
            ['2024-06-01', 'Rent', '500.00'],
        ]);
        const preset: BankPreset = {
            bank: Bank.ICICI,
            dateHeaderAliases: ['Date'],
            dateFormat: 'YYYY-MM-DD',
            payeeHeaderAliases: ['Payee'],
            amountPattern: 'signed',
            amountHeaderAliases: ['Amount (INR)'],
        };

        expect(resolvePresetMapping(sheet, preset)).toBeNull();
    });

    it('does not match on very short/generic tokens alone', () => {
        const sheet = makeSheet([
            ['Date', 'Description', 'Category'],
            ['2024-06-01', 'Salary', 'Income'],
        ]);
        const preset: BankPreset = {
            bank: Bank.Axis,
            dateHeaderAliases: ['Transaction Date'],
            dateFormat: 'YYYY-MM-DD',
            payeeHeaderAliases: ['Payee'], // no "Payee"-like header present at all
            amountPattern: 'signed',
            amountHeaderAliases: ['Amount'],
        };

        expect(resolvePresetMapping(sheet, preset)).toBeNull();
    });
});
