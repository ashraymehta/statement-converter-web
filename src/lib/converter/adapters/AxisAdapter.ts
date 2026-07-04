import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Bank } from '../models/Bank';
import { type Transaction } from '../models/Transaction';
import { TransactionAdapter } from './TransactionAdapter';
import { XLSXUtil } from '../helpers/XLSXUtil';

dayjs.extend(customParseFormat);

export class AxisAdapter extends TransactionAdapter {
    public async convert(xlsxData: ArrayBuffer): Promise<Transaction[]> {
        const workBook = XLSX.read(xlsxData, { raw: true, type: 'array' });
        const sheet = workBook.Sheets[workBook.SheetNames[0]];

        const addressForTransactionDate = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Tran Date');
        const addressForDetails = XLSXUtil.findTextIgnoringWhitespace(sheet, 'PARTICULARS');
        const addressForDepositAmount = XLSXUtil.findTextIgnoringWhitespace(sheet, 'CR');
        const addressForWithdrawalAmount = XLSXUtil.findTextIgnoringWhitespace(sheet, 'DR');

        const startingRow = addressForTransactionDate.r + 1;
        const range = XLSX.utils.decode_range(sheet['!ref']!);
        const lastRow = range.e.r;
        const rows = Array.from({ length: 1 + lastRow - startingRow }, (_, i) => startingRow + i);

        return rows.flatMap((row) => {
            const parsed = dayjs(
                XLSXUtil.getCellValue(sheet, row, addressForTransactionDate.c) as string,
                'DD-MM-YYYY',
                true,
            );
            if (!parsed.isValid()) return [];

            const payee = XLSXUtil.getCellValue(sheet, row, addressForDetails.c) as string;
            return [<Transaction>{
                Payee: payee,
                Outflow: XLSXUtil.getNumberInCell(sheet, row, addressForWithdrawalAmount.c),
                Inflow: XLSXUtil.getNumberInCell(sheet, row, addressForDepositAmount.c),
                Date: parsed.toDate(),
                Memo: payee,
                Category: null,
            }];
        });
    }

    public supports(bank: Bank): boolean {
        return bank === Bank.Axis;
    }
}
