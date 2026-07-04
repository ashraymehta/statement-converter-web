import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Bank } from '../models/Bank';
import { type Transaction } from '../models/Transaction';
import { TransactionAdapter } from './TransactionAdapter';
import { XLSXUtil } from '../helpers/XLSXUtil';

dayjs.extend(customParseFormat);

export class N26Adapter extends TransactionAdapter {
    public async convert(xlsxData: ArrayBuffer): Promise<Transaction[]> {
        const workBook = XLSX.read(xlsxData, { raw: true, type: 'array' });
        const sheet = workBook.Sheets[workBook.SheetNames[0]];

        const addressForTransactionDate = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Booking Date');
        const addressForDescription = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Payment Reference');
        const addressForAmount = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Amount (EUR)');
        const addressForPayee = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Partner Name');
        const addressForCategory = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Type');

        const startingRow = addressForTransactionDate.r + 1;
        const range = XLSX.utils.decode_range(sheet['!ref']!);
        const lastRow = range.e.r;
        const rows = Array.from({ length: 1 + lastRow - startingRow }, (_, i) => startingRow + i);

        return rows.flatMap((row) => {
            const parsed = dayjs(
                XLSXUtil.getCellValue(sheet, row, addressForTransactionDate.c) as string,
                'YYYY-MM-DD',
                true,
            );
            if (!parsed.isValid()) return [];

            const amount = XLSXUtil.getNumberInCell(sheet, row, addressForAmount.c);
            const outflow = amount < 0 ? Math.abs(amount) : 0;
            const inflow = amount >= 0 ? amount : 0;

            return [<Transaction>{
                Payee: XLSXUtil.getCellValue(sheet, row, addressForPayee.c),
                Outflow: outflow,
                Inflow: inflow,
                Date: parsed.toDate(),
                Memo: XLSXUtil.getCellValue(sheet, row, addressForDescription.c),
                Category: XLSXUtil.getCellValue(sheet, row, addressForCategory.c),
            }];
        });
    }

    public supports(bank: Bank): boolean {
        return bank === Bank.N26;
    }
}
