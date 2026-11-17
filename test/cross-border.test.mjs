import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync } from 'node:fs';

process.env.DSH_HOME = mkdtempSync(path.join(os.tmpdir(), 'cb-'));
const { computeProfit, priceFor } = await import('../plugins/cross-border/calc.js');
const { setRatesForTest, rateIn } = await import('../plugins/cross-border/rates.js');
const { lanRegistry } = await import('../plugins/cross-border/common.js');
const cb = await import('../plugins/cross-border/index.js');

setRatesForTest({ base: 'CNY', date: '2026-11-16', rates: { CNY: 1, USD: 0.15, EUR: 0.13619 }, fetchedAt: Date.now(), source: 'test', stale: false });
cb.apply({ effect: (f) => f(), tools: { register() {} }, webServer: { register() {} }, connection: { requestRejection: () => null } });
const run = (input) => lanRegistry().runs.get('cross-border').run(input);

test('profit removes VAT, fees, ads, returns and landed cost', () => {
  const r = computeProfit({ price: 119, vatPct: 19, platformFeePct: 15, fulfilFee: 3, adPct: 10, returnPct: 5, costCny: 60, shippingCny: 10, dutyPct: 0 }, 0.13);
  assert.equal(r.netPrice, 100);
  assert.equal(r.vat, 19);
  assert.equal(r.landed, 9.1);
  // 100 - 15 - 3 - 10 - 5 - 9.1
  assert.equal(r.profit, 57.9);
  assert.equal(r.marginPct, 57.9);
});

test('priceFor inverts computeProfit and break-even gives zero profit', () => {
  const p = { vatPct: 20, platformFeePct: 15, fulfilFee: 2, adPct: 8, returnPct: 2, costCny: 40, shippingCny: 8, dutyPct: 5 };
  const price = priceFor(p, 0.11, 25);
  assert.ok(Math.abs(computeProfit({ ...p, price }, 0.11).marginPct - 25) < 0.1);
  const be = computeProfit({ ...p, price: 50 }, 0.11).breakEvenPrice;
  assert.ok(Math.abs(computeProfit({ ...p, price: be }, 0.11).profit) < 0.05);
  assert.equal(priceFor({ platformFeePct: 60, adPct: 30, returnPct: 10 }, 0.1, 5), null, 'fees leave no room');
});

test('computeProfit rejects a missing price or rate', () => {
  assert.equal(computeProfit({ price: 0 }, 1).ok, false);
  assert.equal(computeProfit({ price: 10 }, 0).ok, false);
  assert.equal(rateIn({ rates: { USD: 0.15 } }, 'usd'), 0.15);
  assert.equal(rateIn({ rates: { USD: 0.15 } }, 'AED'), null);
});

test('products, listings and shipments round trip with live economics', async () => {
  const add = await run({ action: 'add_product', title: 'Yoga mat', sku: 'YM-1', costCny: 30, shippingCny: 6, dutyPct: 0, stock: 5, reorderAt: 10, tags: ['#Sport'] });
  assert.equal(add.ok, true);
  const id = add.product.id;
  assert.deepEqual(add.product.tags, ['sport']);
  assert.equal((await run({ action: 'add_product', title: 'dup', sku: 'ym-1' })).ok, false, 'SKU is unique, case-insensitively');

  const l = await run({ action: 'set_listing', id, platform: 'amazon', market: 'DE', price: 24.9 });
  assert.equal(l.ok, true);
  const listing = l.product.listings[0];
  assert.equal(listing.currency, 'EUR', 'market preset fills currency');
  assert.equal(listing.vatPct, 19);
  assert.equal(listing.platformFeePct, 15, 'platform preset fills commission');
  assert.equal(listing.economics.ok, true);
  assert.ok(listing.economics.profit < listing.economics.netPrice);

  const bad = await run({ action: 'set_listing', id, platform: 'amazon', market: 'ZZ', currency: 'AED', price: 10 });
  assert.equal(bad.ok, true);
  assert.equal(bad.product.listings[1].economics.ok, false, 'a currency without a rate reports why instead of guessing');
  assert.equal((await run({ action: 'set_listing', id, platform: 'amazon', price: -1 })).ok, false);

  const sum = await run({ action: 'summary' });
  assert.equal(sum.lowStock.length, 1);

  const ship = await run({ action: 'add_shipment', trackingNo: 'LP123', productId: id, qty: 20, eta: '2026-12-01' });
  assert.equal(ship.ok, true);
  assert.match(ship.shipment.trackUrl, /17track\.net.*LP123/);
  const done = await run({ action: 'update_shipment', shipmentId: ship.shipment.id, status: 'delivered' });
  assert.equal(done.stockAdded, 20);
  const again = await run({ action: 'update_shipment', shipmentId: ship.shipment.id, status: 'delivered', note: 'ok' });
  assert.equal(again.stockAdded, 0, 'stock is applied once');
  assert.equal((await run({ action: 'get', id })).product.stock, 25);
  assert.equal((await run({ action: 'summary' })).lowStock.length, 0);

  assert.equal((await run({ action: 'remove_product', id })).ok, true);
  assert.equal((await run({ action: 'list_shipments' })).items[0].productId, null);
});

test('calc and price_for work offline with a rate and from cached rates by currency', async () => {
  const a = await run({ action: 'calc', price: 20, currency: 'USD', costCny: 40, platformFeePct: 15 });
  assert.equal(a.ok, true);
  assert.equal(a.result.landed, 6);
  const b = await run({ action: 'price_for', currency: 'EUR', costCny: 40, platformFeePct: 15, targetMarginPct: 30 });
  assert.equal(b.ok, true);
  assert.ok(Math.abs(b.result.marginPct - 30) < 0.2);
  assert.equal((await run({ action: 'price_for', currency: 'USD', platformFeePct: 80, adPct: 30 })).ok, false);
  assert.equal((await run({ action: 'calc', price: 10, currency: 'XXX', costCny: 1 })).ok, false);
});
