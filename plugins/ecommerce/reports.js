import { orderFinance } from './orders.js';
import { evalListing } from './model.js';
import { r1, r2, today, inRange, dateRange, addDays, daysBetween } from './util.js';

const sum = (arr, f) => arr.reduce((a, x) => a + f(x), 0);

/** Group `rows` by key and add up their finance figures. */
function group(rows, keyOf) {
  const m = new Map();
  for (const { o, f } of rows) {
    const k = keyOf(o) || '—';
    const e = m.get(k) || { key: k, orders: 0, units: 0, netCny: 0, costCny: 0, feeCny: 0, profitCny: 0 };
    e.orders++; e.units += o.status === 'paid' ? o.qty : 0;
    e.netCny += f.netCny; e.costCny += f.costCny; e.feeCny += f.feeCny + f.fulfilCny; e.profitCny += f.profitCny;
    m.set(k, e);
  }
  return [...m.values()].map((e) => ({ ...e, netCny: r2(e.netCny), costCny: r2(e.costCny), feeCny: r2(e.feeCny), profitCny: r2(e.profitCny), marginPct: e.netCny > 0 ? r1(e.profitCny / e.netCny * 100) : null }))
    .sort((a, b) => b.profitCny - a.profitCny);
}

/**
 * Profit and loss for a period. Order profit already deducts the product's landed cost, platform fees and per-order fees;
 * separately entered costs (ads, freight paid on its own, software, samples, taxes) come off on top.
 */
export function pnl(data, from, to) {
  const rows = data.orders.filter((o) => inRange(o.date, from, to)).map((o) => ({ o, f: orderFinance(o) }));
  const live = rows.filter((r) => r.o.status !== 'cancelled');
  const costs = data.costs.filter((x) => inRange(x.date, from, to));
  const net = sum(live, (r) => r.f.netCny);
  const orderProfit = sum(live, (r) => r.f.profitCny);
  const extra = sum(costs, (x) => x.amountCny);
  const profit = orderProfit - extra;
  const byKind = {};
  for (const x of costs) byKind[x.kind] = r2((byKind[x.kind] || 0) + x.amountCny);
  const prodName = new Map(data.products.map((p) => [p.id, p.sku]));
  const byProduct = group(live, (o) => o.sku).map((e) => {
    const adCny = sum(costs.filter((x) => x.productId && prodName.get(x.productId) === e.key), (x) => x.amountCny);
    return { ...e, adCny: r2(adCny), profitAfterCostsCny: r2(e.profitCny - adCny) };
  });
  const paid = live.filter((r) => r.o.status === 'paid');
  const returned = live.filter((r) => r.o.status === 'returned');
  return {
    from, to,
    orders: paid.length, units: sum(paid, (r) => r.o.qty), returnedOrders: returned.length,
    returnRatePct: live.length ? r1(returned.length / live.length * 100) : 0,
    revenueCny: r2(sum(live, (r) => r.f.grossCny)), netRevenueCny: r2(net),
    productCostCny: r2(sum(live, (r) => r.f.costCny)), platformFeesCny: r2(sum(live, (r) => r.f.feeCny)), fulfilCny: r2(sum(live, (r) => r.f.fulfilCny)),
    orderProfitCny: r2(orderProfit), otherCostsCny: r2(extra), otherCostsByKind: byKind,
    profitCny: r2(profit), marginPct: net > 0 ? r1(profit / net * 100) : null,
    avgOrderCny: paid.length ? r2(sum(paid, (r) => r.f.netCny) / paid.length) : null,
    byPlatform: group(live, (o) => o.platform), byMarket: group(live, (o) => o.market), byProduct,
  };
}

export function dailySeries(data, from, to) {
  const days = new Map();
  for (let d = from; d <= to; d = addDays(d, 1)) days.set(d, { date: d, netCny: 0, profitCny: 0, orders: 0 });
  for (const o of data.orders) {
    if (o.status === 'cancelled' || !days.has(o.date)) continue;
    const f = orderFinance(o); const e = days.get(o.date);
    e.netCny += f.netCny; e.profitCny += f.profitCny; if (o.status === 'paid') e.orders++;
  }
  for (const x of data.costs) { const e = days.get(x.date); if (e) e.profitCny -= x.amountCny; }
  return [...days.values()].map((e) => ({ ...e, netCny: r2(e.netCny), profitCny: r2(e.profitCny) }));
}

/** Everything that needs a decision today, ranked: restock, loss-making listings, late batches, unpaid suppliers, stock errors. */
export function attention(data, stats, table, settings) {
  const t = today();
  const restock = [];
  for (const p of data.products) {
    const st = stats.byProduct.get(p.id);
    if (!st) continue;
    if (st.plan.status === 'out' || st.plan.status === 'order_now') {
      restock.push({ id: p.id, sku: p.sku, title: p.title, status: st.plan.status, stock: p.stock, velocityPerDay: st.velocity, daysCover: st.plan.daysCover,
        daysCoverWithPipeline: st.plan.daysCoverWithPipeline, inTransit: st.inTransit, onOrder: st.onOrder, suggestedQty: st.plan.suggested, reorderPoint: st.plan.reorderPoint,
        estCostCny: r2(st.plan.suggested * (p.costCny || 0)) });
    }
  }
  restock.sort((a, b) => (a.status === 'out' ? 0 : 1) - (b.status === 'out' ? 0 : 1) || (a.daysCover ?? 0) - (b.daysCover ?? 0));
  const losing = []; const thin = [];
  for (const p of data.products) for (const l of p.listings) {
    const e = evalListing(p, l, table, settings);
    if (!e.ok) continue;
    const row = { sku: p.sku, title: p.title, platform: l.platform, market: l.market, price: l.price, currency: l.currency, profit: e.profit, marginPct: e.marginPct, breakEvenPrice: e.breakEvenPrice };
    if (e.profit < 0) losing.push(row); else if (e.marginPct < settings.lowMarginPct) thin.push(row);
  }
  const open = data.batches.filter((b) => b.status !== 'delivered' && b.status !== 'cancelled');
  const lateBatches = open.filter((b) => b.eta && b.eta < t).map((b) => ({ id: b.id, sku: b.sku, qty: b.qty, status: b.status, eta: b.eta, daysLate: daysBetween(b.eta, t), supplier: b.supplier, trackingNo: b.trackingNo }));
  const unpaid = data.batches.filter((b) => b.status !== 'cancelled').map((b) => ({ b, due: b.qty * b.unitCostCny + b.freightCny - (b.paidCny || 0) })).filter((x) => x.due > 0.5)
    .map((x) => ({ id: x.b.id, sku: x.b.sku, supplier: x.b.supplier, status: x.b.status, unpaidCny: r2(x.due) }));
  const oversold = data.products.filter((p) => p.stock === 0 && (stats.byProduct.get(p.id) || {}).sold > 0).map((p) => p.sku);
  return { restock, losingListings: losing, thinListings: thin, lateBatches, unpaidSuppliers: unpaid, soldOut: oversold };
}

export function dashboard(data, stats, table, settings, input) {
  const { from, to } = dateRange(input, 30);
  const span = daysBetween(from, to) + 1;
  const prevTo = addDays(from, -1); const prevFrom = addDays(prevTo, -(span - 1));
  const cur = pnl(data, from, to);
  const prev = pnl(data, prevFrom, prevTo);
  const delta = (a, b) => (b ? r1((a - b) / Math.abs(b) * 100) : null);
  const inv = data.products.reduce((a, p) => a + (p.stock || 0) * (p.costCny || 0), 0);
  const pipeline = data.batches.filter((b) => b.status !== 'delivered' && b.status !== 'cancelled').reduce((a, b) => a + b.qty * b.unitCostCny + b.freightCny, 0);
  return {
    from, to, days: span, current: cur,
    previous: { from: prevFrom, to: prevTo, netRevenueCny: prev.netRevenueCny, profitCny: prev.profitCny, orders: prev.orders },
    change: { netRevenuePct: delta(cur.netRevenueCny, prev.netRevenueCny), profitPct: delta(cur.profitCny, prev.profitCny), ordersPct: delta(cur.orders, prev.orders) },
    inventoryValueCny: r2(inv), openPurchasesCny: r2(pipeline),
    series: dailySeries(data, from, to),
    attention: attention(data, stats, table, settings),
  };
}
