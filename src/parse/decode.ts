function tryDecode(bytes: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding).decode(bytes);
  } catch {
    return null;
  }
}

function score(t: string): number {
  let s = 0;
  if (t.includes('交易时间')) s += 5;
  if (t.includes('支付宝')) s += 3;
  if (t.includes('微信支付') || t.includes('金额(元)')) s += 3;
  if (t.includes('商品说明')) s += 2;
  if (t.includes('\uFFFD')) s -= 10;
  if (t.includes('֧����')) s -= 8;
  return s;
}

/** Prefer UTF-8 vs GBK/GB18030 without iconv-lite (avoids Node polyfills in browser). */
export function bytesToText(buf: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  }
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  const gbk =
    tryDecode(bytes, 'gbk') ||
    tryDecode(bytes, 'gb18030') ||
    utf8;
  if (score(gbk) > score(utf8)) return { text: gbk, encoding: 'gbk' };
  return { text: utf8, encoding: 'utf-8' };
}
