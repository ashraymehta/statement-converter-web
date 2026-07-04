import type { Bank } from '../models/Bank';
import type { Transaction } from '../models/Transaction';

export abstract class TransactionAdapter {
    public abstract convert(fileData: ArrayBuffer): Promise<Transaction[]>;
    public abstract supports(bank: Bank): boolean;
}
