import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const home = await fs.mkdtemp(path.join(os.tmpdir(), 'elans-stack-'));
process.env.DSH_HOME = home;
after(() => fs.rm(home, { recursive: true, force: true }));
const mod = await import('../plugins/elans-stack/index.js');
let route;
mod.apply({ effect: (f) => f(), tools: { register() {} }, webServer: { register: (d) => { route = d; } }, connection: { requestRejection: () => null } });
const call = (body) => new Promise((resolve) => {
  const req = { method: 'POST', headers: {}, async *[Symbol.asyncIterator]() { yield JSON.stringify(body); } };
  route.handler(req, { writeHead() {}, end: (t) => resolve(JSON.parse(t)) });
});

test('feature switches store a clean list and protect the overview and features tabs', async () => {
  assert.deepEqual((await call({ action: 'settings' })).disabled, []);
  const r = await call({ action: 'set_disabled', disabled: ['market', 'card:weather', 'market', 'bad id!', 7] });
  assert.deepEqual(r.disabled, ['market', 'card:weather', '7']);
  assert.equal((await call({ action: 'set_disabled', disabled: ['elans-features'] })).ok, false);
  assert.equal((await call({ action: 'set_disabled', disabled: 'market' })).ok, false);
  assert.deepEqual((await call({ action: 'settings' })).disabled, ['market', 'card:weather', '7']);
  const saved = JSON.parse(await fs.readFile(path.join(home, 'plugin-data', 'elans-stack.json'), 'utf8'));
  assert.deepEqual(saved.disabled, ['market', 'card:weather', '7']);
  assert.deepEqual((await call({ action: 'set_disabled', disabled: [] })).disabled, []);
});
