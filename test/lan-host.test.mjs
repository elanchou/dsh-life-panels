import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createLanServer, sessionToken, DEFAULT_EXCLUDE } from '../plugins/lan-host/server.js';

const here = path.dirname(new URL(import.meta.url).pathname);
const runs = new Map();
const raws = new Map();
const calls = [];
runs.set('news-feeds', { name: 'news-feeds', run: async (input, _a, via) => { calls.push({ input, via }); return { ok: true, echo: input.action }; }, clientFile: path.join(here, '../plugins/news-feeds/client.js') });
runs.set('cloud-sync', { name: 'cloud-sync', run: async () => ({ ok: true, secret: 'token' }), clientFile: path.join(here, '../plugins/cloud-sync/client.js') });
runs.set('focus', { name: 'focus', run: async () => ({ ok: true }), clientFile: path.join(here, '../plugins/focus/client.js') });
raws.set('/plugin-api/focus/raw', { name: 'focus', handler: (req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('raw:' + req.lanTrusted); } });
let hidden = [];
const KEY = 'k-test-key';
const lan = createLanServer({ port: 0, host: '127.0.0.1', key: () => KEY, registry: () => ({ runs, raws }), exclude: () => [...DEFAULT_EXCLUDE, ...hidden] });
const port = await lan.ready;
const base = 'http://127.0.0.1:' + port;
after(() => lan.close());

const cookie = 'dsh_lan=' + sessionToken(KEY);
const post = (p, body, headers = {}) => fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', cookie, ...headers }, body: JSON.stringify(body) });

test('an unpaired device gets the pairing page and no data', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 401);
  assert.match(await page.text(), /Pairing needed/);
  assert.equal((await fetch(base + '/_lan/manifest')).status, 401);
  assert.equal((await post('/plugin-api/news-feeds', { action: 'x' }, { cookie: '' })).status, 401);
  assert.equal((await post('/plugin-api/news-feeds', { action: 'x' }, { cookie: 'dsh_lan=wrong' })).status, 401);
  assert.equal(calls.length, 0);
});

test('the right key sets a cookie and redirects; a wrong key does not', async () => {
  const bad = await fetch(base + '/?k=nope', { redirect: 'manual' });
  assert.equal(bad.status, 401);
  assert.equal(bad.headers.get('set-cookie'), null);
  const ok = await fetch(base + '/?k=' + KEY, { redirect: 'manual' });
  assert.equal(ok.status, 302);
  assert.equal(ok.headers.get('location'), '/');
  assert.match(ok.headers.get('set-cookie'), /^dsh_lan=[\w-]+; Path=\/; HttpOnly; SameSite=Lax/);
  assert.equal(ok.headers.get('set-cookie').includes(KEY), false);
  const page = await fetch(base + '/', { headers: { cookie: ok.headers.get('set-cookie').split(';')[0] } });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /shell\.js/);
});

test('plugin calls are relayed with a lan marker, and excluded plugins are not reachable', async () => {
  const r = await post('/plugin-api/news-feeds', { action: 'headlines' });
  assert.deepEqual(await r.json(), { ok: true, echo: 'headlines' });
  assert.equal(calls.at(-1).via.lan, true);
  assert.equal((await post('/plugin-api/cloud-sync', { action: 'status' })).status, 404);
  assert.equal((await fetch(base + '/_lan/client/cloud-sync.js', { headers: { cookie } })).status, 404);
  const list = await (await fetch(base + '/_lan/manifest', { headers: { cookie } })).json();
  assert.deepEqual(list.plugins.map((p) => p.name), ['focus', 'news-feeds']);
});

test('hiding a plugin removes its panel, calls and raw routes at once', async () => {
  assert.equal((await fetch(base + '/plugin-api/focus/raw', { headers: { cookie } })).status, 200);
  hidden = ['focus'];
  assert.equal((await fetch(base + '/plugin-api/focus/raw', { headers: { cookie } })).status, 404);
  assert.equal((await post('/plugin-api/focus', { action: 'status' })).status, 404);
  const list = await (await fetch(base + '/_lan/manifest', { headers: { cookie } })).json();
  assert.deepEqual(list.plugins.map((p) => p.name), ['news-feeds']);
  hidden = [];
});

test('raw handlers are marked trusted; cross-origin posts and non-JSON posts are refused', async () => {
  assert.equal(await (await fetch(base + '/plugin-api/focus/raw', { headers: { cookie } })).text(), 'raw:true');
  assert.equal((await post('/plugin-api/news-feeds', { action: 'x' }, { origin: 'http://evil.example' })).status, 403);
  assert.equal((await post('/plugin-api/news-feeds', { action: 'x' }, { origin: base })).status, 200);
  const form = await fetch(base + '/plugin-api/news-feeds', { method: 'POST', headers: { 'content-type': 'text/plain', cookie }, body: '{}' });
  assert.equal(form.status, 415);
  assert.equal((await fetch(base + '/plugin-api/news-feeds', { headers: { cookie } })).status, 405);
});

test('repeated bad credentials are rate limited', async () => {
  let last = 0;
  for (let i = 0; i < 40; i++) last = (await fetch(base + '/?k=bad' + i)).status;
  assert.equal(last, 429);
});
