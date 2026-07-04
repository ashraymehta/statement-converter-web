import { type CellAddress, utils, type WorkSheet } from 'xlsx';
import { NumberUtil } from './NumberUtil';

export class XLSXUtil {
    public static findTextIgnoringWhitespace(sheet: WorkSheet, text: string): CellAddress {
        const range = utils.decode_range(sheet['!ref']!);
        const { s: rangeStart, e: rangeEnd } = range;

        for (let R = rangeStart.r; R <= rangeEnd.r; ++R) {
            for (let C = rangeStart.c; C <= rangeEnd.c; ++C) {
                const cellAddress = utils.encode_cell({ c: C, r: R });
                if (!sheet[cellAddress]) continue;
                const cell = sheet[cellAddress];

                if (!(cell.t === 's' || cell.t === 'str')) continue;
                if (!cell.v) continue;
                if ((cell.v as string).replace(/\s/g, '') === text.replace(/\s/g, '')) {
                    return utils.decode_cell(cellAddress);
                }
            }
        }
        return undefined as unknown as CellAddress;
    }

    public static getCellValue(sheet: WorkSheet, row: number, column: number): string | number | boolean | null {
        const cellAddress = utils.encode_cell({ c: column, r: row });
        return !sheet[cellAddress] ? null : (sheet[cellAddress].v as string | number | boolean);
    }

    public static getNumberInCell(sheet: WorkSheet, row: number, column: number): number {
        const cellAddress = utils.encode_cell({ c: column, r: row });
        if (!sheet[cellAddress]) return 0;
        const value = sheet[cellAddress].v;
        if (typeof value === 'number') {
            return value;
        }

        return new NumberUtil().parseNumber(String(value)) ?? 0;
    }
}
