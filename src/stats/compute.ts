import { isClosed, isRefundedExpense } from '../parse/detect';
import type { Txn } from '../parse/types';
import { categorize } from './categorize';
import type { Cat } from './categorize';

export interface YearStats {
  year: number;
  expenseTotal: number;
  incomeTotal: number;
  expenseCount: number;
  incomeCount: number;
  byCategory: { cat: Cat; amount: number; count: number }[];
  topMerchants: { name: string; amount: number; count: number }[];
  biggest: Txn | null;
  monthly: { month: number; amount: number }[];
  lateNight: { count: number; amount: number };
  teaCoffeeCups: number;
  takeoutCount: number;
  persona: string;
  personaDetail: string;
  spendingTxns: Txn[];
}

function isLifestyleExpense(t: Txn): boolean {
  if (t.direction !== 'expense') return false;
  if (isClosed(t) || isRefundedExpense(t)) return false;
  const cat = categorize(t);
  if (cat === '转账红包') return false;
  return true;
}

export function computeStats(txns: Txn[], year: number): YearStats {
  const yearTxns = txns.filter((t) => t.time.getFullYear() === year);
  let expenseTotal = 0;
  let incomeTotal = 0;
  let expenseCount = 0;
  let incomeCount = 0;
  const catMap = new Map<Cat, { amount: number; count: number }>();
  const merchantMap = new Map<string, { amount: number; count: number }>();
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }));
  let lateNight = { count: 0, amount: 0 };
  let teaCoffeeCups = 0;
  let takeoutCount = 0;
  let biggest: Txn | null = null;
  const spendingTxns: Txn[] = [];

  for (const t of yearTxns) {
    if (t.direction === 'income' && !isClosed(t)) {
      incomeTotal += t.amount;
      incomeCount++;
      continue;
    }
    if (!isLifestyleExpense(t)) continue;
    spendingTxns.push(t);
    expenseTotal += t.amount;
    expenseCount++;
    const cat = categorize(t);
    const c = catMap.get(cat) || { amount: 0, count: 0 };
    c.amount += t.amount;
    c.count++;
    catMap.set(cat, c);

    const mName = t.counterparty || t.product || '未知';
    const m = merchantMap.get(mName) || { amount: 0, count: 0 };
    m.amount += t.amount;
    m.count++;
    merchantMap.set(mName, m);

    monthly[t.time.getMonth()].amount += t.amount;
    const h = t.time.getHours();
    if (h >= 23 || h < 5) {
      lateNight.count++;
      lateNight.amount += t.amount;
    }
    if (cat === '奶茶咖啡') teaCoffeeCups++;
    if (cat === '外卖') takeoutCount++;
    if (!biggest || t.amount > biggest.amount) biggest = t;
  }

  const byCategory = [...catMap.entries()]
    .map(([cat, v]) => ({ cat, ...v }))
    .sort((a, b) => b.amount - a.amount);

  const topMerchants = [...merchantMap.entries()]
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  const { persona, personaDetail } = pickPersona({
    expenseTotal,
    byCategory,
    lateNight,
    teaCoffeeCups,
    takeoutCount,
    monthly,
  });

  return {
    year,
    expenseTotal,
    incomeTotal,
    expenseCount,
    incomeCount,
    byCategory,
    topMerchants,
    biggest,
    monthly,
    lateNight,
    teaCoffeeCups,
    takeoutCount,
    persona,
    personaDetail,
    spendingTxns,
  };
}

function pickPersona(s: {
  expenseTotal: number;
  byCategory: { cat: Cat; amount: number }[];
  lateNight: { count: number; amount: number };
  teaCoffeeCups: number;
  takeoutCount: number;
  monthly: { amount: number }[];
}): { persona: string; personaDetail: string } {
  const top = s.byCategory[0]?.cat;
  if (s.teaCoffeeCups >= 8) {
    return {
      persona: '移动咖啡因续航体',
      personaDetail: `奶茶/咖啡约 ${s.teaCoffeeCups} 杯，血管里流的是糖分和 deadline。`,
    };
  }
  if (s.takeoutCount >= 10 || top === '外卖') {
    return {
      persona: '外卖拯救加班人',
      personaDetail: `外卖约 ${s.takeoutCount} 单，厨房灯可能已经进博物馆了。`,
    };
  }
  if (s.lateNight.count >= 5) {
    return {
      persona: '深夜消费刺客克星（受害者）',
      personaDetail: `深夜下单 ${s.lateNight.count} 次，月亮看见了你的购物车。`,
    };
  }
  if (top === '房租') {
    return {
      persona: '给房东打工的城市游牧民',
      personaDetail: '房租抬头见喜（喜的是房东）。',
    };
  }
  if (top === '游戏娱乐') {
    return {
      persona: '快乐优先级 MAX',
      personaDetail: '娱乐开支领先，精神状态暂时比钱包富裕。',
    };
  }
  if (top === '交通') {
    return {
      persona: '城市漂流瓶',
      personaDetail: '一半时间在路上，另一半在等车。',
    };
  }
  let peakMonth = 1;
  let peakAmt = 0;
  s.monthly.forEach((b, i) => {
    if (b.amount > peakAmt) {
      peakAmt = b.amount;
      peakMonth = i + 1;
    }
  });
  return {
    persona: '人间清醒记账选手',
    personaDetail: `全年生活支出约 ¥${s.expenseTotal.toFixed(0)}，峰值在 ${peakMonth} 月。`,
  };
}

export function formatMoney(n: number, privacy: boolean): string {
  if (privacy) return '¥•••';
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
