import http from 'node:http';
import os from 'node:os';
import { promises as fs } from 'node:fs';
import { randomBytes, createHmac, timingSafeEqual } from 'node:crypto';

/**
 * LAN host: serves the life-panels to another device (an iPad) on the local network.
 *
 *   iPad --HTTP + pairing key--> this server --> the same Host-side `run` each plugin registers for its own panel
 *
 * Every plugin records its UI operation in the shared registry (see lanExpose in common.js). This server serves a
 * small shell page that loads each plugin's own client.js, and relays the panels' POST calls to those operations.
 * Requests are authenticated by a pairing key (first visit via ?k=, then a cookie derived from the key).
 */

export const newKey = () => randomBytes(16).toString('base64url');
const COOKIE = 'dsh_lan';

/** Not exposed to the LAN: the sync token store, the internal iCafe workflow, and this plugin's own settings. */
export const DEFAULT_EXCLUDE = ['cloud-sync', 'icafe-workflow', 'lan-host'];

export function lanAddresses() {
  const out = [];
  for (const [name, list] of Object.entries(os.networkInterfaces())) {
    for (const a of list || []) {
      if ((a.family !== 'IPv4' && a.family !== 4) || a.internal || /^169\.254\./.test(a.address)) continue;
      const priv = /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(a.address);
      out.push({ name, address: a.address, rank: (priv ? 0 : 2) + (/^(en|eth|wlan|wl)/.test(name) ? 0 : 1) });
    }
  }
  return out.sort((a, b) => a.rank - b.rank).map(({ name, address }) => ({ name, address }));
}

function sameSecret(a, b) {
  const x = Buffer.from(String(a || ''));
  const y = Buffer.from(String(b || ''));
  return x.length === y.length && x.length > 0 && timingSafeEqual(x, y);
}
/** The cookie value: derived from the key, so it survives restarts and dies when the key is rotated. */
export const sessionToken = (key) => createHmac('sha256', String(key)).update('dsh-life-panels-lan-session').digest('base64url');

function cookieOf(req, name) {
  for (const part of String(req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

const WEB = (file) => new URL('./web/' + file, import.meta.url);
const VENDOR = {
  '/_lan/react.js': new URL('./vendor/react.production.min.js', import.meta.url),
  '/_lan/react-dom.js': new URL('./vendor/react-dom.production.min.js', import.meta.url),
};
const LOCKED = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light dark"><title>DSH</title>
<style>body{font:16px/1.6 -apple-system,system-ui,sans-serif;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px;text-align:center}main{max-width:380px}h1{font-size:20px}p{color:#888}</style></head>
<body><main><h1>需要配对 · Pairing needed</h1><p>在电脑的 DSH 里打开「局域网」面板，用 iPad 扫描二维码。<br>Open the LAN panel in DSH on the computer and scan the QR code with this device.</p></main></body></html>`;

async function readJsonBody(req, limit = 256 * 1024) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > limit) throw Object.assign(new Error('request too large'), { status: 413 });
  }
  try { return raw ? JSON.parse(raw) : {}; } catch { throw Object.assign(new Error('invalid JSON'), { status: 400 }); }
}

/**
 * @param {object} o
 * @param {number} o.port
 * @param {string} [o.host]
 * @param {() => string} o.key
 * @param {() => { runs: Map, raws: Map }} o.registry
 * @param {() => Set<string>|string[]} [o.exclude]
 */
export function createLanServer({ port, host = '0.0.0.0', key, registry, exclude = () => DEFAULT_EXCLUDE }) {
  const hits = new Map(); // ip -> { n, at } failed credentials
  const seen = new Map(); // ip -> last authenticated request
  const excluded = (name) => new Set(exclude()).has(name);

  const send = (res, status, body, type = 'application/json; charset=utf-8', extra = {}) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', ...extra });
    res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
  };
  const sendFile = async (res, url, type, cache) => {
    try {
      const body = await fs.readFile(url);
      res.writeHead(200, { 'content-type': type, 'cache-control': cache, 'x-content-type-options': 'nosniff' });
      res.end(body);
    } catch { send(res, 404, { ok: false, error: 'not found' }); }
  };

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url || '/', 'http://x');
    const ip = req.socket.remoteAddress || '';
    const path = url.pathname;
    const reg = registry();
    try {
      // Public: shell assets contain no data.
      if (req.method === 'GET' && VENDOR[path]) return sendFile(res, VENDOR[path], 'text/javascript; charset=utf-8', 'public, max-age=86400');
      if (req.method === 'GET' && path === '/_lan/shell.js') return sendFile(res, WEB('shell.js'), 'text/javascript; charset=utf-8', 'no-cache');
      if (req.method === 'GET' && path === '/_lan/shell.css') return sendFile(res, WEB('shell.css'), 'text/css; charset=utf-8', 'no-cache');

      // Authentication: the cookie, or (on the entry page only) the key in the URL.
      const secret = key();
      const failed = () => { const h = hits.get(ip) || { n: 0, at: Date.now() }; if (Date.now() - h.at > 60000) { h.n = 0; h.at = Date.now(); } h.n += 1; hits.set(ip, h); };
      const blocked = () => { const h = hits.get(ip); return !!h && h.n > 30 && Date.now() - h.at < 60000; };
      if (blocked()) return send(res, 429, { ok: false, error: 'too many attempts' });
      const cookie = cookieOf(req, COOKIE);
      const viaKey = req.method === 'GET' && path === '/' && url.searchParams.has('k');
      if (viaKey) {
        if (sameSecret(url.searchParams.get('k'), secret)) {
          res.writeHead(302, {
            location: '/', 'cache-control': 'no-store', 'referrer-policy': 'no-referrer',
            'set-cookie': COOKIE + '=' + sessionToken(secret) + '; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000',
          });
          return res.end();
        }
        failed();
        return send(res, 401, LOCKED, 'text/html; charset=utf-8');
      }
      const authed = sameSecret(cookie, sessionToken(secret));
      if (cookie && !authed) failed();
      if (!authed) {
        if (req.method === 'GET' && path === '/') return send(res, 401, LOCKED, 'text/html; charset=utf-8');
        return send(res, 401, { ok: false, error: 'pairing needed' });
      }
      seen.set(ip, Date.now());

      if (req.method === 'GET' && path === '/') {
        try {
          res.writeHead(200, {
            'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store', 'x-content-type-options': 'nosniff',
            'x-frame-options': 'DENY', 'referrer-policy': 'same-origin',
          });
          return res.end(await fs.readFile(WEB('shell.html')));
        } catch { return send(res, 500, { ok: false, error: 'shell page missing' }); }
      }
      if (req.method === 'GET' && path === '/manifest.webmanifest') {
        return send(res, 200, {
          name: 'DSH Life Panels', short_name: 'DSH', start_url: '/?k=' + encodeURIComponent(secret), scope: '/', display: 'standalone',
          background_color: '#151517', theme_color: '#151517',
        }, 'application/manifest+json');
      }
      if (req.method === 'GET' && path === '/_lan/manifest') {
        const plugins = [];
        for (const e of reg.runs.values()) {
          if (excluded(e.name)) continue;
          try { const st = await fs.stat(e.clientFile); plugins.push({ name: e.name, src: '/_lan/client/' + e.name + '.js?v=' + Math.round(st.mtimeMs) }); } catch { /* no client half */ }
        }
        plugins.sort((a, b) => a.name.localeCompare(b.name));
        return send(res, 200, { ok: true, plugins });
      }
      const clientMatch = req.method === 'GET' && /^\/_lan\/client\/([\w-]+)\.js$/.exec(path);
      if (clientMatch) {
        const e = reg.runs.get(clientMatch[1]);
        if (!e || excluded(e.name)) return send(res, 404, { ok: false, error: 'not found' });
        return sendFile(res, e.clientFile, 'text/javascript; charset=utf-8', 'no-cache');
      }
      const apiMatch = /^\/plugin-api\/([\w-]+)$/.exec(path);
      if (apiMatch) {
        if (req.method !== 'POST') return send(res, 405, { ok: false, error: 'POST only' });
        const e = reg.runs.get(apiMatch[1]);
        if (!e || excluded(e.name)) return send(res, 404, { ok: false, error: 'not found' });
        const origin = req.headers.origin;
        if (origin) { let ok = false; try { ok = new URL(origin).host === req.headers.host; } catch { /* bad origin */ } if (!ok) return send(res, 403, { ok: false, error: 'cross-origin request refused' }); }
        if (!/json/i.test(String(req.headers['content-type'] || ''))) return send(res, 415, { ok: false, error: 'JSON only' });
        const input = await readJsonBody(req);
        return send(res, 200, await e.run(input, undefined, { lan: true, ip }));
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        const raw = reg.raws.get(path);
        if (raw && !excluded(raw.name)) { req.lanTrusted = true; return await raw.handler(req, res); }
      }
      send(res, 404, { ok: false, error: 'not found' });
    } catch (error) {
      if (res.headersSent) { res.destroy(); return; }
      send(res, error.status || 500, { ok: false, error: error && error.message ? error.message : String(error) });
    }
  });
  server.headersTimeout = 10000;
  server.requestTimeout = 0; // streams stay open
  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => { server.off('error', reject); resolve(server.address().port); });
  });
  return {
    server, ready,
    devices: () => { const now = Date.now(); let n = 0; for (const [ip, at] of seen) { if (now - at < 120000) n++; else seen.delete(ip); } return n; },
    close: () => new Promise((r) => { server.close(() => r()); server.closeAllConnections && server.closeAllConnections(); }),
  };
}
