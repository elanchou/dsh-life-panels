import { uid } from './common.js';
import { priceFor, computeProfit, landedCny, reorderPlan } from './calc.js';
import { getRates, rateIn } from './rates.js';
import { newProduct, applyProductFields, listingFrom, productView, evalListing, settingsOf, CURRENCIES } from './model.js';
import { str, num, nonNeg, applyNums, nowIso } from './util.js';

/** Product, listing, calculator, rates and settings actions. Each takes the shared op context `c` and the input. */

export async function ratesAction(c, input) {
  try {
    const t = await getRates({ refresh: !!input.refresh });
    const wanted = Array.isArray(input.currencies) && input.currencies.length ? input.currencies.map((x) => String(x).toUpperCase()) : CURRENCIES;
    const rates = {};
    for (const k of wanted) if (t.rates[k]) rates[k] = t.rates[k];
    return { ok: true, base: 'CNY', date: t.date, source: t.source, stale: t.stale, rates, note: 'Units of the currency per 1 CNY.' };
  } catch (e) { return { ok: false, error: e.message }; }
}

/** calc / price_for. Costs come from a saved product (`id`) or from costCny, shippingCny, dutyPct and weightG in the input. */
export async function calcAction(c, input, action) {
  const p = {};
  const err = applyNums(p, input, ['price', 'vatPct', 'platformFeePct', 'payFeePct', 'fulfilFee', 'adPct', 'returnPct'], ['vatPct', 'platformFeePct', 'payFeePct', 'adPct', 'returnPct']);
  if (err) return { ok: false, error: err };
  const s = c.settings;
  let product;
  if (input.id) {
    product = c.data.products.find((x) => x.id === input.id || x.sku === input.id);
    if (!product) return { ok: false, error: 'No such product: ' + String(input.id) };
  } else {
    product = { costCny: 0, shippingCny: 0, dutyPct: 0, weightG: 0, dims: {} };
    const e2 = applyNums(product, input, ['costCny', 'shippingCny', 'dutyPct', 'weightG'], ['dutyPct']);
    if (e2) return { ok: false, error: e2 };
  }
  const landed = landedCny(product, s);
  p.landedCny = landed.value;
  let rate = num(input.rate);
  const cur = str(input.currency || 'USD', 5).toUpperCase();
  if (!(rate > 0)) {
    try { rate = rateIn(await getRates(), cur); } catch (e) { return { ok: false, error: e.message }; }
    if (!rate) return { ok: false, error: 'No rate for ' + cur + '; pass `rate` (' + cur + ' per 1 CNY)' };
  }
  if (action === 'price_for') {
    const target = input.targetMarginPct === undefined ? 20 : num(input.targetMarginPct);
    if (Number.isNaN(target) || target < 0 || target >= 100) return { ok: false, error: 'targetMarginPct must be between 0 and 100' };
    const price = priceFor(p, rate, target);
    if (price === null) return { ok: false, error: 'Fees and target margin add up to 100% or more of the price; no price can reach it' };
    return { ok: true, price, currency: cur, targetMarginPct: target, landed, result: computeProfit({ ...p, price }, rate) };
  }
  const r = computeProfit(p, rate);
  return r.ok ? { ok: true, currency: cur, landed, result: r } : r;
}

export async function listProducts(c, input) {
  const q = String(input.query || '').trim().toLowerCase();
  const tag = String(input.tag || '').trim().toLowerCase();
  const items = c.data.products.filter((p) => (!tag || (p.tags || []).includes(tag))
    && (!q || (p.sku + ' ' + p.title + ' ' + Object.values(p.titles || {}).join(' ') + ' ' + (p.tags || []).join(' ') + ' ' + (p.supplier || '')).toLowerCase().includes(q)))
    .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  const limit = Math.max(1, Math.min(500, Math.floor(Number(input.limit) || 200)));
  const table = await c.rates();
  const stats = c.stats();
  const rows = items.slice(0, limit).map((p) => {
    const margins = p.listings.map((l) => evalListing(p, l, table, c.settings)).filter((e) => e.ok).map((e) => e.marginPct);
    const st = stats.byProduct.get(p.id);
    return {
      id: p.id, sku: p.sku, title: p.title, stock: p.stock, tags: p.tags || [], supplier: p.supplier || '', updatedAt: p.updatedAt,
      landedCny: landedCny(p, c.settings).value, listings: p.listings.length,
      minMarginPct: margins.length ? Math.min(...margins) : null, maxMarginPct: margins.length ? Math.max(...margins) : null,
      status: st ? st.plan.status : 'idle', daysCover: st ? st.plan.daysCover : null, soldInWindow: st ? st.sold : 0,
    };
  });
  const tagCount = new Map();
  for (const p of c.data.products) for (const t of p.tags || []) tagCount.set(t, (tagCount.get(t) || 0) + 1);
  return {
    ok: true, total: c.data.products.length, matched: items.length, items: rows,
    tags: [...tagCount.entries()].sort((a, b) => b[1] - a[1]).map(([name, count]) => ({ name, count })),
    ratesDate: table ? table.date : null, ratesStale: table ? !!table.stale : null,
  };
}

export async function getProduct(c, input) {
  const p = c.find(input.id);
  if (!p) return { ok: false, error: 'No such product: ' + String(input.id) };
  const st = c.stats().byProduct.get(p.id);
  return { ok: true, product: productView(p, await c.rates(), c.settings), replenishment: st ? { ...st.plan, velocityPerDay: st.velocity, inTransit: st.inTransit, onOrder: st.onOrder } : null };
}

export async function addProduct(c, input) {
  if (c.data.products.length >= 5000) return { ok: false, error: 'Too many products (max 5000)' };
  const r = newProduct(c.data, input);
  if (r.error) return { ok: false, error: r.error };
  c.data.products.push(r.product);
  return c.done({ product: productView(r.product, await c.rates(), c.settings) });
}

export async function updateProduct(c, input) {
  const p = c.find(input.id);
  if (!p) return { ok: false, error: 'No such product: ' + String(input.id) };
  if (input.sku !== undefined) {
    const sku = str(input.sku, 60);
    if (!sku) return { ok: false, error: 'sku cannot be empty' };
    if (c.data.products.some((x) => x !== p && x.sku.toLowerCase() === sku.toLowerCase())) return { ok: false, error: 'SKU already exists: ' + sku };
    p.sku = sku;
  }
  const err = applyProductFields(p, input);
  if (err) return { ok: false, error: err };
  p.updatedAt = nowIso();
  return c.done({ product: productView(p, await c.rates(), c.settings) });
}

export async function removeProduct(c, input) {
  const p = c.find(input.id);
  if (!p) return { ok: false, error: 'No such product: ' + String(input.id) };
  const used = c.data.orders.filter((o) => o.productId === p.id).length;
  if (used && input.force !== true) return { ok: false, error: p.sku + ' has ' + used + ' orders; removing it would orphan them. Pass force=true to remove anyway, or keep it and set stock to 0.' };
  c.data.products.splice(c.data.products.indexOf(p), 1);
  for (const b of c.data.batches) if (b.productId === p.id) b.productId = null;
  return c.done({ removed: p.id });
}

export async function setListing(c, input) {
  const p = c.find(input.id);
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
  p.updatedAt = nowIso();
  return c.done({ product: productView(p, await c.rates(), c.settings) });
}

export async function removeListing(c, input) {
  const p = c.find(input.id);
  if (!p) return { ok: false, error: 'No such product: ' + String(input.id) };
  const i = p.listings.findIndex((l) => l.id === input.listingId);
  if (i < 0) return { ok: false, error: 'No such listing: ' + String(input.listingId) };
  p.listings.splice(i, 1);
  p.updatedAt = nowIso();
  return c.done({ product: productView(p, await c.rates(), c.settings) });
}

/** Set stock to a counted figure (`stock`) or move it by `delta`; the reason goes into the product note trail. */
export async function adjustStock(c, input) {
  const p = c.find(input.id);
  if (!p) return { ok: false, error: 'No such product: ' + String(input.id) };
  let next;
  if (input.stock !== undefined) { const n = num(input.stock); if (!Number.isInteger(n) || n < 0) return { ok: false, error: 'stock must be a non-negative integer' }; next = n; }
  else if (input.delta !== undefined) { const d = num(input.delta); if (!Number.isInteger(d)) return { ok: false, error: 'delta must be an integer' }; next = (p.stock || 0) + d; }
  else return { ok: false, error: 'Provide stock (counted figure) or delta' };
  const before = p.stock;
  p.stock = next;
  p.updatedAt = nowIso();
  return c.done({ sku: p.sku, before, stock: next });
}

export async function settingsAction(c, input) {
  if (input.settings && typeof input.settings === 'object') {
    const next = { ...c.settings };
    for (const k of Object.keys(next)) {
      if (input.settings[k] === undefined) continue;
      const r = nonNeg(input.settings, k, k === 'lowMarginPct' ? 100 : 100000);
      if (r.error) return { ok: false, error: r.error };
      next[k] = r.value;
    }
    if (!(next.volDivisor > 0)) return { ok: false, error: 'volDivisor must be greater than 0' };
    c.data.settings = next;
    await c.store.save();
    c.settings = settingsOf(c.data);
  }
  return { ok: true, settings: c.settings };
}
