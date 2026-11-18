import { uid } from './common.js';
import { landedCny, computeProfit, DEFAULT_SETTINGS } from './calc.js';
import { rateIn } from './rates.js';
import { str, num, nonNeg, applyNums, nowIso } from './util.js';

export const PLATFORMS = ['amazon', 'shopify', 'tiktok', 'temu', 'aliexpress', 'ebay', 'shopee', 'lazada', 'etsy', 'walmart', 'other'];
export const BATCH_STATUS = ['ordered', 'producing', 'shipped', 'customs', 'delivered', 'cancelled'];
export const COST_KINDS = ['ads', 'shipping', 'software', 'samples', 'platform', 'tax', 'other'];
export const CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD', 'SGD', 'HKD', 'KRW', 'THB', 'MYR', 'PHP', 'IDR', 'BRL', 'MXN', 'PLN', 'SEK', 'NOK', 'DKK', 'CHF', 'TRY', 'INR', 'ZAR', 'CNY'];
/** Starting points for a market; VAT and GST are standard rates. Edit per listing. */
export const MARKET_PRESETS = {
  US: { currency: 'USD', vatPct: 0 }, UK: { currency: 'GBP', vatPct: 20 }, DE: { currency: 'EUR', vatPct: 19 }, FR: { currency: 'EUR', vatPct: 20 },
  ES: { currency: 'EUR', vatPct: 21 }, IT: { currency: 'EUR', vatPct: 22 }, NL: { currency: 'EUR', vatPct: 21 }, JP: { currency: 'JPY', vatPct: 10 },
  AU: { currency: 'AUD', vatPct: 10 }, CA: { currency: 'CAD', vatPct: 5 }, SG: { currency: 'SGD', vatPct: 9 }, MX: { currency: 'MXN', vatPct: 16 },
};
/** Rough category-average commission and payment fee by platform; not a quote. */
export const PLATFORM_FEES = {
  amazon: [15, 0], ebay: [13, 0], shopify: [0, 2.9], tiktok: [6, 0], temu: [0, 0], aliexpress: [8, 0], shopee: [8, 0], lazada: [6, 0], etsy: [6.5, 3], walmart: [15, 0], other: [10, 0],
};

export function settingsOf(data) {
  const s = { ...DEFAULT_SETTINGS, ...(data.settings || {}) };
  for (const k of Object.keys(DEFAULT_SETTINGS)) if (!Number.isFinite(Number(s[k])) || Number(s[k]) < 0) s[k] = DEFAULT_SETTINGS[k];
  return s;
}

export function newProduct(data, input) {
  const title = str(input.title, 200);
  if (!title) return { error: 'title is required' };
  const sku = str(input.sku, 60) || 'SKU-' + String(data.products.length + 1).padStart(4, '0');
  if (data.products.some((p) => p.sku.toLowerCase() === sku.toLowerCase())) return { error: 'SKU already exists: ' + sku };
  const p = {
    id: uid(), sku, title, titles: {}, costCny: 0, shippingCny: 0, dutyPct: 0, weightG: 0, dims: { l: 0, w: 0, h: 0 }, stock: 0,
    tags: [], supplier: '', supplierUrl: '', notes: '', listings: [], createdAt: nowIso(), updatedAt: nowIso(),
  };
  const err = applyProductFields(p, input);
  return err ? { error: err } : { product: p };
}

/** Apply the product-level fields present in `input`. Returns an error message or null. */
export function applyProductFields(p, input) {
  if (input.title !== undefined) { const t = str(input.title, 200); if (!t) return 'title cannot be empty'; p.title = t; }
  if (input.titles !== undefined) {
    if (!input.titles || typeof input.titles !== 'object' || Array.isArray(input.titles)) return 'titles must be an object of language code to title';
    const out = {};
    for (const [k, v] of Object.entries(input.titles).slice(0, 20)) if (/^[a-z]{2}(-[A-Za-z]{2,4})?$/.test(k) && str(v, 300)) out[k] = str(v, 300);
    p.titles = out;
  }
  const err = applyNums(p, input, ['costCny', 'shippingCny', 'dutyPct', 'weightG'], ['dutyPct']);
  if (err) return err;
  if (input.dims !== undefined) {
    const d = input.dims || {};
    const out = {};
    for (const k of ['l', 'w', 'h']) { const n = num(d[k] ?? 0); if (Number.isNaN(n) || n < 0) return 'dims.' + k + ' must be a non-negative number (cm)'; out[k] = n; }
    p.dims = out;
  }
  if (input.stock !== undefined) {
    if (input.stock === null || input.stock === '') p.stock = null;
    else { const n = num(input.stock); if (Number.isNaN(n) || n < 0 || !Number.isInteger(n)) return 'stock must be a non-negative integer'; p.stock = n; }
  }
  if (input.tags !== undefined) p.tags = [...new Set((Array.isArray(input.tags) ? input.tags : []).map((t) => String(t).trim().replace(/^#/, '').toLowerCase().slice(0, 24)).filter(Boolean))].slice(0, 12);
  if (input.supplier !== undefined) p.supplier = str(input.supplier, 120);
  if (input.supplierUrl !== undefined) p.supplierUrl = str(input.supplierUrl, 500);
  if (input.notes !== undefined) p.notes = str(input.notes, 4000);
  return null;
}

/** Build or update a listing from `input`; markets and platforms fill in currency, VAT and fee defaults. */
export function listingFrom(input, base = {}) {
  const out = { ...base };
  if (input.platform !== undefined) {
    if (!PLATFORMS.includes(input.platform)) return { error: 'platform must be one of ' + PLATFORMS.join(', ') };
    out.platform = input.platform;
  }
  out.platform = out.platform || 'other';
  const market = input.market !== undefined ? str(input.market, 12).toUpperCase() : out.market || '';
  const preset = MARKET_PRESETS[market] || {};
  out.market = market;
  const currency = input.currency !== undefined ? str(input.currency, 5).toUpperCase() : out.currency || preset.currency || 'USD';
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'currency must be a 3-letter code' };
  out.currency = currency;
  const err = applyNums(out, input, ['price', 'vatPct', 'platformFeePct', 'payFeePct', 'fulfilFee', 'adPct', 'returnPct'], ['vatPct', 'platformFeePct', 'payFeePct', 'adPct', 'returnPct']);
  if (err) return { error: err };
  const [fee, pay] = PLATFORM_FEES[out.platform] || [10, 0];
  if (out.vatPct === undefined) out.vatPct = preset.vatPct ?? 0;
  if (out.platformFeePct === undefined) out.platformFeePct = fee;
  if (out.payFeePct === undefined) out.payFeePct = pay;
  for (const k of ['fulfilFee', 'adPct', 'returnPct']) if (out[k] === undefined) out[k] = 0;
  if (input.rate !== undefined) {
    if (input.rate === '' || input.rate === null) delete out.rate;
    else { const r = num(input.rate); if (!(r > 0)) return { error: 'rate must be greater than 0' }; out.rate = r; }
  }
  if (input.url !== undefined) out.url = str(input.url, 500);
  if (input.ref !== undefined) out.ref = str(input.ref, 60);
  if (input.note !== undefined) out.note = str(input.note, 300);
  if (!(out.price > 0)) return { error: 'price must be greater than 0' };
  return { value: out };
}

export function evalListing(product, listing, table, settings) {
  const rate = Number(listing.rate) > 0 ? Number(listing.rate) : rateIn(table, listing.currency);
  if (!rate) return { ok: false, error: 'No rate for ' + listing.currency + '; set `rate` (' + listing.currency + ' per 1 CNY) on the listing' };
  return computeProfit({ ...listing, landedCny: landedCny(product, settings).value }, rate);
}

export function productView(p, table, settings) {
  const landed = landedCny(p, settings);
  return { ...p, landed, listings: p.listings.map((l) => ({ ...l, economics: evalListing(p, l, table, settings) })) };
}

/** Find the listing an order belongs to: same platform and market first, then same platform, then the only listing. */
export function matchListing(p, platform, market) {
  const ls = p.listings;
  return ls.find((l) => l.platform === platform && l.market === market) || ls.find((l) => l.platform === platform) || (ls.length === 1 ? ls[0] : null);
}

export { nonNeg };
