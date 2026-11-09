import type { YearStats } from '../stats/compute';
import { formatMoney } from '../stats/compute';

export type Skin = 'midnight' | 'peach' | 'mint';

const SKINS: Record<
  Skin,
  { bg: string; card: string; accent: string; text: string; muted: string; name: string }
> = {
  midnight: {
    name: '午夜账本',
    bg: 'linear-gradient(160deg,#0f172a 0%,#1e293b 50%,#312e81 100%)',
    card: 'rgba(15,23,42,0.55)',
    accent: '#a5b4fc',
    text: '#f8fafc',
    muted: '#94a3b8',
  },
  peach: {
    name: '蜜桃汽水',
    bg: 'linear-gradient(160deg,#fff7ed 0%,#ffedd5 40%,#fecdd3 100%)',
    card: 'rgba(255,255,255,0.65)',
    accent: '#ea580c',
    text: '#7c2d12',
    muted: '#9a3412',
  },
  mint: {
    name: '薄荷账单',
    bg: 'linear-gradient(160deg,#ecfdf5 0%,#d1fae5 45%,#a5f3fc 100%)',
    card: 'rgba(255,255,255,0.7)',
    accent: '#059669',
    text: '#064e3b',
    muted: '#047857',
  },
};

export function skinMeta(skin: Skin) {
  return SKINS[skin];
}

export function renderPosterHtml(stats: YearStats, skin: Skin, privacy: boolean): string {
  const s = SKINS[skin];
  const topCats = stats.byCategory.slice(0, 5);
  const maxCat = topCats[0]?.amount || 1;
  const bars = topCats
    .map((c) => {
      const pct = Math.max(8, Math.round((c.amount / maxCat) * 100));
      return `<div class="bar-row"><span>${c.cat}</span><div class="bar"><i style="width:${pct}%"></i></div><b>${formatMoney(c.amount, privacy)}</b></div>`;
    })
    .join('');

  const months = stats.monthly
    .map((m) => {
      const maxM = Math.max(...stats.monthly.map((x) => x.amount), 1);
      const h = Math.round((m.amount / maxM) * 64);
      return `<div class="m"><div class="mc" style="height:${h}px"></div><em>${m.month}</em></div>`;
    })
    .join('');

  const biggest = stats.biggest
    ? `${stats.biggest.counterparty || stats.biggest.product} · ${formatMoney(stats.biggest.amount, privacy)}`
    : '—';

  return `
  <div class="poster" data-skin="${skin}" style="background:${s.bg};color:${s.text}">
    <div class="badge">YearBillCard · ${stats.year}</div>
    <h1>钱去哪了？</h1>
    <p class="persona" style="color:${s.accent}">${stats.persona}</p>
    <p class="detail">${stats.personaDetail}</p>
    <div class="hero" style="background:${s.card}">
      <div><small style="color:${s.muted}">生活支出</small><strong>${formatMoney(stats.expenseTotal, privacy)}</strong></div>
      <div><small style="color:${s.muted}">收入入账</small><strong>${formatMoney(stats.incomeTotal, privacy)}</strong></div>
      <div><small style="color:${s.muted}">支出笔数</small><strong>${privacy ? '••' : stats.expenseCount}</strong></div>
    </div>
    <h2>分类 TOP</h2>
    <div class="bars">${bars || '<p style="opacity:.7">暂无分类</p>'}</div>
    <h2>月度曲线</h2>
    <div class="months" style="--accent:${s.accent}">${months}</div>
    <div class="fun">
      <div>奶茶/咖啡 ≈ <b>${privacy ? '•' : stats.teaCoffeeCups}</b> 杯</div>
      <div>外卖 ≈ <b>${privacy ? '•' : stats.takeoutCount}</b> 单</div>
      <div>深夜消费 <b>${privacy ? '•' : stats.lateNight.count}</b> 次</div>
      <div>最大一笔：${biggest}</div>
    </div>
    <footer>本地生成 · 数据未上传 · ${s.name}</footer>
  </div>`;
}
