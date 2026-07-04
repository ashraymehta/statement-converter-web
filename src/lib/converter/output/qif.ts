import dayjs from 'dayjs';
import type { Transaction } from '../models/Transaction';

/** Formats a field line: code + value + CRLF, or empty string if value is falsy. */
function field(code: string, value: string | number | null | undefined): string {
    if (value === null || value === undefined || value === '') return '';
    return `${code}${value}\r\n`;
}

/**
 * Converts a list of transactions to a QIF string (Cash account type).
 * This is an inlined replacement for the `qif` npm package's `write` function,
 * which had a top-level `require('fs')` incompatible with browser bundling.
 */
export function toQif(transactions: Transaction[]): string {
    let result = '!Type:Cash\r\n';

    for (const t of transactions) {
        const amount = t.Inflow ? t.Inflow : -t.Outflow;
        result += field('D', dayjs(t.Date).format('D/M/YYYY'));
        result += field('T', amount);
        result += field('P', t.Payee);
        result += field('L', t.Category);
        result += field('M', t.Memo);
        result += '^\r\n';
    }

    return result;
}
