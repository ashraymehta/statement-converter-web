import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { detect, Bank } from '../lib/converter/index';

const fixture = (name: string): ArrayBuffer => {
    const buf = readFileSync(join(__dirname, 'fixtures', name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

describe('detect — auto-detection across all known banks', () => {
    it('detects an Axis Bank statement', async () => {
        const result = await detect(fixture('AxisBankStatement.xls'));
        expect(result?.bank).toBe(Bank.Axis);
        expect(result?.transactions.length).toBeGreaterThan(0);
    });

    it('detects an ICICI Bank statement', async () => {
        const result = await detect(fixture('ICICIBankStatement.xls'));
        expect(result?.bank).toBe(Bank.ICICI);
    });

    it('detects an ICICI Bank mini-statement', async () => {
        const result = await detect(fixture('ICICIBankMiniStatement.xls'));
        expect(result?.bank).toBe(Bank.ICICI);
    });

    it('detects an ICICI Credit Card statement (.xls), not plain ICICI', async () => {
        const result = await detect(fixture('ICICICreditCardStatement.xls'));
        expect(result?.bank).toBe(Bank.ICICICreditCard);
    });

    it('detects an ICICI Credit Card past statement (.csv)', async () => {
        const result = await detect(fixture('ICICICreditCardPastStatement.csv'));
        expect(result?.bank).toBe(Bank.ICICICreditCard);
    });

    it('detects an N26 statement', async () => {
        const result = await detect(fixture('N26Statement.csv'));
        expect(result?.bank).toBe(Bank.N26);
    });

    it('detects a Wise statement', async () => {
        const result = await detect(fixture('WiseTransactionHistory.csv'));
        expect(result?.bank).toBe(Bank.Wise);
    });

    it('detects a Trade Republic statement', async () => {
        const result = await detect(fixture('TradeRepublicStatement.json'));
        expect(result?.bank).toBe(Bank.TradeRepublic);
    });

    it('detects an ABN AMRO statement', async () => {
        const result = await detect(fixture('ABNStatement.xls'));
        expect(result?.bank).toBe(Bank.ABN);
        expect(result?.transactions.length).toBe(4);
    });

    it('detects a Standard Chartered statement', async () => {
        const result = await detect(fixture('StandardCharteredStatement.xls'));
        expect(result?.bank).toBe(Bank.StandardChartered);
        expect(result?.transactions.length).toBe(4);
    });

    it('detects a generic MT940 statement', async () => {
        const result = await detect(fixture('MT940Statement.txt'));
        expect(result?.bank).toBe(Bank.GenericMT940);
        expect(result?.transactions.length).toBe(3);
    });

    it('returns null for a file that matches no known bank', async () => {
        const result = await detect(fixture('GenericSignedAmountStatement.csv'));
        expect(result).toBeNull();
    });

    it('returns null for completely unstructured/random content', async () => {
        const bytes = new Uint8Array([1, 2, 3, 4, 5, 255, 254, 253]);
        const result = await detect(bytes.buffer);
        expect(result).toBeNull();
    });
});
