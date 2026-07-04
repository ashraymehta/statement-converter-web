import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Bank } from '../models/Bank';
import { type Transaction } from '../models/Transaction';
import { TransactionAdapter } from './TransactionAdapter';
import { XLSXUtil } from '../helpers/XLSXUtil';

dayjs.extend(customParseFormat);

export class ICICIAdapter extends TransactionAdapter {
    public async convert(xlsxData: ArrayBuffer): Promise<Transaction[]> {
        const workBook = XLSX.read(xlsxData, { raw: true, type: 'array' });
        const sheet = workBook.Sheets[workBook.SheetNames[0]];

        const addressForTransactionDate = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Transaction Date');
        const addressForDetails =
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Transaction Remark') ??
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Transaction Remarks');
        const addressForAmount = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Amount (INR)');
        const addressForCreditOrDebit = XLSXUtil.findTextIgnoringWhitespace(sheet, 'CR/DR');
        const addressForWithdrawal = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Withdrawal Amount(INR)');
        const addressForDeposit = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Deposit Amount(INR)');
        const addressForLegend = XLSXUtil.findTextIgnoringWhitespace(sheet, 'Legends Used in Account Statement');

        const startingRow = addressForTransactionDate.r + 1;
        const range = XLSX.utils.decode_range(sheet['!ref']!);
        const lastRow = addressForLegend ? addressForLegend.r - 1 : range.e.r;
        const rows = Array.from({ length: 1 + lastRow - startingRow }, (_, i) => startingRow + i);

        return rows.map((row) => {
            let isOutflow: boolean;
            let amount: number;

            if (addressForAmount) {
                isOutflow = this.isOutflow(sheet, row, addressForCreditOrDebit.c);
                amount = XLSXUtil.getNumberInCell(sheet, row, addressForAmount.c);
            } else {
                const withdrawal = XLSXUtil.getNumberInCell(sheet, row, addressForWithdrawal.c);
                if (withdrawal === 0) {
                    isOutflow = false;
                    amount = XLSXUtil.getNumberInCell(sheet, row, addressForDeposit.c);
                } else {
                    isOutflow = true;
                    amount = withdrawal;
                }
            }

            const date = dayjs(
                XLSXUtil.getCellValue(sheet, row, addressForTransactionDate.c) as string,
                'DD/MM/YYYY',
                true,
            ).toDate();
            const payee = XLSXUtil.getCellValue(sheet, row, addressForDetails.c) as string;

            return <Transaction>{
                Payee: payee,
                Outflow: isOutflow ? amount : 0,
                Inflow: !isOutflow ? amount : 0,
                Date: date,
                Memo: payee,
                Category: null,
            };
        });
    }

    private isOutflow(sheet: XLSX.WorkSheet, row: number, column: number): boolean {
        const cellValue = XLSXUtil.getCellValue(sheet, row, column) as string;
        return cellValue.includes('Dr.');
    }

    public supports(bank: Bank): boolean {
        return bank === Bank.ICICI;
    }
}
