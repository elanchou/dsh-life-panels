import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { Store, dataFile, registerRoute, registerTool, errorText, clip, uid, lanRegistry, localToday } from './common.js';
import { createAgentServer, newToken, hashToken, toolAllowed, publicTool, EXCLUDED_TOOLS } from './server.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/agent-api';
const DEFAULT_PORT = 8780;
const MAX_TOKENS = 20;
const MAX_LOG = 200;
const CLOUDFLARED = ['/opt/homebrew/bin/cloudflared', '/usr/local/bin/cloudflared', '/usr/bin/cloudflared'];

/** Call another plugin's own operation in-process; null when it is not installed. */
async function callPlugin(name, input) {
  const e = lanRegistry().runs.get(name);
  if (!e) return null;
  try { const r = await e.run(input, undefined, { external: true }); return r && r.ok !== false ? r : null; } catch { return null; }
}

/** One compact snapshot across the panels, so an agent can start from a single call. */
async function today() {
  const day = localToday();
  const [cal, focus, vocab, trips, market, news, tube, read, notes, wx] = await Promise.all([
    callPlugin('calendar-reminders', { action: 'list', scope: 'open' }), callPlugin('focus', { action: 'status' }),
    callPlugin('vocabulary', { action: 'status' }), callPlugin('travel-planner', { action: 'list_trips' }),
    callPlugin('market', { action: 'quotes' }), callPlugin('news-feeds', { action: 'headlines', limit: 5 }),
    callPlugin('youtube', { action: 'channels' }), callPlugin('reading-list', { action: 'list', status: 'unread' }),
    callPlugin('notes', { action: 'list', limit: 5 }), callPlugin('elans-stack', { action: 'weather' }),
  ]);
  const out = { ok: true, date: day };
  if (cal) {
    const items = cal.items || [];
    out.reminders = {
      overdue: items.filter((i) => i.date && i.date < day).map((i) => ({ id: i.id, title: i.title, date: i.date })),
      today: items.filter((i) => i.date === day).map((i) => ({ id: i.id, title: i.title, time: i.time })),
      upcoming: items.filter((i) => i.date && i.date > day).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 5).map((i) => ({ id: i.id, title: i.title, date: i.date })),
      undated: items.filter((i) => !i.date).length,
    };
  }
  if (focus) out.focus = { today: focus.stats.today, streak: focus.stats.streak, timer: focus.timer ? { phase: focus.timer.phase, state: focus.timer.state, task: focus.timer.task } : null };
  if (vocab) out.vocabulary = { due: vocab.due, newRemaining: vocab.newRemaining, streak: vocab.streak, book: vocab.settings && vocab.settings.book };
  if (trips) {
    const list = trips.trips || [];
    const active = list.find((x) => x.startDate <= day && x.endDate >= day);
    const next = list.filter((x) => x.startDate > day).sort((a, b) => a.startDate.localeCompare(b.startDate))[0];
    out.trip = active ? { status: 'on', id: active.id, name: active.name, destination: active.destination, endDate: active.endDate }
      : next ? { status: 'upcoming', id: next.id, name: next.name, destination: next.destination, startDate: next.startDate } : null;
  }
  if (market) {
    out.market = {
      indices: market.indices.filter((i) => i.quote).map((i) => ({ name: i.name, price: i.quote.price, pct: i.quote.pct })),
      watchlist: market.items.map((i) => ({ key: i.key, name: i.name, price: i.quote && i.quote.price, pct: i.quote && i.quote.pct, profit: i.position && i.position.profit })),
    };
  }
  if (news) out.headlines = (news.items || []).map((n) => ({ title: n.title, source: n.source, link: n.link, publishedAt: n.publishedAt }));
  if (tube) out.youtube = { newVideos: (tube.channels || []).reduce((a, c) => a + (c.newCount || 0), 0) };
  if (read) out.readingList = { unread: (read.counts || {}).unread || 0 };
  if (notes) out.notes = { total: notes.total, recent: (notes.items || []).map((n) => ({ id: n.id, title: n.title || clip(n.body.split('\n')[0], 60), tasks: n.tasks, pinned: n.pinned })) };
  if (wx && wx.weather) out.weather = { city: wx.city, now: wx.weather.now, days: wx.weather.days };
  return out;
}

const TODAY_TOOL = {
  name: 'dashboard_today',
  description: 'One-call overview of Elan\'s day across the panels: overdue, today\'s and upcoming reminders, focus progress, vocabulary due, current or next trip, market indices and watchlist, latest headlines, new YouTube videos, unread reading list, recent notes and weather. Sections for panels that are not installed are omitted. Start here, then use the specific tools to change things.',
  parameters: { type: 'object', properties: { action: { type: 'string', enum: ['get'], description: 'Always get.' } }, required: ['action'], additionalProperties: false },
};

export function apply(ctx) {
  // Per machine and holds token hashes, so it is never part of cloud-sync's file list.
  const store = new Store(dataFile('agent-api-local'), () => ({ version: 1, enabled: false, port: DEFAULT_PORT, tokens: [], tunnel: false }));
  const callLog = [];
  let server = null;
  let lastError = null;
  let tunnel = null; // { proc, url, error, startedAt }

  const cfg = () => ({ enabled: false, port: DEFAULT_PORT, tokens: [], tunnel: false, ...(store.data || {}) });
  const tools = () => {
    const m = new Map(lanRegistry().tools);
    m.set(TODAY_TOOL.name, { ...TODAY_TOOL, run: () => today(), plugin: 'agent-api' });
    return m;
  };

  async function stop() { const s = server; server = null; if (s) await s.close(); }
  async function start() {
    await stop();
    const c = cfg();
    if (!c.enabled) return;
    for (let i = 0; i < 10; i++) {
      const srv = createAgentServer({
        port: (Number(c.port) || DEFAULT_PORT) + i, host: '127.0.0.1', tokens: () => cfg().tokens, tools,
        onCall: (e) => { callLog.unshift(e); callLog.length = Math.min(callLog.length, MAX_LOG); touch(e.token); },
      });
      try { server = { close: srv.close, port: await srv.ready }; lastError = null; break; }
      catch (e) { lastError = errorText(e); if (!e || e.code !== 'EADDRINUSE') break; }
    }
    if (server && c.tunnel) startTunnel(); else stopTunnel();
  }
  let touchTimer = null;
  function touch(id) {
    const tk = (store.data && store.data.tokens || []).find((t) => t.id === id);
    if (!tk) return;
    tk.lastUsedAt = new Date().toISOString();
    if (!touchTimer) touchTimer = setTimeout(() => { touchTimer = null; store.save().catch(() => {}); }, 5000);
  }

  /* ---- Public URL through a Cloudflare quick tunnel: no account, a new random URL on each start ---- */
  function cloudflared() { return CLOUDFLARED.find((p) => existsSync(p)) || null; }
  function stopTunnel() { if (tunnel && tunnel.proc) { try { tunnel.proc.kill(); } catch { /* gone */ } } tunnel = null; }
  function startTunnel() {
    if (tunnel && tunnel.proc && !tunnel.proc.killed && tunnel.port === server.port) return;
    stopTunnel();
    const bin = cloudflared();
    if (!bin) { tunnel = { proc: null, url: null, error: 'cloudflared is not installed (brew install cloudflared)', port: null }; return; }
    const proc = spawn(bin, ['tunnel', '--no-autoupdate', '--url', 'http://127.0.0.1:' + server.port], { stdio: ['ignore', 'pipe', 'pipe'] });
    const t = { proc, url: null, error: null, port: server.port, startedAt: new Date().toISOString() };
    tunnel = t;
    const scan = (buf) => { const m = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/.exec(String(buf)); if (m && !t.url) t.url = m[0]; };
    proc.stdout.on('data', scan); proc.stderr.on('data', scan);
    proc.on('exit', (code) => { if (tunnel === t) { t.proc = null; t.error = 'cloudflared exited (' + code + ')'; } });
  }

  function view() {
    const c = cfg();
    const local = server ? 'http://127.0.0.1:' + server.port : null;
    const pub = tunnel && tunnel.url ? tunnel.url : null;
    return {
      enabled: !!c.enabled, running: !!server, port: server ? server.port : c.port, error: lastError,
      local, mcpLocal: local ? local + '/mcp' : null,
      tunnel: { wanted: !!c.tunnel, url: pub, mcp: pub ? pub + '/mcp' : null, error: tunnel ? tunnel.error : null, available: !!cloudflared(), starting: !!(c.tunnel && tunnel && tunnel.proc && !tunnel.url) },
      tokens: (c.tokens || []).map((t) => ({ id: t.id, name: t.name, scope: t.scope, tools: t.tools || [], createdAt: t.createdAt, lastUsedAt: t.lastUsedAt || null, hint: t.hint })),
      tools: [...tools().values()].filter((t) => !EXCLUDED_TOOLS.has(t.name)).map((t) => ({ name: t.name, plugin: t.plugin, read: toolAllowed(t, { scope: 'read' }) })).sort((a, b) => a.name.localeCompare(b.name)),
      log: callLog.slice(0, 50),
    };
  }

  async function run(input, _agent, via) {
    if (via && (via.lan || via.external)) return { ok: false, error: 'not available here' };
    await store.load();
    const action = input.action || 'status';
    if (action === 'status') return { ok: true, api: view() };
    if (action === 'enable' || action === 'disable') {
      store.data.enabled = action === 'enable';
      if (input.port !== undefined) {
        const port = Math.floor(Number(input.port));
        if (!(port >= 1024 && port <= 65500)) return { ok: false, error: 'port must be between 1024 and 65500' };
        store.data.port = port;
      }
      if (input.tunnel !== undefined) store.data.tunnel = !!input.tunnel;
      await store.save();
      await start();
      if (!store.data.enabled) stopTunnel();
      const out = { ok: !lastError || action === 'disable', api: view() };
      if (lastError) out.error = lastError;
      return out;
    }
    if (action === 'tunnel') {
      store.data.tunnel = input.on !== false;
      await store.save();
      if (store.data.tunnel && server) startTunnel(); else stopTunnel();
      if (store.data.tunnel) for (let i = 0; i < 40 && tunnel && tunnel.proc && !tunnel.url; i++) await new Promise((r) => setTimeout(r, 250));
      return { ok: true, api: view() };
    }
    if (action === 'create_token') {
      const list = store.data.tokens || (store.data.tokens = []);
      if (list.length >= MAX_TOKENS) return { ok: false, error: 'Too many tokens (max ' + MAX_TOKENS + '); revoke an old one first' };
      const scope = input.scope === 'read' ? 'read' : 'write';
      const known = new Set([...tools().keys()]);
      const only = Array.isArray(input.tools) ? input.tools.map(String).filter((x) => known.has(x) && !EXCLUDED_TOOLS.has(x)) : [];
      const raw = newToken();
      const tk = { id: uid(), name: clip(String(input.name || 'agent').trim() || 'agent', 40), scope, tools: only, hash: hashToken(raw), hint: raw.slice(0, 8) + '…' + raw.slice(-4), createdAt: new Date().toISOString() };
      list.push(tk);
      await store.save();
      // The raw token is shown once; only its hash is stored.
      return { ok: true, token: raw, id: tk.id, api: view() };
    }
    if (action === 'revoke_token') {
      const list = store.data.tokens || [];
      const i = list.findIndex((t) => t.id === input.id);
      if (i < 0) return { ok: false, error: 'No such token' };
      list.splice(i, 1);
      await store.save();
      return { ok: true, api: view() };
    }
    if (action === 'preview') {
      // What a token of this scope would see; handy for checking before sharing.
      const scope = input.scope === 'read' ? 'read' : 'write';
      return { ok: true, tools: [...tools().values()].filter((t) => toolAllowed(t, { scope })).map((t) => publicTool(t, { scope })) };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  store.load().then(() => start()).catch((e) => { lastError = errorText(e); });
  ctx.effect(() => () => { stopTunnel(); stop(); if (touchTimer) clearTimeout(touchTimer); }, 'agent-api: server');
  registerRoute(ctx, ROUTE, run, 'agent-api');
  // The overview is also useful inside DSH; agent_api itself stays a DSH-only tool (EXCLUDED_TOOLS).
  registerTool(ctx, TODAY_TOOL, () => today(), 'agent-api: today');
  registerTool(ctx, {
    name: 'agent_api',
    description: 'Let agents outside DSH (Muse, Claude, ChatGPT, scripts) read and change the life-panel data through MCP or plain HTTP. Actions: status (URLs, tokens, recent external calls), enable (optional port, tunnel=true for a public https URL through a Cloudflare quick tunnel), disable, tunnel (on: start or stop the public URL), create_token (name, scope read|write, optional tools[] to limit it; the token is returned once), revoke_token (id), preview (scope: the tools a token would see). Cloud sync, LAN, iCafe and this tool are never exposed.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'enable', 'disable', 'tunnel', 'create_token', 'revoke_token', 'preview'], description: 'Operation to perform.' },
        port: { type: 'number', description: 'enable: preferred local port (default 8780).' },
        tunnel: { type: 'boolean', description: 'enable: also open the public URL.' },
        on: { type: 'boolean', description: 'tunnel: false stops the public URL.' },
        name: { type: 'string', description: 'create_token: who the token is for, e.g. muse.' },
        scope: { type: 'string', enum: ['read', 'write'], description: 'create_token/preview: read-only or read and write.' },
        tools: { type: 'array', items: { type: 'string' }, description: 'create_token: limit the token to these tool names.' },
        id: { type: 'string', description: 'revoke_token: token id from status.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'agent-api');
}
