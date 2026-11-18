import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.DSH_HOME = mkdtempSync(path.join(os.tmpdir(), 'ec-'));
const { computeProfit, priceFor, reorderPlan, landedCny, blend, chargeableKg, DEFAULT_SETTINGS } = await import('../plugins/ecommerce/calc.js');
const { setRatesForTest, setHistoryForTest, rateIn } = await import('../plugins/ecommerce/rates.js');
const { parseCsv, mapColumns, cellDate, cellNumber } = await import('../plugins/ecommerce/csv.js');
const { lanRegistry } = await import('../plugins/ecommerce/common.js');
const ec = await import('../plugins/ecommerce/index.js');

const TODAY = new Date().toISOString().slice(0, 10);
const daysAgo = (n) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10);
setRatesForTest({ base: 'CNY', date: TODAY, rates: { CNY: 1, USD: 0.15, EUR: 0.13619 }, fetchedAt: Date.now(), source: 'test', stale: false });
setHistoryForTest({ ok: true, from: daysAgo(60), dates: [daysAgo(60)], byDate: { [daysAgo(60)]: { USD: 0.15, EUR: 0.13619 } }, fetchedAt: Date.now() });
ec.apply({ effect: (f) => f(), tools: { register() {} }, webServer: { register() {} }, connection: { requestRejection: () => null } });
const run = (input) => lanRegistry().runs.get('ecommerce').run(input);

test('profit takes VAT, platform and payment fees, ads, returns and landed cost off the price', () => {
  const r = computeProfit({ price: 119, vatPct: 19, platformFeePct: 12, payFeePct: 3, fulfilFee: 3, adPct: 10, returnPct: 5, landedCny: 70 }, 0.13);
  assert.equal(r.netPrice, 100);
  assert.equal(r.landed, 9.1);
  assert.equal(r.profit, 57.9); // 100 - 15 - 3 - 10 - 5 - 9.1
  assert.equal(r.breakEvenRoas, 1.47); // net 100 / (profit 57.9 + ads 10): the ROAS at which ad spend eats all profit before ads
});

test('priceFor inverts computeProfit; fees that leave no room give null', () => {
  const p = { vatPct: 20, platformFeePct: 15, payFeePct: 2, fulfilFee: 2, adPct: 8, returnPct: 2, landedCny: 48 };
  const price = priceFor(p, 0.11, 25);
  assert.ok(Math.abs(computeProfit({ ...p, price }, 0.11).marginPct - 25) < 0.1);
  const be = priceFor(p, 0.11, 0);
  assert.ok(Math.abs(computeProfit({ ...p, price: be }, 0.11).profit) < 0.05);
  assert.equal(priceFor({ platformFeePct: 60, adPct: 30, returnPct: 10 }, 0.1, 5), null);
});

test('landed cost uses fixed freight, else weight (the larger of actual and volumetric) times the rate, then duty', () => {
  const s = { ...DEFAULT_SETTINGS, freightPerKg: 40 };
  assert.equal(chargeableKg({ weightG: 300, dims: { l: 30, w: 20, h: 20 } }, 6000), 2); // 12000/6000 beats 0.3 kg
  assert.deepEqual(landedCny({ costCny: 30, weightG: 500, dutyPct: 10 }, s), { value: 55, freight: 20, freightSource: 'weight' }); // (30+20)*1.1
  assert.equal(landedCny({ costCny: 30, shippingCny: 5, weightG: 500, dutyPct: 0 }, s).value, 35, 'a fixed freight wins');
  assert.equal(landedCny({ costCny: 30, weightG: 500 }, DEFAULT_SETTINGS).freightSource, 'none');
});

test('replenishment: sold out, order now, ok, slow, idle, and the suggested quantity', () => {
  const base = { lead: 45, safety: 14, cover: 30 };
  const out = reorderPlan({ ...base, stock: 0, inTransit: 0, onOrder: 0, velocity: 2 });
  assert.equal(out.status, 'out');
  assert.equal(out.suggested, 178); // 2/day * (59 + 30)
  const now = reorderPlan({ ...base, stock: 60, inTransit: 0, onOrder: 0, velocity: 2 });
  assert.equal(now.status, 'order_now'); // 30 days of stock, 59 needed
  assert.equal(reorderPlan({ ...base, stock: 60, inTransit: 100, onOrder: 0, velocity: 2 }).status, 'ok', 'stock on its way counts');
  assert.equal(reorderPlan({ ...base, stock: 40, inTransit: 0, onOrder: 0, velocity: 0 }).status, 'slow');
  assert.equal(reorderPlan({ ...base, stock: 0, inTransit: 0, onOrder: 0, velocity: 0 }).status, 'idle');
  assert.equal(blend(10, 100, 12, 100), 11);
});

test('CSV: quotes, tab delimiter, header aliases, dates and numbers', () => {
  assert.deepEqual(parseCsv('a,b\n"x, y","he said ""hi"""\n'), [['a', 'b'], ['x, y', 'he said "hi"']]);
  assert.equal(parseCsv('a\tb\n1\t2')[1][1], '2');
  const m = mapColumns(['Order ID', 'Purchase Date', 'SKU', 'Quantity Purchased', 'Item Price', 'Ship Country']);
  assert.deepEqual([m.ref, m.date, m.sku, m.qty, m.price, m.market], [0, 1, 2, 3, 4, 5]);
  assert.equal(cellDate('11/05/2026'), '2026-11-05');
  assert.equal(cellDate('2026/3/7 10:00'), '2026-03-07');
  assert.equal(cellNumber('$1,299.50'), 1299.5);
});

let pid;
test('a product with a listing gets landed cost and live profit; SKUs are unique', async () => {
  await run({ action: 'settings', settings: { freightPerKg: 40, leadDays: 30, safetyDays: 10, coverDays: 20 } });
  const add = await run({ action: 'add_product', title: 'Yoga mat', sku: 'YM-1', costCny: 30, weightG: 500, dutyPct: 0, stock: 100, supplier: 'Foshan Co' });
  assert.equal(add.ok, true);
  pid = add.product.id;
  assert.equal(add.product.landed.value, 50, '30 + 0.5kg * 40');
  assert.equal((await run({ action: 'add_product', title: 'dup', sku: 'ym-1' })).ok, false);
  const l = await run({ action: 'set_listing', id: pid, platform: 'amazon', market: 'DE', price: 29.9 });
  const li = l.product.listings[0];
  assert.deepEqual([li.currency, li.vatPct, li.platformFeePct], ['EUR', 19, 15]);
  assert.equal(li.economics.ok, true);
  const calc = await run({ action: 'calc', id: 'YM-1', price: 29.9, currency: 'EUR', vatPct: 19, platformFeePct: 15 });
  assert.equal(calc.result.landedCny, 50, 'calc reads the saved product by SKU');
  assert.equal((await run({ action: 'set_listing', id: pid, platform: 'amazon', market: 'ZZ', currency: 'AED', price: 10 })).product.listings[1].economics.ok, false, 'no rate: explained, not guessed');
});

test('orders snapshot cost and rate, move stock with their status, and dedupe by platform, order id and SKU', async () => {
  const o = await run({ action: 'add_order', sku: 'YM-1', platform: 'amazon', market: 'DE', qty: 2, ref: 'A-1', date: daysAgo(2) });
  assert.equal(o.ok, true);
  assert.equal(o.order.price, 29.9, 'price comes from the listing');
  assert.equal(o.order.costCnyUnit, 50);
  assert.equal(o.stock, 98);
  assert.equal((await run({ action: 'add_order', sku: 'YM-1', platform: 'amazon', market: 'DE', qty: 1, ref: 'A-1' })).ok, false);
  // a later cost change does not rewrite past profit
  const before = (await run({ action: 'list_orders', platform: 'amazon' })).items[0].finance.profitCny;
  await run({ action: 'update_product', id: pid, costCny: 80 });
  assert.equal((await run({ action: 'list_orders', platform: 'amazon' })).items[0].finance.profitCny, before);
  await run({ action: 'update_product', id: pid, costCny: 30 });
  const r = await run({ action: 'update_order', orderId: o.order.id, status: 'returned', restocked: true });
  assert.equal(r.stock, 100, 'a restocked return gives the units back');
  assert.equal(r.order.finance.profitCny, 0);
  const c = await run({ action: 'update_order', orderId: o.order.id, status: 'paid' });
  assert.equal(c.stock, 98);
  assert.equal((await run({ action: 'remove_order', orderId: o.order.id })).stock, 100);
});

test('import_orders maps columns, skips duplicates and unknown SKUs, and dry run saves nothing', async () => {
  const csv = ['Order ID,Purchase Date,SKU,Quantity,Item Price,Currency,Ship Country,Order Status',
    `B-1,${daysAgo(5)},YM-1,3,29.9,EUR,DE,Shipped`,
    `B-2,${daysAgo(4)},YM-1,1,29.9,EUR,DE,Cancelled`,
    `B-3,${daysAgo(3)},NOPE,1,9,EUR,DE,Shipped`,
    `B-4,,YM-1,1,9,EUR,DE,Shipped`].join('\n');
  const dry = await run({ action: 'import_orders', csv, platform: 'amazon', dryRun: true });
  assert.equal(dry.added, 2);
  assert.deepEqual(dry.unknownSkus, { NOPE: 1 });
  assert.equal(dry.skipped.length, 1);
  assert.equal((await run({ action: 'list_orders', from: daysAgo(30) })).matched, 0, 'dry run saved nothing');
  const real = await run({ action: 'import_orders', csv, platform: 'amazon' });
  assert.equal(real.added, 2);
  assert.equal((await run({ action: 'get', id: 'YM-1' })).product.stock, 97, 'paid 3 out, cancelled 1 not');
  assert.equal((await run({ action: 'import_orders', csv, platform: 'amazon' })).duplicates, 2, 'importing the same file again changes nothing');
  assert.equal((await run({ action: 'import_orders', csv: 'a,b\n1,2', platform: 'amazon' })).ok, false, 'a file without a SKU column explains itself');
});

test('a delivered purchase adds stock once and re-averages the cost', async () => {
  const b = await run({ action: 'add_purchase', sku: 'YM-1', qty: 97, unitCostCny: 40, freightCny: 970, eta: daysAgo(3), status: 'shipped' });
  assert.equal(b.ok, true);
  const todo = await run({ action: 'todo' });
  assert.equal(todo.lateBatches.length, 1, 'past its ETA and not delivered');
  assert.equal(todo.unpaidSuppliers[0].unpaidCny, 4850);
  const d = await run({ action: 'update_purchase', batchId: b.batch.id, status: 'delivered', paidCny: 4850 });
  assert.equal(d.stockAdded, 97);
  assert.equal(d.stock, 194);
  assert.equal(d.costCny, 35, '(97 * 30 + 97 * 40) / 194');
  assert.equal((await run({ action: 'update_purchase', batchId: b.batch.id, status: 'delivered' })).stockAdded, 0, 'applied once');
  assert.equal((await run({ action: 'update_purchase', batchId: b.batch.id, status: 'shipped' })).ok, false);
  assert.equal((await run({ action: 'remove_purchase', batchId: b.batch.id })).ok, false);
});

test('the profit and loss report subtracts extra costs and breaks down by platform and product', async () => {
  const cost = await run({ action: 'add_cost', kind: 'ads', amount: 10, currency: 'USD', date: daysAgo(3), productId: 'YM-1', platform: 'amazon' });
  assert.equal(cost.ok, true);
  assert.equal(cost.cost.amountCny, 66.67, '10 USD at 0.15');
  const rep = await run({ action: 'report', from: daysAgo(30) });
  assert.equal(rep.orders, 1, 'the cancelled order is not counted');
  assert.equal(rep.units, 3);
  assert.equal(rep.otherCostsCny, 66.67);
  assert.ok(Math.abs(rep.profitCny - (rep.orderProfitCny - 66.67)) < 0.02);
  assert.equal(rep.byPlatform[0].key, 'amazon');
  assert.equal(rep.byProduct[0].adCny, 66.67);
  const dash = await run({ action: 'dashboard', from: daysAgo(30) });
  assert.equal(dash.series.length, 31);
  assert.ok(dash.inventoryValueCny > 0);
  assert.equal((await run({ action: 'remove_cost', costId: cost.cost.id })).ok, true);
});

test('restock advice follows the real sales rate', async () => {
  await run({ action: 'update_product', id: pid, stock: 10 });
  const todo = await run({ action: 'todo' });
  const row = todo.restock.find((r) => r.sku === 'YM-1');
  assert.ok(row, 'selling 3 units in the window with 10 left and a 40-day horizon');
  assert.ok(row.suggestedQty > 0);
});

test('remove_product refuses while orders reference it, then force removes it', async () => {
  assert.equal((await run({ action: 'remove_product', id: pid })).ok, false);
  assert.equal((await run({ action: 'remove_product', id: pid, force: true })).ok, true);
  assert.equal(rateIn({ rates: { USD: 0.15 } }, 'usd'), 0.15);
});

test('export_orders returns CSV with a header', async () => {
  const e = await run({ action: 'export_orders', from: daysAgo(400) });
  assert.equal(e.ok, true);
  assert.match(e.csv.split('\n')[0], /^date,ref,sku,/);
});
