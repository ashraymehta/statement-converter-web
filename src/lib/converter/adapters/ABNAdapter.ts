import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Bank } from '../models/Bank';
import { type Transaction } from '../models/Transaction';
import { TransactionAdapter } from './TransactionAdapter';
import { XLSXUtil } from '../helpers/XLSXUtil';

dayjs.extend(customParseFormat);

export class ABNAdapter extends TransactionAdapter {
    public async convert(xlsxData: ArrayBuffer): Promise<Transaction[]> {
        const workBook = XLSX.read(xlsxData, { raw: true, type: 'array' });
        const sheet = workBook.Sheets[workBook.SheetNames[0]];

        const addressForTransactionDate = XLSXUtil.findTextIgnoringWhitespace(sheet, 'transactiondate');
        const addressForDescription = XLSXUtil.findTextIgnoringWhitespace(sheet, 'description');
        const addressForAmount = XLSXUtil.findTextIgnoringWhitespace(sheet, 'amount');

        const startingRow = addressForTransactionDate.r + 1;
        const range = XLSX.utils.decode_range(sheet['!ref']!);
        const lastRow = range.e.r;
        const rows = Array.from({ length: 1 + lastRow - startingRow }, (_, i) => startingRow + i);

        return rows.flatMap((row) => {
            const parsed = dayjs(
                XLSXUtil.getCellValue(sheet, row, addressForTransactionDate.c) as string,
                'YYYYMMDD',
                true,
            );
            if (!parsed.isValid()) return [];

            const amount = XLSXUtil.getNumberInCell(sheet, row, addressForAmount.c);
            const outflow = amount < 0 ? Math.abs(amount) : 0;
            const inflow = amount >= 0 ? amount : 0;
            const memo = XLSXUtil.getCellValue(sheet, row, addressForDescription.c) as string;

            return [<Transaction>{
                Payee: memo,
                Outflow: outflow,
                Inflow: inflow,
                Date: parsed.toDate(),
                Memo: memo,
                Category: null,
            }];
        });
    }

    public supports(bank: Bank): boolean {
        return bank === Bank.ABN;
    }
}
