import * as XLSX from 'xlsx';
import { parseAlipayCsv } from './alipay';
import { bytesToText } from './decode';
import type { ParseResult, Txn } from './types';
import { parseWechatCsv } from './wechat';

function detectSource(text: string, filename: string): 'wechat' | 'alipay' | 'unknown' {
  const lower = filename.toLowerCase();
  if (lower.includes('alipay') || lower.includes('支付宝')) return 'alipay';
  if (lower.includes('wechat') || lower.includes('微信') || lower.includes('微信支付')) return 'wechat';
  if (text.includes('支付宝') || text.includes('电子客户回单')) return 'alipay';
  if (text.includes('微信支付') || text.includes('微信昵称') || text.includes('金额(元)')) return 'wechat';
  if (text.includes('交易订单号') && text.includes('商品说明')) return 'alipay';
  if (text.includes('交易单号') && text.includes('当前状态')) return 'wechat';
  return 'unknown';
}

export async function parseBillFile(file: File): Promise<ParseResult> {
  const name = file.name || 'bill';
  const buf = await file.arrayBuffer();

  if (/\.xlsx?$/i.test(name)) {
    const wb = XLSX.read(buf, { type: 'array' });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const csv = XLSX.utils.sheet_to_csv(sheet);
    const source = detectSource(csv, name);
    if (source === 'alipay') return parseAlipayCsv(csv);
    const r = parseWechatCsv(csv);
    if (r.txns.length) return { ...r, source: source === 'unknown' ? 'wechat' : source };
    const a = parseAlipayCsv(csv);
    if (a.txns.length) return a;
    return { source: 'unknown', txns: [], warnings: ['无法识别 xlsx 账单格式'] };
  }

  const { text } = bytesToText(buf);
  const source = detectSource(text, name);
  if (source === 'alipay') return parseAlipayCsv(text);
  if (source === 'wechat') return parseWechatCsv(text);

  const w = parseWechatCsv(text);
  if (w.txns.length) return w;
  const a = parseAlipayCsv(text);
  if (a.txns.length) return a;
  return { source: 'unknown', txns: [], warnings: ['无法识别账单来源，请确认是微信/支付宝官方导出'] };
}

export function mergeTxns(lists: Txn[]): Txn[] {
  const seen = new Set<string>();
  const out: Txn[] = [];
  for (const t of lists) {
    const key = t.txnId
      ? `${t.source}:${t.txnId}`
      : `${t.source}|${t.time.toISOString()}|${t.amount}|${t.counterparty}|${t.direction}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
  }
  out.sort((a, b) => a.time.getTime() - b.time.getTime());
  return out;
}

export function filterYear(txns: Txn[], year: number): Txn[] {
  return txns.filter((t) => t.time.getFullYear() === year);
}

export function isRefundedExpense(t: Txn): boolean {
  if (t.direction !== 'expense') return false;
  return /全额退款|已退款|对方已退还|已退还/.test(t.status);
}

export function isClosed(t: Txn): boolean {
  return /关闭|失败|已关闭/.test(t.status);
}
