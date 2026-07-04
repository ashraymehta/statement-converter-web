import { describe, it, expect } from 'vitest';
import { NumberUtil, extractIndicator } from '../lib/converter/helpers/NumberUtil';

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

    // Regression coverage for the ICICI zero-amount bug: currency-prefixed
    // amounts previously parsed to NaN, which leaked through as blank/0
    // rather than a real value.
    it('strips a leading currency code before parsing', () => {
        expect(util.parseNumber('INR 11,225.00')).toBe(11225);
    });

    it('strips a leading currency symbol before parsing', () => {
        expect(util.parseNumber('₹5,000.00')).toBe(5000);
        expect(util.parseNumber('$1,234.56')).toBe(1234.56);
    });

    it('strips a trailing currency code before parsing', () => {
        expect(util.parseNumber('1,234.00 USD')).toBe(1234);
    });

    it('handles parenthesized negative notation', () => {
        expect(util.parseNumber('(1,234.56)')).toBe(-1234.56);
    });

    it('never leaks NaN — returns undefined instead', () => {
        expect(util.parseNumber('not a number')).toBeUndefined();
    });

    describe('stray credit/debit indicators', () => {
        it('strips a trailing indicator without corrupting lakh-grouping detection', () => {
            // Previously the stray "." in "Dr." tripped the duplicate-separator
            // heuristic and mangled the magnitude (e.g. "5,000.00 Dr." -> 5).
            expect(util.parseNumber('5,000.00 Dr.')).toBe(5000);
            expect(util.parseNumber('5,000.00 CR')).toBe(5000);
        });

        it('strips an indicator embedded with no whitespace before a digit', () => {
            expect(util.parseNumber('CR500.00')).toBe(500);
            expect(util.parseNumber('Dr.1,499.00')).toBe(1499);
        });

        it('is case-insensitive', () => {
            expect(util.parseNumber('1,234.00 DR')).toBe(1234);
            expect(util.parseNumber('1,234.00 dr')).toBe(1234);
            expect(util.parseNumber('1,234.00 Debit')).toBe(1234);
        });
    });
});

describe('extractIndicator', () => {
    it('detects a trailing debit indicator with a period', () => {
        expect(extractIndicator('5,000.00 Dr.')).toEqual({ cleaned: '5,000.00', isDebit: true });
    });

    it('detects a leading debit indicator with no whitespace', () => {
        expect(extractIndicator('Dr.1,499.00')).toEqual({ cleaned: '1,499.00', isDebit: true });
    });

    it('detects a credit indicator with no whitespace before a digit', () => {
        expect(extractIndicator('CR500.00')).toEqual({ cleaned: '500.00', isDebit: false });
    });

    it('is case-insensitive and tolerates the "Debit"/"Credit" long forms', () => {
        expect(extractIndicator('1,234.00 Credit')).toEqual({ cleaned: '1,234.00', isDebit: false });
        expect(extractIndicator('1,234.00 debit')).toEqual({ cleaned: '1,234.00', isDebit: true });
    });

    it('returns isDebit: null when no indicator is present', () => {
        expect(extractIndicator('1,234.00')).toEqual({ cleaned: '1,234.00', isDebit: null });
    });
});
