import { Store, dataFile, registerRoute, registerTool } from './common.js';
import { getRates } from './rates.js';
import { settingsOf, PLATFORMS, BATCH_STATUS, COST_KINDS } from './model.js';
import { ORDER_STATUS, buildStats } from './orders.js';
import { dashboard, pnl, attention } from './reports.js';
import { dateRange, today } from './util.js';
import * as P from './ops-products.js';
import * as O from './ops-orders.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/ecommerce';
/** Actions that only read; `settings` also writes when given values, so it is left out. */
export const READ = ['dashboard', 'todo', 'report', 'list', 'get', 'calc', 'price_for', 'rates', 'list_orders', 'export_orders', 'list_purchases', 'list_costs'];
const ACTIONS = [
  ...READ, 'settings', 'add_product', 'update_product', 'remove_product', 'set_listing', 'remove_listing', 'adjust_stock',
  'add_order', 'update_order', 'remove_order', 'import_orders',
  'add_purchase', 'update_purchase', 'remove_purchase', 'add_cost', 'remove_cost',
];

export function apply(ctx) {
  const store = new Store(dataFile('ecommerce'), () => ({ version: 1, settings: {}, products: [], orders: [], batches: [], costs: [] }));

  async function run(input) {
    const data = await store.load();
    for (const k of ['products', 'orders', 'batches', 'costs']) if (!Array.isArray(data[k])) data[k] = [];
    const c = {
      data, store, settings: settingsOf(data),
      find: (id) => data.products.find((p) => p.id === id || p.sku === id),
      rates: async () => { try { return await getRates(); } catch { return null; } },
      stats: () => buildStats(data, c.settings, today()),
      done: async (extra) => { await store.save(); return { ok: true, ...extra }; },
    };
    const action = input.action || 'dashboard';
    switch (action) {
      case 'dashboard': { const d = dashboard(data, c.stats(), await c.rates(), c.settings, input); return { ok: true, ...d }; }
      case 'todo': return { ok: true, ...attention(data, c.stats(), await c.rates(), c.settings), today: today() };
      case 'report': { const { from, to } = dateRange(input, 30); return { ok: true, ...pnl(data, from, to) }; }
      case 'settings': return P.settingsAction(c, input);
      case 'rates': return P.ratesAction(c, input);
      case 'calc': case 'price_for': return P.calcAction(c, input, action);
      case 'list': return P.listProducts(c, input);
      case 'get': return P.getProduct(c, input);
      case 'add_product': return P.addProduct(c, input);
      case 'update_product': return P.updateProduct(c, input);
      case 'remove_product': return P.removeProduct(c, input);
      case 'set_listing': return P.setListing(c, input);
      case 'remove_listing': return P.removeListing(c, input);
      case 'adjust_stock': return P.adjustStock(c, input);
      case 'add_order': return O.addOrder(c, input);
      case 'update_order': return O.updateOrder(c, input);
      case 'remove_order': return O.removeOrder(c, input);
      case 'list_orders': return O.listOrders(c, input);
      case 'import_orders': return O.importOrders(c, input);
      case 'export_orders': return O.exportOrders(c, input);
      case 'add_purchase': return O.addBatch(c, input);
      case 'update_purchase': return O.updateBatch(c, input);
      case 'remove_purchase': return O.removeBatch(c, input);
      case 'list_purchases': return O.listBatches(c, input);
      case 'add_cost': return O.addCost(c, input);
      case 'remove_cost': return O.removeCost(c, input);
      case 'list_costs': return O.listCosts(c, input);
      default: return { ok: false, error: 'Unknown action: ' + String(action) };
    }
  }

  registerRoute(ctx, ROUTE, run, 'ecommerce');
  registerTool(ctx, {
    name: 'ecommerce',
    description: 'Cross-border e-commerce back office in the sidebar E-commerce panel. Keeps products with real landed cost (purchase, freight by weight or fixed, duty), per-market listings with platform and payment fees, VAT, ads and returns, orders with the cost and exchange rate of the day they were placed, supplier purchase orders that restock and re-average cost on delivery, and other costs such as ad spend. Computes profit per listing, profit and loss per period, sales rate and restock quantities. Rates are daily ECB reference rates; platform fee and VAT defaults are starting points that the user\'s real figures replace. Money is CNY unless a field names a currency. Actions: dashboard (period overview with change against the previous period and what needs attention), todo (restock, loss-making listings, late or unpaid purchases), report (profit and loss by platform, market and product; from/to, default last 30 days); list (query, tag), get (id or SKU; with replenishment advice), add_product / update_product / remove_product, set_listing / remove_listing, adjust_stock (counted stock or delta), calc and price_for (ad-hoc profit and the price for a target margin; pass id/SKU to use a saved product\'s cost), rates, settings; add_order / update_order / remove_order (stock follows status), list_orders, import_orders (CSV text of a platform export; dryRun first), export_orders (CSV); add_purchase / update_purchase / remove_purchase (delivered adds stock once), list_purchases; add_cost / remove_cost / list_costs. Orders and costs are user data: confirm figures that were not given instead of guessing. Use web_fetch or web_search to research competitor prices or category fees, then record them with set_listing.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ACTIONS, description: 'Operation to perform. Defaults to dashboard.' },
        id: { type: 'string', description: 'Product id or SKU (get, update_product, remove_product, set_listing, remove_listing, adjust_stock; optional for calc and price_for).' },
        listingId: { type: 'string', description: 'set_listing: edit this listing; omit to add one. remove_listing: the listing to remove.' },
        orderId: { type: 'string', description: 'Order id for update_order and remove_order.' },
        batchId: { type: 'string', description: 'Purchase order id for update_purchase and remove_purchase.' },
        costId: { type: 'string', description: 'Cost entry id for remove_cost.' },
        productId: { type: 'string', description: 'Product SKU or id: the product an order, purchase or cost belongs to; also filters the list actions.' },
        sku: { type: 'string', description: 'add_product/update_product: the SKU. add_order/add_purchase: the product SKU.' },
        title: { type: 'string', description: 'Product working title (any language).' },
        titles: { type: 'object', description: 'Listing titles by language code, e.g. {"en": "...", "de": "..."}; replaces the existing set.', additionalProperties: { type: 'string' } },
        costCny: { type: 'number', description: 'Purchase cost per unit, CNY.' },
        shippingCny: { type: 'number', description: 'Fixed first-leg freight per unit, CNY. Leave 0 to derive it from weight and the freight rate in settings.' },
        dutyPct: { type: 'number', description: 'Import duty on cost plus freight, percent 0-100.' },
        weightG: { type: 'number', description: 'Unit weight in grams.' },
        dims: { type: 'object', description: 'Packed size in cm: {l, w, h}; volumetric weight uses settings.volDivisor.', properties: { l: { type: 'number' }, w: { type: 'number' }, h: { type: 'number' } } },
        stock: { type: ['number', 'null'], description: 'add_product/update_product: units on hand (null stops tracking). adjust_stock: the counted figure.' },
        delta: { type: 'number', description: 'adjust_stock: change in units, negative for losses.' },
        supplier: { type: 'string', description: 'Supplier name.' },
        supplierUrl: { type: 'string', description: 'Supplier page or 1688 link.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'Tags; on update the list replaces the existing tags.' },
        notes: { type: 'string', description: 'Free notes on the product.' },
        force: { type: 'boolean', description: 'remove_product: remove even when orders reference it.' },
        platform: { type: 'string', enum: PLATFORMS, description: 'Sales platform. set_listing: sets default commission and payment fee. Also filters list_orders and tags orders and costs.' },
        market: { type: 'string', description: 'Destination market code such as US, UK, DE, JP; US, UK, DE, FR, ES, IT, NL, JP, AU, CA, SG and MX fill in currency and VAT.' },
        price: { type: 'number', description: 'Selling price per unit including VAT, in the sale currency. add_order defaults to the matching listing price.' },
        currency: { type: 'string', description: 'Sale currency, 3-letter code. For calc/price_for/add_cost it also selects the rate.' },
        vatPct: { type: 'number', description: 'VAT or GST included in price, percent.' },
        platformFeePct: { type: 'number', description: 'Platform commission on the price without VAT, percent.' },
        payFeePct: { type: 'number', description: 'Payment processing fee on the price without VAT, percent.' },
        fulfilFee: { type: 'number', description: 'Fixed fees per order unit (fulfilment, last mile, payment fixed part), in the sale currency.' },
        adPct: { type: 'number', description: 'Advertising spend as percent of the price without VAT.' },
        returnPct: { type: 'number', description: 'Revenue lost to returns, percent of the price without VAT.' },
        rate: { type: 'number', description: 'Sale currency per 1 CNY. Overrides the daily rate; required when the currency is not covered.' },
        targetMarginPct: { type: 'number', description: 'price_for: wanted profit as percent of the price without VAT, default 20.' },
        url: { type: 'string', description: 'set_listing: the listing page.' },
        ref: { type: 'string', description: 'Order number on the platform. With platform and SKU it keeps imports from duplicating an order.' },
        note: { type: 'string', description: 'Note on a listing, order, purchase or cost.' },
        date: { type: 'string', description: 'add_order/add_cost: YYYY-MM-DD, default today.' },
        qty: { type: 'number', description: 'Units on an order or purchase order.' },
        status: { type: 'string', enum: [...new Set([...ORDER_STATUS, ...BATCH_STATUS])], description: 'Order status (paid, returned, cancelled) or purchase status (ordered, producing, shipped, customs, delivered, cancelled). list_orders filters by it.' },
        fee: { type: 'number', description: 'add_order/update_order: the platform\'s actual fee for the whole order in the sale currency. Blank estimates it from the listing.' },
        restocked: { type: 'boolean', description: 'Returned order: the goods are back in stock.' },
        unitCostCny: { type: 'number', description: 'add_purchase: unit price paid to the supplier, CNY. Defaults to the product cost.' },
        freightCny: { type: 'number', description: 'add_purchase: total first-leg freight for the whole batch, CNY.' },
        paidCny: { type: 'number', description: 'add_purchase/update_purchase: amount already paid to the supplier, CNY.' },
        orderedAt: { type: 'string', description: 'add_purchase: YYYY-MM-DD, default today.' },
        eta: { type: 'string', description: 'Expected arrival of a purchase, YYYY-MM-DD.' },
        trackingNo: { type: 'string', description: 'Purchase shipment tracking number.' },
        carrier: { type: 'string', description: 'Purchase carrier or forwarder.' },
        openOnly: { type: 'boolean', description: 'list_purchases: hide delivered and cancelled.' },
        kind: { type: 'string', enum: COST_KINDS, description: 'add_cost/list_costs: cost category.' },
        amount: { type: 'number', description: 'add_cost: amount in `currency` (default CNY).' },
        csv: { type: 'string', description: 'import_orders: the CSV text. Needs a SKU column matching product SKUs; date, quantity, price, fee, status, order id and country columns are recognised.' },
        columns: { type: 'object', description: 'import_orders: header overrides {field: exact header text} for fields sku, date, qty, price, fee, status, ref, market, currency.', additionalProperties: { type: 'string' } },
        dryRun: { type: 'boolean', description: 'import_orders: report what would be imported without saving.' },
        settings: { type: 'object', description: 'settings: values to change among freightPerKg (CNY per kg), volDivisor, leadDays, safetyDays, coverDays, windowDays, lowMarginPct.', additionalProperties: { type: 'number' } },
        from: { type: 'string', description: 'Period start YYYY-MM-DD (dashboard, report, list_orders, list_costs, export_orders). Default: 30 days before `to`.' },
        to: { type: 'string', description: 'Period end YYYY-MM-DD, default today.' },
        query: { type: 'string', description: 'list/list_orders: text filter.' },
        tag: { type: 'string', description: 'list: only products with this tag.' },
        limit: { type: 'number', description: 'list/list_orders: maximum rows.' },
        currencies: { type: 'array', items: { type: 'string' }, description: 'rates: limit to these currency codes.' },
        refresh: { type: 'boolean', description: 'rates: bypass the 6-hour cache.' },
      },
      required: [],
      additionalProperties: false,
    },
  }, run, 'ecommerce');
}
