import { Store, dataFile, registerRoute, registerTool, clip, errorText } from './common.js';
import { INDICES, parseQuotes, parseHint, hintKey, parseKline, klineKey } from './quote.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/market';
const QUOTE_TTL = 8 * 1000;
const MAX_WATCH = 100;
const KEY_RE = /^(sh|sz|bj)\d{6}$|^hk\d{5}$|^hk[A-Z]{2,8}$|^us\.?[A-Z][A-Z0-9.-]{0,9}$/;

async function getBuffer(url, timeoutMs = 8000) {
  const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), headers: { 'user-agent': 'Mozilla/5.0 (Macintosh) DSH-LifePanels/1.0' } });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  return Buffer.from(await res.arrayBuffer());
}

export function apply(ctx) {
  // The watchlist is keyed by quote key (sh600519, hk00700, usAAPL) so two computers merge per symbol.
  const store = new Store(dataFile('market'), () => ({ version: 1, watchlist: [] }));
  const cache = new Map(); // key -> { at, quote }

  /** Quotes for any keys; missing ones come back absent. Fresh cache entries are reused. */
  async function quotes(keys) {
    const want = [...new Set(keys)];
    const need = want.filter((k) => { const c = cache.get(k); return !c || Date.now() - c.at > QUOTE_TTL; });
    if (need.length) {
      for (let i = 0; i < need.length; i += 60) {
        const batch = need.slice(i, i + 60);
        const buf = await getBuffer('https://qt.gtimg.cn/q=' + batch.map(encodeURIComponent).join(','));
        const parsed = parseQuotes(new TextDecoder('gbk').decode(buf));
        const now = Date.now();
        for (const k of batch) {
          const q = parsed.get(k) || [...parsed.values()].find((x) => x.key.toLowerCase() === k.toLowerCase());
          if (q) cache.set(k, { at: now, quote: q });
        }
      }
    }
    const out = new Map();
    for (const k of want) { const c = cache.get(k); if (c) out.set(k, c.quote); }
    return out;
  }

  async function search(text) {
    const buf = await getBuffer('https://smartbox.gtimg.cn/s3/?v=2&q=' + encodeURIComponent(text) + '&t=all');
    return parseHint(buf.toString('utf8')).map((h) => ({ ...h, key: hintKey(h) })).filter((h) => h.key).slice(0, 12);
  }

  function position(item, q) {
    const shares = Number(item.shares) || 0;
    const cost = Number(item.cost) || 0;
    if (!shares || !cost || !q || q.price === null) return null;
    const value = shares * q.price;
    const profit = value - shares * cost;
    return { value: Math.round(value * 100) / 100, profit: Math.round(profit * 100) / 100, pct: Math.round((profit / (shares * cost)) * 10000) / 100 };
  }

  async function overview(refresh) {
    const data = await store.load();
    if (refresh) cache.clear();
    const keys = [...INDICES.map((i) => i[0]), ...data.watchlist.map((w) => w.key)];
    let map;
    let error = null;
    try { map = await quotes(keys); } catch (e) { error = errorText(e); map = new Map(); for (const k of keys) { const c = cache.get(k); if (c) map.set(k, c.quote); } }
    const stale = error !== null;
    const indices = INDICES.map(([key, name]) => ({ key, name, quote: map.get(key) || null }));
    const items = data.watchlist.map((w) => {
      const q = map.get(w.key) || null;
      return { id: w.id, key: w.key, name: (q && q.name) || w.name, note: w.note || '', shares: w.shares || 0, cost: w.cost || 0, quote: q, position: position(w, q), addedAt: w.addedAt };
    });
    const up = items.filter((i) => i.quote && i.quote.pct > 0).length;
    const down = items.filter((i) => i.quote && i.quote.pct < 0).length;
    return { ok: true, indices, items, up, down, stale, error, at: new Date().toISOString() };
  }

  async function add(data, input) {
    const raw = String(input.symbol || input.key || input.query || '').trim();
    if (!raw) return { ok: false, error: 'symbol is required: a quote key such as sh600519, hk00700, usAAPL, a bare code, or a name' };
    let key = KEY_RE.test(raw) ? raw.replace(/^(sh|sz|bj|hk)/i, (m) => m.toLowerCase()) : null;
    if (key && /^us/i.test(key)) key = 'us' + key.slice(2).toUpperCase();
    if (!key) {
      const hits = await search(raw);
      if (!hits.length) return { ok: false, error: 'No stock, ETF or index found for "' + clip(raw, 40) + '"' };
      // Rank: an exact code or name match, then stocks and ETFs ahead of indices (a bare 000001 is both the
      // Shanghai index and Ping An Bank; "腾讯" should give Tencent, not an index with its name in it).
      const rank = (h) => (h.code.toLowerCase() === raw.toLowerCase() || h.name === raw ? 0 : 2) + (h.type === 'ZS' ? 1 : 0);
      key = hits.map((h, i) => ({ h, i })).sort((a, b) => rank(a.h) - rank(b.h) || a.i - b.i)[0].h.key;
    }
    if (data.watchlist.some((w) => w.key === key)) return { ok: true, already: true, key };
    if (data.watchlist.length >= MAX_WATCH) return { ok: false, error: 'Watchlist is full (' + MAX_WATCH + ')' };
    const map = await quotes([key]);
    const q = map.get(key);
    if (!q) return { ok: false, error: 'Unknown symbol: ' + key };
    const now = new Date().toISOString();
    data.watchlist.push({ id: key, key, name: q.name, addedAt: now, updatedAt: now });
    await store.save();
    return { ok: true, key, name: q.name };
  }

  async function run(input) {
    const data = await store.load();
    const action = input.action || 'quotes';
    if (action === 'quotes') return overview(!!input.refresh);
    if (action === 'search') {
      const text = String(input.query || '').trim();
      if (!text) return { ok: false, error: 'query is required' };
      const hits = await search(text);
      const have = new Set(data.watchlist.map((w) => w.key));
      return { ok: true, results: hits.map((h) => ({ key: h.key, code: h.code, name: h.name, market: h.market, type: h.type, watched: have.has(h.key) })) };
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
    if (action === 'history') {
      const key = String(input.id || input.key || '').trim();
      if (!key) return { ok: false, error: 'id is required' };
      const q = (await quotes([key])).get(key);
      if (!q) return { ok: false, error: 'Unknown symbol: ' + key };
      const days = Math.max(5, Math.min(250, Math.floor(Number(input.days) || 60)));
      const kk = klineKey(q);
      const buf = await getBuffer('https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=' + encodeURIComponent(kk) + ',day,,,' + days + ',qfq', 10000);
      let json = null;
      try { json = JSON.parse(buf.toString('utf8')); } catch { json = null; }
      return { ok: true, key, name: q.name, quote: q, candles: parseKline(json, kk) };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  registerRoute(ctx, ROUTE, run, 'market');
  registerTool(ctx, {
    name: 'market',
    description: 'Stock, ETF and index watchlist in the sidebar Market panel (China A-shares, Hong Kong, US; delayed public quotes, no account). Actions: quotes (watchlist with prices, change and positions, plus the main indices; optional refresh), search (query: name, pinyin or code), add (symbol: a quote key like sh600519, hk00700, usAAPL, or a name/code to look up), remove (id), update (id plus note, shares, cost for profit and loss; empty clears), history (id, optional days up to 250: daily candles). Prices come from an unofficial public endpoint and may lag; this is information, not investment advice.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['quotes', 'search', 'add', 'remove', 'update', 'history'], description: 'Operation to perform.' },
        query: { type: 'string', description: 'search: name, pinyin or code.' },
        symbol: { type: 'string', description: 'add: quote key (sh600519, sz000001, hk00700, usAAPL) or a name/code to look up.' },
        id: { type: 'string', description: 'remove/update/history: quote key of the symbol.' },
        note: { type: 'string', description: 'update: a note shown next to the symbol.' },
        shares: { type: ['number', 'string'], description: 'update: shares held; empty string clears.' },
        cost: { type: ['number', 'string'], description: 'update: average cost per share; empty string clears.' },
        days: { type: 'number', description: 'history: number of daily candles, default 60.' },
        refresh: { type: 'boolean', description: 'quotes: bypass the short cache.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'market');
}
