import * as XLSX from 'xlsx';
import { XLSXUtil } from './helpers/XLSXUtil';
import { Bank } from './models/Bank';
import type { RawTable, ColumnMapping, ColumnRole, AmountPattern } from './generic';

/**
 * Declarative description of a tabular bank's statement layout — header-name
 * aliases per semantic role, the amount pattern, and the date format(s). A
 * "bank" is data, not code: `resolvePresetMapping` below is the one shared
 * engine that locates headers and builds a mapping for `applyMapping`
 * (generic.ts) to consume, whether the bank was auto-detected or the user
 * picked it manually.
 *
 * Some banks need more than one preset (e.g. ICICI has two real-world
 * layouts) — list them in priority order in `BANK_PRESETS`; the first one
 * whose required headers resolve wins.
 */
export interface BankPreset {
    bank: Bank;
    dateHeaderAliases: string[];
    /** A single strict dayjs format, or an array tried in order (some banks
     *  mix formats across export types — e.g. ICICI Credit Card). */
    dateFormat: string | string[];
    payeeHeaderAliases: string[];
    /** Omit when the bank has no distinct memo column — Payee is reused (see `generic.ts`'s `buildTransaction`). */
    memoHeaderAliases?: string[];
    categoryHeaderAliases?: string[];
    amountPattern: AmountPattern;
    /** Required for 'signed' and 'indicator'. */
    amountHeaderAliases?: string[];
    /** Used by 'signed'; defaults to `true` (negative amount = outflow). */
    negativeIsOutflow?: boolean;
    /** Used by 'indicator'; omit when the direction is embedded in the amount cell itself. */
    indicatorHeaderAliases?: string[];
    /** Used by 'indicator'; case-insensitive exact-match values meaning "debit/outflow". Defaults to ['dr', 'debit']. */
    debitIndicatorValues?: string[];
    /** Required for 'split'; at least one of outflow/inflow must resolve. */
    outflowHeaderAliases?: string[];
    inflowHeaderAliases?: string[];
    /** Truncates the data range to end just before this header's row — for
     *  statements with a trailing legend/footer section (e.g. ICICI). */
    endSentinelHeaderAliases?: string[];
}

/**
 * Ordered so that the most distinctive-header banks are listed before the
 * more generic ones, and so ICICI's Credit Card layout (its own bank value)
 * doesn't interfere with plain ICICI's two candidate layouts, which are
 * tried in sequence here for the same `Bank.ICICI` value.
 */
export const BANK_PRESETS: BankPreset[] = [
    {
        bank: Bank.Axis,
        dateHeaderAliases: ['Tran Date'],
        dateFormat: 'DD-MM-YYYY',
        payeeHeaderAliases: ['PARTICULARS'],
        amountPattern: 'split',
        inflowHeaderAliases: ['CR'],
        outflowHeaderAliases: ['DR'],
    },
    {
        // Layout A: one combined "Amount (INR)" column + a separate "CR/DR" indicator column.
        bank: Bank.ICICI,
        dateHeaderAliases: ['Transaction Date'],
        dateFormat: 'DD/MM/YYYY',
        payeeHeaderAliases: ['Transaction Remark', 'Transaction Remarks'],
        amountPattern: 'indicator',
        amountHeaderAliases: ['Amount (INR)'],
        indicatorHeaderAliases: ['CR/DR'],
        endSentinelHeaderAliases: ['Legends Used in Account Statement'],
    },
    {
        // Layout B (fallback): separate Withdrawal/Deposit columns, no combined amount column.
        bank: Bank.ICICI,
        dateHeaderAliases: ['Transaction Date'],
        dateFormat: 'DD/MM/YYYY',
        payeeHeaderAliases: ['Transaction Remark', 'Transaction Remarks'],
        amountPattern: 'split',
        outflowHeaderAliases: ['Withdrawal Amount(INR)'],
        inflowHeaderAliases: ['Deposit Amount(INR)'],
        endSentinelHeaderAliases: ['Legends Used in Account Statement'],
    },
    {
        bank: Bank.ICICICreditCard,
        dateHeaderAliases: ['Transaction Date', 'Date'],
        dateFormat: ['DD/MM/YYYY', 'DD-MMM-YY'],
        payeeHeaderAliases: ['Details', 'Transaction Details'],
        memoHeaderAliases: ['Reference Number', 'Sr.No.'],
        amountPattern: 'indicator',
        amountHeaderAliases: ['Amount (INR)', 'Amount(in Rs)', 'Intl.Amount'],
        indicatorHeaderAliases: ['BillingAmountSign'],
        endSentinelHeaderAliases: ['MESSAGE Details'],
    },
    {
        bank: Bank.StandardChartered,
        dateHeaderAliases: ['Date'],
        dateFormat: 'DD/MM/YYYY',
        payeeHeaderAliases: ['Transaction'],
        amountPattern: 'split',
        inflowHeaderAliases: ['Deposit'],
        outflowHeaderAliases: ['Withdrawal'],
    },
    {
        bank: Bank.ABN,
        dateHeaderAliases: ['transactiondate'],
        dateFormat: 'YYYYMMDD',
        payeeHeaderAliases: ['description'],
        amountPattern: 'signed',
        amountHeaderAliases: ['amount'],
        negativeIsOutflow: true,
    },
    {
        bank: Bank.N26,
        dateHeaderAliases: ['Booking Date'],
        dateFormat: 'YYYY-MM-DD',
        payeeHeaderAliases: ['Partner Name'],
        memoHeaderAliases: ['Payment Reference'],
        categoryHeaderAliases: ['Type'],
        amountPattern: 'signed',
        amountHeaderAliases: ['Amount (EUR)'],
        negativeIsOutflow: true,
    },
    {
        bank: Bank.Wise,
        dateHeaderAliases: ['Created on'],
        dateFormat: 'YYYY-MM-DD HH:mm:ss',
        payeeHeaderAliases: ['Target name'],
        memoHeaderAliases: ['Reference'],
        categoryHeaderAliases: ['Category'],
        amountPattern: 'indicator',
        amountHeaderAliases: ['Source amount (after fees)'],
        indicatorHeaderAliases: ['Direction'],
        debitIndicatorValues: ['out'],
    },
];

function tokenize(text: string): string[] {
    return text
        .toLowerCase()
        .split(/[^a-z0-9]+/)
        .filter((t) => t.length > 0);
}

const FUZZY_MIN_TOKEN_LENGTH = 3;
const FUZZY_MIN_ALIAS_TOKEN_COVERAGE = 0.5;

/**
 * Approximate fallback for when no alias matches exactly — e.g. a preset
 * expects "Transaction Date" but the file just says "Date". Tokenizes both
 * the alias and each candidate header and matches only when the
 * *candidate's* tokens are a subset of the *alias's* tokens: the file's
 * header may be a simpler/shorter version of what was expected, but never a
 * more specific one.
 *
 * That direction matters. An earlier, direction-agnostic substring version
 * of this let a preset's "Amount (INR)" alias wrongly match a file's
 * "Withdrawal Amount(INR)" header — textually one contains the other, but
 * they're meaningfully different columns. Requiring candidate ⊆ alias (not
 * the reverse) rules that out while still catching the stated use case.
 */
function findApproximateMatch(sheet: XLSX.WorkSheet, alias: string): XLSX.CellAddress | null {
    const aliasTokens = tokenize(alias).filter((t) => t.length >= FUZZY_MIN_TOKEN_LENGTH);
    if (aliasTokens.length === 0) return null;
    const aliasTokenSet = new Set(aliasTokens);

    const range = XLSX.utils.decode_range(sheet['!ref']!);
    let best: { address: XLSX.CellAddress; coverage: number } | null = null;

    for (let r = range.s.r; r <= range.e.r; r++) {
        for (let c = range.s.c; c <= range.e.c; c++) {
            const value = XLSXUtil.getCellValue(sheet, r, c);
            if (typeof value !== 'string') continue;

            const cellTokens = tokenize(value).filter((t) => t.length >= FUZZY_MIN_TOKEN_LENGTH);
            if (cellTokens.length === 0) continue;

            // Every candidate token must appear in the alias — the candidate
            // may be a subset (simpler/shorter), never a superset.
            const isSubset = cellTokens.every((t) => aliasTokenSet.has(t));
            if (!isSubset) continue;

            const coverage = cellTokens.length / aliasTokens.length;
            if (coverage < FUZZY_MIN_ALIAS_TOKEN_COVERAGE) continue;

            if (!best || coverage > best.coverage) {
                best = { address: { r, c }, coverage };
            }
        }
    }

    return best?.address ?? null;
}

function findFirstMatch(sheet: XLSX.WorkSheet, aliases: string[] | undefined, allowFuzzy = true): XLSX.CellAddress | null {
    if (!aliases) return null;
    for (const alias of aliases) {
        const address = XLSXUtil.findTextIgnoringWhitespace(sheet, alias);
        if (address) return address;
    }
    if (!allowFuzzy) return null;
    // No exact match for any alias — fall back to an approximate one before
    // giving up, so header variants no preset lists yet (e.g. "Date" instead
    // of "Transaction Date") can still resolve.
    for (const alias of aliases) {
        const address = findApproximateMatch(sheet, alias);
        if (address) return address;
    }
    return null;
}

/**
 * Resolves a bank preset against a spreadsheet: locates each role's header —
 * trying each alias in order, the same approach `ICICICreditCardAdapter` used
 * ad hoc for a couple of fields, now generalised to every role — and builds
 * the `RawTable`/`ColumnMapping` pair the shared `applyMapping` engine
 * (generic.ts) consumes.
 *
 * Returns `null` if a required header isn't found. That *is* the detection
 * signal: "this preset doesn't match this file," letting the caller try the
 * next candidate preset (or the next bank) without needing exceptions for
 * control flow.
 */
export function resolvePresetMapping(
    fileData: ArrayBuffer,
    preset: BankPreset,
): { table: RawTable; mapping: ColumnMapping } | null {
    let workBook: XLSX.WorkBook;
    try {
        workBook = XLSX.read(fileData, { raw: true, type: 'array' });
    } catch {
        return null;
    }

    const sheet = workBook.Sheets[workBook.SheetNames[0]];
    if (!sheet || !sheet['!ref']) return null;

    const dateAddr = findFirstMatch(sheet, preset.dateHeaderAliases);
    if (!dateAddr) return null;

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const lastCol = range.e.c;
    const roles: (ColumnRole | null)[] = Array(lastCol + 1).fill(null);
    roles[dateAddr.c] = 'date';

    // Payee is required — every original adapter dereferenced its "details"/
    // "remark"/etc. column unconditionally, so a missing payee header meant
    // "this isn't actually this bank" (it crashed), not "payee is optional".
    // Without this, a preset with looser other requirements (e.g. ICICI
    // Credit Card, tried before plain ICICI) can falsely match a file that
    // merely happens to share its date/amount headers.
    const payeeAddr = findFirstMatch(sheet, preset.payeeHeaderAliases);
    if (!payeeAddr) return null;
    roles[payeeAddr.c] = 'payee';

    const memoAddr = findFirstMatch(sheet, preset.memoHeaderAliases);
    if (memoAddr) roles[memoAddr.c] = 'memo';

    const categoryAddr = findFirstMatch(sheet, preset.categoryHeaderAliases);
    if (categoryAddr) roles[categoryAddr.c] = 'category';

    if (preset.amountPattern === 'split') {
        const outflowAddr = findFirstMatch(sheet, preset.outflowHeaderAliases);
        const inflowAddr = findFirstMatch(sheet, preset.inflowHeaderAliases);
        if (!outflowAddr && !inflowAddr) return null;
        if (outflowAddr) roles[outflowAddr.c] = 'outflow';
        if (inflowAddr) roles[inflowAddr.c] = 'inflow';
    } else {
        const amountAddr = findFirstMatch(sheet, preset.amountHeaderAliases);
        if (!amountAddr) return null;
        roles[amountAddr.c] = 'amount';

        if (preset.amountPattern === 'indicator') {
            const indicatorAddr = findFirstMatch(sheet, preset.indicatorHeaderAliases);
            // Only assign the role if it's a genuinely different column —
            // otherwise leave it unmapped so applyMapping takes its "extract
            // the indicator from the amount cell itself" (embedded) branch.
            if (indicatorAddr && indicatorAddr.c !== amountAddr.c) {
                roles[indicatorAddr.c] = 'indicator';
            }
        }
    }

    let lastRow = range.e.r;
    // Sentinels are rare, structural markers, not "column headers" in the
    // same sense as the other roles — a wrong match here truncates the
    // entire row range rather than just misreading one column, so this one
    // requires an exact match (e.g. a bare "Details" payee header must not
    // fuzzy-match "MESSAGE Details" as the sentinel).
    const sentinelAddr = findFirstMatch(sheet, preset.endSentinelHeaderAliases, false);
    if (sentinelAddr && sentinelAddr.r - 1 < lastRow) {
        lastRow = sentinelAddr.r - 1;
    }

    const startingRow = dateAddr.r + 1;
    const rows: RawTable['rows'] = [];
    for (let r = startingRow; r <= lastRow; r++) {
        const row: RawTable['rows'][number] = [];
        for (let c = 0; c <= lastCol; c++) {
            row.push(XLSXUtil.getCellValue(sheet, r, c));
        }
        rows.push(row);
    }

    // Headers aren't meaningful for the preset path (no UI displays them —
    // that's only for the unrecognised-bank mapping fallback) but RawTable
    // requires the field, and it keeps row-index alignment self-documenting.
    const headers = Array.from({ length: lastCol + 1 }, (_, c) => `Column ${c + 1}`);

    return {
        table: { headers, rows },
        mapping: {
            pattern: preset.amountPattern,
            roles,
            negativeIsOutflow: preset.negativeIsOutflow ?? true,
            debitIndicatorValues: preset.debitIndicatorValues,
            dateFormat: preset.dateFormat,
        },
    };
}
