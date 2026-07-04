import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Bank } from '../models/Bank';
import { type Transaction } from '../models/Transaction';
import { TransactionAdapter } from './TransactionAdapter';
import { XLSXUtil } from '../helpers/XLSXUtil';

dayjs.extend(customParseFormat);

export class WiseAdapter extends TransactionAdapter {
    public async convert(xlsxData: ArrayBuffer): Promise<Transaction[]> {
        const workBook = XLSX.read(xlsxData, { raw: true, type: 'array' });
        const sheet = workBook.Sheets[workBook.SheetNames[0]];

        const addressForCreatedOn = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Created on');
        const addressForPayee = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Target name');
        const addressForAmount = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Source amount (after fees)');
        const addressForDirection = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Direction');
        const addressForReference = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Reference');
        const addressForCategory = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Category');

        const startingRow = addressForCreatedOn.r + 1;
        const range = XLSX.utils.decode_range(sheet['!ref']!);
        const lastRow = range.e.r;
        const rows = Array.from({ length: 1 + lastRow - startingRow }, (_, i) => startingRow + i);

        return rows.flatMap((row) => {
            const parsed = dayjs(
                XLSXUtil.getCellValue(sheet, row, addressForCreatedOn.c) as string,
                'YYYY-MM-DD HH:mm:ss',
                true,
            );
            if (!parsed.isValid()) return [];

            const amount = XLSXUtil.getNumberInCell(sheet, row, addressForAmount.c);
            const isOutflow = XLSXUtil.getCellValue(sheet, row, addressForDirection.c) === 'OUT';

            return [<Transaction>{
                Payee: XLSXUtil.getCellValue(sheet, row, addressForPayee.c),
                Outflow: isOutflow ? amount : 0,
                Inflow: isOutflow ? 0 : amount,
                Date: parsed.toDate(),
                Memo: XLSXUtil.getCellValue(sheet, row, addressForReference.c),
                Category: XLSXUtil.getCellValue(sheet, row, addressForCategory.c),
            }];
        });
    }

    public supports(bank: Bank): boolean {
        return bank === Bank.Wise;
    }
}
