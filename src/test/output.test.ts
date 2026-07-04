import { describe, it, expect } from 'vitest';
import { toQif, toCsv } from '../lib/converter/index';
import type { Transaction } from '../lib/converter/index';

const sample: Transaction[] = [
    {
        Payee: 'Coffee Shop',
        Outflow: 4.5,
        Inflow: 0,
        Date: new Date('2024-06-10'),
        Memo: 'Morning coffee',
        Category: 'Food',
    },
    {
        Payee: 'Employer Ltd',
        Outflow: 0,
        Inflow: 2500,
        Date: new Date('2024-06-01'),
        Memo: 'Salary',
        Category: null,
    },
];

describe('toQif', () => {
    it('produces a valid QIF Cash header', () => {
        const result = toQif(sample);
        expect(result).toContain('!Type:Cash');
    });

    it('encodes outflow as negative amount', () => {
        const result = toQif(sample);
        expect(result).toContain('T-4.5');
    });

    it('encodes inflow as positive amount', () => {
        const result = toQif(sample);
        expect(result).toContain('T2500');
    });

    it('includes payee and memo', () => {
        const result = toQif(sample);
        expect(result).toContain('PCoffee Shop');
        expect(result).toContain('MMorning coffee');
    });

    it('uses record separator ^', () => {
        const result = toQif(sample);
        expect(result.split('^\r\n').length - 1).toBe(2);
    });
});

describe('toCsv', () => {
    it('produces a header row', () => {
        const result = toCsv(sample);
        expect(result.split('\n')[0]).toBe('Date,Payee,Memo,Outflow,Inflow,Category');
    });

    it('produces correct number of data rows', () => {
        const lines = toCsv(sample).split('\n');
        expect(lines).toHaveLength(3); // header + 2 data rows
    });

    it('escapes commas in values', () => {
        const tricky: Transaction[] = [{
            Payee: 'Acme, Inc.',
            Outflow: 10,
            Inflow: 0,
            Date: new Date('2024-06-15'),
            Memo: '',
            Category: null,
        }];
        const result = toCsv(tricky);
        expect(result).toContain('"Acme, Inc."');
    });
});
