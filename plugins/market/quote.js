/**
 * Parsers for Tencent Finance's public quote endpoints (the same ones its web pages call; no key needed).
 *   quote   https://qt.gtimg.cn/q=sh600519,hk00700,usAAPL      GBK text, one `v_<key>="a~b~c..."` per symbol
 *   search  https://smartbox.gtimg.cn/s3/?v=2&q=<text>&t=all   `v_hint="mkt~code~name~pinyin~type^..."`, \uXXXX escaped
 *   kline   https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=<key>,day,,,<n>,qfq
 * The endpoints are unofficial, so every parser returns empty results on unexpected shapes instead of throwing.
 */

export const INDICES = [
  ['sh000001', '上证指数'], ['sz399001', '深证成指'], ['sz399006', '创业板指'], ['hkHSI', '恒生指数'],
  ['hkHSTECH', '恒生科技'], ['usIXIC', '纳斯达克'], ['usINX', '标普500'], ['usDJI', '道琼斯'],
];

const num = (s) => { if (s === undefined || s === '') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };

export function marketOf(key) {
  if (/^(sh|sz|bj)/.test(key)) return { market: 'cn', currency: 'CNY' };
  if (key.startsWith('hk')) return { market: 'hk', currency: 'HKD' };
  if (key.startsWith('us')) return { market: 'us', currency: 'USD' };
  return { market: '', currency: '' };
}

/** Parse a quote response into Map(key -> quote). Symbols the server does not know are simply absent. */
export function parseQuotes(text) {
  const out = new Map();
  for (const m of String(text).matchAll(/v_([^=\s]+)="([^"]*)"/g)) {
    const key = m[1];
    const f = m[2].split('~');
    if (f.length < 35 || !f[1]) continue;
    const price = num(f[3]);
    const prev = num(f[4]);
    const q = {
      key, name: f[1], code: f[2], price, prev, open: num(f[5]), time: f[30] || '',
      change: num(f[31]), pct: num(f[32]), high: num(f[33]), low: num(f[34]), ...marketOf(key),
    };
    if (q.change === null && price !== null && prev) q.change = Math.round((price - prev) * 1e4) / 1e4;
    if (q.pct === null && q.change !== null && prev) q.pct = Math.round((q.change / prev) * 1e4) / 1e2;
    if (q.market === 'cn') { q.turnover = num(f[38]); q.pe = num(f[39]); q.cap = num(f[45]); }
    out.set(key, q);
  }
  return out;
}

/** Search suggestions: [{ market, code, name, type }]. */
export function parseHint(text) {
  const m = /v_hint="([^"]*)"/.exec(String(text));
  if (!m || !m[1] || m[1] === 'N') return [];
  const raw = m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return raw.split('^').map((e) => {
    const p = e.split('~');
    return { market: p[0], code: p[1], name: p[2], type: p[4] || '' };
  }).filter((e) => e.market && e.code && e.name);
}

/** Quote key for a search hit, or null for things we cannot quote (open-end funds, warrants, ...). */
export function hintKey(hit) {
  if (!/^(GP|ZS|LOF)|ETF/.test(hit.type)) return null;
  const code = String(hit.code);
  if (['sh', 'sz', 'bj'].includes(hit.market)) return hit.market + code;
  if (hit.market === 'hk') return 'hk' + code;
  if (hit.market === 'us') {
    if (code.startsWith('.')) return 'us.' + code.slice(1).toUpperCase();
    return 'us' + code.replace(/\.(oq|n|ps|am|a|k|pk|ob|nq)$/i, '').toUpperCase();
  }
  return null;
}

/** Daily candles: [{ date, open, close, high, low, volume }], oldest first. */
export function parseKline(json, key) {
  const data = json && json.data;
  if (!data || typeof data !== 'object') return [];
  const entry = data[key] || data[Object.keys(data)[0]];
  const rows = (entry && (entry.qfqday || entry.day)) || [];
  return rows.map((r) => ({ date: r[0], open: num(r[1]), close: num(r[2]), high: num(r[3]), low: num(r[4]), volume: num(r[5]) }))
    .filter((r) => r.date && r.close !== null);
}

/** The key the kline endpoint wants: US symbols carry their exchange suffix (usAAPL.OQ), which the quote returns as `code`. */
export function klineKey(quote) {
  return quote.market === 'us' ? 'us' + quote.code : quote.key;
}
