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
