import type { ParseResult, Txn } from './types';
import {
  findHeaderIndex,
  parseAmount,
  parseDateTime,
  parseDirection,
  splitCsvLine,
} from './utils';

const MUST = ['交易时间', '收/支'];

export function parseWechatCsv(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const hi = findHeaderIndex(lines, MUST);
  if (hi < 0) {
    return { source: 'wechat', txns: [], warnings: ['未找到微信账单表头（需含「交易时间」「收/支」）'] };
  }
  const header = splitCsvLine(lines[hi]).map((h) => h.replace(/^\uFEFF/, ''));
  const idx = (name: string, aliases: string[] = []) => {
    const keys = [name, ...aliases];
    for (const k of keys) {
      const i = header.findIndex((h) => h === k || h.includes(k));
      if (i >= 0) return i;
    }
    return -1;
  };
  const cTime = idx('交易时间');
  const cType = idx('交易类型');
  const cPeer = idx('交易对方');
  const cGoods = idx('商品');
  const cDir = idx('收/支');
  const cAmt = idx('金额(元)', ['金额']);
  const cStatus = idx('当前状态', ['交易状态']);
  const cTxn = idx('交易单号', ['交易订单号']);

  if (cTime < 0 || cDir < 0 || cAmt < 0) {
    warnings.push('微信表头缺少关键列');
  }

  const txns: Txn[] = [];
  for (let i = hi + 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || line.startsWith('---') || line.includes('合计')) continue;
    const cols = splitCsvLine(line);
    if (cols.length < 5) continue;
    const time = parseDateTime(cols[cTime] || '');
    if (time.getTime() === 0) continue;
    const amount = parseAmount(cols[cAmt] || '0');
    const direction = parseDirection(cols[cDir] || '');
    const txnId = (cols[cTxn] || '').trim();
    const status = (cols[cStatus] || '').trim();
    const counterparty = (cols[cPeer] || '').trim();
    const product = (cols[cGoods] || '').trim();
    const typeOrCategory = (cols[cType] || '').trim();
    const raw: Record<string, string> = {};
    header.forEach((h, j) => {
      raw[h] = cols[j] ?? '';
    });
    txns.push({
      id: txnId || `wechat-${i}-${time.getTime()}`,
      time,
      source: 'wechat',
      typeOrCategory,
      counterparty,
      product,
      direction,
      amount,
      status,
      txnId,
      raw,
    });
  }
  return { source: 'wechat', txns, warnings };
}
