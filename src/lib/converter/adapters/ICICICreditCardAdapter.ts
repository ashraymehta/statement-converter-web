import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import { Bank } from '../models/Bank';
import { type Transaction } from '../models/Transaction';
import { TransactionAdapter } from './TransactionAdapter';
import { XLSXUtil } from '../helpers/XLSXUtil';

dayjs.extend(customParseFormat);

export class ICICICreditCardAdapter extends TransactionAdapter {
    public async convert(xlsxData: ArrayBuffer): Promise<Transaction[]> {
        const workBook = XLSX.read(xlsxData, { raw: true, type: 'array' });
        const sheet = workBook.Sheets[workBook.SheetNames[0]];

        const addressForTransactionDate =
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Transaction Date') ??
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Date');
        const addressForDetails =
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Details') ??
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Transaction Details');
        const addressForAmount =
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Amount (INR)') ??
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Amount(in Rs)') ??
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Intl.Amount');
        const addressForReferenceNumber =
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Reference Number') ??
            XLSXUtil.findTextIgnoringWhitespace(sheet, 'Sr.No.');
        const addressForCreditOrDebit = XLSXUtil.findTextIgnoringWhitespace(sheet, 'BillingAmountSign');

        const range = XLSX.utils.decode_range(sheet['!ref']!);
        const lastRow = this.findLastRow(sheet, range, addressForTransactionDate);
        const startingRow = this.findFirstRow(sheet, range, addressForTransactionDate);
        const rows = Array.from({ length: 1 + lastRow - startingRow }, (_, i) => startingRow + i);

        return rows
            .filter((row) => {
                // ICICI sometimes has account numbers in the Date field as a separator — filter those out.
                const parsed = this.parseDayjs(
                    XLSXUtil.getCellValue(sheet, row, addressForTransactionDate.c) as string,
                );
                return parsed.isValid();
            })
            .map((row) => {
                let isOutflow: boolean;
                let amount: number;

                if (addressForCreditOrDebit) {
                    const creditOrDebit = XLSXUtil.getCellValue(sheet, row, addressForCreditOrDebit.c) as string;
                    isOutflow = creditOrDebit !== 'CR';
                    const amountCellValue = XLSXUtil.getCellValue(sheet, row, addressForAmount.c) as string;
                    amount = parseFloat(amountCellValue.replace(/,/g, ''));
                } else {
                    const result = this.determineDebitOrCredit(sheet, row, addressForAmount.c);
                    isOutflow = result.isOutflow;
                    amount = result.amount;
                }

                const date = this.parseDayjs(
                    XLSXUtil.getCellValue(sheet, row, addressForTransactionDate.c) as string,
                ).toDate();

                return <Transaction>{
                    Payee: XLSXUtil.getCellValue(sheet, row, addressForDetails.c),
                    Outflow: isOutflow ? amount : 0,
                    Inflow: !isOutflow ? amount : 0,
                    Date: date,
                    Memo: XLSXUtil.getCellValue(sheet, row, addressForReferenceNumber.c),
                    Category: null,
                };
            });
    }

    private parseDayjs(text: string) {
        return dayjs(text, ['DD/MM/YYYY', 'DD-MMM-YY'], true);
    }

    private findFirstRow(
        sheet: XLSX.WorkSheet,
        range: XLSX.Range,
        addressForTransactionDate: XLSX.CellAddress,
    ): number {
        for (let current = addressForTransactionDate.r + 1; current <= range.e.r; current++) {
            const val = XLSXUtil.getCellValue(sheet, current, addressForTransactionDate.c);
            if (val !== null && String(val).trim() !== '') return current;
        }
        return addressForTransactionDate.r;
    }

    private findLastRow(
        sheet: XLSX.WorkSheet,
        range: XLSX.Range,
        addressForTransactionDate: XLSX.CellAddress,
    ): number {
        for (let current = 0; current <= range.e.r; current++) {
            const cellValue = XLSXUtil.getCellValue(sheet, current, addressForTransactionDate.c);
            if (cellValue && String(cellValue).includes('MESSAGE Details')) {
                return current - 1;
            }
        }
        return range.e.r;
    }

    private determineDebitOrCredit(
        sheet: XLSX.WorkSheet,
        row: number,
        column: number,
    ): { isOutflow: boolean; amount: number } {
        const cellValue = XLSXUtil.getCellValue(sheet, row, column) as string;
        return {
            isOutflow: cellValue.includes('Dr.'),
            amount: parseFloat(cellValue.replace(/,/g, '')),
        };
    }

    public supports(bank: Bank): boolean {
        return bank === Bank.ICICICreditCard;
    }
}
