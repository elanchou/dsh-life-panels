import { r2, r1, n0 } from './util.js';
import { landedCny, reorderPlan } from './calc.js';

/**
 * Order finance and stock effects. An order keeps a snapshot of the costs and fee rates that applied when it was
 * placed, so a later change to a product's cost never rewrites past profit.
 *   status: paid | returned | cancelled
 *   price: unit price including VAT, in `currency`; rate: `currency` per 1 CNY on the order date
 *   fee: the platform's actual fee for the whole order in `currency` (blank = estimate from the fee rates)
 */
export const ORDER_STATUS = ['paid', 'returned', 'cancelled'];

/** Units that leave stock because of this order: paid takes them out, a returned order only when not restocked. */
export function stockEffect(o) {
  if (o.status === 'paid') return -o.qty;
  if (o.status === 'returned') return o.restocked ? 0 : -o.qty;
  return 0;
}

export function orderFinance(o) {
  const zero = { netCny: 0, feeCny: 0, fulfilCny: 0, costCny: 0, profitCny: 0, grossCny: 0 };
  if (o.status === 'cancelled' || !(o.rate > 0)) return zero;
  const rate = o.rate;
  const gross = n0(o.price) * o.qty;
  const returned = o.status === 'returned';
  const net = returned ? 0 : gross / (1 + n0(o.vatPct) / 100);
  const fee = returned ? 0 : (o.fee !== undefined && o.fee !== null ? n0(o.fee) : net * (n0(o.platformFeePct) + n0(o.payFeePct)) / 100);
  const fulfil = returned ? 0 : n0(o.fulfilFee) * o.qty;
  const cost = returned && o.restocked ? 0 : n0(o.costCnyUnit) * o.qty;
  const profit = (net - fee - fulfil) / rate - cost;
  return { netCny: r2(net / rate), feeCny: r2(fee / rate), fulfilCny: r2(fulfil / rate), costCny: r2(cost), profitCny: r2(profit), grossCny: r2(gross / rate) };
}

/** Snapshot fields copied from the product and listing onto a new order. */
export function snapshot(product, listing, settings) {
  return {
    costCnyUnit: landedCny(product, settings).value,
    vatPct: listing ? n0(listing.vatPct) : 0,
    platformFeePct: listing ? n0(listing.platformFeePct) : 0,
    payFeePct: listing ? n0(listing.payFeePct) : 0,
    fulfilFee: listing ? n0(listing.fulfilFee) : 0,
  };
}

/**
 * Per-product sales rate and replenishment advice for the next purchase.
 * Velocity uses paid orders in the window; for a product that started selling inside the window the rate is taken
 * over the days since its first sale (at least 7), so a new product is not understated.
 */
export function buildStats(data, settings, todayStr) {
  const win = Math.max(1, Math.floor(n0(settings.windowDays) || 30));
  const from = new Date(Date.parse(todayStr) - (win - 1) * 86400000).toISOString().slice(0, 10);
  const byProduct = new Map();
  for (const p of data.products) byProduct.set(p.id, { sold: 0, first: null });
  for (const o of data.orders) {
    if (o.status !== 'paid' || o.date < from || o.date > todayStr) continue;
    const s = byProduct.get(o.productId);
    if (!s) continue;
    s.sold += o.qty;
    if (!s.first || o.date < s.first) s.first = o.date;
  }
  const pipe = new Map();
  for (const b of data.batches) {
    if (!b.productId) continue;
    const e = pipe.get(b.productId) || { inTransit: 0, onOrder: 0 };
    if (b.status === 'shipped' || b.status === 'customs') e.inTransit += b.qty;
    else if (b.status === 'ordered' || b.status === 'producing') e.onOrder += b.qty;
    pipe.set(b.productId, e);
  }
  for (const p of data.products) {
    const s = byProduct.get(p.id);
    const days = s.first ? Math.min(win, Math.max(7, Math.round((Date.parse(todayStr) - Date.parse(s.first)) / 86400000) + 1)) : win;
    s.velocity = r2(s.sold / days);
    const e = pipe.get(p.id) || { inTransit: 0, onOrder: 0 };
    s.inTransit = e.inTransit; s.onOrder = e.onOrder;
    s.plan = reorderPlan({ stock: p.stock === null ? 0 : p.stock, inTransit: e.inTransit, onOrder: e.onOrder, velocity: s.velocity, lead: settings.leadDays, safety: settings.safetyDays, cover: settings.coverDays });
  }
  return { byProduct, windowDays: win, from };
}

export { r1 };
