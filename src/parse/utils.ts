export function parseAmount(raw: string): number {
  const s = String(raw ?? '')
    .replace(/[¥￥,\s]/g, '')
    .trim();
  const n = Number.parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}

export function parseDirection(raw: string): 'income' | 'expense' | 'neutral' {
  const s = String(raw ?? '').trim();
  if (!s || s === '/' || s === '不计收支') return 'neutral';
  if (s.includes('收') && !s.includes('支')) return 'income';
  if (s.includes('支')) return 'expense';
  if (s.includes('入')) return 'income';
  return 'neutral';
}

export function findHeaderIndex(lines: string[], mustHave: string[]): number {
  for (let i = 0; i < Math.min(lines.length, 80); i++) {
    const line = lines[i];
    if (!line.includes(',')) continue;
    const ok = mustHave.every((k) => line.includes(k));
    if (ok) return i;
  }
  return -1;
}

/** Minimal CSV split that respects double quotes */
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQ = !inQ;
      }
      continue;
    }
    if (c === ',' && !inQ) {
      out.push(cur.trim());
      cur = '';
      continue;
    }
    cur += c;
  }
  out.push(cur.trim());
  return out;
}

export function parseDateTime(s: string): Date {
  const t = String(s).trim().replace(/\//g, '-');
  const d = new Date(t.replace(' ', 'T'));
  if (!Number.isNaN(d.getTime())) return d;
  const m = t.match(/(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +m[6]);
  return new Date(0);
}
