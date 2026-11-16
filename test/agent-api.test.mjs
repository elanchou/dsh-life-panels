import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const home = await fs.mkdtemp(path.join(os.tmpdir(), 'agent-api-'));
process.env.DSH_HOME = home;
const { createAgentServer, hashToken, newToken } = await import('../plugins/agent-api/server.js');
const { lanRegistry } = await import('../plugins/notes/common.js');
const notes = await import('../plugins/notes/index.js');
notes.apply({ effect: (f) => f(), tools: { register() {} }, webServer: { register() {} }, connection: { requestRejection: () => null } });

const rw = newToken(); const ro = newToken();
const tokens = [{ id: 'w', name: 'muse', scope: 'write', hash: hashToken(rw) }, { id: 'r', name: 'reader', scope: 'read', hash: hashToken(ro) }];
const calls = [];
const tools = () => { const m = new Map(lanRegistry().tools); m.set('cloud_sync', { name: 'cloud_sync', parameters: { properties: { action: { enum: ['status'] } } }, run: async () => ({ ok: true, secret: 1 }) }); return m; };
const srv = createAgentServer({ port: 0, tokens: () => tokens, tools, onCall: (e) => calls.push(e) });
const base = 'http://127.0.0.1:' + (await srv.ready);
after(async () => { await srv.close(); await fs.rm(home, { recursive: true, force: true }); });

const rpc = async (token, body, extra = '') => {
  const r = await fetch(base + '/mcp' + extra, { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify(body) });
  return { status: r.status, body: r.status === 202 ? null : await r.json() };
};

test('MCP handshake, tool listing and calls go to the plugin operation', async () => {
  assert.equal((await rpc(null, { jsonrpc: '2.0', id: 1, method: 'initialize', params: {} })).status, 401);
  const init = await rpc(rw, { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  assert.equal(init.body.result.protocolVersion, '2025-06-18');
  assert.equal(init.body.result.serverInfo.name, 'elans-stack');
  assert.equal((await rpc(rw, { jsonrpc: '2.0', method: 'notifications/initialized' })).status, 202);
  const list = await rpc(rw, { jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const names = list.body.result.tools.map((t) => t.name);
  assert.ok(names.includes('notes'));
  assert.ok(!names.includes('cloud_sync'), 'credential tools are never listed');
  const add = await rpc(rw, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'notes', arguments: { action: 'add', body: 'from muse #agent\n- [ ] one' } } });
  assert.equal(add.body.result.isError, false);
  assert.equal(add.body.result.structuredContent.note.tags[0], 'agent');
  const bad = await rpc(rw, { jsonrpc: '2.0', id: 4, method: 'tools/call', params: { name: 'cloud_sync', arguments: { action: 'status' } } });
  assert.equal(bad.body.result.isError, true);
  assert.equal((await rpc(rw, { jsonrpc: '2.0', id: 5, method: 'nope' })).body.error.code, -32601);
});

test('a read-only token sees reading actions only and cannot write', async () => {
  const list = await rpc(ro, { jsonrpc: '2.0', id: 1, method: 'tools/list' });
  const n = list.body.result.tools.find((t) => t.name === 'notes');
  assert.deepEqual(n.inputSchema.properties.action.enum, ['list', 'get']);
  const w = await rpc(ro, { jsonrpc: '2.0', id: 2, method: 'tools/call', params: { name: 'notes', arguments: { action: 'add', body: 'x' } } });
  assert.equal(w.body.result.isError, true);
  assert.match(w.body.result.content[0].text, /read-only/);
  const r = await rpc(ro, { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'notes', arguments: { action: 'list' } } });
  assert.equal(r.body.result.structuredContent.total, 1);
});

test('plain HTTP and token-in-URL work; wrong tokens are counted and rate limited', async () => {
  const t = await (await fetch(base + '/v1/tools', { headers: { authorization: 'Bearer ' + rw } })).json();
  assert.ok(t.tools.length >= 1);
  const r = await fetch(base + '/v1/tools/notes', { method: 'POST', headers: { authorization: 'Bearer ' + rw, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'list' }) });
  assert.equal(r.status, 200);
  assert.equal((await fetch(base + '/v1/tools/notes', { method: 'POST', headers: { authorization: 'Bearer ' + ro, 'content-type': 'application/json' }, body: JSON.stringify({ action: 'delete', id: 'x' }) })).status, 403);
  const viaUrl = await rpc(null, { jsonrpc: '2.0', id: 1, method: 'tools/list' }, '/' + rw);
  assert.equal(viaUrl.status, 200);
  assert.ok(calls.some((c) => c.token === 'w' && c.tool === 'notes' && c.ok));
  let last = 0;
  for (let i = 0; i < 25; i++) last = (await fetch(base + '/v1/tools', { headers: { authorization: 'Bearer dsh_wrong' + i } })).status;
  assert.equal(last, 429);
});
