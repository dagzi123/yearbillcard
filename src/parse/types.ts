export type BillSource = 'wechat' | 'alipay' | 'unknown';

export type Direction = 'income' | 'expense' | 'neutral';

export interface Txn {
  id: string;
  time: Date;
  source: BillSource;
  typeOrCategory: string;
  counterparty: string;
  product: string;
  direction: Direction;
  amount: number;
  status: string;
  txnId: string;
  raw: Record<string, string>;
}

export interface ParseResult {
  source: BillSource;
  txns: Txn[];
  warnings: string[];
}
