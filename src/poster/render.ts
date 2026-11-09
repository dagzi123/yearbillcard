import type { YearStats } from '../stats/compute';
import { formatMoney, formatMoneyOrPct, truncName } from '../stats/compute';

export type Skin = 'midnight' | 'peach' | 'mint';

const SKINS: Record<
  Skin,
  { bg: string; card: string; accent: string; text: string; muted: string; name: string; soft: string }
> = {
  midnight: {
    name: '午夜账本',
    bg: 'linear-gradient(165deg,#0b1224 0%,#1e1b4b 48%,#312e81 100%)',
    card: 'rgba(15,23,42,0.55)',
    accent: '#a5b4fc',
    text: '#f8fafc',
    muted: '#94a3b8',
    soft: 'rgba(255,255,255,0.10)',
  },
  peach: {
    name: '蜜桃汽水',
    bg: 'linear-gradient(165deg,#fff7ed 0%,#ffedd5 42%,#fecdd3 100%)',
    card: 'rgba(255,255,255,0.72)',
    accent: '#ea580c',
    text: '#7c2d12',
    muted: '#9a3412',
    soft: 'rgba(255,255,255,0.55)',
  },
  mint: {
    name: '薄荷账单',
    bg: 'linear-gradient(165deg,#ecfdf5 0%,#d1fae5 45%,#a5f3fc 100%)',
    card: 'rgba(255,255,255,0.72)',
    accent: '#059669',
    text: '#064e3b',
    muted: '#047857',
    soft: 'rgba(255,255,255,0.55)',
  },
};

export function skinMeta(skin: Skin) {
  return SKINS[skin];
}

export function renderPosterHtml(stats: YearStats, skin: Skin, privacy: boolean): string {
  const s = SKINS[skin];
  const top3 = stats.topMerchants.slice(0, 3);
  const cats = stats.byCategory.slice(0, 5);
  const maxMonth = Math.max(...stats.monthly.map((m) => m.amount), 1);
  const maxCat = cats[0]?.amount || 1;

  const monthBars = stats.monthly
    .map((m) => {
      const h = Math.round((m.amount / maxMonth) * 72);
      const pct = stats.expenseTotal > 0 ? Math.round((m.amount / stats.expenseTotal) * 100) : 0;
      const val = privacy ? `${pct}%` : shortNum(m.amount);
      return `<div class="mbar"><div class="mfill" style="height:${Math.max(h, 6)}px;background:${s.accent}"></div><span class="mlab">${m.month}</span><span class="mval">${val}</span></div>`;
    })
    .join('');

  const fun = stats.funLines
    .map((l) => {
      let line = l;
      if (privacy) line = line.replace(/¥[\d,.]+/g, '¥***');
      return `<li>${escapeHtml(line)}</li>`;
    })
    .join('');

  const merchants = top3
    .map((m, i) => {
      const amt = formatMoneyOrPct(m.amount, m.pct, privacy);
      return `<div class="mer"><span class="rank">0${i + 1}</span><span class="mname" title="${escapeHtml(m.name)}">${escapeHtml(truncName(m.name, 16))}</span><span class="mamt">${amt}</span></div>`;
    })
    .join('');

  const catRows = cats
    .map((c) => {
      const w = Math.max(6, Math.round((c.amount / maxCat) * 100));
      return `<div class="cat-row"><span class="cname">${escapeHtml(c.cat)}</span><div class="cbar"><i style="width:${w}%;background:${s.accent}"></i></div><span class="camt">${formatMoneyOrPct(c.amount, c.pct, privacy)}</span></div>`;
    })
    .join('');

  const busiest = stats.busiestDay
    ? `${stats.busiestDay.label} · ${privacy ? '••' : stats.busiestDay.count} 笔 · ${formatMoneyOrPct(
        stats.busiestDay.amount,
        Math.round((stats.busiestDay.amount / Math.max(stats.expenseTotal, 1)) * 100),
        privacy,
      )}`
    : '—';

  const biggestName = stats.biggest
    ? truncName(stats.biggest.counterparty || stats.biggest.product || '大额支出', 14)
    : '—';
  const biggestAmt = stats.biggest ? formatMoney(stats.biggest.amount, privacy) : '—';

  return `
  <div class="poster" data-skin="${skin}" style="background:${s.bg};color:${s.text};--accent:${s.accent};--card:${s.card};--muted:${s.muted};--soft:${s.soft}">
    <header class="ph">
      <div class="badge">YearBillCard · ${stats.year} · ${s.name}</div>
      <h1>钱去哪了？</h1>
      <p class="persona" style="color:${s.accent}">${escapeHtml(stats.persona)}</p>
      <p class="detail">${escapeHtml(stats.personaDetail)}</p>
    </header>

    <section class="hero-nums" style="background:${s.card}">
      <div class="hero-cell">
        <small style="color:${s.muted}">生活支出</small>
        <strong>${formatMoney(stats.expenseTotal, privacy)}</strong>
        <em>${privacy ? '••' : stats.expenseCount} 笔 · 不含转账红包</em>
      </div>
      <div class="hero-cell">
        <small style="color:${s.muted}">收入入账</small>
        <strong class="sm">${formatMoney(stats.incomeTotal, privacy)}</strong>
        <em>${privacy ? '••' : stats.incomeCount} 笔</em>
      </div>
    </section>

    <section class="block">
      <h2>Year in numbers</h2>
      <ul class="fun-list">${fun}</ul>
    </section>

    <section class="grid2">
      <div class="block cardish" style="background:${s.soft}">
        <h2>Top 3 商家</h2>
        <div class="mers">${merchants || '<div class="empty">—</div>'}</div>
      </div>
      <div class="block cardish" style="background:${s.soft}">
        <h2>高光时刻</h2>
        <div class="hl">
          <div><span class="k" style="color:${s.muted}">最忙一天</span><span class="v">${escapeHtml(busiest)}</span></div>
          <div><span class="k" style="color:${s.muted}">最深夜</span><span class="v">${escapeHtml(stats.lateNight.latestLabel)}</span></div>
          <div><span class="k" style="color:${s.muted}">最大一笔</span><span class="v">${escapeHtml(biggestName)} · ${biggestAmt}</span></div>
        </div>
      </div>
    </section>

    <section class="block">
      <h2>分类构成</h2>
      <div class="cats">${catRows || '<div class="empty">—</div>'}</div>
    </section>

    <section class="block">
      <h2>月度曲线</h2>
      <div class="months">${monthBars}</div>
    </section>

    <p class="witty">「${escapeHtml(stats.wittyLine)}」</p>

    <footer class="pf">
      <span>YearBillCard · 本地解析，不上传</span>
      <span>github.com/dagzi123/yearbillcard</span>
    </footer>
  </div>`;
}

function shortNum(n: number): string {
  if (n >= 10000) return `${(n / 10000).toFixed(1)}万`;
  if (n >= 1000) return `${Math.round(n / 100) / 10}k`;
  return String(Math.round(n));
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
