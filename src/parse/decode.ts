import iconv from 'iconv-lite';

function tryTextDecoder(bytes: Uint8Array, encoding: string): string | null {
  try {
    return new TextDecoder(encoding ).decode(bytes);
  } catch {
    try {
      // some engines want gb18030
      return new TextDecoder(encoding).decode(bytes);
    } catch {
      return null;
    }
  }
}

function score(t: string): number {
  let s = 0;
  if (t.includes('交易时间')) s += 5;
  if (t.includes('支付宝')) s += 3;
  if (t.includes('微信支付') || t.includes('金额(元)')) s += 3;
  if (t.includes('商品说明')) s += 2;
  if (t.includes('\uFFFD')) s -= 10;
  if (t.includes('֧����') || /[\u00c0-\u00ff]{4,}/.test(t) && !t.includes('交易时间')) s -= 4;
  return s;
}

export function bytesToText(buf: ArrayBuffer): { text: string; encoding: string } {
  const bytes = new Uint8Array(buf);
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: new TextDecoder('utf-8').decode(bytes.subarray(3)), encoding: 'utf-8' };
  }

  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
  let gbk =
    tryTextDecoder(bytes, 'gbk') ||
    tryTextDecoder(bytes, 'gb18030') ||
    iconv.decode(Buffer.from(bytes), 'gbk');

  if (score(gbk) > score(utf8)) return { text: gbk, encoding: 'gbk' };
  return { text: utf8, encoding: 'utf-8' };
}
