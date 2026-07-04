import { describe, it, expect } from 'vitest';
import { NumberUtil } from '../lib/converter/helpers/NumberUtil';

describe('NumberUtil', () => {
    const util = new NumberUtil();

    it('parses a plain number', () => {
        expect(util.parseNumber('1234.56')).toBe(1234.56);
    });

    it('trims whitespace before parsing', () => {
        expect(util.parseNumber('  99.00  ')).toBe(99);
    });

    it('returns undefined for null/empty input', () => {
        expect(util.parseNumber('')).toBeUndefined();
        expect(util.parseNumber(null as unknown as string)).toBeUndefined();
    });

    it('handles Indian lakh separators (2,00,000.00)', () => {
        const result = util.parseNumber('2,00,000.00');
        expect(result).toBe(200000);
    });

    it('handles European thousands separators (14.327,59)', () => {
        const result = util.parseNumber('14.327,59');
        expect(result).toBe(14327.59);
    });
});
