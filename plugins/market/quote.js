/**
 * Global market data, all from public endpoints that need no key. Every parser returns empty results on an
 * unexpected shape instead of throwing, because none of these endpoints is an official API.
 *
 *   indices, commodities, FX   Eastmoney quote feed (global instruments)    keys  x:<market>.<code>   x:100.N225
 *   US and Hong Kong stocks    Tencent quote feed                           keys  usAAPL  hk00700
 *   crypto                     CoinLore top coins (+ Bybit daily candles)   keys  c:BTC
 *
 * One quote shape for all of them:
 *   { key, kind: index|commodity|fx|stock|crypto, name, nameEn, code, price, prev, change, pct, high, low, open,
 *     time, currency, region, market, cap, volume, rank, pct1h, pct7d }
 */

const A = 'americas'; const E = 'europe'; const P = 'apac';
/** [key, kind, region, zh name, en name] */
export const CATALOG = [
  ['x:100.SPX', 'index', A, '标普500', 'S&P 500'], ['x:100.DJIA', 'index', A, '道琼斯', 'Dow Jones'], ['x:100.NDX', 'index', A, '纳斯达克综合', 'Nasdaq Composite'],
  ['x:100.TSX', 'index', A, '加拿大 TSX', 'S&P/TSX Composite'], ['x:100.MXX', 'index', A, '墨西哥 IPC', 'S&P/BMV IPC'], ['x:100.BVSP', 'index', A, '巴西 Bovespa', 'Bovespa'],
  ['x:100.FTSE', 'index', E, '英国富时100', 'FTSE 100'], ['x:100.GDAXI', 'index', E, '德国 DAX', 'DAX'], ['x:100.FCHI', 'index', E, '法国 CAC 40', 'CAC 40'],
  ['x:100.SX5E', 'index', E, '欧洲斯托克50', 'Euro Stoxx 50'], ['x:100.IBEX', 'index', E, '西班牙 IBEX 35', 'IBEX 35'], ['x:100.MIB', 'index', E, '意大利 FTSE MIB', 'FTSE MIB'],
  ['x:100.SSMI', 'index', E, '瑞士 SMI', 'SMI'], ['x:100.AEX', 'index', E, '荷兰 AEX', 'AEX'],
  ['x:100.N225', 'index', P, '日经225', 'Nikkei 225'], ['x:100.HSI', 'index', P, '恒生指数', 'Hang Seng'], ['x:100.KS11', 'index', P, '韩国 KOSPI', 'KOSPI'],
  ['x:100.TWII', 'index', P, '台湾加权', 'TAIEX'], ['x:100.SENSEX', 'index', P, '印度 Sensex', 'BSE Sensex'], ['x:100.STI', 'index', P, '新加坡海峡时报', 'Straits Times'],
  ['x:100.AS51', 'index', P, '澳大利亚 ASX 200', 'S&P/ASX 200'],
  ['x:101.GC00Y', 'commodity', '', '黄金', 'Gold'], ['x:101.SI00Y', 'commodity', '', '白银', 'Silver'], ['x:102.CL00Y', 'commodity', '', '原油 (WTI)', 'Crude Oil (WTI)'],
  ['x:102.NG00Y', 'commodity', '', '天然气', 'Natural Gas'], ['x:101.HG00Y', 'commodity', '', '铜', 'Copper'], ['x:103.ZW00Y', 'commodity', '', '小麦', 'Wheat'],
  ['x:100.UDI', 'fx', '', '美元指数', 'US Dollar Index'], ['x:119.EURUSD', 'fx', '', '欧元/美元', 'EUR/USD'], ['x:119.GBPUSD', 'fx', '', '英镑/美元', 'GBP/USD'],
  ['x:119.USDJPY', 'fx', '', '美元/日元', 'USD/JPY'], ['x:119.AUDUSD', 'fx', '', '澳元/美元', 'AUD/USD'], ['x:119.USDCAD', 'fx', '', '美元/加元', 'USD/CAD'],
  ['x:119.USDCHF', 'fx', '', '美元/瑞郎', 'USD/CHF'], ['x:119.NZDUSD', 'fx', '', '新西兰元/美元', 'NZD/USD'],
];
const BY_KEY = new Map(CATALOG.map((c) => [c[0], { key: c[0], kind: c[1], region: c[2], name: c[3], nameEn: c[4] }]));
export const catalogEntry = (key) => BY_KEY.get(key) || null;
export const MACRO_KEYS = CATALOG.filter((c) => c[1] !== 'index').map((c) => c[0]);
export const INDEX_KEYS = CATALOG.filter((c) => c[1] === 'index').map((c) => c[0]);
/** The few instruments the overview and the daily briefing show. */
export const HEADLINE = ['x:100.SPX', 'x:100.N225', 'x:100.GDAXI', 'c:BTC'];

/** Stock exchanges on the globe: one pin each, tied to its headline index. Hours are local, weekdays only. */
export const EXCHANGES = [
  { id: 'nyse', city: 'New York', cityZh: '纽约', lat: 40.71, lon: -74.0, tz: 'America/New_York', hours: [['09:30', '16:00']], index: 'x:100.SPX' },
  { id: 'tsx', city: 'Toronto', cityZh: '多伦多', lat: 43.65, lon: -79.38, tz: 'America/Toronto', hours: [['09:30', '16:00']], index: 'x:100.TSX' },
  { id: 'bmv', city: 'Mexico City', cityZh: '墨西哥城', lat: 19.43, lon: -99.13, tz: 'America/Mexico_City', hours: [['08:30', '15:00']], index: 'x:100.MXX' },
  { id: 'b3', city: 'São Paulo', cityZh: '圣保罗', lat: -23.55, lon: -46.63, tz: 'America/Sao_Paulo', hours: [['10:00', '17:55']], index: 'x:100.BVSP' },
  { id: 'lse', city: 'London', cityZh: '伦敦', lat: 51.51, lon: -0.13, tz: 'Europe/London', hours: [['08:00', '16:30']], index: 'x:100.FTSE' },
  { id: 'fwb', city: 'Frankfurt', cityZh: '法兰克福', lat: 50.11, lon: 8.68, tz: 'Europe/Berlin', hours: [['09:00', '17:30']], index: 'x:100.GDAXI' },
  { id: 'epa', city: 'Paris', cityZh: '巴黎', lat: 48.86, lon: 2.35, tz: 'Europe/Paris', hours: [['09:00', '17:30']], index: 'x:100.FCHI' },
  { id: 'six', city: 'Zurich', cityZh: '苏黎世', lat: 47.37, lon: 8.54, tz: 'Europe/Zurich', hours: [['09:00', '17:30']], index: 'x:100.SSMI' },
  { id: 'bme', city: 'Madrid', cityZh: '马德里', lat: 40.42, lon: -3.7, tz: 'Europe/Madrid', hours: [['09:00', '17:30']], index: 'x:100.IBEX' },
  { id: 'mil', city: 'Milan', cityZh: '米兰', lat: 45.46, lon: 9.19, tz: 'Europe/Rome', hours: [['09:00', '17:30']], index: 'x:100.MIB' },
  { id: 'ams', city: 'Amsterdam', cityZh: '阿姆斯特丹', lat: 52.37, lon: 4.9, tz: 'Europe/Amsterdam', hours: [['09:00', '17:30']], index: 'x:100.AEX' },
  { id: 'bse', city: 'Mumbai', cityZh: '孟买', lat: 19.08, lon: 72.88, tz: 'Asia/Kolkata', hours: [['09:15', '15:30']], index: 'x:100.SENSEX' },
  { id: 'sgx', city: 'Singapore', cityZh: '新加坡', lat: 1.35, lon: 103.82, tz: 'Asia/Singapore', hours: [['09:00', '17:00']], index: 'x:100.STI' },
  { id: 'hkex', city: 'Hong Kong', cityZh: '香港', lat: 22.32, lon: 114.17, tz: 'Asia/Hong_Kong', hours: [['09:30', '12:00'], ['13:00', '16:00']], index: 'x:100.HSI' },
  { id: 'twse', city: 'Taipei', cityZh: '台北', lat: 25.03, lon: 121.56, tz: 'Asia/Taipei', hours: [['09:00', '13:30']], index: 'x:100.TWII' },
  { id: 'krx', city: 'Seoul', cityZh: '首尔', lat: 37.57, lon: 126.98, tz: 'Asia/Seoul', hours: [['09:00', '15:30']], index: 'x:100.KS11' },
  { id: 'tse', city: 'Tokyo', cityZh: '东京', lat: 35.68, lon: 139.69, tz: 'Asia/Tokyo', hours: [['09:00', '11:30'], ['12:30', '15:30']], index: 'x:100.N225' },
  { id: 'asx', city: 'Sydney', cityZh: '悉尼', lat: -33.87, lon: 151.21, tz: 'Australia/Sydney', hours: [['10:00', '16:00']], index: 'x:100.AS51' },
];

const num = (s) => { if (s === undefined || s === null || s === '' || s === '-') return null; const n = Number(s); return Number.isFinite(n) ? n : null; };
const round = (n, d) => (n === null ? null : Math.round(n * 10 ** d) / 10 ** d);

/* ---------- Eastmoney: global indices, commodities, FX ---------- */

/** Fields requested from the quote feed, in the order the parser reads them by name. */
export const EM_FIELDS = 'f2,f3,f4,f12,f13,f14,f15,f16,f17,f18,f124';
export const emSecid = (key) => key.slice(2); // x:100.SPX -> 100.SPX
export const emUrl = (keys) => 'https://push2.eastmoney.com/api/qt/ulist.np/get?fltt=2&fields=' + EM_FIELDS + '&secids=' + keys.map(emSecid).join(',');

/** Parse the ulist response into Map(key -> quote). Names come from the catalog, not from the (Chinese) feed. */
export function parseEastmoney(json) {
  const out = new Map();
  const rows = json && json.data && Array.isArray(json.data.diff) ? json.data.diff : [];
  for (const r of rows) {
    const key = 'x:' + r.f13 + '.' + r.f12;
    const cat = catalogEntry(key);
    const price = num(r.f2);
    if (!cat || price === null) continue;
    const prev = num(r.f18);
    out.set(key, {
      key, kind: cat.kind, region: cat.region, name: cat.name, nameEn: cat.nameEn, code: String(r.f12), price, prev,
      change: num(r.f4) ?? (prev ? round(price - prev, 4) : null), pct: num(r.f3), high: num(r.f15), low: num(r.f16), open: num(r.f17),
      time: num(r.f124) ? new Date(num(r.f124) * 1000).toISOString() : '', currency: cat.kind === 'fx' ? '' : cat.kind === 'index' ? '' : 'USD', market: cat.kind,
    });
  }
  return out;
}

/* ---------- Yahoo Finance: fallback for the Eastmoney keys (indices, commodities, FX) ---------- */

const YAHOO = {
  'x:100.SPX': '^GSPC', 'x:100.DJIA': '^DJI', 'x:100.NDX': '^IXIC', 'x:100.TSX': '^GSPTSE', 'x:100.MXX': '^MXX', 'x:100.BVSP': '^BVSP',
  'x:100.FTSE': '^FTSE', 'x:100.GDAXI': '^GDAXI', 'x:100.FCHI': '^FCHI', 'x:100.SX5E': '^STOXX50E', 'x:100.IBEX': '^IBEX', 'x:100.MIB': 'FTSEMIB.MI',
  'x:100.SSMI': '^SSMI', 'x:100.AEX': '^AEX', 'x:100.N225': '^N225', 'x:100.HSI': '^HSI', 'x:100.KS11': '^KS11', 'x:100.TWII': '^TWII',
  'x:100.SENSEX': '^BSESN', 'x:100.STI': '^STI', 'x:100.AS51': '^AXJO',
  'x:101.GC00Y': 'GC=F', 'x:101.SI00Y': 'SI=F', 'x:102.CL00Y': 'CL=F', 'x:102.NG00Y': 'NG=F', 'x:101.HG00Y': 'HG=F', 'x:103.ZW00Y': 'ZW=F',
  'x:100.UDI': 'DX-Y.NYB', 'x:119.EURUSD': 'EURUSD=X', 'x:119.GBPUSD': 'GBPUSD=X', 'x:119.USDJPY': 'JPY=X', 'x:119.AUDUSD': 'AUDUSD=X',
  'x:119.USDCAD': 'CAD=X', 'x:119.USDCHF': 'CHF=X', 'x:119.NZDUSD': 'NZDUSD=X',
};
export const yahooSymbol = (key) => YAHOO[key] || null;
export const yahooUrl = (key, range, interval) => 'https://query1.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(YAHOO[key]) + '?range=' + range + '&interval=' + interval;

/** One Yahoo chart response (range 1d) as a quote of the same shape the Eastmoney parser returns. */
export function parseYahooQuote(key, json) {
  const cat = catalogEntry(key);
  const res = json && json.chart && Array.isArray(json.chart.result) ? json.chart.result[0] : null;
  const m = res && res.meta;
  if (!cat || !m) return null;
  const price = num(m.regularMarketPrice);
  if (price === null) return null;
  const prev = num(m.chartPreviousClose) ?? num(m.previousClose);
  const change = prev ? round(price - prev, 4) : null;
  return {
    key, kind: cat.kind, region: cat.region, name: cat.name, nameEn: cat.nameEn, code: key.split('.')[1], price, prev, change,
    pct: prev ? round((price - prev) / prev * 100, 2) : null, high: num(m.regularMarketDayHigh), low: num(m.regularMarketDayLow), open: null,
    time: num(m.regularMarketTime) ? new Date(num(m.regularMarketTime) * 1000).toISOString() : '', currency: cat.kind === 'fx' ? '' : cat.kind === 'index' ? '' : 'USD', market: cat.kind,
  };
}

/** Yahoo daily candles, oldest first, in the same shape as parseEmKline. */
export function parseYahooKline(json) {
  const res = json && json.chart && Array.isArray(json.chart.result) ? json.chart.result[0] : null;
  if (!res || !Array.isArray(res.timestamp)) return [];
  const q = (res.indicators && res.indicators.quote && res.indicators.quote[0]) || {};
  const out = [];
  res.timestamp.forEach((t, i) => {
    const close = num(q.close && q.close[i]);
    if (close === null) return;
    out.push({ date: new Date(t * 1000).toISOString().slice(0, 10), open: num(q.open && q.open[i]), close, high: num(q.high && q.high[i]), low: num(q.low && q.low[i]), volume: num(q.volume && q.volume[i]) });
  });
  return out;
}

/** Daily candles from push2his: "2026-11-16,open,close,high,low,volume" (fields2 f51..f56). */
export function parseEmKline(json) {
  const rows = json && json.data && Array.isArray(json.data.klines) ? json.data.klines : [];
  return rows.map((l) => { const p = String(l).split(','); return { date: p[0], open: num(p[1]), close: num(p[2]), high: num(p[3]), low: num(p[4]), volume: num(p[5]) }; })
    .filter((r) => r.date && r.close !== null);
}
export const emKlineUrl = (key, days) => 'https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=' + emSecid(key) + '&klt=101&fqt=1&lmt=' + days + '&end=20500101&fields1=f1&fields2=f51,f52,f53,f54,f55,f56';

/* ---------- Crypto: CoinLore tickers, Bybit candles ---------- */

export const COINLORE_URL = (start, limit) => 'https://api.coinlore.net/api/tickers/?start=' + start + '&limit=' + limit;
export const cryptoKey = (symbol) => 'c:' + String(symbol).toUpperCase();
export const cryptoSymbol = (key) => key.slice(2);

/** Parse CoinLore's ticker list into Map(key -> quote). Prices are USD. The first listing of a symbol wins (rank order). */
export function parseCoinLore(json) {
  const out = new Map();
  const rows = json && Array.isArray(json.data) ? json.data : [];
  for (const r of rows) {
    const symbol = String(r.symbol || '').toUpperCase();
    const price = num(r.price_usd);
    if (!symbol || price === null || out.has(cryptoKey(symbol))) continue;
    const pct = num(r.percent_change_24h);
    out.set(cryptoKey(symbol), {
      key: cryptoKey(symbol), kind: 'crypto', region: '', name: String(r.name || symbol), nameEn: String(r.name || symbol), code: symbol, price,
      prev: pct !== null ? round(price / (1 + pct / 100), 8) : null, change: pct !== null ? round(price - price / (1 + pct / 100), 8) : null, pct,
      pct1h: num(r.percent_change_1h), pct7d: num(r.percent_change_7d), cap: num(r.market_cap_usd), volume: num(r.volume24), rank: num(r.rank),
      high: null, low: null, open: null, time: '', currency: 'USD', market: 'crypto',
    });
  }
  return out;
}

/** Bybit spot candles come newest first: [ms, open, high, low, close, volume, turnover]. Returned oldest first. */
export function parseBybitKline(json) {
  const rows = json && json.result && Array.isArray(json.result.list) ? json.result.list : [];
  return rows.map((r) => ({ date: new Date(Number(r[0])).toISOString().slice(0, 10), open: num(r[1]), high: num(r[2]), low: num(r[3]), close: num(r[4]), volume: num(r[5]) }))
    .filter((r) => r.date && r.close !== null).reverse();
}
export const bybitKlineUrl = (symbol, days) => 'https://api.bybit.com/v5/market/kline?category=spot&symbol=' + encodeURIComponent(symbol) + 'USDT&interval=D&limit=' + days;

/* ---------- Tencent: US and Hong Kong stocks (the only stock source that answers from every network tried) ---------- */

export function marketOf(key) {
  if (key.startsWith('x:')) { const c = catalogEntry(key); return { market: c ? c.kind : '', currency: '' }; }
  if (key.startsWith('c:')) return { market: 'crypto', currency: 'USD' };
  if (key.startsWith('hk')) return { market: 'hk', currency: 'HKD' };
  if (key.startsWith('us')) return { market: 'us', currency: 'USD' };
  return { market: '', currency: '' };
}

/** Parse a Tencent quote response (GBK decoded by the caller) into Map(key -> quote). */
export function parseQuotes(text) {
  const out = new Map();
  for (const m of String(text).matchAll(/v_([^=\s]+)="([^"]*)"/g)) {
    const key = m[1];
    const f = m[2].split('~');
    if (f.length < 35 || !f[1]) continue;
    const mk = marketOf(key);
    if (mk.market !== 'us' && mk.market !== 'hk') continue;
    const price = num(f[3]); const prev = num(f[4]);
    const q = {
      key, kind: 'stock', region: mk.market === 'us' ? 'americas' : 'apac', name: f[1], nameEn: f[46] || f[1], code: f[2],
      price, prev, open: num(f[5]), time: f[30] || '', change: num(f[31]), pct: num(f[32]), high: num(f[33]), low: num(f[34]), ...mk,
    };
    if (q.change === null && price !== null && prev) q.change = round(price - prev, 4);
    if (q.pct === null && q.change !== null && prev) q.pct = round((q.change / prev) * 100, 2);
    out.set(key, q);
  }
  return out;
}

/** Tencent search suggestions: [{ market, code, name, type }]. `name` is Chinese or English depending on the query. */
export function parseHint(text) {
  const m = /v_hint="([^"]*)"/.exec(String(text));
  if (!m || !m[1] || m[1] === 'N') return [];
  const raw = m[1].replace(/\\u([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  return raw.split('^').map((e) => {
    const p = e.split('~');
    return { market: p[0], code: p[1], name: p[2], type: p[4] || '' };
  }).filter((e) => e.market && e.code && e.name);
}

/** Quote key for a search hit. Only US and Hong Kong stocks, ETFs and indices are quotable; mainland markets are not offered. */
export function hintKey(hit) {
  if (!/^(GP|ZS|LOF)|ETF/.test(hit.type)) return null;
  const code = String(hit.code);
  if (hit.market === 'hk') return /^\d{5}$/.test(code) ? 'hk' + code : null;
  if (hit.market === 'us') {
    if (code.startsWith('.')) return null; // US index codes are covered by the catalog
    return 'us' + code.replace(/\.(oq|n|ps|am|a|k|pk|ob|nq)$/i, '').toUpperCase();
  }
  return null;
}

/** Tencent daily candles: [{ date, open, close, high, low, volume }], oldest first. */
export function parseKline(json, key) {
  const data = json && json.data;
  if (!data || typeof data !== 'object') return [];
  const entry = data[key] || data[Object.keys(data)[0]];
  const rows = (entry && (entry.qfqday || entry.day)) || [];
  return rows.map((r) => ({ date: r[0], open: num(r[1]), close: num(r[2]), high: num(r[3]), low: num(r[4]), volume: num(r[5]) }))
    .filter((r) => r.date && r.close !== null);
}

/** The key Tencent's kline endpoint wants: US symbols carry their exchange suffix (usAAPL.OQ), which the quote returns as `code`. */
export function klineKey(quote) {
  return quote.market === 'us' ? 'us' + quote.code : quote.key;
}

/* ---------- Exchange hours ---------- */

const minutes = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

/** Local weekday (0 = Sunday) and minutes since midnight in an IANA time zone. */
export function localParts(tz, now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const get = (t) => (parts.find((p) => p.type === t) || {}).value;
  const wd = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[get('weekday')];
  return { weekday: wd, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

/** 'open' | 'lunch' | 'closed' for an exchange at `now`. Weekdays only; public holidays are not known. */
export function exchangeState(ex, now = new Date()) {
  const { weekday, minutes: m } = localParts(ex.tz, now);
  if (weekday === 0 || weekday === 6) return 'closed';
  if (ex.hours.some(([a, b]) => m >= minutes(a) && m < minutes(b))) return 'open';
  const first = minutes(ex.hours[0][0]); const last = minutes(ex.hours[ex.hours.length - 1][1]);
  return m > first && m < last ? 'lunch' : 'closed';
}
