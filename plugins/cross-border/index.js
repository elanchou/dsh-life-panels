import { Store, dataFile, registerRoute, registerTool, clip, uid } from './common.js';
import { computeProfit, priceFor } from './calc.js';
import { getRates, rateIn } from './rates.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/cross-border';
const MAX_PRODUCTS = 5000;
const MAX_SHIPMENTS = 2000;
const PLATFORMS = ['amazon', 'shopify', 'tiktok', 'temu', 'aliexpress', 'ebay', 'shopee', 'lazada', 'other'];
const SHIP_STATUS = ['preparing', 'in_transit', 'customs', 'delivered', 'exception'];
const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'HKD', 'KRW', 'THB', 'MYR', 'PHP', 'IDR', 'BRL', 'MXN', 'PLN', 'SEK', 'NOK', 'DKK', 'CHF', 'TRY', 'INR', 'ZAR', 'CNY'];
/** Starting points when a listing leaves a field blank: edit them per listing. VAT/GST are standard rates of the market; platform fees are rough category averages, not a quote. */
export const MARKET_PRESETS = {
  US: { currency: 'USD', vatPct: 0 }, UK: { currency: 'GBP', vatPct: 20 }, DE: { currency: 'EUR', vatPct: 19 }, FR: { currency: 'EUR', vatPct: 20 },
  JP: { currency: 'JPY', vatPct: 10 }, AU: { currency: 'AUD', vatPct: 10 }, CA: { currency: 'CAD', vatPct: 5 }, SG: { currency: 'SGD', vatPct: 9 },
};
export const PLATFORM_FEE_PCT = { amazon: 15, ebay: 13, shopify: 3, tiktok: 6, temu: 0, aliexpress: 8, shopee: 8, lazada: 6, other: 10 };

const NUM_FIELDS = ['costCny', 'shippingCny', 'dutyPct'];
const LISTING_NUM = ['price', 'vatPct', 'platformFeePct', 'fulfilFee', 'adPct', 'returnPct'];

function num(v) { const n = Number(v); return Number.isFinite(n) ? Math.round(n * 10000) / 10000 : NaN; }
function str(v, n) { return clip(String(v ?? '').trim(), n); }
/** Parse a non-negative number field; undefined stays undefined. Returns { error } or { value }. */
function nonNeg(input, key, max = 1e9) {
  if (input[key] === undefined || input[key] === null || input[key] === '') return { value: undefined };
  const n = num(input[key]);
  if (Number.isNaN(n) || n < 0 || n > max) return { error: key + ' must be a number between 0 and ' + max };
  return { value: n };
}
export function trackUrl(no) { return no ? 'https://t.17track.net/en#nums=' + encodeURIComponent(no) : ''; }

export function apply(ctx) {
  const store = new Store(dataFile('cross-border'), () => ({ version: 1, products: [], shipments: [] }));
  const now = () => new Date().toISOString();

  /** Listing economics in its own currency, with the CNY rate resolved from `rates` or an explicit override. */
  function evalListing(product, listing, table) {
    const rate = Number(listing.rate) > 0 ? Number(listing.rate) : rateIn(table, listing.currency);
    if (!rate) return { ok: false, error: 'No rate for ' + listing.currency + '; set `rate` (' + listing.currency + ' per 1 CNY) on the listing' };
    return computeProfit({
      ...listing, costCny: product.costCny, shippingCny: product.shippingCny, dutyPct: product.dutyPct,
    }, rate);
  }
  async function ratesOrNull() { try { return await getRates(); } catch { return null; } }

  const productView = (p, table) => ({
    ...p,
    listings: p.listings.map((l) => ({ ...l, economics: evalListing(p, l, table) })),
  });

  function listingFrom(input, base = {}) {
    const out = { ...base };
    const market = input.market !== undefined ? str(input.market, 12).toUpperCase() : out.market || '';
    const preset = MARKET_PRESETS[market] || {};
    if (input.platform !== undefined) {
      if (!PLATFORMS.includes(input.platform)) return { error: 'platform must be one of ' + PLATFORMS.join(', ') };
      out.platform = input.platform;
    }
    out.platform = out.platform || 'other';
    out.market = market;
    const currency = input.currency !== undefined ? str(input.currency, 5).toUpperCase() : out.currency || preset.currency || 'USD';
    if (!/^[A-Z]{3}$/.test(currency)) return { error: 'currency must be a 3-letter code' };
    out.currency = currency;
    for (const k of LISTING_NUM) {
      const r = nonNeg(input, k, k.endsWith('Pct') ? 100 : 1e9);
      if (r.error) return { error: r.error };
      if (r.value !== undefined) out[k] = r.value;
    }
    if (out.vatPct === undefined) out.vatPct = preset.vatPct ?? 0;
    if (out.platformFeePct === undefined) out.platformFeePct = PLATFORM_FEE_PCT[out.platform] ?? 10;
    for (const k of ['fulfilFee', 'adPct', 'returnPct']) if (out[k] === undefined) out[k] = 0;
    if (input.rate !== undefined) {
      if (input.rate === '' || input.rate === null) delete out.rate;
      else { const r = num(input.rate); if (!(r > 0)) return { error: 'rate must be greater than 0' }; out.rate = r; }
    }
    if (input.url !== undefined) out.url = str(input.url, 500);
    if (input.note !== undefined) out.note = str(input.note, 300);
    if (!(out.price > 0)) return { error: 'price must be greater than 0' };
    return { value: out };
  }

  async function run(input) {
    const data = await store.load();
    const action = input.action || 'list';
    const touch = async (extra) => { await store.save(); return { ok: true, ...extra }; };

    if (action === 'rates') {
      try {
        const t = await getRates({ refresh: !!input.refresh });
        const wanted = Array.isArray(input.currencies) && input.currencies.length ? input.currencies.map((c) => String(c).toUpperCase()) : CURRENCIES;
        const rates = {};
        for (const c of wanted) if (t.rates[c]) rates[c] = t.rates[c];
        return { ok: true, base: 'CNY', date: t.date, source: t.source, stale: t.stale, rates, note: 'Units of the currency per 1 CNY.' };
      } catch (e) { return { ok: false, error: e.message }; }
    }

    if (action === 'calc' || action === 'price_for') {
      const p = {};
      for (const k of [...NUM_FIELDS, ...LISTING_NUM]) {
        const r = nonNeg(input, k, k.endsWith('Pct') ? 100 : 1e9);
        if (r.error) return { ok: false, error: r.error };
        if (r.value !== undefined) p[k] = r.value;
      }
      let rate = num(input.rate);
      if (!(rate > 0)) {
        const cur = str(input.currency || 'USD', 5).toUpperCase();
        try { rate = rateIn(await getRates(), cur); } catch (e) { return { ok: false, error: e.message }; }
        if (!rate) return { ok: false, error: 'No rate for ' + cur + '; pass `rate`' };
      }
      if (action === 'price_for') {
        const target = input.targetMarginPct === undefined ? 20 : num(input.targetMarginPct);
        if (Number.isNaN(target) || target < 0 || target >= 100) return { ok: false, error: 'targetMarginPct must be between 0 and 100' };
        const price = priceFor(p, rate, target);
        if (price === null) return { ok: false, error: 'Fees and target margin add up to 100% or more of the price; no price can reach it' };
        return { ok: true, price, targetMarginPct: target, rate, result: computeProfit({ ...p, price }, rate) };
      }
      const r = computeProfit(p, rate);
      return r.ok ? { ok: true, result: r } : r;
    }

    if (action === 'list') {
      const q = String(input.query || '').trim().toLowerCase();
      const tag = String(input.tag || '').trim().toLowerCase();
      const table = await ratesOrNull();
      let items = data.products.filter((p) => (!tag || (p.tags || []).includes(tag))
        && (!q || (p.sku + ' ' + p.title + ' ' + (p.titles ? Object.values(p.titles).join(' ') : '') + ' ' + (p.tags || []).join(' ')).toLowerCase().includes(q)));
      items = items.slice().sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
      const limit = Math.max(1, Math.min(500, Math.floor(Number(input.limit) || 200)));
      const rows = items.slice(0, limit).map((p) => {
        const econ = p.listings.map((l) => ({ l, e: evalListing(p, l, table) })).filter((x) => x.e.ok);
        const margins = econ.map((x) => x.e.marginPct);
        return {
          id: p.id, sku: p.sku, title: p.title, costCny: p.costCny, stock: p.stock, tags: p.tags || [], updatedAt: p.updatedAt,
          listings: p.listings.length, markets: [...new Set(p.listings.map((l) => l.market).filter(Boolean))],
          minMarginPct: margins.length ? Math.min(...margins) : null, maxMarginPct: margins.length ? Math.max(...margins) : null,
          lowStock: p.stock !== null && p.reorderAt > 0 && p.stock <= p.reorderAt,
        };
      });
      const tagCount = new Map();
      for (const p of data.products) for (const t of p.tags || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
      return {
        ok: true, total: data.products.length, matched: items.length, items: rows,
        tags: [...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
        ratesDate: table ? table.date : null, ratesStale: table ? !!table.stale : null,
      };
    }

    if (action === 'get') {
      const p = data.products.find((x) => x.id === input.id);
      if (!p) return { ok: false, error: 'No such product: ' + String(input.id) };
      return { ok: true, product: productView(p, await ratesOrNull()) };
    }

    if (action === 'add_product') {
      const title = str(input.title, 200);
      if (!title) return { ok: false, error: 'title is required' };
      if (data.products.length >= MAX_PRODUCTS) return { ok: false, error: 'Too many products (max ' + MAX_PRODUCTS + ')' };
      const sku = str(input.sku, 60) || 'SKU-' + String(data.products.length + 1).padStart(4, '0');
      if (data.products.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) return { ok: false, error: 'SKU already exists: ' + sku };
      const p = { id: uid(), sku, title, titles: {}, costCny: 0, shippingCny: 0, dutyPct: 0, stock: null, reorderAt: 0, tags: [], notes: '', listings: [], createdAt: now(), updatedAt: now() };
      const err = applyProductFields(p, input);
      if (err) return { ok: false, error: err };
      data.products.push(p);
      return touch({ product: productView(p, await ratesOrNull()) });
    }

    if (action === 'update_product') {
      const p = data.products.find((x) => x.id === input.id);
      if (!p) return { ok: false, error: 'No such product: ' + String(input.id) };
      if (input.sku !== undefined) {
        const sku = str(input.sku, 60);
        if (!sku) return { ok: false, error: 'sku cannot be empty' };
        if (data.products.some((x) => x !== p && x.sku.toLowerCase() === sku.toLowerCase())) return { ok: false, error: 'SKU already exists: ' + sku };
        p.sku = sku;
      }
      const err = applyProductFields(p, input);
      if (err) return { ok: false, error: err };
      p.updatedAt = now();
      return touch({ product: productView(p, await ratesOrNull()) });
    }

    if (action === 'remove_product') {
      const i = data.products.findIndex((x) => x.id === input.id);
      if (i < 0) return { ok: false, error: 'No such product: ' + String(input.id) };
      data.products.splice(i, 1);
      for (const s of data.shipments) if (s.productId === input.id) s.productId = null;
      return touch({ removed: input.id });
    }

    if (action === 'set_listing') {
      const p = data.products.find((x) => x.id === input.id);
      if (!p) return { ok: false, error: 'No such product: ' + String(input.id) };
      const existing = input.listingId ? p.listings.find((l) => l.id === input.listingId) : null;
      if (input.listingId && !existing) return { ok: false, error: 'No such listing: ' + String(input.listingId) };
      const r = listingFrom(input, existing || {});
      if (r.error) return { ok: false, error: r.error };
      if (existing) Object.assign(existing, r.value);
      else {
        if (p.listings.length >= 40) return { ok: false, error: 'Too many listings on one product (max 40)' };
        p.listings.push({ id: uid(), ...r.value });
      }
      p.updatedAt = now();
      return touch({ product: productView(p, await ratesOrNull()) });
    }

    if (action === 'remove_listing') {
      const p = data.products.find((x) => x.id === input.id);
      const i = p ? p.listings.findIndex((l) => l.id === input.listingId) : -1;
      if (!p) return { ok: false, error: 'No such product: ' + String(input.id) };
      if (i < 0) return { ok: false, error: 'No such listing: ' + String(input.listingId) };
      p.listings.splice(i, 1);
      p.updatedAt = now();
      return touch({ product: productView(p, await ratesOrNull()) });
    }

    if (action === 'list_shipments') {
      const open = input.openOnly === true;
      const items = data.shipments.filter((s) => !open || s.status !== 'delivered').sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
        .map((s) => ({ ...s, trackUrl: trackUrl(s.trackingNo), sku: (data.products.find((p) => p.id === s.productId) || {}).sku || null }));
      return { ok: true, total: data.shipments.length, items };
    }

    if (action === 'add_shipment') {
      if (data.shipments.length >= MAX_SHIPMENTS) return { ok: false, error: 'Too many shipments (max ' + MAX_SHIPMENTS + ')' };
      const trackingNo = str(input.trackingNo, 60);
      const label = str(input.label, 120);
      if (!trackingNo && !label) return { ok: false, error: 'Provide trackingNo or label' };
      if (input.status !== undefined && !SHIP_STATUS.includes(input.status)) return { ok: false, error: 'status must be one of ' + SHIP_STATUS.join(', ') };
      if (input.productId && !data.products.some((p) => p.id === input.productId)) return { ok: false, error: 'No such product: ' + String(input.productId) };
      const qty = input.qty === undefined ? 0 : num(input.qty);
      if (Number.isNaN(qty) || qty < 0) return { ok: false, error: 'qty must be a non-negative number' };
      const s = {
        id: uid(), label, trackingNo, carrier: str(input.carrier, 60), productId: input.productId || null, qty,
        status: input.status || 'in_transit', eta: /^\d{4}-\d{2}-\d{2}$/.test(String(input.eta || '')) ? input.eta : '', note: str(input.note, 300),
        createdAt: now(), updatedAt: now(),
      };
      data.shipments.push(s);
      return touch({ shipment: { ...s, trackUrl: trackUrl(trackingNo) } });
    }

    if (action === 'update_shipment') {
      const s = data.shipments.find((x) => x.id === input.shipmentId);
      if (!s) return { ok: false, error: 'No such shipment: ' + String(input.shipmentId) };
      if (input.status !== undefined) { if (!SHIP_STATUS.includes(input.status)) return { ok: false, error: 'status must be one of ' + SHIP_STATUS.join(', ') }; s.status = input.status; }
      if (input.trackingNo !== undefined) s.trackingNo = str(input.trackingNo, 60);
      if (input.carrier !== undefined) s.carrier = str(input.carrier, 60);
      if (input.label !== undefined) s.label = str(input.label, 120);
      if (input.note !== undefined) s.note = str(input.note, 300);
      if (input.eta !== undefined) s.eta = /^\d{4}-\d{2}-\d{2}$/.test(String(input.eta)) ? input.eta : '';
      s.updatedAt = now();
      // Stock arrives when the shipment is first marked delivered; it is applied once.
      let stockAdded = 0;
      if (s.status === 'delivered' && !s.stockApplied && s.productId && s.qty > 0) {
        const p = data.products.find((x) => x.id === s.productId);
        if (p) { p.stock = (p.stock || 0) + s.qty; p.updatedAt = now(); stockAdded = s.qty; s.stockApplied = true; }
      }
      return touch({ shipment: { ...s, trackUrl: trackUrl(s.trackingNo) }, stockAdded });
    }

    if (action === 'remove_shipment') {
      const i = data.shipments.findIndex((x) => x.id === input.shipmentId);
      if (i < 0) return { ok: false, error: 'No such shipment: ' + String(input.shipmentId) };
      data.shipments.splice(i, 1);
      return touch({ removed: input.shipmentId });
    }

    if (action === 'summary') {
      const table = await ratesOrNull();
      const loss = []; const low = [];
      for (const p of data.products) {
        for (const l of p.listings) {
          const e = evalListing(p, l, table);
          if (e.ok && e.profit < 0) loss.push({ sku: p.sku, title: p.title, market: l.market, platform: l.platform, profit: e.profit, currency: l.currency, marginPct: e.marginPct });
        }
        if (p.stock !== null && p.reorderAt > 0 && p.stock <= p.reorderAt) low.push({ sku: p.sku, title: p.title, stock: p.stock, reorderAt: p.reorderAt });
      }
      const open = data.shipments.filter((s) => s.status !== 'delivered');
      return {
        ok: true, products: data.products.length, listings: data.products.reduce((a, p) => a + p.listings.length, 0),
        losingListings: loss, lowStock: low,
        openShipments: open.length, lateShipments: open.filter((s) => s.eta && s.eta < new Date().toISOString().slice(0, 10)).length,
        ratesDate: table ? table.date : null,
      };
    }

    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  /** Apply the product-level fields present in `input` to `p`. Returns an error message or null. */
  function applyProductFields(p, input) {
    if (input.title !== undefined) { const t = str(input.title, 200); if (!t) return 'title cannot be empty'; p.title = t; }
    if (input.titles !== undefined) {
      if (!input.titles || typeof input.titles !== 'object' || Array.isArray(input.titles)) return 'titles must be an object of language code to title';
      const out = {};
      for (const [k, v] of Object.entries(input.titles).slice(0, 20)) if (/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(k) && str(v, 300)) out[k] = str(v, 300);
      p.titles = out;
    }
    for (const k of NUM_FIELDS) {
      const r = nonNeg(input, k, k === 'dutyPct' ? 100 : 1e9);
      if (r.error) return r.error;
      if (r.value !== undefined) p[k] = r.value;
    }
    if (input.stock !== undefined) {
      if (input.stock === null || input.stock === '') p.stock = null;
      else { const n = num(input.stock); if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) return 'stock must be a non-negative integer'; p.stock = n; }
    }
    const ra = nonNeg(input, 'reorderAt');
    if (ra.error) return ra.error;
    if (ra.value !== undefined) p.reorderAt = Math.floor(ra.value);
    if (input.tags !== undefined) p.tags = [...new Set((Array.isArray(input.tags) ? input.tags : []).map((t) => String(t).trim().replace(/^#/, '').toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 12);
    if (input.notes !== undefined) p.notes = str(input.notes, 4000);
    return null;
  }

  registerRoute(ctx, ROUTE, run, 'cross-border');
  registerTool(ctx, {
    name: 'cross_border',
    description: 'Cross-border e-commerce workbench in the sidebar Cross-border panel: products with a landed cost in CNY, listings per platform and market with fees, VAT and ad spend, live profit and margin in the sale currency, and inbound shipments. Rates are daily ECB reference rates (about 30 currencies). Fee and VAT defaults are starting points; the user\'s real platform fees win. Actions: summary (listings that lose money, low stock, open and late shipments); list (query, tag, limit); get (id); add_product (title, optional sku, titles {lang: title}, costCny, shippingCny, dutyPct, stock, reorderAt, tags, notes); update_product (id plus those fields); remove_product (id); set_listing (id, optional listingId to edit; platform, market, price, currency, vatPct, platformFeePct, fulfilFee, adPct, returnPct, rate, url, note); remove_listing (id, listingId); calc (ad-hoc unit economics without saving); price_for (selling price that reaches targetMarginPct); rates (optional currencies[], refresh); list_shipments (openOnly); add_shipment (trackingNo or label, carrier, productId, qty, status, eta, note); update_shipment (shipmentId; delivered adds qty to the product stock once); remove_shipment (shipmentId). Use web_fetch or web_search to research competitor prices or category fees, then write them with set_listing.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['summary', 'list', 'get', 'add_product', 'update_product', 'remove_product', 'set_listing', 'remove_listing', 'calc', 'price_for', 'rates', 'list_shipments', 'add_shipment', 'update_shipment', 'remove_shipment'], description: 'Operation to perform.' },
        id: { type: 'string', description: 'Product id from list or add_product. Required for get, update_product, remove_product, set_listing and remove_listing.' },
        listingId: { type: 'string', description: 'set_listing: edit this listing; omit to add one. remove_listing: the listing to remove.' },
        shipmentId: { type: 'string', description: 'Shipment id for update_shipment and remove_shipment.' },
        productId: { type: 'string', description: 'add_shipment/update_shipment: the product this shipment restocks.' },
        title: { type: 'string', description: 'add_product/update_product: working title (any language).' },
        titles: { type: 'object', description: 'add_product/update_product: listing titles by language code, e.g. {"en": "...", "de": "..."}; replaces the existing set.', additionalProperties: { type: 'string' } },
        sku: { type: 'string', description: 'add_product/update_product: unique SKU; generated when omitted on add.' },
        costCny: { type: 'number', description: 'Purchase cost per unit, CNY.' },
        shippingCny: { type: 'number', description: 'First-leg freight per unit, CNY.' },
        dutyPct: { type: 'number', description: 'Import duty on cost plus freight, percent 0-100.' },
        stock: { type: ['number', 'null'], description: 'Units on hand; null stops tracking.' },
        reorderAt: { type: 'number', description: 'Flag low stock at or below this many units; 0 disables.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags; on update the list replaces the existing tags.' },
        notes: { type: 'string', description: 'Free notes on the product.' },
        platform: { type: 'string', enum: PLATFORMS, description: 'set_listing: sales platform; sets the default commission.' },
        market: { type: 'string', description: 'set_listing: destination market code such as US, UK, DE, JP; US, UK, DE, FR, JP, AU, CA and SG fill in currency and VAT.' },
        price: { type: 'number', description: 'Selling price including VAT, in the sale currency.' },
        currency: { type: 'string', description: 'Sale currency, 3-letter code. For calc and price_for, used to look up the rate.' },
        vatPct: { type: 'number', description: 'VAT or GST included in price, percent.' },
        platformFeePct: { type: 'number', description: 'Platform commission on the price without VAT, percent.' },
        fulfilFee: { type: 'number', description: 'Fixed per-order fees (fulfilment, last mile, payment), in the sale currency.' },
        adPct: { type: 'number', description: 'Advertising spend as percent of the price without VAT.' },
        returnPct: { type: 'number', description: 'Revenue lost to returns, percent of the price without VAT.' },
        rate: { type: 'number', description: 'Sale currency per 1 CNY. Overrides the daily rate; required when the currency is not covered.' },
        targetMarginPct: { type: 'number', description: 'price_for: wanted profit as percent of the price without VAT, default 20.' },
        url: { type: 'string', description: 'set_listing: the listing page.' },
        note: { type: 'string', description: 'Note on a listing or shipment.' },
        currencies: { type: 'array', items: { type: 'string' }, description: 'rates: limit to these currency codes.' },
        refresh: { type: 'boolean', description: 'rates: bypass the 6-hour cache.' },
        trackingNo: { type: 'string', description: 'Shipment tracking number.' },
        carrier: { type: 'string', description: 'Shipment carrier or forwarder.' },
        label: { type: 'string', description: 'Shipment label when there is no tracking number yet.' },
        qty: { type: 'number', description: 'Units in the shipment.' },
        status: { type: 'string', enum: SHIP_STATUS, description: 'Shipment status.' },
        eta: { type: 'string', description: 'Expected arrival, YYYY-MM-DD.' },
        openOnly: { type: 'boolean', description: 'list_shipments: hide delivered ones.' },
        query: { type: 'string', description: 'list: text filter over SKU, titles and tags.' },
        tag: { type: 'string', description: 'list: only products with this tag.' },
        limit: { type: 'number', description: 'list: maximum products, default 200.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'cross-border');
}
