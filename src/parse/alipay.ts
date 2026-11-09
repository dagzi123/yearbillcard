import type { ParseResult, Txn } from './types';
import {
  findHeaderIndex,
  parseAmount,
  parseDateTime,
  parseDirection,
  splitCsvLine,
} from './utils';

const MUST = ['交易时间', '收/支'];

export function parseAlipayCsv(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const hi = findHeaderIndex(lines, MUST);
  if (hi < 0) {
    return { source: 'alipay', txns: [], warnings: ['未找到支付宝账单表头（需含「交易时间」「收/支」）'] };
  }
  const header = splitCsvLine(lines[hi]).map((h) => h.replace(/^\uFEFF/, '').replace(/,$/, ''));
  const idx = (name: string, aliases: string[] = []) => {
    const keys = [name, ...aliases];
    for (const k of keys) {
      const i = header.findIndex((h) => h === k || h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };
  const cTime = idx('交易时间', ['交易创建时间']);
  const cCat = idx('交易分类', ['类型']);
  const cPeer = idx('交易对方');
  const cGoods = idx('商品说明', ['商品名称', '商品']);
  const cDir = idx('收/支');
  const cAmt = idx('金额', ['金额（元）', '金额(元)']);
  const cStatus = idx('交易状态');
  const cTxn = idx('交易订单号', ['交易号', '交易单号']);

  const txns: Txn[] = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('---')) continue;
    const cols = splitCsvLine(line.replace(/,$/, ''));
    if (cols.length < 5) continue;
    const time = parseDateTime(cols[cTime] || '');
    if (time.getTime() === 0) continue;
    const amount = parseAmount(cols[cAmt] || '0');
    const direction = parseDirection(cols[cDir] || '');
    const txnId = (cols[cTxn] || '').trim();
    const status = (cols[cStatus] || '').trim();
    txns.push({
      id: txnId || `alipay-${i}-${time.getTime()}`,
      time,
      source: 'alipay',
      typeOrCategory: (cols[cCat] || '').trim(),
      counterparty: (cols[cPeer] || '').trim(),
      product: (cols[cGoods] || '').trim(),
      direction,
      amount,
      status,
      txnId,
      raw: Object.fromEntries(header.map((h, j) => [h, cols[j] ?? ''])),
    });
  }
  if (!txns.length) warnings.push('支付宝解析结果为空，请确认编码为 GBK 且为官方导出');
  return { source: 'alipay', txns, warnings };
}
