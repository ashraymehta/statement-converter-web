import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import {
    readGenericSheet,
    applyMapping,
    createEmptyMapping,
    isMappingComplete,
    detectCategoricalColumns,
    guessDateFormat,
    parseCellAsDate,
    AUTO_DATE_FORMAT,
    type ColumnMapping,
    type RawTable,
} from '../lib/converter/index';

const fixture = (name: string): ArrayBuffer => {
    const buf = readFileSync(join(__dirname, 'fixtures', name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

describe('readGenericSheet', () => {
    it('finds the header row past leading metadata rows', () => {
        const table = readGenericSheet(fixture('GenericSignedAmountStatement.csv'));
        expect(table).not.toBeNull();
        expect(table!.headers).toEqual(['Value Date', 'Description', 'Amount']);
        expect(table!.rows).toHaveLength(4);
    });

    it('finds the header row when it is already the first row', () => {
        const table = readGenericSheet(fixture('GenericSplitColumnsStatement.csv'));
        expect(table).not.toBeNull();
        expect(table!.headers).toEqual(['Txn Date', 'Narration', 'Type', 'Debit', 'Credit']);
        expect(table!.rows).toHaveLength(7);
    });

    it('returns null for unstructured/random content', () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5, 255, 254, 253]);
        expect(readGenericSheet(bytes.buffer)).toBeNull();
    });
});

describe('applyMapping — signed amount pattern', () => {
    const table = readGenericSheet(fixture('GenericSignedAmountStatement.csv'))!;

    it('maps date/payee/amount columns into transactions with correct signs', () => {
        const mapping: ColumnMapping = {
            pattern: 'signed',
            roles: ['date', 'payee', 'amount'],
            negativeIsOutflow: true,
            dateFormat: guessDateFormat(table, 0),
        };

        const transactions = applyMapping(table, mapping);
        expect(transactions).toHaveLength(4);

        const [freelance, coffee, rent, interest] = transactions;
        expect(freelance.Inflow).toBe(1200);
        expect(freelance.Outflow).toBe(0);
        expect(coffee.Outflow).toBe(4.5);
        expect(rent.Outflow).toBe(800);
        expect(interest.Inflow).toBe(2.1);
        expect(freelance.Payee).toBe('Freelance payment');
    });

    it('accepts columns already normalised to Date/number (as the mapping UI produces)', () => {
        // The mapping UI parses a column's raw strings into real Date/number
        // values once, the moment a role is first assigned to it (so the cell
        // can be rendered and edited like a known-bank column), then feeds
        // those normalised values back through applyMapping on every edit.
        const normalizedTable = {
            headers: table.headers,
            rows: table.rows.map((row) => [
                new Date(row[0] as string),
                row[1],
                Number(row[2]),
            ]),
        };
        const mapping: ColumnMapping = {
            pattern: 'signed',
            roles: ['date', 'payee', 'amount'],
            negativeIsOutflow: true,
            dateFormat: 'YYYY-MM-DD',
        };

        const transactions = applyMapping(normalizedTable, mapping);
        expect(transactions).toHaveLength(4);
        expect(transactions[0].Inflow).toBe(1200);
    });

    it('is incomplete until date and amount are both mapped', () => {
        const empty = createEmptyMapping(table.headers.length);
        expect(isMappingComplete(empty)).toBe(false);

        const dateOnly: ColumnMapping = { ...empty, roles: ['date', null, null] };
        expect(isMappingComplete(dateOnly)).toBe(false);

        const complete: ColumnMapping = { ...empty, roles: ['date', null, 'amount'] };
        expect(isMappingComplete(complete)).toBe(true);
    });
});

describe('applyMapping — split outflow/inflow pattern', () => {
    const table = readGenericSheet(fixture('GenericSplitColumnsStatement.csv'))!;

    it('maps separate debit/credit columns into transactions', () => {
        const mapping: ColumnMapping = {
            pattern: 'split',
            roles: ['date', 'payee', null, 'outflow', 'inflow'],
            negativeIsOutflow: true,
            dateFormat: guessDateFormat(table, 0),
        };

        const transactions = applyMapping(table, mapping);
        expect(transactions).toHaveLength(7);

        const [salary, electricity, gift] = transactions;
        expect(salary.Inflow).toBe(3000);
        expect(salary.Outflow).toBe(0);
        expect(electricity.Outflow).toBe(120);
        expect(gift.Inflow).toBe(50);
    });

    it('is complete once date and at least one of outflow/inflow are mapped', () => {
        const empty = createEmptyMapping(table.headers.length);
        const mapping: ColumnMapping = { ...empty, pattern: 'split', roles: ['date', null, null, 'outflow', null] };
        expect(isMappingComplete(mapping)).toBe(true);
    });
});

describe('applyMapping — indicator pattern (amount + direction column)', () => {
    it('reads direction from a separate indicator column', () => {
        const table: RawTable = {
            headers: ['Date', 'Payee', 'Amount', 'CR/DR'],
            rows: [
                ['2024-06-01', 'Salary', '11,225.00', 'CR'],
                ['2024-06-05', 'Rent', '5,000.00', 'DR'],
                ['2024-06-10', 'Refund', '250.00', 'Cr'],
            ],
        };
        const mapping: ColumnMapping = {
            pattern: 'indicator',
            roles: ['date', 'payee', 'amount', 'indicator'],
            negativeIsOutflow: true,
            dateFormat: 'YYYY-MM-DD',
        };

        const transactions = applyMapping(table, mapping);
        expect(transactions).toHaveLength(3);
        expect(transactions[0]).toMatchObject({ Inflow: 11225, Outflow: 0 });
        expect(transactions[1]).toMatchObject({ Inflow: 0, Outflow: 5000 });
        expect(transactions[2]).toMatchObject({ Inflow: 250, Outflow: 0 });
    });

    it('supports non-Dr/Cr indicator conventions via debitIndicatorValues (e.g. Wise OUT/IN)', () => {
        const table: RawTable = {
            headers: ['Created on', 'Target name', 'Amount', 'Direction'],
            rows: [
                ['2024-06-01', 'Alice', '120.00', 'OUT'],
                ['2024-06-05', 'Bob', '250.00', 'IN'],
            ],
        };
        const mapping: ColumnMapping = {
            pattern: 'indicator',
            roles: ['date', 'payee', 'amount', 'indicator'],
            negativeIsOutflow: true,
            debitIndicatorValues: ['out'],
            dateFormat: 'YYYY-MM-DD',
        };

        const transactions = applyMapping(table, mapping);
        expect(transactions[0]).toMatchObject({ Outflow: 120, Inflow: 0 });
        expect(transactions[1]).toMatchObject({ Inflow: 250, Outflow: 0 });
    });

    it('extracts an indicator embedded in the same cell as the amount', () => {
        const table: RawTable = {
            headers: ['Date', 'Details', 'Amount'],
            rows: [
                ['2024-06-01', 'Shopping', 'Dr.1,499.00'],
                ['2024-06-05', 'Cashback', 'CR150.00'],
            ],
        };
        const mapping: ColumnMapping = {
            pattern: 'indicator',
            roles: ['date', 'payee', 'amount'], // no separate 'indicator' column mapped
            negativeIsOutflow: true,
            dateFormat: 'YYYY-MM-DD',
        };

        const transactions = applyMapping(table, mapping);
        expect(transactions).toHaveLength(2);
        expect(transactions[0]).toMatchObject({ Outflow: 1499, Inflow: 0 });
        expect(transactions[1]).toMatchObject({ Inflow: 150, Outflow: 0 });
    });

    it('is complete once date and amount are mapped (indicator column is optional)', () => {
        const empty = createEmptyMapping(3);
        const mapping: ColumnMapping = { ...empty, pattern: 'indicator', roles: ['date', null, 'amount'] };
        expect(isMappingComplete(mapping)).toBe(true);
    });
});

describe('guessDateFormat', () => {
    it('guesses ISO format for YYYY-MM-DD columns', () => {
        const table = readGenericSheet(fixture('GenericSignedAmountStatement.csv'))!;
        expect(guessDateFormat(table, 0)).toBe('YYYY-MM-DD');
    });

    it('guesses unpadded D/M/YYYY without requiring leading zeros', () => {
        const table: RawTable = { headers: ['Date'], rows: [['1/6/2024'], ['15/6/2024'], ['3/12/2024']] };
        expect(guessDateFormat(table, 0)).toBe('D/M/YYYY');
        table.rows.forEach((row) => {
            expect(parseCellAsDate(row[0], guessDateFormat(table, 0))).not.toBeNull();
        });
    });

    it('falls back to lenient auto-parsing for formats with no strict match', () => {
        // ISO timestamps with an explicit UTC offset aren't in the strict
        // candidate list, but dayjs's default lenient parser handles them.
        const table: RawTable = {
            headers: ['Date'],
            rows: [['2024-06-01T08:00:00+02:00'], ['2024-06-15T09:30:00+02:00']],
        };
        const format = guessDateFormat(table, 0);
        expect(format).toBe(AUTO_DATE_FORMAT);

        const parsed = parseCellAsDate(table.rows[0][0], format);
        expect(parsed).not.toBeNull();
        expect(parsed!.getUTCFullYear()).toBe(2024);
        expect(parsed!.getUTCMonth()).toBe(5); // June, 0-indexed
        expect(parsed!.getUTCDate()).toBe(1);
    });

    it('never leaves a column completely unparseable when auto-fallback applies', () => {
        const table: RawTable = { headers: ['Date'], rows: [['June 1, 2024'], ['June 15, 2024']] };
        const format = guessDateFormat(table, 0);
        const parsedCount = table.rows.filter((row) => parseCellAsDate(row[0], format) !== null).length;
        expect(parsedCount).toBe(table.rows.length);
    });

    it('does not treat non-date text as a date via the lenient fallback', () => {
        // dayjs's lenient (no-format) parser delegates to the native `Date`
        // constructor, which will "successfully" parse arbitrary text like
        // this in some JS engines. The auto-fallback must reject it rather
        // than silently accepting a bogus date.
        const table: RawTable = { headers: ['Date'], rows: [['not-a-date-1'], ['not-a-date-2']] };
        const format = guessDateFormat(table, 0);
        const parsedCount = table.rows.filter((row) => parseCellAsDate(row[0], format) !== null).length;
        expect(parsedCount).toBe(0);
    });

    it('parses each row to its own distinct date rather than collapsing them all (regression)', () => {
        // An 8-column unrecognised statement with unpadded M/D/YYYY dates —
        // previously every row silently failed to parse and ended up empty.
        const table = readGenericSheet(fixture('GenericManyColumnsStatement.csv'))!;
        const format = guessDateFormat(table, 0);
        const dates = table.rows.map((row) => parseCellAsDate(row[0], format));

        expect(dates.every((d) => d !== null)).toBe(true);
        // Compare local calendar date parts — .toISOString() would convert to
        // UTC and shift the date near midnight depending on the runner's timezone.
        const localDates = dates.map((d) => [d!.getFullYear(), d!.getMonth() + 1, d!.getDate()].join('-'));
        expect(new Set(localDates).size).toBe(table.rows.length); // all distinct
        expect(localDates).toEqual(['2024-6-1', '2024-6-3', '2024-6-10', '2024-6-15']);
    });
});

describe('detectCategoricalColumns', () => {
    it('flags low-cardinality short-string columns and not free-text ones', () => {
        const table = readGenericSheet(fixture('GenericSplitColumnsStatement.csv'))!;
        const flags = detectCategoricalColumns(table);
        // Type (index 2) repeats "Credit"/"Debit" — categorical.
        expect(flags[2]).toBe(true);
        // Narration (index 1) has 7 distinct free-text values — not categorical.
        expect(flags[1]).toBe(false);
    });
});
