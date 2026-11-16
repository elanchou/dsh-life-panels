import http from 'node:http';
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { toolAllowed, publicTool, checkCall } from './policy.js';

export { EXCLUDED_TOOLS, EXCLUDED_ACTIONS, READ_ACTIONS, allowedActions, toolAllowed, publicTool, checkCall } from './policy.js';

/**
 * Agent API: the same tools the DSH agent uses, offered to agents outside DSH.
 *
 *   MCP (Streamable HTTP, JSON responses)   POST /mcp            Authorization: Bearer <token>
 *                                           POST /mcp/<token>    for clients that only take a URL
 *   Plain HTTP                              GET  /v1/tools                 list tools
 *                                           POST /v1/tools/<name>          body: the tool arguments
 *                                           GET  /v1/health                no auth
 *
 * Every call goes to the plugin's own operation, so the data, validation and file locking are exactly those of
 * the panels. Tokens are stored as SHA-256 hashes; a read-only token sees and runs only reading actions.
 */

export const PROTOCOL_VERSIONS = ['2025-06-18', '2025-03-26', '2024-11-05'];
export const newToken = () => 'dsh_' + randomBytes(24).toString('base64url');
export const hashToken = (t) => createHash('sha256').update(String(t)).digest('hex');

function bearer(req) {
  const h = String(req.headers.authorization || '');
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  return m ? m[1] : '';
}
function sameHash(a, b) {
  const x = Buffer.from(a, 'hex'); const y = Buffer.from(b, 'hex');
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
async function readJson(req, limit = 256 * 1024) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw Object.assign(new Error('request too large'), { status: 413 });
  }
  if (!raw) return {};
  try { return JSON.parse(raw); } catch { throw Object.assign(new Error('invalid JSON'), { status: 400, code: -32700 }); }
}

/**
 * @param {object} o
 * @param {number} o.port
 * @param {string} [o.host]
 * @param {() => Array<{id:string,hash:string,scope:string,tools?:string[],name:string}>} o.tokens
 * @param {() => Map} o.tools  name -> { name, description, parameters, run }
 * @param {(entry) => void} [o.onCall]
 * @param {string} [o.version]
 */
export function createAgentServer({ port, host = '127.0.0.1', tokens, tools, onCall = () => {}, version = '1.0.0' }) {
  const fails = new Map(); // ip -> { n, at }
  const findToken = (raw) => {
    if (!raw) return null;
    const hh = hashToken(raw);
    return tokens().find((t) => sameHash(t.hash, hh)) || null;
  };
  const send = (res, status, body, extra = {}) => {
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
    res.end(body === undefined ? '' : JSON.stringify(body));
  };
  const visible = (token) => [...tools().values()].filter((t) => toolAllowed(t, token)).sort((a, b) => a.name.localeCompare(b.name));

  async function invoke(token, name, args, client) {
    const tool = tools().get(name);
    const denied = checkCall(tool, token, args);
    const started = Date.now();
    if (denied) { onCall({ at: new Date().toISOString(), token: token.id, client, tool: name, action: args && args.action, ok: false, error: denied, ms: 0 }); return { ok: false, error: denied }; }
    let result;
    try { result = await tool.run(args || {}, undefined, { external: true, client }); }
    catch (e) { result = { ok: false, error: e && e.message ? e.message : String(e) }; }
    if (!result || typeof result !== 'object') result = { ok: false, error: 'tool returned nothing' };
    onCall({ at: new Date().toISOString(), token: token.id, client, tool: name, action: args && args.action, ok: result.ok !== false, error: result.ok === false ? String(result.error || '') : null, ms: Date.now() - started });
    return result;
  }

  async function mcp(req, res, token) {
    if (req.method === 'GET') return send(res, 405, { error: 'This server does not open an SSE stream; POST JSON-RPC requests instead.' }, { allow: 'POST' });
    if (req.method === 'DELETE') return send(res, 200, {});
    if (req.method !== 'POST') return send(res, 405, { error: 'POST only' }, { allow: 'POST' });
    let msg;
    try { msg = await readJson(req); } catch (e) { return send(res, 400, { jsonrpc: '2.0', id: null, error: { code: e.code || -32600, message: e.message } }); }
    const batch = Array.isArray(msg);
    const list = batch ? msg : [msg];
    const client = String(req.headers['user-agent'] || 'mcp').slice(0, 60);
    const out = [];
    for (const m of list) {
      if (!m || m.jsonrpc !== '2.0' || typeof m.method !== 'string') { out.push({ jsonrpc: '2.0', id: m && m.id !== undefined ? m.id : null, error: { code: -32600, message: 'Invalid request' } }); continue; }
      const isNote = m.id === undefined || m.id === null;
      const reply = (result) => { if (!isNote) out.push({ jsonrpc: '2.0', id: m.id, result }); };
      const fail = (code, message) => { if (!isNote) out.push({ jsonrpc: '2.0', id: m.id, error: { code, message } }); };
      const p = m.params || {};
      if (m.method === 'initialize') {
        const asked = String(p.protocolVersion || '');
        reply({
          protocolVersion: PROTOCOL_VERSIONS.includes(asked) ? asked : PROTOCOL_VERSIONS[0],
          capabilities: { tools: { listChanged: false } },
          serverInfo: { name: 'elans-stack', title: 'ElansStack (DSH life panels)', version },
          instructions: 'Tools for Elan\'s calendar, notes, reading list, trips, vocabulary, focus timer, market watchlist, news, podcasts, YouTube and TV. Start with dashboard_today for an overview. Dates are YYYY-MM-DD in Asia/Shanghai.',
        });
      } else if (m.method === 'ping') reply({});
      else if (m.method.startsWith('notifications/')) { /* nothing to do */ }
      else if (m.method === 'tools/list') reply({ tools: visible(token).map((t) => publicTool(t, token)) });
      else if (m.method === 'tools/call') {
        const result = await invoke(token, String(p.name || ''), p.arguments || {}, client);
        const failed = result.ok === false;
        reply({ content: [{ type: 'text', text: JSON.stringify(failed ? { error: result.error } : result, null, 1) }], structuredContent: failed ? undefined : result, isError: failed });
      } else if (m.method === 'resources/list') reply({ resources: [] });
      else if (m.method === 'prompts/list') reply({ prompts: [] });
      else fail(-32601, 'Method not found: ' + m.method);
    }
    if (!out.length) { res.writeHead(202, { 'cache-control': 'no-store' }); return res.end(); }
    return send(res, 200, batch ? out : out[0]);
  }

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    const ip = String(req.headers['cf-connecting-ip'] || req.socket.remoteAddress || '');
    try {
      if (url.pathname === '/v1/health' || url.pathname === '/') return send(res, 200, { ok: true, name: 'elans-stack', mcp: '/mcp', tools: '/v1/tools' });
      const f = fails.get(ip);
      if (f && f.n >= 20 && Date.now() - f.at < 10 * 60 * 1000) return send(res, 429, { error: 'too many failed attempts; try again later' });
      let raw = bearer(req);
      let path = url.pathname;
      const inPath = /^\/mcp\/(dsh_[\w-]{20,})$/.exec(path);
      if (inPath) { raw = inPath[1]; path = '/mcp'; }
      const token = findToken(raw);
      if (!token) {
        const g = fails.get(ip) || { n: 0, at: Date.now() };
        if (Date.now() - g.at > 10 * 60 * 1000) { g.n = 0; g.at = Date.now(); }
        g.n += 1; fails.set(ip, g);
        return send(res, 401, { error: 'missing or unknown token' }, { 'www-authenticate': 'Bearer' });
      }
      if (path === '/mcp') return await mcp(req, res, token);
      if (req.method === 'GET' && path === '/v1/tools') return send(res, 200, { tools: visible(token).map((t) => publicTool(t, token)) });
      const m = /^\/v1\/tools\/([\w-]+)$/.exec(path);
      if (m) {
        if (req.method !== 'POST') return send(res, 405, { error: 'POST only' }, { allow: 'POST' });
        const args = await readJson(req);
        const result = await invoke(token, m[1], args, String(req.headers['user-agent'] || 'http').slice(0, 60));
        const status = result.ok === false ? (/Unknown tool/.test(String(result.error)) ? 404 : /not available/.test(String(result.error)) ? 403 : 400) : 200;
        return send(res, status, result);
      }
      return send(res, 404, { error: 'not found' });
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      send(res, error.status || 500, { error: error && error.message ? error.message : String(error) });
    }
  });
  server.headersTimeout = 15000;
  server.requestTimeout = 120000;
  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(server.address().port); });
  });
  return { server, ready, close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections && server.closeAllConnections(); }) };
}
