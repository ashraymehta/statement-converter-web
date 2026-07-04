import parse from 'multi-number-parse';

const CURRENCY_PATTERN = /^(INR|USD|EUR|GBP|[₹$€£])\s*|\s*(INR|USD|EUR|GBP)$/gi;
const INDICATOR_PATTERN = /^(dr|debit|cr|credit)\.?|(dr|debit|cr|credit)\.?$/i;
const PAREN_NEGATIVE_PATTERN = /^\((.*)\)$/;

/**
 * Detects and strips a leading or trailing credit/debit indicator word
 * (case-insensitive, optional trailing period, and tolerant of no whitespace
 * before a following digit, e.g. "CR500.00") from a cell's text.
 *
 * Used both defensively inside `NumberUtil.parseNumber` (so a stray indicator
 * can't corrupt magnitude parsing) and directly by the `'indicator'` amount
 * pattern in `generic.ts`, where the direction signal is embedded in the same
 * cell as the amount (e.g. ICICI Credit Card's "Dr.1,499.00" / "CR500.00").
 */
export function extractIndicator(text: string): { cleaned: string; isDebit: boolean | null } {
    const match = text.match(INDICATOR_PATTERN);
    if (!match) {
        return { cleaned: text, isDebit: null };
    }

    const word = (match[1] ?? match[2]).toLowerCase();
    const isDebit = word === 'dr' || word === 'debit';
    const cleaned = text.replace(match[0], '').trim();
    return { cleaned, isDebit };
}

export class NumberUtil {
    private readonly commonSeparators = [',', '.'];

    public parseNumber(text: string): number | undefined {
        if (!text) {
            return undefined;
        }

        let trimmedText = text.trim();
        if (!trimmedText) {
            return undefined;
        }

        // Parenthesized negative notation, e.g. "(1,234.56)" -> -1234.56
        let isParenNegative = false;
        const parenMatch = trimmedText.match(PAREN_NEGATIVE_PATTERN);
        if (parenMatch) {
            isParenNegative = true;
            trimmedText = parenMatch[1].trim();
        }

        // Strip currency symbols/codes from either end, e.g. "INR 11,225.00", "₹5,000.00".
        trimmedText = trimmedText.replace(CURRENCY_PATTERN, '').trim();

        // Strip a stray credit/debit indicator so it can't corrupt the
        // lakh-grouping detection below, e.g. "5,000.00 Dr." -> "5,000.00".
        // (The indicator's *meaning* is handled separately by extractIndicator()
        // for the 'indicator' amount pattern — this is purely defensive.)
        trimmedText = extractIndicator(trimmedText).cleaned.trim();

        if (!trimmedText) {
            return undefined;
        }

        // Remove duplicate separators that multi-number-parse can't handle,
        // e.g. Indian lakh formatting: 2,00,000.00
        let parsableText = trimmedText;
        for (const separator of this.commonSeparators) {
            if (trimmedText.split(separator).length > 2) {
                parsableText = trimmedText.replace(separator, '');
                break;
            }
        }

        const result = parse(parsableText) as number;
        // multi-number-parse returns NaN (not undefined) for anything it can't
        // parse — normalise to undefined so every `?? 0` fallback downstream
        // behaves correctly instead of silently propagating NaN.
        if (Number.isNaN(result)) {
            return undefined;
        }

        return isParenNegative ? -Math.abs(result) : result;
    }
}
