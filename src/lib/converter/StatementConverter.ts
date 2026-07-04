import { Bank } from './models/Bank';
import { type Transaction } from './models/Transaction';
import { MT940Adapter } from './adapters/MT940Adapter';
import { TradeRepublicAdapter } from './adapters/TradeRepublicAdapter';
import { applyMapping } from './generic';
import { resolvePresetMapping, BANK_PRESETS } from './presets';

const mt940Adapter = new MT940Adapter();
const tradeRepublicAdapter = new TradeRepublicAdapter();

/**
 * Parses a bank statement file into normalised transactions.
 * This is the "parse" step; output conversion (toQif / toCsv) is separate.
 *
 * The 7 tabular banks (Axis, ICICI, ICICI Credit Card, Standard Chartered,
 * ABN, N26, Wise) are declarative presets (see `presets.ts`) resolved through
 * the shared `applyMapping` engine (`generic.ts`) — the same engine used for
 * the unrecognised-bank column-mapping fallback. A bank is data (header
 * aliases + amount pattern), not a bespoke parsing class. Some banks (ICICI)
 * have more than one real-world layout; each candidate preset is tried in
 * order until one resolves with at least one transaction.
 *
 * MT940 (SWIFT tags) and Trade Republic (JSON) aren't tabular/header-driven
 * data, so they keep their own bespoke adapters.
 */
export async function parse(bank: Bank, fileData: ArrayBuffer): Promise<Transaction[]> {
    if (bank === Bank.GenericMT940) {
        return mt940Adapter.convert(fileData);
    }
    if (bank === Bank.TradeRepublic) {
        return tradeRepublicAdapter.convert(fileData);
    }

    const presets = BANK_PRESETS.filter((p) => p.bank === bank);
    if (presets.length === 0) {
        throw new Error(`No adapter found for bank [${bank}]`);
    }

    for (const preset of presets) {
        const resolved = resolvePresetMapping(fileData, preset);
        if (resolved) {
            const transactions = applyMapping(resolved.table, resolved.mapping);
            if (transactions.length > 0) {
                return transactions;
            }
        }
    }
    return [];
}

/**
 * Order in which to try each known bank when auto-detecting a statement's format.
 * `parse()` never throws for a preset-based bank whose headers don't resolve —
 * it returns an empty array — so trying each bank in turn and keeping the
 * first non-empty result is a reliable, zero-duplication detector that reuses
 * the exact same logic that already parses each format.
 *
 * Ordered most-distinctive-headers-first to minimise any residual collision
 * risk between similar formats (e.g. ICICI Credit Card, which needs "Details"/
 * "Transaction Details", is tried before plain ICICI, which needs "Transaction
 * Remark(s)" instead). Standard Chartered's headers ("Date", "Transaction",
 * "Deposit", "Withdrawal") are the most generic of the set, so it's tried last.
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
 * each bank in `DETECTION_ORDER` until one parses successfully with at least
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
