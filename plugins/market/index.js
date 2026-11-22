import { Store, dataFile, registerRoute, registerTool, lanRaw, clip, errorText } from './common.js';
import { promises as fs } from 'node:fs';
import https from 'node:https';
import {
  CATALOG, INDEX_KEYS, MACRO_KEYS, HEADLINE, EXCHANGES, catalogEntry, exchangeState,
  emUrl, parseEastmoney, emKlineUrl, parseEmKline, COINLORE_URL, parseCoinLore, cryptoSymbol, bybitKlineUrl, parseBybitKline,
  parseQuotes, parseHint, hintKey, parseKline, klineKey, yahooSymbol, yahooUrl, parseYahooQuote, parseYahooKline,
  NEWS_FEEDS, newsFeedUrl, newsTicker, parseRss,
} from './quote.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/market';
const TTL = 8 * 1000;          // stocks, indices, commodities, FX
const YAHOO_TTL = 60 * 1000;   // indices, commodities and FX when they come from Yahoo (one request per instrument)
const CRYPTO_TTL = 40 * 1000;  // CoinLore asks for gentle polling
const SEARCH_COINS_TTL = 10 * 60 * 1000;
const MAX_WATCH = 100;
// Keys the watchlist accepts: global instruments from the catalog, coins, Hong Kong and US stocks.
const KEY_RE = /^x:\d+\.[A-Z0-9]+$|^c:[A-Z0-9]{1,12}$|^hk\d{5}$|^us[A-Z][A-Z0-9.-]{0,9}$/;
const DOMESTIC = /^(sh|sz|bj)\d{6}$|^hk[A-Z]{2,8}$|^us\./; // mainland A-shares and index keys of the old version; no longer offered

const UA = { 'user-agent': 'Mozilla/5.0 (Macintosh) DSH-LifePanels/2.0' };

/**
 * Eastmoney's hosts are reliable on some networks only over IPv4, on others only over IPv6, and on most with
 * Node's default choice, so a request tries the default connection first and then each address family. The
 * family that worked last is remembered per host and tried first next time.
 */
const lastFamily = new Map(); // host -> 0 (default) | 4 | 6
function getFamily(url, family, timeoutMs) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { ...(family ? { family } : {}), headers: UA, timeout: timeoutMs }, (res) => {
      if (res.statusCode !== 200) { res.resume(); reject(new Error('HTTP ' + res.statusCode)); return; }
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    });
    req.on('timeout', () => req.destroy(new Error('timeout')));
    req.on('error', reject);
  });
}
async function getResilient(url, timeoutMs) {
  const host = new URL(url).host;
  const first = lastFamily.has(host) ? lastFamily.get(host) : 0;
  const order = [first, ...[0, 4, 6].filter((f) => f !== first)];
  let last;
  for (const family of order) {
    try { const buf = await getFamily(url, family, Math.min(timeoutMs, 6000)); lastFamily.set(host, family); return buf; } catch (e) { last = e; }
  }
  throw last;
}

async function getBuffer(url, { timeoutMs = 8000, retries = 0 } = {}) {
  let last;
  const resilient = /^https:\/\/[\w.-]*eastmoney\.com\//.test(url);
  for (let i = 0; i <= retries; i++) {
    try {
      if (resilient) return await getResilient(url, timeoutMs);
      const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: UA });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return Buffer.from(await res.arrayBuffer());
    } catch (e) { last = e; if (i < retries) await new Promise((r) => setTimeout(r, 350 * (i + 1))); }
  }
  throw last;
}
async function getJson(url, opts) {
  const buf = await getBuffer(url, opts);
  try { return JSON.parse(buf.toString('utf8')); } catch { return null; }
}

export function apply(ctx) {
  const store = new Store(dataFile('market'), () => ({ version: 2, watchlist: [] }));
  const cache = new Map();            // key -> { at, quote }
  const coinPages = new Map();        // start -> { at, map }
  let coinSearch = null;              // { at, list }

  const fresh = (k, ttl) => { const c = cache.get(k); return c && Date.now() - c.at < ttl ? c.quote : null; };
  const remember = (map, at = Date.now()) => { for (const [k, q] of map) cache.set(k, { at, quote: q }); };

  /* ---- sources ---- */
  let emDownUntil = 0; // Eastmoney is unreachable on some networks: probe it briefly, then use Yahoo straight away for ten minutes
  async function eastmoney(keys) {
    const out = new Map();
    if (Date.now() >= emDownUntil) {
      try {
        for (let i = 0; i < keys.length; i += 40) {
          const buf = await getFamily(emUrl(keys.slice(i, i + 40)), lastFamily.get('push2.eastmoney.com') || 0, 2500);
          let json = null; try { json = JSON.parse(buf.toString('utf8')); } catch { json = null; }
          for (const [k, q] of parseEastmoney(json)) out.set(k, q);
        }
        if (out.size) return out;
      } catch { /* fall through to Yahoo */ }
      emDownUntil = Date.now() + 10 * 60 * 1000;
    }
    const todo = keys.filter((k) => !out.has(k) && yahooSymbol(k));
    let next = 0; let failure = null;
    await Promise.all(Array.from({ length: Math.min(12, todo.length) }, async () => {
      while (next < todo.length) {
        const k = todo[next++];
        try { const q = parseYahooQuote(k, await getJson(yahooUrl(k, '1d', '1d'), { retries: 1 })); if (q) out.set(k, q); } catch (e) { failure = e; }
      }
    }));
    if (!out.size && failure) throw failure;
    return out;
  }
  async function tencent(keys) {
    const out = new Map();
    for (let i = 0; i < keys.length; i += 50) {
      const batch = keys.slice(i, i + 50);
      const buf = await getBuffer('https://qt.gtimg.cn/q=' + batch.map(encodeURIComponent).join(','), { retries: 1 });
      const parsed = parseQuotes(new TextDecoder('gbk').decode(buf));
      for (const k of batch) { const q = parsed.get(k) || [...parsed.values()].find((x) => x.key.toLowerCase() === k.toLowerCase()); if (q) out.set(k, { ...q, key: k }); }
    }
    return out;
  }
  async function coinPage(start) {
    const hit = coinPages.get(start);
    if (hit && Date.now() - hit.at < CRYPTO_TTL) return hit.map;
    const map = parseCoinLore(await getJson(COINLORE_URL(start, 100), { retries: 1 }));
    coinPages.set(start, { at: Date.now(), map });
    return map;
  }
  /** Coins by key; looks through the top 300 by market cap, a page at a time, until every wanted coin is found. */
  async function coins(keys) {
    const out = new Map();
    const want = new Set(keys);
    for (const start of [0, 100, 200]) {
      if (!want.size) break;
      const map = await coinPage(start);
      for (const k of [...want]) { const q = map.get(k); if (q) { out.set(k, q); want.delete(k); } }
      if (start === 0 && !keys.length) break;
    }
    return out;
  }

  /** Quotes for any mix of keys. A source that fails leaves its keys out and is reported in `errors`. */
  async function quotes(keys, { force = false } = {}) {
    const want = [...new Set(keys)];
    const need = want.filter((k) => force || !fresh(k, k.startsWith('c:') ? CRYPTO_TTL : k.startsWith('x:') && Date.now() < emDownUntil ? YAHOO_TTL : TTL));
    const errors = {};
    const groups = { x: need.filter((k) => k.startsWith('x:')), c: need.filter((k) => k.startsWith('c:')), t: need.filter((k) => /^(us|hk)/.test(k)) };
    await Promise.all([
      groups.x.length ? eastmoney(groups.x).then((m) => remember(m), (e) => { errors.indices = errorText(e); }) : null,
      groups.c.length ? coins(groups.c).then((m) => remember(m), (e) => { errors.crypto = errorText(e); }) : null,
      groups.t.length ? tencent(groups.t).then((m) => remember(m), (e) => { errors.stocks = errorText(e); }) : null,
    ]);
    const out = new Map();
    for (const k of want) { const c = cache.get(k); if (c) out.set(k, c.quote); }
    return { map: out, errors };
  }

  /* ---- search ---- */
  async function allCoins() {
    if (coinSearch && Date.now() - coinSearch.at < SEARCH_COINS_TTL) return coinSearch.list;
    const list = [];
    for (const start of [0, 100, 200]) { try { list.push(...(await coinPage(start)).values()); } catch { break; } }
    if (list.length) coinSearch = { at: Date.now(), list };
    return list;
  }
  async function search(text) {
    const q = text.toLowerCase();
    const hits = [];
    const seen = new Set();
    const push = (h) => { if (!seen.has(h.key)) { seen.add(h.key); hits.push(h); } };
    for (const c of CATALOG) {
      const code = c[0].split('.')[1].toLowerCase();
      if (c[3].toLowerCase().includes(q) || c[4].toLowerCase().includes(q) || code === q) push({ key: c[0], kind: c[1], region: c[2], name: c[3], nameEn: c[4], code: c[0].split('.')[1] });
    }
    for (const c of await allCoins().catch(() => [])) {
      if (c.code.toLowerCase() === q || c.name.toLowerCase().includes(q)) push({ key: c.key, kind: 'crypto', region: '', name: c.name, nameEn: c.name, code: c.code, rank: c.rank });
      if (hits.length > 24) break;
    }
    try {
      const buf = await getBuffer('https://smartbox.gtimg.cn/s3/?v=2&q=' + encodeURIComponent(text) + '&t=all');
      for (const h of parseHint(buf.toString('utf8'))) { const key = hintKey(h); if (key) push({ key, kind: h.type === 'ZS' ? 'index' : 'stock', region: h.market === 'us' ? 'americas' : 'apac', name: h.name, nameEn: h.name, code: h.code.replace(/\.(oq|n|ps|am|a|k|pk|ob|nq)$/i, '').toUpperCase(), market: h.market }); }
    } catch { /* the catalog and coin hits still stand */ }
    // Exact code first, then coins by rank, then the rest in source order.
    const rank = (h) => (h.code.toLowerCase() === q || h.name.toLowerCase() === q ? 0 : 2) + (h.kind === 'index' ? 1 : 0);
    return hits.map((h, i) => ({ h, i })).sort((a, b) => rank(a.h) - rank(b.h) || a.i - b.i).map((x) => x.h).slice(0, 14);
  }

  function position(item, q) {
    const shares = Number(item.shares) || 0;
    const cost = Number(item.cost) || 0;
    if (!shares || !cost || !q || q.price === null) return null;
    const value = shares * q.price;
    const profit = value - shares * cost;
    return { value: Math.round(value * 100) / 100, profit: Math.round(profit * 100) / 100, pct: Math.round((profit / (shares * cost)) * 10000) / 100, currency: q.currency || '' };
  }

  /** Drop watchlist entries the global version cannot quote (mainland keys from the first version). */
  async function clean(data) {
    const before = data.watchlist.length;
    data.watchlist = data.watchlist.filter((w) => !DOMESTIC.test(w.key));
    if (data.watchlist.length !== before) await store.save();
  }

  async function overview(refresh) {
    const data = await store.load();
    await clean(data);
    if (refresh) { coinPages.clear(); }
    const keys = [...INDEX_KEYS, ...MACRO_KEYS, ...data.watchlist.map((w) => w.key)];
    const topPromise = coinPage(0).then((m) => [...m.values()].slice(0, 12), (e) => e);
    const { map, errors } = await quotes(keys, { force: !!refresh });
    const topResult = await topPromise;
    let top = [];
    if (Array.isArray(topResult)) top = topResult; else errors.crypto = errors.crypto || errorText(topResult);
    for (const q of top) cache.set(q.key, { at: Date.now(), quote: q });
    const row = (key) => { const c = catalogEntry(key); return { key, kind: c.kind, region: c.region, name: c.name, nameEn: c.nameEn, quote: map.get(key) || null }; };
    const items = data.watchlist.map((w) => {
      const q = map.get(w.key) || (w.key.startsWith('c:') ? (cache.get(w.key) || {}).quote : null) || null;
      return { id: w.id, key: w.key, name: (q && q.name) || w.name, nameEn: (q && q.nameEn) || w.nameEn || w.name, note: w.note || '', shares: w.shares || 0, cost: w.cost || 0, quote: q, position: position(w, q), addedAt: w.addedAt };
    });
    const now = new Date();
    const exchanges = EXCHANGES.map((e) => ({ id: e.id, city: e.city, cityZh: e.cityZh, lat: e.lat, lon: e.lon, tz: e.tz, state: exchangeState(e, now), index: e.index, quote: (map.get(e.index) || null) }));
    const headline = HEADLINE.map((k) => (k.startsWith('c:') ? { key: k, kind: 'crypto', name: 'Bitcoin', nameEn: 'Bitcoin', region: '', quote: (top.find((q) => q.key === k) || null) } : row(k)));
    return {
      ok: true, headline, indices: INDEX_KEYS.map(row), macro: MACRO_KEYS.map(row), crypto: top, exchanges, items,
      up: items.filter((i) => i.quote && i.quote.pct > 0).length, down: items.filter((i) => i.quote && i.quote.pct < 0).length,
      openCount: exchanges.filter((e) => e.state === 'open').length, stale: Object.keys(errors).length > 0, errors, at: now.toISOString(),
    };
  }

  async function add(data, input) {
    const raw = String(input.symbol || input.key || input.query || '').trim();
    if (!raw) return { ok: false, error: 'symbol is required: a key such as c:BTC, usAAPL, hk00700, x:100.N225, or a name or ticker to look up' };
    let key = KEY_RE.test(raw) ? raw : null;
    if (!key && /^[A-Za-z]{1,6}$/.test(raw) === false && KEY_RE.test(raw.toUpperCase())) key = raw.toUpperCase();
    if (key && /^us/i.test(key)) key = 'us' + key.slice(2).toUpperCase();
    if (key && /^c:/i.test(key)) key = 'c:' + key.slice(2).toUpperCase();
    if (key && !KEY_RE.test(key)) key = null;
    if (!key) {
      const hits = await search(raw);
      if (!hits.length) return { ok: false, error: 'Nothing found for "' + clip(raw, 40) + '": try a ticker (AAPL), a coin (BTC), or a market name (Nikkei)' };
      key = hits[0].key;
    }
    if (key.startsWith('x:') && !catalogEntry(key)) return { ok: false, error: 'Unknown instrument: ' + key };
    if (data.watchlist.some((w) => w.key === key)) return { ok: true, already: true, key };
    if (data.watchlist.length >= MAX_WATCH) return { ok: false, error: 'Watchlist is full (' + MAX_WATCH + ')' };
    const { map } = await quotes([key], { force: true });
    const q = map.get(key);
    if (!q) return { ok: false, error: 'Unknown symbol: ' + key };
    const now = new Date().toISOString();
    data.watchlist.push({ id: key, key, name: q.name, nameEn: q.nameEn, addedAt: now, updatedAt: now });
    await store.save();
    return { ok: true, key, name: q.nameEn || q.name };
  }

  async function history(key, days) {
    const { map } = await quotes([key]);
    const q = map.get(key);
    if (!q) return { ok: false, error: 'Unknown symbol: ' + key };
    let candles = [];
    if (key.startsWith('x:')) {
      if (Date.now() >= emDownUntil) try { candles = parseEmKline(await getJson(emKlineUrl(key, days), { timeoutMs: 4000, retries: 0 })); } catch { candles = []; }
      if (!candles.length && yahooSymbol(key)) {
        try { candles = parseYahooKline(await getJson(yahooUrl(key, days <= 20 ? '1mo' : days <= 60 ? '3mo' : days <= 120 ? '6mo' : '1y', '1d'), { timeoutMs: 10000, retries: 1 })).slice(-days); } catch { candles = []; }
      }
    } else if (key.startsWith('c:')) {
      try { candles = parseBybitKline(await getJson(bybitKlineUrl(cryptoSymbol(key), days), { timeoutMs: 10000, retries: 1 })); } catch { candles = []; }
    } else {
      const kk = klineKey(q);
      candles = parseKline(await getJson('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=' + encodeURIComponent(kk) + ',day,,,' + days + ',qfq', { timeoutMs: 10000, retries: 1 }), kk);
    }
    return { ok: true, key, name: q.nameEn || q.name, quote: q, candles };
  }

  /* ---- news ---- */
  const newsCache = new Map(); // url -> { at, items }
  async function feed(url, symbol) {
    const hit = newsCache.get(url);
    if (hit && Date.now() - hit.at < 2 * 60 * 1000) return hit.items;
    try {
      const items = parseRss((await getBuffer(url, { timeoutMs: 6000 })).toString('utf8'), symbol);
      newsCache.set(url, { at: Date.now(), items });
      if (newsCache.size > 100) newsCache.delete(newsCache.keys().next().value);
      return items;
    } catch { return hit ? hit.items : []; }
  }
  /** Headlines for the market in general, the watchlist (first six symbols) or one symbol. */
  async function news(data, input) {
    const scope = String(input.scope || 'market');
    let sources;
    if (scope === 'symbol') {
      const key = String(input.id || input.key || '').trim();
      const ticker = key ? newsTicker(key) : null;
      if (!ticker) return { ok: false, error: 'No news feed for: ' + key };
      sources = [[newsFeedUrl(ticker), ticker]];
    } else if (scope === 'watchlist') {
      sources = data.watchlist.slice(0, 6).map((w) => [w.key, newsTicker(w.key)]).filter((x) => x[1]).map(([, t]) => [newsFeedUrl(t), t]);
    } else if (scope === 'crypto') {
      sources = ['BTC-USD', 'ETH-USD', 'SOL-USD'].map((t) => [newsFeedUrl(t), t]);
    } else {
      sources = NEWS_FEEDS.map((u) => [u, '']);
    }
    const lists = await Promise.all(sources.map(([u, sym]) => feed(u, sym)));
    const seen = new Set();
    const items = lists.flat().filter((n) => !seen.has(n.title) && seen.add(n.title)).sort((a, b) => b.time - a.time).slice(0, 40);
    return { ok: true, scope, items };
  }

  async function run(input) {
    const data = await store.load();
    const action = input.action || 'quotes';
    if (action === 'quotes') return overview(!!input.refresh);
    if (action === 'search') {
      const text = String(input.query || '').trim();
      if (!text) return { ok: false, error: 'query is required' };
      const have = new Set(data.watchlist.map((w) => w.key));
      return { ok: true, results: (await search(text)).map((h) => ({ ...h, watched: have.has(h.key) })) };
    }
    if (action === 'add') return add(data, input);
    if (action === 'remove') {
      const i = data.watchlist.findIndex((w) => w.id === input.id || w.key === input.id);
      if (i < 0) return { ok: false, error: 'Not on the watchlist: ' + String(input.id) };
      data.watchlist.splice(i, 1);
      await store.save();
      return { ok: true };
    }
    if (action === 'update') {
      const w = data.watchlist.find((x) => x.id === input.id || x.key === input.id);
      if (!w) return { ok: false, error: 'Not on the watchlist: ' + String(input.id) };
      if (input.note !== undefined) w.note = clip(String(input.note), 200);
      for (const f of ['shares', 'cost']) {
        if (input[f] === undefined) continue;
        const n = Number(input[f]);
        if (input[f] === '' || input[f] === null) delete w[f];
        else if (Number.isFinite(n) && n >= 0) w[f] = n;
        else return { ok: false, error: f + ' must be a non-negative number' };
      }
      w.updatedAt = new Date().toISOString();
      await store.save();
      return { ok: true };
    }
    if (action === 'news') return news(data, input);
    if (action === 'history') {
      const key = String(input.id || input.key || '').trim();
      if (!key) return { ok: false, error: 'id is required' };
      return history(key, Math.max(5, Math.min(250, Math.floor(Number(input.days) || 60))));
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  registerRoute(ctx, ROUTE, run, 'market');

  /* ---- the globe script (three.js and the land map bundled in), same-origin so the page needs no CDN ---- */
  const asset = (name, type) => ({
    kind: 'exact',
    path: ROUTE + '/' + name,
    async handler(req, res) {
      const code = req.lanTrusted === true ? null : ctx.connection.requestRejection({ headers: req.headers });
      if (code || (req.lanTrusted !== true && req.headers['sec-fetch-site'] === 'cross-site')) { res.writeHead(code || 403, { 'content-type': 'text/plain' }); res.end('forbidden'); return; }
      if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { 'content-type': 'text/plain', allow: 'GET, HEAD' }); res.end('GET only'); return; }
      try {
        const body = await fs.readFile(new URL('./vendor/' + name, import.meta.url));
        res.writeHead(200, { 'content-type': type, 'cache-control': 'private, no-cache', 'content-length': body.length });
        res.end(req.method === 'HEAD' ? undefined : body);
      } catch (error) { res.writeHead(500, { 'content-type': 'text/plain' }); res.end(errorText(error)); }
    },
  });
  for (const a of [asset('globe.js', 'text/javascript; charset=utf-8')]) {
    ctx.effect(() => ctx.webServer.register(a), 'market: ' + a.path);
    lanRaw(ctx, 'market', a.path, a.handler, 'market: ' + a.path);
  }

  registerTool(ctx, {
    name: 'market',
    description: 'Global markets in the sidebar Market panel: world stock indices and exchanges (Americas, Europe, Asia-Pacific), gold, oil and other commodities, major currency pairs, crypto, plus a watchlist of US and Hong Kong stocks, ETFs and coins with optional positions. Delayed public quotes, no account. Actions: quotes (headline markets, all indices, commodities and FX, top coins, which exchanges are open, and the watchlist with positions; optional refresh), search (query: a ticker, company, coin or market name), add (symbol: a key like c:BTC, usAAPL, hk00700, x:100.N225, or a name or ticker to look up), remove (id), update (id plus note, shares, cost for profit and loss; empty clears), history (id, optional days up to 250: daily candles), news (scope market|watchlist|crypto|symbol, id for symbol: recent headlines from public RSS feeds). Prices come from unofficial public endpoints and may lag; this is information, not investment advice.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['quotes', 'search', 'add', 'remove', 'update', 'history', 'news'], description: 'Operation to perform.' },
        query: { type: 'string', description: 'search: ticker, company, coin or market name.' },
        symbol: { type: 'string', description: 'add: a key (c:BTC, usAAPL, hk00700, x:100.N225) or a name or ticker to look up.' },
        id: { type: 'string', description: 'remove/update/history: key of the symbol.' },
        note: { type: 'string', description: 'update: a note shown next to the symbol.' },
        shares: { type: ['number', 'string'], description: 'update: units held; empty string clears.' },
        cost: { type: ['number', 'string'], description: 'update: average cost per unit, in the quote currency; empty string clears.' },
        days: { type: 'number', description: 'history: number of daily candles, default 60.' },
        scope: { type: 'string', enum: ['market', 'watchlist', 'crypto', 'symbol'], description: 'news: which headlines; symbol needs id.' },
        refresh: { type: 'boolean', description: 'quotes: bypass the short cache.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'market');
}
