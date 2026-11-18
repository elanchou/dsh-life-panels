/**
 * Unit economics and replenishment maths. Pure functions, no I/O. Percentages are 0-100.
 * `rate` is the sale currency per 1 CNY.
 */
import { n0, r1, r2 } from './util.js';

export const DEFAULT_SETTINGS = {
  freightPerKg: 0,      // first-leg freight, CNY per chargeable kg, used when a product has no fixed freight
  volDivisor: 6000,     // cm3 per kg for volumetric weight (express/air 5000-6000)
  leadDays: 45,         // supplier production + first-leg + inbound, days
  safetyDays: 14,
  coverDays: 30,        // how many days of sales one replenishment should cover after the lead time
  windowDays: 30,       // sales window for the daily sales rate
  lowMarginPct: 10,
};

export function chargeableKg(p, divisor = 6000) {
  const d = p.dims || {};
  const vol = (n0(d.l) * n0(d.w) * n0(d.h)) / (n0(divisor) || 6000);
  return Math.max(n0(p.weightG) / 1000, vol);
}

/** First-leg freight per unit in CNY: the fixed figure when set (a real shipment's blended cost), else weight times the rate. */
export function freightCny(p, s) {
  if (n0(p.shippingCny) > 0) return { value: n0(p.shippingCny), source: 'fixed' };
  const kg = chargeableKg(p, s.volDivisor);
  if (kg > 0 && n0(s.freightPerKg) > 0) return { value: kg * n0(s.freightPerKg), source: 'weight' };
  return { value: 0, source: 'none' };
}

/** Landed cost per unit in CNY: (purchase + first-leg freight) with duty on top. */
export function landedCny(p, s) {
  const f = freightCny(p, s);
  const base = n0(p.costCny) + f.value;
  return { value: r2(base * (1 + n0(p.dutyPct) / 100)), freight: r2(f.value), freightSource: f.source };
}

/** Quantity-weighted average of an old and a new unit value. */
export function blend(oldVal, oldQty, newVal, newQty) {
  const a = n0(oldQty); const b = n0(newQty);
  if (a + b <= 0) return n0(newVal);
  return r2((n0(oldVal) * a + n0(newVal) * b) / (a + b));
}

/** Profit of one unit sold at p.price (tax included). `p.landedCny` is the landed cost in CNY. */
export function computeProfit(p, rate) {
  const price = n0(p.price);
  if (!(price > 0)) return { ok: false, error: 'price must be greater than 0' };
  if (!(rate > 0)) return { ok: false, error: 'rate must be greater than 0' };
  const net = price / (1 + n0(p.vatPct) / 100);
  const landed = n0(p.landedCny) * rate;
  const platformFee = net * (n0(p.platformFeePct) + n0(p.payFeePct)) / 100;
  const fulfil = n0(p.fulfilFee);
  const ads = net * n0(p.adPct) / 100;
  const returns = net * n0(p.returnPct) / 100;
  const profit = net - platformFee - fulfil - ads - returns - landed;
  return {
    ok: true,
    netPrice: r2(net), vat: r2(price - net), landedCny: r2(n0(p.landedCny)), landed: r2(landed),
    platformFee: r2(platformFee), fulfilFee: r2(fulfil), ads: r2(ads), returns: r2(returns),
    profit: r2(profit), profitCny: r2(profit / rate), marginPct: r1(profit / net * 100),
    roiPct: landed > 0 ? r1(profit / landed * 100) : null,
    breakEvenPrice: priceFor(p, rate, 0),
    breakEvenRoas: net > 0 && profit + ads > 0 ? r2(net / (profit + ads)) : null,
    rate,
  };
}

/** Selling price (tax included) that yields `marginPct` of the net price as profit; null when the fees leave no room. */
export function priceFor(p, rate, marginPct) {
  const share = (n0(p.platformFeePct) + n0(p.payFeePct) + n0(p.adPct) + n0(p.returnPct) + n0(marginPct)) / 100;
  const room = 1 - share;
  if (!(room > 0) || !(rate > 0)) return null;
  const net = (n0(p.landedCny) * rate + n0(p.fulfilFee)) / room;
  return r2(net * (1 + n0(p.vatPct) / 100));
}

/**
 * Replenishment plan from the daily sales rate. `avail` counts stock, stock on its way and open purchase orders.
 * status: out (sold out while still selling), order_now (what is on hand and on the way will not last through the
 * lead time plus safety days), ok, slow (stock but no recent sales), idle (nothing in stock, nothing selling).
 */
export function reorderPlan({ stock, inTransit, onOrder, velocity, lead, safety, cover }) {
  const s = n0(stock); const t = n0(inTransit); const o = n0(onOrder); const v = n0(velocity);
  const avail = s + t + o;
  const horizon = n0(lead) + n0(safety);
  const target = Math.ceil(v * (horizon + n0(cover)));
  const suggested = Math.max(0, target - avail);
  let status = 'ok';
  if (v <= 0) status = s > 0 ? 'slow' : 'idle';
  else if (s <= 0) status = 'out';
  else if (avail / v < horizon) status = 'order_now';
  return {
    status, suggested, target,
    daysCover: v > 0 ? r1(s / v) : null,
    daysCoverWithPipeline: v > 0 ? r1(avail / v) : null,
    reorderPoint: Math.ceil(v * horizon),
  };
}
