import dayjs from 'dayjs';
import parser from 'stitch-swiftmessageparser';
import type { Transaction as SwiftTransaction } from 'stitch-swiftmessageparser/dist/lib/transaction';
import { Bank } from '../models/Bank';
import { type Transaction } from '../models/Transaction';
import { TransactionAdapter } from './TransactionAdapter';

export class MT940Adapter extends TransactionAdapter {
    public async convert(data: ArrayBuffer): Promise<Transaction[]> {
        const rows = parser.parse({
            data: new TextDecoder().decode(data),
            type: 'mt940',
        });

        return rows
            .flatMap((row) => row.transactions)
            .map((row: SwiftTransaction) => {
                const date = dayjs(row.date).toDate();
                const amount = row.amount;
                const outflow = amount.isNegative() ? amount.abs().toNumber() : 0;
                const inflow = amount.isPositive() ? amount.toNumber() : 0;

                const segments = [
                    row.bankReference,
                    row.details,
                    row.extraDetails,
                    row.reference,
                    row.detailSegments.filter((s) => s && s.trim()).join(' - '),
                ].filter((s) => s && s.trim());

                const memo = segments.join(' - ').trim();

                return <Transaction>{
                    Payee: memo,
                    Outflow: outflow,
                    Inflow: inflow,
                    Date: date,
                    Memo: memo,
                    Category: null,
                };
            })
            .filter((row) => !!row);
    }

    public supports(bank: Bank): boolean {
        return bank === Bank.GenericMT940;
    }
}
