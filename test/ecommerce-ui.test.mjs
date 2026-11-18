import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { mkdtempSync } from 'node:fs';

/**
 * Smoke test for the panel: no React is installed here, so a tiny stand-in (elements as plain objects, hooks backed by
 * per-instance slots, effects run after each pass) renders the real client bundle against the real Host operations.
 * It catches undefined names, missing translation keys and render-time exceptions; it does not check layout.
 */
process.env.DSH_HOME = mkdtempSync(path.join(os.tmpdir(), 'ecui-'));
const { setRatesForTest, setHistoryForTest } = await import('../plugins/ecommerce/rates.js');
const { lanRegistry } = await import('../plugins/ecommerce/common.js');
const ec = await import('../plugins/ecommerce/index.js');
const today = new Date().toISOString().slice(0, 10);
setRatesForTest({ base: 'CNY', date: today, rates: { CNY: 1, USD: 0.15, EUR: 0.13619 }, fetchedAt: Date.now(), source: 'test', stale: false });
setHistoryForTest({ ok: true, from: '2020-01-01', dates: ['2020-01-01'], byDate: { '2020-01-01': { USD: 0.15, EUR: 0.13619 } }, fetchedAt: Date.now() });
ec.apply({ effect: (f) => f(), tools: { register() {} }, webServer: { register() {} }, connection: { requestRejection: () => null } });
const host = lanRegistry().runs.get('ecommerce').run;

// ---- stand-in React ----
let current = null;
const h = (type, props, ...children) => ({ type, props: props || {}, children: children.flat(Infinity) });
let dirty = false;
function makeHooks() {
  return {
    useState(init) { const c = current; const i = c.i++; if (!(i in c.slots)) c.slots[i] = typeof init === 'function' ? init() : init; return [c.slots[i], (v) => { const n = typeof v === 'function' ? v(c.slots[i]) : v; if (n !== c.slots[i]) { c.slots[i] = n; dirty = true; } }]; },
    useRef(init) { const c = current; const i = c.i++; if (!(i in c.slots)) c.slots[i] = { current: init }; return c.slots[i]; },
    useMemo(f) { const c = current; const i = c.i++; if (!(i in c.slots)) c.slots[i] = f(); return c.slots[i]; },
    useCallback(f) { const c = current; const i = c.i++; c.slots[i] = f; return f; },
    useEffect(f, deps) { const c = current; const i = c.i++; const prev = c.slots[i]; const same = prev && deps && prev.deps && deps.length === prev.deps.length && deps.every((d, k) => Object.is(d, prev.deps[k])); if (!same) { c.slots[i] = { deps }; c.effects.push(() => { try { const r = f(); if (typeof r === 'function') c.cleanups.push(r); } catch (e) { errors.push(e); } }); } },
  };
}
const errors = [];
const hooks = makeHooks();
const React = { createElement: h, ...hooks };
const instances = new Map();
function expand(node, key) {
  if (node === null || node === undefined || typeof node === 'string' || typeof node === 'number' || typeof node === 'boolean') return node;
  if (Array.isArray(node)) return node.map((n, i) => expand(n, key + '/' + i));
  if (typeof node.type === 'function') {
    const k = key + ':' + (node.props.key ?? '') + ':' + (node.type.name || 'anon');
    let inst = instances.get(k);
    if (!inst) { inst = { slots: {}, effects: [], cleanups: [], i: 0 }; instances.set(k, inst); }
    inst.i = 0; current = inst;
    const out = node.type({ ...node.props, children: node.children });
    seen.add(k);
    return expand(out, k);
  }
  return { ...node, children: node.children.map((c, i) => expand(c, key + '/' + (c && c.props && c.props.key !== undefined ? c.props.key : i))) };
}
let seen = new Set();
const text = (n) => (n === null || n === undefined || typeof n === 'boolean' ? '' : typeof n === 'string' || typeof n === 'number' ? String(n) : Array.isArray(n) ? n.map(text).join(' ') : text(n.children));
async function settle(root, passes = 12) {
  let tree;
  for (let p = 0; p < passes; p++) {
    dirty = false; seen = new Set();
    tree = expand(root, 'root');
    for (const inst of instances.values()) { const fx = inst.effects.splice(0); fx.forEach((f) => f()); }
    await new Promise((r) => setTimeout(r, 15));
    if (!dirty && p > 1) break;
  }
  seen = new Set(); dirty = false;
  return expand(root, 'root');
}
function find(tree, pred, out = []) {
  if (!tree || typeof tree !== 'object') return out;
  if (Array.isArray(tree)) { tree.forEach((t) => find(t, pred, out)); return out; }
  if (pred(tree)) out.push(tree);
  find(tree.children, pred, out);
  return out;
}

// ---- load the bundle with a fake module loader ----
globalThis.setInterval = () => 0; // the panel polls; the test drives refreshes itself
globalThis.clearInterval = () => {};
globalThis.fetch = async (url, init) => {
  const body = JSON.parse(init.body);
  const data = await host(body);
  return { ok: true, status: 200, json: async () => data };
};
globalThis.localStorage = { _m: {}, getItem(k) { return this._m[k] ?? null; }, setItem(k, v) { this._m[k] = String(v); } };
globalThis.document = { hidden: false, createElement: () => ({ click() {}, remove() {} }), body: { appendChild() {} } };
globalThis.window = globalThis;
globalThis.URL.createObjectURL = () => 'blob:x';
let registered = null;
globalThis.__ModuleLoader__ = { load(def) { registered = def; } };
const code = fs.readFileSync(new URL('../plugins/ecommerce/client.js', import.meta.url), 'utf8');
new Function(code)();
const mod = registered.factory((name) => { assert.equal(name, 'react'); return React; });
const dicts = {};
const slots = {};
mod.apply({
  effect: (f) => f(),
  locale: { register: (ns, d) => { Object.assign(dicts, d); return () => {}; }, bind: () => (k, vars) => { const s = dicts.zh[k]; if (s === undefined) errors.push(new Error('missing zh key: ' + k)); if (dicts.en[k] === undefined) errors.push(new Error('missing en key: ' + k)); return String(s ?? k).replace(/\{(\w+)\}/g, (_, v) => (vars && vars[v] !== undefined ? vars[v] : '{' + v + '}')); } },
  slots: { inject: (_o, f) => { f(); return () => {}; }, register: (opts, comp) => { slots[opts.name + ':' + (opts.key || opts.id)] = comp; return () => {}; } },
});
const t = (k, vars) => String(dicts.zh[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => (vars && vars[v] !== undefined ? vars[v] : '{' + v + '}'));
const Panel = slots['main:ecommerce'];

test('the panel registers its own main view and sidebar icon, with matching zh and en keys', () => {
  assert.ok(Panel, 'main slot');
  assert.ok(slots['sidebar.panellist:ecommerce'], 'sidebar entry');
  const zh = Object.keys(dicts.zh).sort(); const en = Object.keys(dicts.en).sort();
  assert.deepEqual(zh.filter((k) => !en.includes(k)), []);
  assert.deepEqual(en.filter((k) => !zh.includes(k)), []);
});

test('every tab renders, on empty data and with data, without errors or missing keys', async () => {
  const root = h(Panel, {});
  let tree = await settle(root);
  assert.match(text(tree), /开始用起来/, 'overview shows the getting-started card on a fresh install');
  assert.deepEqual(errors.map(String), []);

  // seed real data through the Host
  const p = await host({ action: 'add_product', title: 'Yoga mat', sku: 'YM-1', costCny: 30, weightG: 500, stock: 20, supplier: 'Foshan' });
  await host({ action: 'settings', settings: { freightPerKg: 40 } });
  await host({ action: 'set_listing', id: p.product.id, platform: 'amazon', market: 'DE', price: 29.9 });
  await host({ action: 'set_listing', id: p.product.id, platform: 'amazon', market: 'ZZ', currency: 'AED', price: 10 });
  await host({ action: 'add_order', sku: 'YM-1', platform: 'amazon', market: 'DE', qty: 4, ref: 'A-1', date: today });
  await host({ action: 'add_purchase', sku: 'YM-1', qty: 50, unitCostCny: 30, freightCny: 500, eta: '2020-01-01', status: 'shipped' });
  await host({ action: 'add_cost', kind: 'ads', amount: 20, currency: 'USD', productId: 'YM-1' });

  const tabs = [['tabOverview', /净销售额/], ['tabProducts', /Yoga mat/], ['tabOrders', /A-1/], ['tabPurchases', /YM-1 × 50/], ['tabFinance', /利润表/], ['tabCalc', /利润测算/]];
  for (const [key, expect] of tabs) {
    // switch tab by pressing its button
    const btn = find(tree, (n) => n.props && n.props.role === 'tab' && text(n).includes(t(key)))[0];
    assert.ok(btn, 'tab button ' + key);
    btn.props.onClick();
    tree = await settle(root);
    assert.match(text(tree), expect, key + ' content');
    assert.deepEqual(errors.map(String), [], key + ' raised errors');
  }
});

test('opening a product shows its landed cost, restock advice and listings (including the one without a rate)', async () => {
  const root = h(Panel, {});
  let tree = await settle(root);
  find(tree, (n) => n.props && n.props.role === 'tab' && text(n).includes(t('tabProducts')))[0].props.onClick();
  tree = await settle(root);
  const row = find(tree, (n) => n.type === 'button' && n.props.className && n.props.className.includes('ec-row'))[0];
  row.props.onClick();
  tree = await settle(root);
  const s = text(tree);
  assert.match(s, /补货建议/);
  assert.match(s, /在售信息/);
  assert.match(s, /No rate for AED/, 'a listing without a rate explains itself');
  assert.deepEqual(errors.map(String), []);
});

test('the orders tab import box previews a CSV through the host', async () => {
  const root = h(Panel, {});
  let tree = await settle(root);
  find(tree, (n) => n.props && n.props.role === 'tab' && text(n).includes(t('tabOrders')))[0].props.onClick();
  tree = await settle(root);
  find(tree, (n) => n.type === 'button' && text(n).includes(t('importOrders')))[0].props.onClick();
  tree = await settle(root);
  const ta = find(tree, (n) => n.type === 'textarea')[0];
  ta.props.onChange({ target: { value: `Order ID,Purchase Date,SKU,Quantity,Item Price\nB-9,${today},YM-1,2,29.9\nB-10,${today},NOPE,1,5` } });
  tree = await settle(root);
  find(tree, (n) => n.type === 'button' && text(n) === t('preview'))[0].props.onClick();
  tree = await settle(root);
  const s = text(tree);
  assert.match(s, /将导入 1 \/ 2/);
  assert.match(s, /NOPE/);
  assert.deepEqual(errors.map(String), []);
});
