import { Buffer } from 'buffer';
(window as any).Buffer = Buffer;
import './style.css';
import { toPng } from 'html-to-image';
import { filterYear, mergeTxns, parseBillFile } from './parse/detect';
import type { Txn } from './parse/types';
import { renderPosterHtml, skinMeta } from './poster/render';
import type { Skin } from './poster/render';
import { computeStats, formatMoney } from './stats/compute';
import type { YearStats } from './stats/compute';

const app = document.querySelector<HTMLDivElement>('#app')!;

let txns: Txn[] = [];
let warnings: string[] = [];
let filesLoaded: string[] = [];
let year = new Date().getFullYear() - 1;
let skin: Skin = 'midnight';
let privacy = false;
let stats: YearStats | null = null;

function render() {
  const scaleClass = 'scaled';
  app.innerHTML = `
  <div class="app">
    <header class="hero-head">
      <h1>YearBillCard · 钱去哪了</h1>
      <p>本地解析微信 / 支付宝账单，生成可发小红书的年度海报。数据不出浏览器。</p>
    </header>
    <div class="privacy-banner">🔒 隐私承诺：全部在浏览器本地处理，不上传服务器、无账号、无追踪。</div>
    <section class="panel">
      <div class="drop" id="drop">拖拽账单文件到此处，或点击选择<br/><small>支持微信 csv/xlsx、支付宝 csv（GBK）· 可多文件</small></div>
      <input id="file" type="file" accept=".csv,.xlsx,.xls,text/csv" multiple hidden />
      <div class="row">
        <button type="button" id="demo">试用演示数据（SYNTHETIC）</button>
        <label>年份 <input id="year" type="number" value="${year}" min="2018" max="2030" /></label>
        <label>皮肤
          <select id="skin">
            <option value="midnight" ${skin === 'midnight' ? 'selected' : ''}>午夜账本</option>
            <option value="peach" ${skin === 'peach' ? 'selected' : ''}>蜜桃汽水</option>
            <option value="mint" ${skin === 'mint' ? 'selected' : ''}>薄荷账单</option>
          </select>
        </label>
        <label><input id="privacy" type="checkbox" ${privacy ? 'checked' : ''}/> 隐私模式（隐藏金额）</label>
        <button type="button" class="secondary" id="clear">清空</button>
      </div>
      <div class="file-list">${filesLoaded.length ? '已加载：' + filesLoaded.join('、') : '尚未加载文件'}</div>
      <div class="warnings">${warnings.map((w) => `⚠ ${w}`).join('<br/>')}</div>
    </section>
    <div class="layout">
      <section class="panel" id="statsPanel">
        ${stats ? renderStats(stats) : '<p style="color:#64748b">导入账单或点击演示数据后，这里显示统计。</p>'}
      </section>
      <section class="panel">
        <div class="row" style="margin-top:0">
          <button type="button" id="download" ${stats ? '' : 'disabled'}>下载海报 PNG（1080×1440）</button>
          <span style="color:#64748b;font-size:.9rem">${skinMeta(skin).name}</span>
        </div>
        <div class="poster-wrap">
          <div id="posterHost"></div>
        </div>
      </section>
    </div>
  </div>`;

  const drop = app.querySelector('#drop')!;
  const file = app.querySelector<HTMLInputElement>('#file')!;
  drop.addEventListener('click', () => file.click());
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('drag');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('drag'));
  drop.addEventListener('drop', async (e) => {
    e.preventDefault();
    drop.classList.remove('drag');
    const de = e as DragEvent;
    const fl = de.dataTransfer?.files;
    if (fl?.length) await ingest(fl);
  });
  file.addEventListener('change', async () => {
    if (file.files?.length) await ingest(file.files);
  });
  app.querySelector('#demo')!.addEventListener('click', loadDemo);
  app.querySelector('#clear')!.addEventListener('click', () => {
    txns = [];
    warnings = [];
    filesLoaded = [];
    stats = null;
    render();
  });
  app.querySelector('#year')!.addEventListener('change', (e) => {
    year = Number((e.target as HTMLInputElement).value) || year;
    recompute();
  });
  app.querySelector('#skin')!.addEventListener('change', (e) => {
    skin = (e.target as HTMLSelectElement).value as Skin;
    paintPoster();
  });
  app.querySelector('#privacy')!.addEventListener('change', (e) => {
    privacy = (e.target as HTMLInputElement).checked;
    recompute();
  });
  app.querySelector('#download')!.addEventListener('click', downloadPoster);

  paintPoster();
  const host = app.querySelector('#posterHost')!;
  const poster = host.querySelector('.poster') as HTMLElement | null;
  if (poster) poster.classList.add(scaleClass);
}

function renderStats(s: YearStats): string {
  return `
    <div class="stats-grid">
      <div class="stat"><small>生活支出</small><strong>${formatMoney(s.expenseTotal, privacy)}</strong></div>
      <div class="stat"><small>收入</small><strong>${formatMoney(s.incomeTotal, privacy)}</strong></div>
      <div class="stat"><small>人格</small><strong style="font-size:1rem">${s.persona}</strong></div>
    </div>
    <p style="margin:12px 0;color:#475569">${s.personaDetail}</p>
    <h3>分类</h3>
    <ul>${s.byCategory
      .slice(0, 8)
      .map((c) => `<li>${c.cat} · ${formatMoney(c.amount, privacy)}（${c.count}笔）</li>`)
      .join('')}</ul>
    <h3>商户 TOP</h3>
    <ul>${s.topMerchants
      .slice(0, 5)
      .map((m) => `<li>${m.name} · ${formatMoney(m.amount, privacy)}</li>`)
      .join('')}</ul>
  `;
}

function paintPoster() {
  const host = document.querySelector('#posterHost');
  if (!host) return;
  if (!stats) {
    host.innerHTML = `<div style="padding:40px;color:#64748b">海报预览区</div>`;
    return;
  }
  host.innerHTML = renderPosterHtml(stats, skin, privacy);
  host.querySelector('.poster')?.classList.add('scaled');
}

function recompute() {
  const filtered = filterYear(txns, year);
  stats = filtered.length ? computeStats(txns, year) : null;
  if (!filtered.length && txns.length) warnings = [...warnings.filter((w) => !w.includes('年份')), `所选年份 ${year} 无交易，请换年份`];
  render();
}

async function ingest(fileList: FileList | File[]) {
  const arr = [...fileList];
  const newTxns: Txn[] = [];
  for (const f of arr) {
    const r = await parseBillFile(f);
    warnings.push(...r.warnings.map((w) => `${f.name}: ${w}`));
    if (!r.txns.length) warnings.push(`${f.name}: 未解析到交易行`);
    newTxns.push(...r.txns);
    filesLoaded.push(`${f.name}(${r.source}/${r.txns.length})`);
  }
  txns = mergeTxns([...txns, ...newTxns]);
  // auto year: max year in data
  if (txns.length) {
    const years = txns.map((t) => t.time.getFullYear());
    year = Math.max(...years);
  }
  stats = computeStats(txns, year);
  render();
}

async function loadDemo() {
  warnings = [];
  filesLoaded = [];
  txns = [];
  const base = import.meta.env.BASE_URL || '/';
  const files = ['wechat_sample.csv', 'alipay_sample.csv'];
  for (const name of files) {
    const res = await fetch(`${base}sample/${name}`);
    const blob = await res.blob();
    const file = new File([blob], name, { type: 'text/csv' });
    await ingest([file]);
  }
}

async function downloadPoster() {
  const el = document.querySelector('.poster') as HTMLElement | null;
  if (!el || !stats) return;
  const prev = el.className;
  el.classList.remove('scaled');
  el.style.transform = 'none';
  try {
    const dataUrl = await toPng(el, {
      width: 1080,
      height: 1440,
      pixelRatio: 1,
      cacheBust: true,
    });
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = `yearbillcard-${stats.year}-${skin}.png`;
    a.click();
  } finally {
    el.className = prev;
  }
}

render();

// Expose for playwright screenshots
(window as unknown as { __yearbill?: unknown }).__yearbill = {
  loadDemo,
  getStats: () => stats,
  setSkin: (s: Skin) => {
    skin = s;
    paintPoster();
  },
  setPrivacy: (p: boolean) => {
    privacy = p;
    recompute();
  },
};
