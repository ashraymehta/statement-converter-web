import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { NumberUtil, extractIndicator } from './helpers/NumberUtil';
import type { Transaction } from './models/Transaction';

export { extractIndicator };

dayjs.extend(customParseFormat);

const numberUtil = new NumberUtil();

// `Date` is included so a column already normalised by the mapping UI (which
// parses a column's raw strings into real Date objects once, the moment the
// Date role is assigned to it) can be fed straight back into `applyMapping`.
export type CellValue = string | number | boolean | Date | null;

export interface RawTable {
    headers: string[];
    rows: CellValue[][];
}

const HEADER_SCAN_ROWS = 15;

/**
 * Best-effort generic spreadsheet reader for files that don't match any known
 * bank format. Finds the header row heuristically — the row with the most
 * non-empty string cells among the first `HEADER_SCAN_ROWS` rows, which handles
 * the leading metadata rows (e.g. "Account No:") seen in many real statements —
 * and returns everything below it as raw data rows.
 *
 * Returns `null` if the file can't be read as a spreadsheet at all, or no
 * plausible header row / data is found. Callers should show a plain error in
 * that case rather than falling into column mapping.
 */
export function readGenericSheet(fileData: ArrayBuffer): RawTable | null {
    let workBook: XLSX.WorkBook;
    try {
        workBook = XLSX.read(fileData, { raw: true, type: 'array' });
    } catch {
        return null;
    }

    const sheet = workBook.Sheets[workBook.SheetNames[0]];
    if (!sheet || !sheet['!ref']) {
        return null;
    }

    const range = XLSX.utils.decode_range(sheet['!ref']);
    const lastRow = range.e.r;
    const lastCol = range.e.c;
    const scanLimit = Math.min(lastRow, HEADER_SCAN_ROWS);

    let headerRow = -1;
    let bestScore = 0;
    for (let r = 0; r <= scanLimit; r++) {
        let score = 0;
        for (let c = 0; c <= lastCol; c++) {
            const value = getCell(sheet, r, c);
            if (typeof value === 'string' && value.trim() !== '') {
                score++;
            }
        }
        if (score > bestScore) {
            bestScore = score;
            headerRow = r;
        }
    }

    if (headerRow === -1) {
        return null;
    }

    const headers: string[] = [];
    for (let c = 0; c <= lastCol; c++) {
        const value = getCell(sheet, headerRow, c);
        headers.push(typeof value === 'string' && value.trim() !== '' ? value.trim() : `Column ${c + 1}`);
    }

    const rows: CellValue[][] = [];
    for (let r = headerRow + 1; r <= lastRow; r++) {
        const row: CellValue[] = [];
        let hasValue = false;
        for (let c = 0; c <= lastCol; c++) {
            const value = getCell(sheet, r, c);
            if (value !== null) hasValue = true;
            row.push(value);
        }
        if (hasValue) rows.push(row);
    }

    if (rows.length === 0) {
        return null;
    }

    return { headers, rows };
}

function getCell(sheet: XLSX.WorkSheet, row: number, col: number): CellValue {
    const address = XLSX.utils.encode_cell({ r: row, c: col });
    const cell = sheet[address];
    if (!cell) return null;
    return (cell.v as CellValue) ?? null;
}

// ── Column mapping ──────────────────────────────────────────────────────────

export type ColumnRole = 'date' | 'payee' | 'memo' | 'category' | 'amount' | 'outflow' | 'inflow' | 'indicator';
export type AmountPattern = 'signed' | 'split' | 'indicator';

export interface ColumnMapping {
    pattern: AmountPattern;
    /** One entry per column, aligned to `RawTable.headers`; `null` means unassigned/ignored. */
    roles: (ColumnRole | null)[];
    /** Used when `pattern === 'signed'`: whether a negative amount means money out. */
    negativeIsOutflow: boolean;
    /** Used when `pattern === 'indicator'` and 'indicator' is a *separate* column
     *  (not embedded in the amount cell): case-insensitive exact-match values
     *  meaning "this row is a debit/outflow". Not every bank spells this
     *  "Dr"/"Cr" — e.g. Wise's Direction column uses "OUT"/"IN". Defaults to
     *  `['dr', 'debit']` if omitted. */
    debitIndicatorValues?: string[];
    /** A single strict dayjs format, an array tried in order (some banks mix
     *  formats across export types — e.g. ICICI Credit Card), or `AUTO_DATE_FORMAT`. */
    dateFormat: string | string[];
}

const DEFAULT_DEBIT_WORDS = ['dr', 'debit'];

/** Normalized exact-match check for a *separate* indicator column's value
 *  (as opposed to `extractIndicator`, which handles a word embedded alongside
 *  digits in the same cell as the amount). */
function isDebitValue(text: string, debitWords: string[]): boolean {
    const normalized = text.trim().toLowerCase().replace(/\.$/, '');
    return debitWords.some((word) => word.toLowerCase() === normalized);
}

const DEFAULT_DATE_FORMAT = 'YYYY-MM-DD';

export function createEmptyMapping(columnCount: number): ColumnMapping {
    return {
        pattern: 'signed',
        roles: Array(columnCount).fill(null),
        negativeIsOutflow: true,
        dateFormat: DEFAULT_DATE_FORMAT,
    };
}

/** True once enough columns are assigned to compute at least a placeholder transaction list. */
export function isMappingComplete(mapping: ColumnMapping): boolean {
    if (!mapping.roles.includes('date')) return false;
    if (mapping.pattern === 'split') return mapping.roles.includes('outflow') || mapping.roles.includes('inflow');
    return mapping.roles.includes('amount'); // 'signed' and 'indicator' both just need an amount column
}

/**
 * Converts a raw table into normalised transactions using a column mapping.
 * Reuses `NumberUtil.parseNumber` for locale-aware numeric parsing (the same
 * helper `XLSXUtil.getNumberInCell` uses), and the same sign conventions
 * already established in `ABNAdapter`/`N26Adapter` (signed amount column) and
 * `StandardCharteredAdapter` (separate outflow/inflow columns). Rows with an
 * unparsable date are skipped, consistent with the existing adapters.
 */
export function applyMapping(table: RawTable, mapping: ColumnMapping): Transaction[] {
    const dateCol = mapping.roles.indexOf('date');
    if (dateCol === -1) return [];

    const payeeCol = mapping.roles.indexOf('payee');
    const memoCol = mapping.roles.indexOf('memo');
    const categoryCol = mapping.roles.indexOf('category');

    if (mapping.pattern === 'signed') {
        const amountCol = mapping.roles.indexOf('amount');
        if (amountCol === -1) return [];

        return table.rows.flatMap((row) => {
            const date = parseDate(row[dateCol], mapping.dateFormat);
            if (!date) return [];

            const rawAmount = parseAmount(row[amountCol]);
            const isOutflow = mapping.negativeIsOutflow ? rawAmount < 0 : rawAmount >= 0;
            const amount = Math.abs(rawAmount);

            return [
                buildTransaction(row, payeeCol, memoCol, categoryCol, date, isOutflow ? amount : 0, isOutflow ? 0 : amount),
            ];
        });
    }

    if (mapping.pattern === 'indicator') {
        const amountCol = mapping.roles.indexOf('amount');
        if (amountCol === -1) return [];
        const indicatorCol = mapping.roles.indexOf('indicator');
        const debitWords = mapping.debitIndicatorValues ?? DEFAULT_DEBIT_WORDS;

        return table.rows.flatMap((row) => {
            const date = parseDate(row[dateCol], mapping.dateFormat);
            if (!date) return [];

            let amount: number;
            let isDebit: boolean | null;

            if (indicatorCol !== -1) {
                // Direction lives in its own column — e.g. ICICI's "CR/DR", or
                // Wise's "Direction" column (values "OUT"/"IN", configured via
                // debitIndicatorValues: ['out']). Normalized exact-match, not
                // substring extraction, since the whole cell is just the value.
                amount = Math.abs(parseAmount(row[amountCol]));
                const indicatorText = cellToString(row[indicatorCol]).trim();
                isDebit = indicatorText === '' ? null : isDebitValue(indicatorText, debitWords);
            } else {
                // Direction is embedded in the amount cell itself
                // (e.g. ICICI Credit Card's "Dr.1,499.00" / "CR500.00").
                const extracted = extractIndicator(cellToString(row[amountCol]));
                amount = Math.abs(parseAmount(extracted.cleaned));
                isDebit = extracted.isDebit;
            }

            const isOutflow = isDebit ?? true; // indeterminate indicator defaults to outflow
            return [
                buildTransaction(row, payeeCol, memoCol, categoryCol, date, isOutflow ? amount : 0, isOutflow ? 0 : amount),
            ];
        });
    }

    const outflowCol = mapping.roles.indexOf('outflow');
    const inflowCol = mapping.roles.indexOf('inflow');
    if (outflowCol === -1 && inflowCol === -1) return [];

    return table.rows.flatMap((row) => {
        const date = parseDate(row[dateCol], mapping.dateFormat);
        if (!date) return [];

        const outflow = outflowCol !== -1 ? parseAmount(row[outflowCol]) : 0;
        const inflow = inflowCol !== -1 ? parseAmount(row[inflowCol]) : 0;

        return [buildTransaction(row, payeeCol, memoCol, categoryCol, date, outflow, inflow)];
    });
}

function buildTransaction(
    row: CellValue[],
    payeeCol: number,
    memoCol: number,
    categoryCol: number,
    date: Date,
    outflow: number,
    inflow: number,
): Transaction {
    const payee = payeeCol !== -1 ? cellToString(row[payeeCol]) : '';
    const category = categoryCol !== -1 ? cellToString(row[categoryCol]) : '';
    return {
        Payee: payee,
        Outflow: outflow,
        Inflow: inflow,
        Date: date,
        // Several banks (Axis, Standard Chartered, ABN) don't have a distinct
        // memo column — they use the same descriptive text for both fields.
        // Falling back to Payee when Memo isn't mapped preserves that.
        Memo: memoCol !== -1 ? cellToString(row[memoCol]) : payee,
        Category: category || null,
    };
}

function cellToString(value: CellValue): string {
    return value === null || value === undefined ? '' : String(value);
}

/** Locale-aware numeric parsing for a raw cell value. Exported for reuse by the
 *  mapping UI, which normalises a column's cells once when a numeric role is
 *  first assigned to it. */
export function parseCellAsNumber(value: CellValue): number {
    return parseAmount(value);
}

function parseAmount(value: CellValue): number {
    if (typeof value === 'number') return value;
    if (typeof value === 'string') return numberUtil.parseNumber(value) ?? 0;
    return 0;
}

/** Parses a raw cell value as a date using the given format (or as an Excel
 *  date serial, if numeric). Exported for reuse by the mapping UI, which
 *  normalises a column's cells once when the Date role is first assigned. */
export function parseCellAsDate(value: CellValue, format: string | string[]): Date | null {
    return parseDate(value, format);
}

/** Sentinel `dateFormat` meaning "no single format matched well — parse each
 *  value with dayjs's lenient built-in parser instead of a strict format." */
export const AUTO_DATE_FORMAT = 'auto';

// dayjs's lenient (no-format) parser delegates to the native `Date`
// constructor, which is implementation-defined and surprisingly permissive —
// e.g. `new Date('not-a-date-1')` parses "successfully" in V8. Requiring the
// text to at least look date-shaped (two+ numeric groups, or a month name)
// before trusting a lenient parse avoids treating arbitrary text as a date.
const DATE_LIKE_PATTERN = /\d{1,4}\s*[/\-.]\s*\d{1,2}\s*[/\-.]\s*\d{1,4}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b/i;

function looksLikeDate(text: string): boolean {
    return DATE_LIKE_PATTERN.test(text);
}

function parseDate(value: CellValue, format: string | string[]): Date | null {
    if (value === null || value === undefined) return null;
    if (value instanceof Date) {
        return isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number') {
        return excelSerialToDate(value);
    }
    const text = String(value).trim();
    if (!text) return null;

    if (format === AUTO_DATE_FORMAT) {
        if (!looksLikeDate(text)) return null;
        const lenient = dayjs(text);
        return lenient.isValid() ? lenient.toDate() : null;
    }

    // A bank preset may need to try more than one strict format — e.g. ICICI
    // Credit Card mixes DD/MM/YYYY (regular export) and DD-MMM-YY ("past
    // statement" export) depending on how the file was downloaded.
    const formats = Array.isArray(format) ? format : [format];
    for (const candidate of formats) {
        const parsed = dayjs(text, candidate, true);
        if (parsed.isValid()) return parsed.toDate();
    }
    return null;
}

/** Converts an Excel date serial number (days since 1899-12-30) to a JS Date. */
function excelSerialToDate(serial: number): Date {
    const utcDays = Math.floor(serial - 25569);
    const date = new Date(utcDays * 86400 * 1000);
    const fractionalDay = serial - Math.floor(serial);
    const totalSeconds = Math.round(fractionalDay * 86400);
    date.setUTCSeconds(date.getUTCSeconds() + totalSeconds);
    return date;
}

// ── Cosmetic heuristics for the mapping UI ──────────────────────────────────

const CATEGORICAL_SAMPLE_ROWS = 20;
const CATEGORICAL_MIN_SAMPLE = 5;
const CATEGORICAL_MAX_DISTINCT = 6;
const CATEGORICAL_MAX_LENGTH = 24;

/**
 * Flags columns whose sampled values look categorical (few distinct short
 * strings relative to a reasonably sized sample) so the unmapped preview can
 * render them as pill/tag badges instead of plain text — purely cosmetic, has
 * no effect on mapping/export. Requires a minimum sample size so a handful of
 * rows (all trivially "≤ N distinct") doesn't produce a false positive.
 */
export function detectCategoricalColumns(table: RawTable): boolean[] {
    return table.headers.map((_, c) => {
        const sample = table.rows
            .slice(0, CATEGORICAL_SAMPLE_ROWS)
            .map((row) => row[c])
            .filter((v): v is string => typeof v === 'string' && v.trim() !== '');

        if (sample.length < CATEGORICAL_MIN_SAMPLE) return false;

        const distinct = new Set(sample.map((v) => v.trim()));
        const allShort = sample.every((v) => v.length <= CATEGORICAL_MAX_LENGTH);
        return allShort && distinct.size <= CATEGORICAL_MAX_DISTINCT;
    });
}

// Zero-padded and unpadded variants both included — real-world exports mix
// "06/01/2024" and "6/1/2024" style dates, and dayjs's strict mode requires an
// exact match (a single "D"/"M" token accepts 1-2 digits; "DD"/"MM" require 2).
const CANDIDATE_DATE_FORMATS = [
    'YYYY-MM-DD',
    'YYYY-M-D',
    'DD/MM/YYYY',
    'D/M/YYYY',
    'MM/DD/YYYY',
    'M/D/YYYY',
    'DD-MM-YYYY',
    'D-M-YYYY',
    'DD.MM.YYYY',
    'D.M.YYYY',
    'DD-MMM-YYYY',
    'D-MMM-YYYY',
    'DD-MMM-YY',
    'D-MMM-YY',
    'MMM D, YYYY',
    'MMMM D, YYYY',
    'D MMM YYYY',
    'D MMMM YYYY',
    'YYYY-MM-DD HH:mm:ss',
    'YYYY-MM-DDTHH:mm:ss',
    'DD/MM/YYYY HH:mm:ss',
    'MM/DD/YYYY HH:mm:ss',
];

/**
 * Guesses the best date format for a column by trying each candidate format
 * against a sample of its values and returning whichever parses the most rows.
 * If no candidate format confidently matches (covers at least half the
 * sample), falls back to `AUTO_DATE_FORMAT` — dayjs's lenient built-in parser,
 * which handles many additional real-world variants (e.g. "June 1 2024",
 * ISO timestamps with offsets) without needing an exact format string.
 */
export function guessDateFormat(table: RawTable, columnIndex: number): string {
    const sample = table.rows
        .slice(0, CATEGORICAL_SAMPLE_ROWS)
        .map((row) => row[columnIndex])
        .filter((v): v is string => typeof v === 'string' && v.trim() !== '');

    if (sample.length === 0) return DEFAULT_DATE_FORMAT;

    let bestFormat = CANDIDATE_DATE_FORMATS[0];
    let bestScore = 0;
    for (const format of CANDIDATE_DATE_FORMATS) {
        const score = sample.filter((v) => dayjs(v, format, true).isValid()).length;
        if (score > bestScore) {
            bestScore = score;
            bestFormat = format;
        }
    }

    if (bestScore < sample.length * 0.5) {
        const autoScore = sample.filter((v) => looksLikeDate(v) && dayjs(v).isValid()).length;
        if (autoScore > bestScore) {
            return AUTO_DATE_FORMAT;
        }
    }

    return bestFormat;
}
