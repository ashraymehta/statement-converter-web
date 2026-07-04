import { Bank } from '../models/Bank';
import { type Transaction } from '../models/Transaction';
import { TransactionAdapter } from './TransactionAdapter';

interface TradeRepublicItem {
    timestamp: string;
    title: string;
    eventType: string;
    amount: { value: string | number };
}

interface TradeRepublicJson {
    items: TradeRepublicItem[];
}

export class TradeRepublicAdapter extends TransactionAdapter {
    public async convert(fileData: ArrayBuffer): Promise<Transaction[]> {
        const text = new TextDecoder().decode(fileData);
        const data = JSON.parse(text) as TradeRepublicJson;

        if (!data.items || !Array.isArray(data.items)) {
            throw new Error('Trade Republic JSON must contain an "items" array');
        }

        return data.items.map((item) => {
            const date = new Date(item.timestamp);
            const amount = Number(item.amount.value);
            const isOutflow = amount < 0;

            return <Transaction>{
                Payee: item.title ?? '',
                Outflow: isOutflow ? Math.abs(amount) : 0,
                Inflow: !isOutflow ? amount : 0,
                Date: date,
                Memo: item.eventType ?? '',
                Category: null,
            };
        });
    }

    public supports(bank: Bank): boolean {
        return bank === Bank.TradeRepublic;
    }
}
