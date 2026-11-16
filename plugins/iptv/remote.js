import http from 'node:http';
import os from 'node:os';
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { REMOTE_HTML } from './remote-page.js';

/**
 * LAN remote control for the TV panel.
 *
 * Phone  --HTTP (LAN, pairing key)-->  this server  --SSE (same-origin, Harness login)-->  the TV page in the browser
 * Phone  <--SSE now-playing state--    this server  <--POST remote_state--                  the TV page
 *
 * The LAN server never proxies streams or exposes playlists' proxy settings; it only relays remote commands and
 * channel lists, and every API call needs the pairing key that the panel shows as a QR code.
 */

export const newKey = () => randomBytes(16).toString('base64url');

function sameKey(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}

/** Non-internal IPv4 addresses, private LAN ranges first. */
export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) continue;
      if (/^169\.254\./.test(a.address)) continue;
      const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      out.push({ name, address: a.address, rank: (priv ? 0 : 2) + (/^(en|eth|wlan|wl)/.test(name) ? 0 : 1) });
    }
  }
  return out.sort((a, b) => a.rank - b.rank).map(({ name, address }) => ({ name, address }));
}

/** Server-sent events hub: a set of open responses that receive JSON messages. */
export class Hub {
  constructor() { this.clients = new Map(); this.seq = 0; }
  add(res, info = {}) {
    const id = String(++this.seq);
    res.writeHead(200, {
      'content-type': 'text/event-stream; charset=utf-8', 'cache-control': 'no-store, no-transform',
      connection: 'keep-alive', 'x-accel-buffering': 'no',
    });
    res.write('retry: 2000\n\n');
    const ping = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closed */ } }, 20000);
    const client = { id, res, ping, at: Date.now(), ...info };
    this.clients.set(id, client);
    res.on('close', () => { clearInterval(ping); this.clients.delete(id); if (this.onChange) this.onChange(); });
    if (this.onChange) this.onChange();
    return client;
  }
  send(client, event, data) {
    try { client.res.write('event: ' + event + '\ndata: ' + JSON.stringify(data) + '\n\n'); } catch { /* closed */ }
  }
  broadcast(event, data) { for (const c of this.clients.values()) this.send(c, event, data); }
  get size() { return this.clients.size; }
  closeAll() { for (const c of this.clients.values()) { clearInterval(c.ping); try { c.res.end(); } catch { /* closed */ } } this.clients.clear(); }
}

async function readJson(req, limit = 16 * 1024) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw Object.assign(new Error('request too large'), { status: 413 });
  }
  return raw ? JSON.parse(raw) : {};
}

/**
 * Start the LAN server. `api` supplies: state() -> now-playing snapshot, command(cmd) -> result,
 * channels(query) -> channel list, favorite(input) -> result. Resolves { server, close } once listening.
 */
export function startRemoteServer({ port, host = '0.0.0.0', key, api, phones }) {
  const send = (res, status, body, type = 'application/json; charset=utf-8') => {
    res.writeHead(status, {
      'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
      'referrer-policy': 'no-referrer',
    });
    res.end(typeof body === 'string' ? body : JSON.stringify(body));
  };
  const hits = new Map(); // ip -> { n, at } for a small rate limit on failed keys
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    const ip = req.socket.remoteAddress || '';
    const authed = () => {
      const given = req.headers['x-remote-key'] || url.searchParams.get('k');
      if (sameKey(given, key())) return true;
      const h = hits.get(ip) || { n: 0, at: Date.now() };
      if (Date.now() - h.at > 60000) { h.n = 0; h.at = Date.now(); }
      h.n += 1; hits.set(ip, h);
      return false;
    };
    const limited = () => { const h = hits.get(ip); return h && h.n > 30 && Date.now() - h.at < 60000; };
    try {
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        res.writeHead(200, {
          'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
          'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY',
          'content-security-policy': "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src https: http: data:; connect-src 'self'; manifest-src 'self'; base-uri 'none'; form-action 'none'",
        });
        res.end(REMOTE_HTML);
        return;
      }
      if (req.method === 'GET' && url.pathname === '/manifest.webmanifest') {
        return send(res, 200, { name: 'TV Remote', short_name: 'Remote', display: 'standalone', background_color: '#0b0c10', theme_color: '#0b0c10', start_url: '/' }, 'application/manifest+json');
      }
      if (limited()) return send(res, 429, { ok: false, error: 'too many attempts' });
      if (!authed()) return send(res, 401, { ok: false, error: 'pairing key missing or wrong; scan the QR code in the TV panel again' });
      if (req.method === 'GET' && url.pathname === '/events') {
        const client = phones.add(res, { ip });
        phones.send(client, 'state', api.state());
        return;
      }
      if (req.method === 'GET' && url.pathname === '/channels') {
        const p = url.searchParams;
        return send(res, 200, await api.channels({
          query: p.get('q') || undefined, group: p.get('group') || undefined, favorites: p.get('fav') === '1',
          offset: Number(p.get('offset')) || 0, limit: Math.min(Number(p.get('limit')) || 200, 500),
        }));
      }
      if (req.method === 'POST' && url.pathname === '/cmd') return send(res, 200, await api.command(await readJson(req)));
      if (req.method === 'POST' && url.pathname === '/favorite') return send(res, 200, await api.favorite(await readJson(req)));
      send(res, 404, { ok: false, error: 'not found' });
    } catch (error) {
      send(res, error.status || 500, { ok: false, error: error && error.message ? error.message : String(error) });
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 0; // SSE responses stay open
  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(server.address().port); });
  });
  return { server, ready, close: () => new Promise((r) => { phones.closeAll(); server.close(() => r()); server.closeAllConnections && server.closeAllConnections(); }) };
}
