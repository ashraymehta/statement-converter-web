export enum Bank {
    ABN = 'abn',
    Axis = 'axis',
    GenericMT940 = 'Others (MT940)',
    ICICI = 'icici',
    ICICICreditCard = 'icicicc',
    N26 = 'n26',
    StandardChartered = 'sc',
    TradeRepublic = 'trade_republic',
    Wise = 'wise',
}

/** Human-readable label for each bank value */
export const BankLabels: Record<Bank, string> = {
    [Bank.ABN]: 'ABN AMRO',
    [Bank.Axis]: 'Axis Bank',
    [Bank.GenericMT940]: 'Generic MT940',
    [Bank.ICICI]: 'ICICI Bank',
    [Bank.ICICICreditCard]: 'ICICI Credit Card',
    [Bank.N26]: 'N26',
    [Bank.StandardChartered]: 'Standard Chartered',
    [Bank.TradeRepublic]: 'Trade Republic',
    [Bank.Wise]: 'Wise',
};
