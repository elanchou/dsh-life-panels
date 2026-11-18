import { uid } from './common.js';
import { getRates, getHistory, rateIn, rateOnDate } from './rates.js';
import { blend } from './calc.js';
import { matchListing, PLATFORMS, BATCH_STATUS, COST_KINDS } from './model.js';
import { ORDER_STATUS, stockEffect, orderFinance, snapshot } from './orders.js';
import { parseCsv, mapColumns, cellNumber, cellDate, cellStatus } from './csv.js';
import { str, num, r2, isDate, today, addDays, nowIso, inRange, dateRange } from './util.js';

const MAX_ORDERS = 50000;

/** Currency per 1 CNY for an order date: manual, else the ECB rate of that day, else the latest rate (flagged). */
export async function rateFor(currency, date, manual) {
  const cur = String(currency).toUpperCase();
  if (manual > 0) return { rate: manual, source: 'manual' };
  if (cur === 'CNY') return { rate: 1, source: 'manual' };
  const hist = await getHistory(addDays(date, -10));
  const h = rateOnDate(hist, date, cur);
  if (h) return { rate: h, source: 'ecb' };
  try { const r = rateIn(await getRates(), cur); if (r) return { rate: r, source: 'latest' }; } catch { /* no network */ }
  return { rate: null, source: 'none' };
}

function findProductBySku(data, key) {
  const k = String(key || '').trim().toLowerCase();
  return k ? data.products.find((p) => p.sku.toLowerCase() === k || p.id === key) : null;
}

/** Create one order object (not yet stored). Returns { order } or { error }. */
export async function buildOrder(c, input, defaults = {}) {
  const p = findProductBySku(c.data, input.productId || input.sku);
  if (!p) return { error: 'No product with SKU ' + String(input.productId || input.sku || '') };
  const qty = num(input.qty === undefined ? 1 : input.qty);
  if (!Number.isInteger(qty) || qty <= 0 || qty > 100000) return { error: 'qty must be a positive integer' };
  const platform = input.platform || defaults.platform || 'other';
  if (!PLATFORMS.includes(platform)) return { error: 'platform must be one of ' + PLATFORMS.join(', ') };
  const market = str(input.market ?? defaults.market ?? '', 12).toUpperCase();
  const listing = matchListing(p, platform, market);
  const date = input.date || today();
  if (!isDate(date)) return { error: 'date must be YYYY-MM-DD' };
  const price = input.price === undefined || input.price === '' ? (listing ? listing.price : NaN) : num(input.price);
  if (!(price >= 0)) return { error: 'price is required (no listing to take it from)' };
  const currency = str(input.currency || defaults.currency || (listing && listing.currency) || 'USD', 5).toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) return { error: 'currency must be a 3-letter code' };
  const status = input.status || 'paid';
  if (!ORDER_STATUS.includes(status)) return { error: 'status must be one of ' + ORDER_STATUS.join(', ') };
  let fee;
  if (input.fee !== undefined && input.fee !== '' && input.fee !== null) { fee = num(input.fee); if (!(fee >= 0)) return { error: 'fee must be a non-negative number' }; }
  const r = await rateFor(currency, date, num(input.rate));
  if (!r.rate) return { error: 'No exchange rate for ' + currency + ' on ' + date + '; pass `rate` (' + currency + ' per 1 CNY)' };
  const order = {
    id: uid(), date, ref: str(input.ref, 60), productId: p.id, sku: p.sku, platform, market, qty, price, currency, rate: r.rate, rateSource: r.source,
    ...(fee !== undefined ? { fee } : {}), status, restocked: !!input.restocked, note: str(input.note, 300),
    ...snapshot(p, listing, c.settings), createdAt: nowIso(), updatedAt: nowIso(),
  };
  return { order, product: p };
}

export async function addOrder(c, input) {
  if (c.data.orders.length >= MAX_ORDERS) return { ok: false, error: 'Too many orders (max ' + MAX_ORDERS + ')' };
  const r = await buildOrder(c, input);
  if (r.error) return { ok: false, error: r.error };
  const { order, product } = r;
  if (order.ref && c.data.orders.some((o) => o.ref === order.ref && o.platform === order.platform && o.sku === order.sku)) return { ok: false, error: 'Order ' + order.ref + ' already exists on ' + order.platform };
  c.data.orders.push(order);
  const eff = stockEffect(order);
  if (product.stock !== null) product.stock = Math.max(0, product.stock + eff);
  product.updatedAt = nowIso();
  return c.done({ order: { ...order, finance: orderFinance(order) }, stock: product.stock, oversold: product.stock !== null && eff < 0 && product.stock === 0 });
}

export async function updateOrder(c, input) {
  const o = c.data.orders.find((x) => x.id === input.orderId);
  if (!o) return { ok: false, error: 'No such order: ' + String(input.orderId) };
  const p = c.data.products.find((x) => x.id === o.productId);
  const before = stockEffect(o);
  if (input.status !== undefined) { if (!ORDER_STATUS.includes(input.status)) return { ok: false, error: 'status must be one of ' + ORDER_STATUS.join(', ') }; o.status = input.status; }
  if (input.restocked !== undefined) o.restocked = !!input.restocked;
  if (input.fee !== undefined) { if (input.fee === '' || input.fee === null) delete o.fee; else { const f = num(input.fee); if (!(f >= 0)) return { ok: false, error: 'fee must be a non-negative number' }; o.fee = f; } }
  if (input.price !== undefined) { const v = num(input.price); if (!(v >= 0)) return { ok: false, error: 'price must be a non-negative number' }; o.price = v; }
  if (input.qty !== undefined) { const q = num(input.qty); if (!Number.isInteger(q) || q <= 0) return { ok: false, error: 'qty must be a positive integer' }; o.qty = q; }
  if (input.rate !== undefined) { const v = num(input.rate); if (!(v > 0)) return { ok: false, error: 'rate must be greater than 0' }; o.rate = v; o.rateSource = 'manual'; }
  if (input.note !== undefined) o.note = str(input.note, 300);
  if (input.ref !== undefined) o.ref = str(input.ref, 60);
  o.updatedAt = nowIso();
  const delta = stockEffect(o) - before;
  if (p && p.stock !== null && delta) { p.stock = Math.max(0, p.stock + delta); p.updatedAt = nowIso(); }
  return c.done({ order: { ...o, finance: orderFinance(o) }, stock: p ? p.stock : null });
}

export async function removeOrder(c, input) {
  const i = c.data.orders.findIndex((x) => x.id === input.orderId);
  if (i < 0) return { ok: false, error: 'No such order: ' + String(input.orderId) };
  const o = c.data.orders[i];
  const p = c.data.products.find((x) => x.id === o.productId);
  const eff = stockEffect(o);
  if (p && p.stock !== null && eff) { p.stock = Math.max(0, p.stock - eff); p.updatedAt = nowIso(); }
  c.data.orders.splice(i, 1);
  return c.done({ removed: o.id, stock: p ? p.stock : null });
}

export async function listOrders(c, input) {
  const { from, to } = dateRange(input, 30);
  const q = String(input.query || '').trim().toLowerCase();
  let items = c.data.orders.filter((o) => inRange(o.date, from, to)
    && (!input.productId || o.productId === input.productId || o.sku === input.productId)
    && (!input.platform || o.platform === input.platform) && (!input.market || o.market === String(input.market).toUpperCase())
    && (!input.status || o.status === input.status)
    && (!q || (o.ref + ' ' + o.sku + ' ' + o.note).toLowerCase().includes(q)));
  items = items.sort((a, b) => b.date.localeCompare(a.date) || String(b.createdAt).localeCompare(String(a.createdAt)));
  const limit = Math.max(1, Math.min(1000, Math.floor(Number(input.limit) || 200)));
  return { ok: true, from, to, matched: items.length, items: items.slice(0, limit).map((o) => ({ ...o, finance: orderFinance(o) })) };
}

/**
 * Import orders from CSV text (Amazon, Shopify, TikTok, Shopee exports or a plain sheet). Needs a SKU column that matches
 * product SKUs. dryRun reports what would happen without saving. Existing orders (same platform and order id) are skipped,
 * so the same file can be imported again safely.
 */
export async function importOrders(c, input) {
  const rows = parseCsv(input.csv);
  if (rows.length < 2) return { ok: false, error: 'The CSV needs a header row and at least one order row' };
  const map = mapColumns(rows[0], input.columns || {});
  if (map.sku === undefined) return { ok: false, error: 'No SKU column found. Headers seen: ' + rows[0].slice(0, 12).join(' | ') + '. Pass columns={sku: "<your header>"}.' };
  const platform = input.platform || 'other';
  if (!PLATFORMS.includes(platform)) return { ok: false, error: 'platform must be one of ' + PLATFORMS.join(', ') };
  const defaults = { platform, market: input.market, currency: input.currency };
  const dry = input.dryRun === true;
  const cell = (r, f) => (map[f] === undefined ? '' : String(r[map[f]] ?? '').trim());
  // Fetch one rate history for the whole file.
  const dates = rows.slice(1).map((r) => cellDate(cell(r, 'date'))).filter(Boolean).sort();
  if (dates.length) await getHistory(addDays(dates[0], -10));
  const seen = new Set(c.data.orders.filter((o) => o.ref).map(orderKey));
  const result = { added: 0, duplicates: 0, skipped: [], unknownSkus: {}, rows: rows.length - 1 };
  const touched = new Map();
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const line = i + 1;
    const sku = cell(r, 'sku');
    const date = cellDate(cell(r, 'date'));
    const qty = map.qty === undefined ? 1 : cellNumber(cell(r, 'qty'));
    const price = map.price === undefined ? undefined : cellNumber(cell(r, 'price'));
    if (!sku) { result.skipped.push({ line, reason: 'no SKU' }); continue; }
    if (!date) { result.skipped.push({ line, reason: 'no readable date' }); continue; }
    const p = findProductBySku(c.data, sku);
    if (!p) { result.unknownSkus[sku] = (result.unknownSkus[sku] || 0) + 1; continue; }
    const ref = cell(r, 'ref');
    if (ref && seen.has(platform + '|' + ref + '|' + p.sku)) { result.duplicates++; continue; }
    const fee = map.fee === undefined ? undefined : cellNumber(cell(r, 'fee'));
    const cur = cell(r, 'currency').toUpperCase();
    const built = await buildOrder(c, {
      sku, ref, date, qty: Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1, platform,
      market: cell(r, 'market') || defaults.market, currency: /^[A-Z]{3}$/.test(cur) ? cur : defaults.currency,
      ...(Number.isFinite(price) ? { price } : {}), ...(Number.isFinite(fee) ? { fee } : {}), status: cellStatus(cell(r, 'status')),
    }, defaults);
    if (built.error) { result.skipped.push({ line, reason: built.error }); continue; }
    if (c.data.orders.length + result.added >= MAX_ORDERS) { result.skipped.push({ line, reason: 'order limit reached' }); break; }
    // A multi-line order has the same id on several lines; the SKU keeps them apart.
    if (ref) seen.add(platform + '|' + ref + '|' + p.sku);
    result.added++;
    if (!dry) {
      const o = built.order;
      c.data.orders.push(o);
      const eff = stockEffect(o);
      if (p.stock !== null && eff) { p.stock = Math.max(0, p.stock + eff); }
      touched.set(p.id, true);
    }
  }
  if (!dry && result.added) { for (const id of touched.keys()) { const p = c.data.products.find((x) => x.id === id); if (p) p.updatedAt = nowIso(); } await c.store.save(); }
  return { ok: true, dryRun: dry, mapped: Object.fromEntries(Object.entries(map).map(([k, v]) => [k, rows[0][v]])), ...result };
}

/** Existing orders imported earlier are tracked by platform + order id + SKU; keep that key stable on added orders. */
export function orderKey(o) { return o.platform + '|' + o.ref + '|' + o.sku; }

export async function exportOrders(c, input) {
  const { from, to } = dateRange(input, 30);
  const head = ['date', 'ref', 'sku', 'platform', 'market', 'status', 'qty', 'unit_price', 'currency', 'rate_per_cny', 'net_cny', 'platform_fee_cny', 'fulfil_cny', 'cost_cny', 'profit_cny'];
  const esc = (v) => { const s = String(v ?? ''); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const lines = [head.join(',')];
  for (const o of c.data.orders.filter((x) => inRange(x.date, from, to)).sort((a, b) => a.date.localeCompare(b.date))) {
    const f = orderFinance(o);
    lines.push([o.date, o.ref, o.sku, o.platform, o.market, o.status, o.qty, o.price, o.currency, o.rate, f.netCny, f.feeCny, f.fulfilCny, f.costCny, f.profitCny].map(esc).join(','));
  }
  return { ok: true, from, to, rows: lines.length - 1, csv: lines.join('\n') + '\n' };
}

/** Purchase batches from suppliers. Delivery adds the stock once and folds the new cost into the product's average cost. */
export async function addBatch(c, input) {
  if (c.data.batches.length >= 3000) return { ok: false, error: 'Too many purchase orders (max 3000)' };
  const p = findProductBySku(c.data, input.productId || input.sku);
  if (!p) return { ok: false, error: 'No product with SKU ' + String(input.productId || input.sku || '') };
  const qty = num(input.qty);
  if (!Number.isInteger(qty) || qty <= 0) return { ok: false, error: 'qty must be a positive integer' };
  const unit = input.unitCostCny === undefined ? p.costCny : num(input.unitCostCny);
  if (!(unit >= 0)) return { ok: false, error: 'unitCostCny must be a non-negative number' };
  const freight = input.freightCny === undefined ? 0 : num(input.freightCny);
  if (!(freight >= 0)) return { ok: false, error: 'freightCny (total for the batch) must be a non-negative number' };
  const status = input.status || 'ordered';
  if (!BATCH_STATUS.includes(status)) return { ok: false, error: 'status must be one of ' + BATCH_STATUS.join(', ') };
  const orderedAt = input.orderedAt || today();
  if (!isDate(orderedAt)) return { ok: false, error: 'orderedAt must be YYYY-MM-DD' };
  if (input.eta && !isDate(input.eta)) return { ok: false, error: 'eta must be YYYY-MM-DD' };
  const b = {
    id: uid(), productId: p.id, sku: p.sku, qty, unitCostCny: unit, freightCny: freight, supplier: str(input.supplier ?? p.supplier, 120),
    status, orderedAt, eta: input.eta || '', trackingNo: str(input.trackingNo, 60), carrier: str(input.carrier, 60), note: str(input.note, 300),
    paidCny: input.paidCny === undefined ? 0 : num(input.paidCny) || 0, createdAt: nowIso(), updatedAt: nowIso(),
  };
  c.data.batches.push(b);
  let stockAdded = 0;
  if (status === 'delivered') stockAdded = receive(p, b);
  return c.done({ batch: b, stockAdded });
}

/** Add the batch to stock once and blend its cost into the product's average cost. */
function receive(p, b) {
  if (b.stockApplied) return 0;
  const have = p.stock === null ? 0 : p.stock;
  p.costCny = blend(p.costCny, have, b.unitCostCny, b.qty);
  const freightUnit = b.qty > 0 ? b.freightCny / b.qty : 0;
  if (b.freightCny > 0) p.shippingCny = blend(p.shippingCny, have, freightUnit, b.qty);
  p.stock = have + b.qty;
  p.updatedAt = nowIso();
  b.stockApplied = true;
  b.receivedAt = today();
  return b.qty;
}

export async function updateBatch(c, input) {
  const b = c.data.batches.find((x) => x.id === input.batchId);
  if (!b) return { ok: false, error: 'No such purchase order: ' + String(input.batchId) };
  if (input.status !== undefined) {
    if (!BATCH_STATUS.includes(input.status)) return { ok: false, error: 'status must be one of ' + BATCH_STATUS.join(', ') };
    if (b.stockApplied && input.status !== 'delivered') return { ok: false, error: 'This batch is already in stock; change stock with adjust_stock instead' };
    b.status = input.status;
  }
  for (const k of ['trackingNo', 'carrier', 'supplier', 'note']) if (input[k] !== undefined) b[k] = str(input[k], k === 'note' ? 300 : 120);
  if (input.eta !== undefined) { if (input.eta && !isDate(input.eta)) return { ok: false, error: 'eta must be YYYY-MM-DD' }; b.eta = input.eta || ''; }
  for (const k of ['unitCostCny', 'freightCny', 'paidCny']) if (input[k] !== undefined) {
    if (b.stockApplied && k !== 'paidCny') return { ok: false, error: 'This batch is already in stock; its cost is fixed' };
    const v = num(input[k]); if (!(v >= 0)) return { ok: false, error: k + ' must be a non-negative number' }; b[k] = v;
  }
  b.updatedAt = nowIso();
  let stockAdded = 0;
  const p = c.data.products.find((x) => x.id === b.productId);
  if (b.status === 'delivered' && p) stockAdded = receive(p, b);
  return c.done({ batch: b, stockAdded, stock: p ? p.stock : null, costCny: p ? p.costCny : null });
}

export async function removeBatch(c, input) {
  const i = c.data.batches.findIndex((x) => x.id === input.batchId);
  if (i < 0) return { ok: false, error: 'No such purchase order: ' + String(input.batchId) };
  if (c.data.batches[i].stockApplied) return { ok: false, error: 'This batch is already in stock; it cannot be removed' };
  c.data.batches.splice(i, 1);
  return c.done({ removed: input.batchId });
}

export async function listBatches(c, input) {
  const open = input.openOnly === true;
  const t = today();
  const items = c.data.batches.filter((b) => (!open || (b.status !== 'delivered' && b.status !== 'cancelled')) && (!input.productId || b.productId === input.productId || b.sku === input.productId))
    .sort((a, b) => b.orderedAt.localeCompare(a.orderedAt))
    .map((b) => ({ ...b, totalCny: r2(b.qty * b.unitCostCny + b.freightCny), unpaidCny: r2(Math.max(0, b.qty * b.unitCostCny + b.freightCny - (b.paidCny || 0))),
      late: !!b.eta && b.eta < t && b.status !== 'delivered' && b.status !== 'cancelled', trackUrl: b.trackingNo ? 'https://t.17track.net/en#nums=' + encodeURIComponent(b.trackingNo) : '' }));
  return { ok: true, total: c.data.batches.length, items };
}

/** Costs that are not tied to one order: ad spend, freight paid separately, software, samples, taxes. */
export async function addCost(c, input) {
  if (c.data.costs.length >= 20000) return { ok: false, error: 'Too many cost entries (max 20000)' };
  const kind = input.kind || 'other';
  if (!COST_KINDS.includes(kind)) return { ok: false, error: 'kind must be one of ' + COST_KINDS.join(', ') };
  const amount = num(input.amount);
  if (!(amount > 0)) return { ok: false, error: 'amount must be greater than 0' };
  const date = input.date || today();
  if (!isDate(date)) return { ok: false, error: 'date must be YYYY-MM-DD' };
  const currency = str(input.currency || 'CNY', 5).toUpperCase();
  const r = await rateFor(currency, date, num(input.rate));
  if (!r.rate) return { ok: false, error: 'No exchange rate for ' + currency + '; pass `rate`' };
  let productId = null;
  if (input.productId) { const p = findProductBySku(c.data, input.productId); if (!p) return { ok: false, error: 'No product ' + String(input.productId) }; productId = p.id; }
  const platform = input.platform ? String(input.platform) : '';
  if (platform && !PLATFORMS.includes(platform)) return { ok: false, error: 'platform must be one of ' + PLATFORMS.join(', ') };
  const cost = { id: uid(), date, kind, amount, currency, rate: r.rate, amountCny: r2(amount / r.rate), productId, platform, market: str(input.market, 12).toUpperCase(), note: str(input.note, 300), createdAt: nowIso() };
  c.data.costs.push(cost);
  return c.done({ cost });
}

export async function removeCost(c, input) {
  const i = c.data.costs.findIndex((x) => x.id === input.costId);
  if (i < 0) return { ok: false, error: 'No such cost entry: ' + String(input.costId) };
  c.data.costs.splice(i, 1);
  return c.done({ removed: input.costId });
}

export async function listCosts(c, input) {
  const { from, to } = dateRange(input, 30);
  const items = c.data.costs.filter((x) => inRange(x.date, from, to) && (!input.kind || x.kind === input.kind) && (!input.productId || x.productId === input.productId))
    .sort((a, b) => b.date.localeCompare(a.date));
  return { ok: true, from, to, totalCny: r2(items.reduce((a, x) => a + x.amountCny, 0)), items };
}
