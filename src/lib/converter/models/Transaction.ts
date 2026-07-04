export interface Transaction {
    Payee: string;
    Outflow: number;
    Inflow: number;
    Date: Date;
    Memo: string;
    Category: string | null;
}
