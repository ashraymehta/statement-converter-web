import { Bank } from './models/Bank';
import { type Transaction } from './models/Transaction';
import { type TransactionAdapter } from './adapters/TransactionAdapter';
import { AxisAdapter } from './adapters/AxisAdapter';
import { ICICIAdapter } from './adapters/ICICIAdapter';
import { ICICICreditCardAdapter } from './adapters/ICICICreditCardAdapter';
import { StandardCharteredAdapter } from './adapters/StandardCharteredAdapter';
import { ABNAdapter } from './adapters/ABNAdapter';
import { N26Adapter } from './adapters/N26Adapter';
import { MT940Adapter } from './adapters/MT940Adapter';
import { WiseAdapter } from './adapters/WiseAdapter';
import { TradeRepublicAdapter } from './adapters/TradeRepublicAdapter';

const allAdapters: TransactionAdapter[] = [
    new AxisAdapter(),
    new ICICIAdapter(),
    new ICICICreditCardAdapter(),
    new StandardCharteredAdapter(),
    new ABNAdapter(),
    new N26Adapter(),
    new MT940Adapter(),
    new WiseAdapter(),
    new TradeRepublicAdapter(),
];

/**
 * Parses a bank statement file into normalised transactions.
 * This is the "parse" step; output conversion (toQif / toCsv) is separate.
 */
export async function parse(bank: Bank, fileData: ArrayBuffer): Promise<Transaction[]> {
    const adapter = allAdapters.find((a) => a.supports(bank));
    if (!adapter) {
        throw new Error(`No adapter found for bank [${bank}]`);
    }
    return adapter.convert(fileData);
}

/**
 * Order in which to try each known bank when auto-detecting a statement's format.
 * Every adapter locates its expected header cells and throws (or returns zero rows)
 * the moment a required header is missing, so trying each `parse()` in turn and
 * keeping the first non-empty, non-throwing result is a reliable, zero-duplication
 * detector — it reuses the exact same logic that already parses each format, so
 * detection can never drift out of sync with the adapters.
 *
 * Ordered most-distinctive-headers-first to minimise any residual collision risk
 * between similar formats (e.g. ICICI Credit Card, which needs "Details"/
 * "Transaction Details", is tried before plain ICICI, which needs "Transaction
 * Remark(s)" instead — the two header sets don't overlap, but this keeps the more
 * specific format first defensively). Standard Chartered's headers ("Date",
 * "Transaction", "Deposit", "Withdrawal") are the most generic of the set, so it's
 * tried last.
 */
const DETECTION_ORDER: Bank[] = [
    Bank.TradeRepublic,
    Bank.GenericMT940,
    Bank.Axis,
    Bank.N26,
    Bank.Wise,
    Bank.ABN,
    Bank.ICICICreditCard,
    Bank.ICICI,
    Bank.StandardChartered,
];

export interface DetectionResult {
    bank: Bank;
    transactions: Transaction[];
}

/** Cheap pre-check so MT940 detection doesn't rely solely on the parser's error behavior. */
function looksLikeMT940(fileData: ArrayBuffer): boolean {
    const text = new TextDecoder().decode(fileData);
    return /^:(20|25|28C?|60F|61|86|62F):/m.test(text);
}

/**
 * Attempts to auto-detect which known bank a statement file belongs to by trying
 * each adapter in `DETECTION_ORDER` until one parses successfully with at least
 * one transaction. Returns `null` if no known bank matches — the caller should
 * fall back to generic column mapping (see `generic.ts`) rather than treating
 * this as a hard failure.
 */
export async function detect(fileData: ArrayBuffer): Promise<DetectionResult | null> {
    for (const bank of DETECTION_ORDER) {
        if (bank === Bank.GenericMT940 && !looksLikeMT940(fileData)) {
            continue;
        }
        try {
            const transactions = await parse(bank, fileData);
            if (transactions.length > 0) {
                return { bank, transactions };
            }
        } catch {
            // Not this format — try the next candidate.
        }
    }
    return null;
}
