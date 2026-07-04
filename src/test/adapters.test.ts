import { readFileSync } from 'fs';
import { join } from 'path';
import { describe, it, expect } from 'vitest';
import { parse, Bank } from '../lib/converter/index';
import { expectValidTransactions } from './helpers';

const fixture = (name: string): ArrayBuffer => {
    const buf = readFileSync(join(__dirname, 'fixtures', name));
    return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
};

describe('StatementConverter — adapter integration', () => {
    it('parses an Axis Bank statement', async () => {
        const result = await parse(Bank.Axis, fixture('AxisBankStatement.xls'));
        expectValidTransactions(result);
        expect(result[0]).toMatchObject({ Payee: 'SALARY JUNE', Inflow: 85000, Outflow: 0 });
    });

    it('parses an ICICI Bank statement (full)', async () => {
        const result = await parse(Bank.ICICI, fixture('ICICIBankStatement.xls'));
        expectValidTransactions(result);
        expect(result[0]).toMatchObject({ Payee: 'SALARY CREDIT', Inflow: 90000, Outflow: 0 });
        expect(result[1]).toMatchObject({ Payee: 'ATM WITHDRAWAL', Outflow: 5000, Inflow: 0 });
    });

    it('parses an ICICI Bank mini-statement', async () => {
        const result = await parse(Bank.ICICI, fixture('ICICIBankMiniStatement.xls'));
        expectValidTransactions(result);
        expect(result[0]).toMatchObject({ Payee: 'NEFT FROM XYZ CO', Inflow: 45000, Outflow: 0 });
    });

    it('parses an ICICI Credit Card statement (.xls)', async () => {
        const result = await parse(Bank.ICICICreditCard, fixture('ICICICreditCardStatement.xls'));
        expectValidTransactions(result);
        expect(result[0]).toMatchObject({ Payee: 'AMAZON SHOPPING', Outflow: 3499, Inflow: 0 });
    });

    it('parses an ICICI Credit Card past statement (.csv)', async () => {
        const result = await parse(Bank.ICICICreditCard, fixture('ICICICreditCardPastStatement.csv'));
        expectValidTransactions(result);
        expect(result[0]).toMatchObject({ Payee: 'ZARA SHOPPING', Outflow: 1499, Inflow: 0 });
    });

    it('parses a Standard Chartered statement', async () => {
        const result = await parse(Bank.StandardChartered, fixture('StandardCharteredStatement.xls'));
        expectValidTransactions(result);
        expect(result[0]).toMatchObject({ Payee: 'Salary credit', Inflow: 75000, Outflow: 0 });
    });

    it('parses an ABN AMRO statement', async () => {
        const result = await parse(Bank.ABN, fixture('ABNStatement.xls'));
        expectValidTransactions(result);
        expect(result[0]).toMatchObject({ Payee: 'Salary payment', Inflow: 2450, Outflow: 0 });
    });

    it('parses an N26 statement (.csv)', async () => {
        const result = await parse(Bank.N26, fixture('N26Statement.csv'));
        expectValidTransactions(result);
        const outRow = result.find((r) => r.Outflow > 0);
        const inRow = result.find((r) => r.Inflow > 0);
        expect(outRow).toBeDefined();
        expect(inRow).toBeDefined();
    });

    it('parses a Wise statement (.csv)', async () => {
        const result = await parse(Bank.Wise, fixture('WiseTransactionHistory.csv'));
        expectValidTransactions(result);
        expect(result[0]).toMatchObject({ Payee: 'Alice Receiver', Outflow: 120, Inflow: 0 });
    });

    it('parses a generic MT940 statement', async () => {
        const result = await parse(Bank.GenericMT940, fixture('MT940Statement.txt'));
        expectValidTransactions(result);
    });

    it('parses a Trade Republic statement (.json)', async () => {
        const result = await parse(Bank.TradeRepublic, fixture('TradeRepublicStatement.json'));
        expectValidTransactions(result);
        expect(result).toHaveLength(3);
        // Dividend: positive amount → inflow
        expect(result[0].Inflow).toBe(12.5);
        expect(result[0].Outflow).toBe(0);
        // Savings plan: negative amount → outflow
        expect(result[1].Outflow).toBe(100);
        expect(result[1].Inflow).toBe(0);
        // Sell: positive → inflow
        expect(result[2].Inflow).toBe(350);
    });

    it('throws for an unknown bank', async () => {
        const buf = new ArrayBuffer(4);
        await expect(parse('unknown_bank' as Bank, buf)).rejects.toThrow('No adapter found');
    });
});
