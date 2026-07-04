import dayjs from 'dayjs';
import type { Transaction } from '../models/Transaction';

function escapeCsv(value: string | number | null | undefined): string {
    const str = value === null || value === undefined ? '' : String(value);
    if (/["\n,]/.test(str)) {
        return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
}

/** Converts a list of transactions to a CSV string with headers. */
export function toCsv(transactions: Transaction[]): string {
    const header = 'Date,Payee,Memo,Outflow,Inflow,Category';
    const rows = transactions.map((t) => {
        const date = dayjs(t.Date).format('MM/DD/YYYY');
        return [
            escapeCsv(date),
            escapeCsv(t.Payee),
            escapeCsv(t.Memo),
            escapeCsv(t.Outflow || ''),
            escapeCsv(t.Inflow || ''),
            escapeCsv(t.Category),
        ].join(',');
    });
    return [header, ...rows].join('\n');
}
