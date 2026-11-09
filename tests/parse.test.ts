import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import iconv from 'iconv-lite';
import { describe, expect, it } from 'vitest';
import { parseAlipayCsv } from '../src/parse/alipay';
import { filterYear, mergeTxns } from '../src/parse/detect';
import { parseWechatCsv } from '../src/parse/wechat';
import { computeStats } from '../src/stats/compute';
import { categorize } from '../src/stats/categorize';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('wechat parser', () => {
  it('parses synthetic wechat csv', () => {
    const text = readFileSync(join(root, 'sample/wechat_sample.csv'), 'utf-8');
    expect(text).toContain('SYNTHETIC');
    const r = parseWechatCsv(text);
    expect(r.txns.length).toBeGreaterThan(200);
    const meituan = r.txns.find((t) => t.counterparty.includes('美团'));
    expect(meituan?.direction).toBe('expense');
    expect(meituan!.amount).toBeGreaterThan(10);
    const refund = r.txns.find((t) => /全额退款|已退款|退款成功/.test(t.status));
    expect(refund).toBeTruthy();
  });
});

describe('alipay parser', () => {
  it('parses synthetic alipay gbk csv', () => {
    const buf = readFileSync(join(root, 'sample/alipay_sample.csv'));
    const text = iconv.decode(buf, 'gbk');
    expect(text).toContain('支付宝');
    expect(text).toContain('SYNTHETIC');
    const r = parseAlipayCsv(text);
    expect(r.txns.length).toBeGreaterThan(200);
    const tea = r.txns.find((t) => /瑞幸|奈雪|喜茶|星巴克|霸王茶姬/.test(t.counterparty));
    expect(tea?.direction).toBe('expense');
    const neutral = r.txns.find((t) => t.direction === 'neutral');
    expect(neutral).toBeTruthy();
  });
});

describe('merge + stats', () => {
  it('merges and computes 2025 persona stats', () => {
    const w = parseWechatCsv(readFileSync(join(root, 'sample/wechat_sample.csv'), 'utf-8'));
    const a = parseAlipayCsv(iconv.decode(readFileSync(join(root, 'sample/alipay_sample.csv')), 'gbk'));
    const all = mergeTxns([...w.txns, ...a.txns]);
    const y = filterYear(all, 2025);
    expect(y.length).toBe(all.length);
    expect(all.length).toBeGreaterThanOrEqual(300);
    expect(all.length).toBeLessThanOrEqual(600);
    const stats = computeStats(all, 2025);
    expect(stats.expenseTotal).toBeGreaterThan(10000);
    expect(stats.teaCoffeeCups).toBeGreaterThan(10);
    expect(stats.takeoutCount).toBeGreaterThan(10);
    expect(stats.persona.length).toBeGreaterThan(0);
    expect(stats.funLines.length).toBeGreaterThan(2);
    expect(stats.topMerchants.length).toBeGreaterThan(0);
    expect(stats.busiestDay).toBeTruthy();
    const takeout = y.filter((t) => categorize(t) === '外卖' && t.direction === 'expense');
    expect(takeout.length).toBeGreaterThan(0);
  });
});
