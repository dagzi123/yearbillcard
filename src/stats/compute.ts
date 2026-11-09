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
  byCategory: { cat: Cat; amount: number; count: number; pct: number }[];
  topMerchants: { name: string; amount: number; count: number; pct: number }[];
  biggest: Txn | null;
  monthly: { month: number; amount: number }[];
  lateNight: { count: number; amount: number; latestLabel: string };
  teaCoffeeCups: number;
  takeoutCount: number;
  metroRides: number;
  travelSpend: number;
  persona: string;
  personaDetail: string;
  wittyLine: string;
  funLines: string[];
  busiestDay: { label: string; amount: number; count: number } | null;
  spendingTxns: Txn[];
}

function isLifestyleExpense(t: Txn): boolean {
  if (t.direction !== 'expense') return false;
  if (isClosed(t) || isRefundedExpense(t)) return false;
  if (categorize(t) === '转账红包') return false;
  return true;
}

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

function truncName(name: string, max = 14): string {
  const s = name.trim();
  if ([...s].length <= max) return s;
  return [...s].slice(0, max - 1).join('') + '…';
}

export function computeStats(txns: Txn[], year: number): YearStats {
  const yearTxns = txns.filter((t) => t.time.getFullYear() === year);
  let expenseTotal = 0;
  let incomeTotal = 0;
  let expenseCount = 0;
  let incomeCount = 0;
  const catMap = new Map<Cat, { amount: number; count: number }>();
  const merchantMap = new Map<string, { amount: number; count: number }>();
  const dayMap = new Map<string, { amount: number; count: number }>();
  const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, amount: 0 }));
  let lateNight = { count: 0, amount: 0, latestLabel: '—' };
  let latestNightMin = -1;
  let teaCoffeeCups = 0;
  let takeoutCount = 0;
  let metroRides = 0;
  let travelSpend = 0;
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
    const dayKey = `${t.time.getMonth() + 1}/${t.time.getDate()}`;
    const d = dayMap.get(dayKey) || { amount: 0, count: 0 };
    d.amount += t.amount;
    d.count++;
    dayMap.set(dayKey, d);

    const h = t.time.getHours();
    const min = t.time.getMinutes();
    if (h >= 23 || h < 5) {
      lateNight.count++;
      lateNight.amount += t.amount;
      // "latest" = furthest past midnight into early morning, else latest before midnight
      const score = h < 5 ? 24 + h : h;
      const scoreMin = score * 60 + min;
      if (scoreMin > latestNightMin) {
        latestNightMin = scoreMin;
        lateNight.latestLabel = `${pad2(h)}:${pad2(min)} · ${truncName(mName, 10)}`;
      }
    }
    if (cat === '奶茶咖啡') teaCoffeeCups++;
    if (cat === '外卖') takeoutCount++;
    if (/地铁|乘车码|公交/.test(`${t.counterparty}${t.product}`)) metroRides++;
    if (/高铁|酒店|机票|飞猪|携程|景区|旅行/.test(`${t.counterparty}${t.product}${t.typeOrCategory}`)) {
      travelSpend += t.amount;
    }
    if (!biggest || t.amount > biggest.amount) biggest = t;
  }

  const byCategory = [...catMap.entries()]
    .map(([cat, v]) => ({
      cat,
      ...v,
      pct: expenseTotal > 0 ? Math.round((v.amount / expenseTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);

  const topMerchants = [...merchantMap.entries()]
    .map(([name, v]) => ({
      name,
      ...v,
      pct: expenseTotal > 0 ? Math.round((v.amount / expenseTotal) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 8);

  let busiestDay: YearStats['busiestDay'] = null;
  for (const [label, v] of dayMap) {
    if (!busiestDay || v.amount > busiestDay.amount) busiestDay = { label, ...v };
  }

  const { persona, personaDetail } = pickPersona({
    expenseTotal,
    byCategory,
    lateNight,
    teaCoffeeCups,
    takeoutCount,
    monthly,
  });

  const funLines = buildFunLines({
    takeoutCount,
    teaCoffeeCups,
    metroRides,
    lateNight,
    expenseTotal,
    travelSpend,
  });

  const wittyLine = buildWittyLine({ persona, takeoutCount, teaCoffeeCups, lateNight, busiestDay });

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
    metroRides,
    travelSpend,
    persona,
    personaDetail,
    wittyLine,
    funLines,
    busiestDay,
    spendingTxns,
  };
}

function buildFunLines(s: {
  takeoutCount: number;
  teaCoffeeCups: number;
  metroRides: number;
  lateNight: { count: number };
  expenseTotal: number;
  travelSpend: number;
}): string[] {
  const lines: string[] = [];
  lines.push(`外卖 ≈ ${s.takeoutCount} 顿（约每 ${s.takeoutCount ? Math.max(1, Math.round(365 / s.takeoutCount)) : '—'} 天一顿）`);
  lines.push(`奶茶/咖啡 ≈ ${s.teaCoffeeCups} 杯`);
  if (s.metroRides > 0) lines.push(`地铁乘车 ≈ ${s.metroRides} 次`);
  lines.push(`深夜下单 ${s.lateNight.count} 次`);
  if (s.travelSpend > 0) lines.push(`旅行相关约 ${Math.round(s.travelSpend / 100) / 10}k`);
  // truthful simple comparison — cups of milk tea stacked ≈ height metaphor kept soft
  if (s.teaCoffeeCups >= 12) {
    const meters = (s.teaCoffeeCups * 0.12).toFixed(1); // ~12cm cup height joke
    lines.push(`杯子叠起来约 ${meters} 米（按 12cm/杯估算）`);
  }
  return lines.slice(0, 4);
}

function buildWittyLine(s: {
  persona: string;
  takeoutCount: number;
  teaCoffeeCups: number;
  lateNight: { count: number };
  busiestDay: { label: string } | null;
}): string {
  if (s.takeoutCount > 80) return '厨房灯：已读不回。';
  if (s.teaCoffeeCups > 100) return '今年的血液浓度，含糖量偏乐观。';
  if (s.lateNight.count > 25) return '最熟悉的客服，是凌晨的骑手。';
  if (s.busiestDay) return `手最忙的一天：${s.busiestDay.label}。`;
  return '账单不会说谎，但可以做海报。';
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
  // With full-year rent, rent often wins — prefer lifestyle personas when lifestyle is large
  const rentAmt = s.byCategory.find((c) => c.cat === '房租')?.amount || 0;
  const lifestyle = s.expenseTotal - rentAmt;
  if (s.teaCoffeeCups >= 80) {
    return {
      persona: '移动咖啡因续航体',
      personaDetail: `奶茶/咖啡约 ${s.teaCoffeeCups} 杯，血管里流的是糖分和 deadline。`,
    };
  }
  if (s.takeoutCount >= 80) {
    return {
      persona: '外卖拯救加班人',
      personaDetail: `外卖约 ${s.takeoutCount} 单，厨房灯可能已经进博物馆了。`,
    };
  }
  if (s.lateNight.count >= 20) {
    return {
      persona: '深夜消费刺客（受害者版）',
      personaDetail: `深夜下单 ${s.lateNight.count} 次，月亮看见了你的购物车。`,
    };
  }
  if (top === '房租' && rentAmt > lifestyle * 0.55) {
    return {
      persona: '给房东打工的城市游牧民',
      personaDetail: '房租抬头见喜（喜的是房东）。',
    };
  }
  if (top === '购物' || (s.byCategory.find((c) => c.cat === '购物')?.amount || 0) > lifestyle * 0.25) {
    return {
      persona: '双十一幸存者',
      personaDetail: '购物车比意志力更诚实。',
    };
  }
  if (top === '游戏娱乐') {
    return {
      persona: '快乐优先级 MAX',
      personaDetail: '娱乐开支领先，精神状态暂时比钱包富裕。',
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
    persona: '一线打工人年度结算单',
    personaDetail: `生活支出约 ¥${s.expenseTotal.toFixed(0)}，峰值在 ${peakMonth} 月。`,
  };
}

export function formatMoney(n: number, privacy: boolean): string {
  if (privacy) return '¥***';
  return `¥${n.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

export function formatMoneyOrPct(amount: number, pct: number, privacy: boolean): string {
  if (privacy) return `${pct}%`;
  return formatMoney(amount, false);
}

export { truncName };
