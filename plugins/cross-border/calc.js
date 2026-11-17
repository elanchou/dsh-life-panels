/**
 * Unit economics for one cross-border listing. Pure functions, no I/O.
 *
 * Inputs (numbers; percentages are 0-100):
 *   price         selling price in the sale currency, tax included
 *   costCny       purchase cost per unit, CNY
 *   shippingCny   first-leg freight per unit, CNY
 *   dutyPct       import duty on (cost + shipping)
 *   vatPct        VAT/GST included in `price`; removed from revenue
 *   platformFeePct  platform commission on the net (ex-VAT) price
 *   fulfilFee     fixed per-order fee in the sale currency (pick/pack, last mile, payment fixed fee)
 *   adPct         advertising spend as a share of net price
 *   returnPct     share of net revenue lost to returns and refunds
 *   rate          sale currency per 1 CNY
 */
const r2 = (n) => Math.round(n * 100) / 100;
const r1 = (n) => Math.round(n * 10) / 10;
const n0 = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);

export function computeProfit(p, rate) {
  const price = n0(p.price);
  if (!(price > 0)) return { ok: false, error: 'price must be greater than 0' };
  if (!(rate > 0)) return { ok: false, error: 'rate must be greater than 0' };
  const net = price / (1 + n0(p.vatPct) / 100);
  const landedCny = (n0(p.costCny) + n0(p.shippingCny)) * (1 + n0(p.dutyPct) / 100);
  const landed = landedCny * rate;
  const platformFee = net * n0(p.platformFeePct) / 100;
  const fulfil = n0(p.fulfilFee);
  const ads = net * n0(p.adPct) / 100;
  const returns = net * n0(p.returnPct) / 100;
  const profit = net - platformFee - fulfil - ads - returns - landed;
  return {
    ok: true,
    netPrice: r2(net), vat: r2(price - net), landedCny: r2(landedCny), landed: r2(landed),
    platformFee: r2(platformFee), fulfilFee: r2(fulfil), ads: r2(ads), returns: r2(returns),
    profit: r2(profit), profitCny: r2(profit / rate),
    marginPct: r1(profit / net * 100),
    roiPct: landed > 0 ? r1(profit / landed * 100) : null,
    breakEvenPrice: priceFor(p, rate, 0),
    rate,
  };
}

/** Selling price (tax included) that yields `marginPct` of the net price as profit; null when the fees leave no room. */
export function priceFor(p, rate, marginPct) {
  const share = (n0(p.platformFeePct) + n0(p.adPct) + n0(p.returnPct) + n0(marginPct)) / 100;
  const room = 1 - share;
  if (!(room > 0) || !(rate > 0)) return null;
  const landed = (n0(p.costCny) + n0(p.shippingCny)) * (1 + n0(p.dutyPct) / 100) * rate;
  const net = (landed + n0(p.fulfilFee)) / room;
  return r2(net * (1 + n0(p.vatPct) / 100));
}
