import { promises as fs } from 'node:fs';
import { once } from 'node:events';
import { Store, dataFile, registerRoute, registerTool, errorText, uid, clip, lanRaw } from './common.js';
import { parseProxy, maskProxy, proxyRequest } from './proxy.js';
import { Hub, startRemoteServer, lanAddresses, newKey } from './remote.js';
import { qrPath } from './qr.js';
import { parsePlaylist, rewriteHls, channelId } from './m3u.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/iptv';
const PLAYLIST_TTL = 6 * 60 * 60 * 1000;
const MAX_PLAYLISTS = 30;
const MAX_FAVORITES = 2000;
const PLAYLIST_BYTES = 8 * 1024 * 1024;
const REMOTE_PORT = 8790;
const REMOTE_COMMANDS = new Set(['toggle', 'play', 'pause', 'next', 'prev', 'tune', 'number', 'volume', 'volume_up', 'volume_down', 'mute', 'stop', 'show', 'guide']);
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) DSH-IPTV/1.0';

const DEFAULT_PLAYLISTS = [
  { name: 'iptv-org · China', url: 'https://iptv-org.github.io/iptv/countries/cn.m3u', enabled: true },
  { name: 'iptv-org · Chinese', url: 'https://iptv-org.github.io/iptv/languages/zho.m3u', enabled: false },
  { name: 'iptv-org · Worldwide', url: 'https://iptv-org.github.io/iptv/index.m3u', enabled: false },
];

const isHttp = (url) => /^https?:\/\//i.test(String(url || '').trim());
const proxied = (href) => ROUTE + '/stream?u=' + encodeURIComponent(href);
const HLS_TYPE = /mpegurl/i;
const HLS_PATH = /\.m3u8?(?:$|[?#])/i;

let hlsLib = null;
async function hlsSource() {
  if (!hlsLib) hlsLib = await fs.readFile(new URL('./vendor/hls.min.js', import.meta.url));
  return hlsLib;
}

/**
 * One outbound GET, either direct (global fetch) or through the configured proxy.
 * Resolves { status, url, header(name), body } where body is an async iterable of byte chunks.
 */
async function upstream(url, { proxy, headers = {}, signal } = {}) {
  if (proxy) {
    const r = await proxyRequest(url, { proxy, headers, signal });
    return {
      status: r.status, url: r.url, body: r.body,
      header: (name) => { const v = r.headers[name.toLowerCase()]; return Array.isArray(v) ? v.join(', ') : v || ''; },
    };
  }
  const r = await fetch(url, { redirect: 'follow', headers, signal });
  return { status: r.status, url: r.url || String(url), body: r.body, header: (name) => r.headers.get(name) || '' };
}

/** Read a whole body up to maxBytes; returns { buf, truncated }. Breaking the loop cancels the rest. */
async function readBody(body, maxBytes) {
  const chunks = [];
  let size = 0;
  let truncated = false;
  if (!body) return { buf: Buffer.alloc(0), truncated };
  for await (const chunk of body) {
    const b = Buffer.from(chunk);
    size += b.length;
    chunks.push(b);
    if (size > maxBytes) { truncated = true; break; }
  }
  return { buf: Buffer.concat(chunks), truncated };
}

/** Fetch a text resource (playlist) with a total timeout. */
async function getText(url, { proxy, timeoutMs = 30000, maxBytes = PLAYLIST_BYTES } = {}) {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('only http(s) URLs are supported');
  const signal = AbortSignal.timeout(timeoutMs);
  const r = await upstream(parsed.href, { proxy, signal, headers: { 'user-agent': UA, accept: 'application/x-mpegurl, audio/mpegurl, text/plain, */*' } });
  if (r.status < 200 || r.status >= 300) { if (r.body && r.body.destroy) r.body.destroy(); throw new Error('HTTP ' + r.status); }
  const { buf } = await readBody(r.body, maxBytes);
  return { text: buf.toString('utf8'), finalUrl: r.url };
}

/**
 * GET handlers for the player: the vendored hls.js, and a same-origin stream proxy. Browsers refuse most IPTV
 * streams directly (no CORS headers, http:// from an https page), so the player fetches playlists and segments
 * through the Host, which in turn can go through the user's outbound proxy. HLS playlists are rewritten so their
 * segments come back through this route too.
 */
function registerGetRoutes(ctx, currentProxy) {
  const reject = (req, res) => {
    // The LAN host authenticates its own requests and marks them; everything else goes through the Harness fence.
    const code = req.lanTrusted === true ? null : ctx.connection.requestRejection({ headers: req.headers });
    const site = req.lanTrusted === true ? undefined : req.headers['sec-fetch-site'];
    if (code || site === 'cross-site') {
      res.writeHead(code || 403, { 'content-type': 'text/plain' });
      res.end('forbidden');
      return true;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { 'content-type': 'text/plain', allow: 'GET, HEAD' });
      res.end('GET only');
      return true;
    }
    return false;
  };

  const hlsRoute = {
    kind: 'exact',
    path: ROUTE + '/hls.js',
    async handler(req, res) {
      if (reject(req, res)) return;
      try {
        const body = await hlsSource();
        res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8', 'cache-control': 'private, max-age=86400', 'content-length': body.length });
        res.end(req.method === 'HEAD' ? undefined : body);
      } catch (error) {
        res.writeHead(500, { 'content-type': 'text/plain' });
        res.end(errorText(error));
      }
    },
  };
  ctx.effect(() => ctx.webServer.register(hlsRoute), 'iptv: hls.js');
  lanRaw(ctx, 'iptv', hlsRoute.path, hlsRoute.handler, 'iptv: hls.js');

  const streamRoute = {
    kind: 'exact',
    path: ROUTE + '/stream',
    async handler(req, res) {
      if (reject(req, res)) return;
      const fail = (status, message) => {
        if (res.headersSent) { res.destroy(); return; }
        res.writeHead(status, { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'no-store' });
        res.end(message);
      };
      let target;
      try {
        target = new URL(new URL(req.url, 'http://localhost').searchParams.get('u') || '');
        if (target.protocol !== 'http:' && target.protocol !== 'https:') throw new Error('protocol');
      } catch { return fail(400, 'invalid stream URL'); }
      const abort = new AbortController();
      res.on('close', () => abort.abort());
      let proxy = null;
      try { proxy = currentProxy(); } catch (error) { return fail(502, 'proxy setting is invalid: ' + errorText(error)); }
      const via = proxy ? ' via proxy ' + proxy.label : '';
      try {
        const headers = { 'user-agent': UA, accept: '*/*' };
        if (req.headers.range) headers.range = req.headers.range;
        // Time out waiting for response headers only; a live stream body is open-ended.
        const timer = setTimeout(() => abort.abort(), 15000);
        let up;
        try { up = await upstream(target.href, { proxy, headers, signal: abort.signal }); } finally { clearTimeout(timer); }
        if (up.status < 200 || up.status >= 300) {
          if (up.body && up.body.destroy) up.body.destroy();
          return fail(502, 'upstream HTTP ' + up.status + via);
        }
        const type = up.header('content-type');
        const looksHls = HLS_TYPE.test(type) || HLS_PATH.test(new URL(up.url || target).pathname + '?');
        if (looksHls) {
          const { buf } = await readBody(up.body, 4 * 1024 * 1024);
          const text = buf.toString('utf8');
          if (text.trimStart().startsWith('#EXTM3U')) {
            const out = rewriteHls(text, up.url || target.href, proxied);
            res.writeHead(200, { 'content-type': 'application/vnd.apple.mpegurl', 'cache-control': 'no-store' });
            res.end(req.method === 'HEAD' ? undefined : out);
            return;
          }
          if (/^\s*</.test(text)) return fail(502, 'the source returned a web page instead of a stream' + via);
          // Not a playlist after all: hand the bytes back untouched.
          res.writeHead(200, { 'content-type': type || 'application/octet-stream', 'cache-control': 'no-store' });
          res.end(buf);
          return;
        }
        const out = { 'content-type': type || 'application/octet-stream', 'cache-control': 'no-store' };
        for (const name of ['content-length', 'content-range', 'accept-ranges']) {
          const value = up.header(name);
          if (value) out[name] = value;
        }
        res.writeHead(up.status, out);
        if (req.method === 'HEAD' || !up.body) { if (up.body && up.body.destroy) up.body.destroy(); res.end(); return; }
        for await (const chunk of up.body) {
          if (!res.write(chunk)) await once(res, 'drain');
        }
        res.end();
      } catch (error) {
        if (abort.signal.aborted && res.writableEnded) return;
        const why = abort.signal.aborted && !res.destroyed ? 'timed out' : errorText(error);
        fail(502, 'could not reach the stream' + via + ': ' + why);
      }
    },
  };
  ctx.effect(() => ctx.webServer.register(streamRoute), 'iptv: stream proxy');
  lanRaw(ctx, 'iptv', streamRoute.path, streamRoute.handler, 'iptv: stream proxy');
}

export function apply(ctx) {
  const store = new Store(dataFile('iptv'), () => ({ version: 1, playlists: null, favorites: [], last: null }));
  // The proxy is per machine and may hold a password, so it lives in its own file that cloud-sync never uploads.
  const local = new Store(dataFile('iptv-local'), () => ({ version: 1, proxy: { enabled: false, url: '', playlists: true }, remote: { enabled: false, port: REMOTE_PORT, key: '' } }));
  // Cached copy of the proxy setting for the synchronous stream route; refreshed on every store load.
  let proxySetting = { enabled: false, url: '', playlists: true };
  const syncProxy = (data) => { proxySetting = { enabled: false, url: '', playlists: true, ...(data.proxy || {}) }; return proxySetting; };
  const activeProxy = (forPlaylists) => {
    const p = proxySetting;
    if (!p.enabled || !p.url) return null;
    if (forPlaylists && p.playlists === false) return null;
    return parseProxy(p.url);
  };
  local.load().then(syncProxy).catch(() => {});
  const cache = new Map(); // playlist id -> { channels, groups, fetchedAt, error, pending }

  async function playlists() {
    const data = await store.load();
    if (!Array.isArray(data.playlists)) {
      data.playlists = DEFAULT_PLAYLISTS.map((p, i) => ({ id: 'default-' + i, ...p }));
      await store.save();
    }
    return data.playlists;
  }

  async function loadPlaylist(list, force) {
    const hit = cache.get(list.id);
    if (hit && hit.pending) return hit.pending;
    if (!force && hit && hit.fetchedAt && Date.now() - hit.fetchedAt < PLAYLIST_TTL && !hit.error) return hit;
    const pending = (async () => {
      try {
        const { text, finalUrl } = await getText(list.url, { proxy: activeProxy(true) });
        if (!/#EXT/i.test(text.slice(0, 4096))) throw new Error('not an M3U playlist');
        const parsed = parsePlaylist(text, finalUrl);
        if (!parsed.channels.length) throw new Error('no channels found in the playlist');
        const entry = { ...parsed, fetchedAt: Date.now(), error: null };
        cache.set(list.id, entry);
        return entry;
      } catch (error) {
        const entry = { channels: hit ? hit.channels : [], groups: hit ? hit.groups : [], fetchedAt: Date.now(), error: errorText(error) };
        cache.set(list.id, entry);
        return entry;
      }
    })();
    cache.set(list.id, { ...(hit || { channels: [], groups: [], fetchedAt: 0, error: null }), pending });
    return pending;
  }

  const view = (c, favs) => ({ id: c.id, name: c.name, url: c.url, logo: c.logo, group: c.group, favorite: favs.has(c.id) });

  async function channels(input) {
    const data = await store.load();
    const all = await playlists();
    const favs = new Map((data.favorites || []).map((f) => [f.id, f]));
    let selected = all.filter((p) => p.enabled);
    if (input.playlist) selected = all.filter((p) => p.id === input.playlist || p.name === input.playlist);
    const results = await Promise.all(selected.map((p) => loadPlaylist(p, !!input.refresh)));
    const status = selected.map((p, i) => ({ id: p.id, name: p.name, count: results[i].channels.length, error: results[i].error }));
    let pool;
    if (input.favorites) {
      pool = [...favs.values()];
    } else {
      const seen = new Set();
      pool = [];
      for (const r of results) for (const c of r.channels) if (!seen.has(c.id)) { seen.add(c.id); pool.push(c); }
    }
    const groupCounts = new Map();
    for (const c of pool) groupCounts.set(c.group, (groupCounts.get(c.group) || 0) + 1);
    const groups = [...groupCounts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    let items = pool;
    if (input.group) items = items.filter((c) => c.group === input.group);
    if (input.query) {
      const words = String(input.query).toLowerCase().split(/\s+/).filter(Boolean);
      items = items.filter((c) => { const hay = (c.name + ' ' + c.group + ' ' + (c.tvgId || '')).toLowerCase(); return words.every((w) => hay.includes(w)); });
    }
    const limit = Math.max(1, Math.min(Number(input.limit) || 120, 500));
    const offset = Math.max(0, Number(input.offset) || 0);
    return {
      ok: true, total: items.length, offset, items: items.slice(offset, offset + limit).map((c) => view(c, favs)), proxy: proxyView(),
      groups, playlists: status, favoriteCount: favs.size, last: data.last || null,
    };
  }

  const proxyView = () => ({ enabled: !!proxySetting.enabled, url: maskProxy(proxySetting.url), playlists: proxySetting.playlists !== false });

  async function testProxy(url) {
    const proxy = parseProxy(url);
    const started = Date.now();
    const r = await upstream('https://iptv-org.github.io/iptv/countries/cn.m3u', { proxy, signal: AbortSignal.timeout(15000), headers: { 'user-agent': UA, range: 'bytes=0-1023' } });
    if (r.body && r.body.destroy) r.body.destroy();
    else if (r.body && r.body.cancel) r.body.cancel().catch(() => {});
    if (r.status >= 400) throw new Error('reached the internet through the proxy, but the test URL answered HTTP ' + r.status);
    return { ms: Date.now() - started, via: proxy.label };
  }

  /* ---------- LAN remote ---------- */
  const phones = new Hub(); // remote pages on phones listening for now-playing state
  // TV pages (Harness tabs) long-poll for commands: a small ring of recent commands, each with a sequence number.
  const cmdLog = [];
  let cmdSeq = 0;
  const waiters = new Set();
  const tvSeen = new Map(); // tab id -> last poll time
  const TV_TTL = 40000;
  const tvCount = () => { const now = Date.now(); let n = 0; for (const [id, at] of tvSeen) { if (now - at < TV_TTL) n++; else tvSeen.delete(id); } return n; };
  const tvs = { get size() { return tvCount(); } };
  let lastTvCount = 0;
  const tvTick = setInterval(() => { const n = tvCount(); if (n !== lastTvCount) { lastTvCount = n; phones.broadcast('state', publicState()); } }, 5000);
  ctx.effect(() => () => { clearInterval(tvTick); for (const w of waiters) w(); waiters.clear(); }, 'iptv: remote poll');
  function pushCommand(out) {
    cmdSeq += 1;
    cmdLog.push({ seq: cmdSeq, at: Date.now(), ...out });
    while (cmdLog.length > 50) cmdLog.shift();
    for (const w of [...waiters]) w();
  }
  async function pollCommands(input) {
    if (!remoteCfg().enabled || !remote) return { ok: true, enabled: false, seq: cmdSeq, cmds: [] };
    const tab = String(input.tab || '').slice(0, 64) || 'tab';
    const first = !tvSeen.has(tab);
    tvSeen.set(tab, Date.now());
    if (first || tvCount() !== lastTvCount) { lastTvCount = tvCount(); phones.broadcast('state', publicState()); }
    const since = Number(input.since);
    if (!Number.isFinite(since) || since < 0) return { ok: true, enabled: true, seq: cmdSeq, cmds: [] };
    const fresh = () => cmdLog.filter((c) => c.seq > since && Date.now() - c.at < 15000);
    if (!fresh().length) {
      await new Promise((resolve) => {
        const done = () => { clearTimeout(timer); waiters.delete(done); resolve(); };
        const timer = setTimeout(done, Math.max(1000, Math.min(Number(input.wait) || 25000, 28000)));
        waiters.add(done);
      });
    }
    tvSeen.set(tab, Date.now());
    return { ok: true, enabled: true, seq: cmdSeq, cmds: fresh() };
  }
  let tvState = { channel: null, state: 'idle', paused: false, muted: false, volume: 1, index: -1, panel: false, at: null };
  let remote = null; // { close, port }
  let remoteError = null;
  const remoteCfg = () => ({ enabled: false, port: REMOTE_PORT, key: '', ...((local.data && local.data.remote) || {}) });
  const publicState = () => ({ ...tvState, favorite: tvState.channel ? isFavorite(tvState.channel.id) : false, tvs: tvs.size, channel: tvState.channel ? { id: tvState.channel.id, name: tvState.channel.name, logo: tvState.channel.logo, group: tvState.channel.group } : null });

  function findChannel(id) {
    for (const entry of cache.values()) { const c = entry.channels.find((x) => x.id === id); if (c) return c; }
    const f = ((store.data && store.data.favorites) || []).find((x) => x.id === id);
    return f || null;
  }

  async function remoteCommand(input) {
    const cmd = String(input.cmd || '');
    if (!REMOTE_COMMANDS.has(cmd)) return { ok: false, error: 'unknown command' };
    if (!tvs.size) return { ok: false, error: 'TV is not open: open DeepSeek Harness on the computer', code: 'no_tv' };
    const out = { cmd };
    if (cmd === 'tune') {
      const c = findChannel(String(input.id || ''));
      if (!c) return { ok: false, error: 'unknown channel' };
      out.channel = { id: c.id, name: c.name, url: c.url, logo: c.logo, group: c.group };
    }
    if (cmd === 'number') out.n = Math.max(1, Math.min(9999, Math.floor(Number(input.n) || 0)));
    if (cmd === 'volume') out.value = Math.max(0, Math.min(1, Number(input.value) || 0));
    pushCommand(out);
    return { ok: true };
  }

  async function phoneChannels(q) {
    const r = await channels(q);
    // Phones get no stream URLs: tuning goes by channel id through the TV page.
    return { ...r, items: r.items.map(({ url, ...rest }) => rest), playlists: undefined, proxy: undefined, last: undefined };
  }

  async function phoneFavorite(x) {
    const r = await run({ action: 'favorite', id: String(x.id || ''), on: x.on === undefined ? undefined : !!x.on });
    if (r.ok) phones.broadcast('state', publicState());
    return r;
  }
  const isFavorite = (id) => !!id && ((store.data && store.data.favorites) || []).some((f) => f.id === id);

  async function stopRemote() {
    const r = remote; remote = null;
    if (r) await r.close();
  }
  async function startRemote() {
    await stopRemote();
    const cfg = remoteCfg();
    if (!cfg.enabled) return;
    let lastError = null;
    for (let i = 0; i < 10; i++) {
      const port = (Number(cfg.port) || REMOTE_PORT) + i;
      const srv = startRemoteServer({
        port, key: () => remoteCfg().key, phones,
        api: { state: publicState, command: remoteCommand, channels: phoneChannels, favorite: phoneFavorite },
      });
      try {
        const bound = await srv.ready;
        remote = { close: srv.close, port: bound };
        remoteError = null;
        return;
      } catch (error) {
        lastError = error;
        if (!error || error.code !== 'EADDRINUSE') break;
      }
    }
    remoteError = errorText(lastError);
  }
  const remoteView = () => {
    const cfg = remoteCfg();
    const addrs = lanAddresses();
    const urls = remote ? addrs.map((a) => 'http://' + a.address + ':' + remote.port + '/?k=' + encodeURIComponent(cfg.key)) : [];
    return {
      enabled: !!cfg.enabled, running: !!remote, port: remote ? remote.port : cfg.port, error: remoteError,
      addresses: addrs, urls, url: urls[0] || null, qr: urls[0] ? qrPath(urls[0]) : null,
      phones: phones.size, tvs: tvs.size,
    };
  };
  local.load().then(() => startRemote()).catch(() => {});
  ctx.effect(() => () => { stopRemote(); }, 'iptv: remote server');


  async function run(input, _agent, via) {
    const action = input.action || 'channels';
    // The phone remote and the proxy settings belong to the computer; a LAN device only watches.
    if (via && via.lan && (action.startsWith('remote') || action === 'settings' || action === 'test_proxy')) return { ok: false, error: 'not available over the LAN' };
    const data = await store.load();
    const localData = await local.load();
    syncProxy(localData);
    if (action === 'channels') return channels(input);
    const all = await playlists();
    if (action === 'playlists') return { ok: true, playlists: all.map((p) => ({ ...p, count: (cache.get(p.id) || { channels: [] }).channels.length, error: (cache.get(p.id) || {}).error || null })) };
    if (action === 'add_playlist') {
      const url = String(input.url || '').trim();
      if (!isHttp(url)) return { ok: false, error: 'url must start with http:// or https://' };
      if (all.length >= MAX_PLAYLISTS) return { ok: false, error: 'Too many playlists (max ' + MAX_PLAYLISTS + ')' };
      if (all.some((p) => p.url === url)) return { ok: false, error: 'This playlist is already added' };
      const list = { id: uid(), name: clip(String(input.name || '').trim() || new URL(url).hostname, 60), url, enabled: true };
      const entry = await loadPlaylist(list, true);
      if (entry.error) { cache.delete(list.id); return { ok: false, error: 'Could not load the playlist: ' + entry.error }; }
      const current = await playlists(); // re-read: cloud sync may have replaced the file during the fetch
      if (current.some((p) => p.url === url)) return { ok: false, error: 'This playlist is already added' };
      current.push(list);
      await store.save();
      return { ok: true, playlist: list, channels: entry.channels.length, groups: entry.groups.slice(0, 8) };
    }
    if (action === 'settings') {
      const changing = input.proxyEnabled !== undefined || input.proxyUrl !== undefined || input.proxyPlaylists !== undefined;
      if (changing) {
        const next = { ...proxySetting };
        if (input.proxyUrl !== undefined) {
          const url = String(input.proxyUrl).trim();
          // The UI sends the masked value back unchanged when only toggling; keep the stored password then.
          if (url !== maskProxy(proxySetting.url)) {
            if (url) { try { parseProxy(url); } catch (error) { return { ok: false, error: errorText(error) }; } }
            next.url = url;
          }
        }
        if (input.proxyEnabled !== undefined) next.enabled = !!input.proxyEnabled;
        if (input.proxyPlaylists !== undefined) next.playlists = !!input.proxyPlaylists;
        if (next.enabled && !next.url) return { ok: false, error: 'Set a proxy address before enabling the proxy' };
        if (input.test && next.enabled) {
          try { await testProxy(next.url); } catch (error) { return { ok: false, error: 'Proxy test failed: ' + errorText(error) }; }
        }
        localData.proxy = next;
        syncProxy(localData);
        cache.clear();
        await local.save();
      }
      return { ok: true, proxy: proxyView() };
    }
    if (action === 'test_proxy') {
      const url = input.proxyUrl !== undefined && String(input.proxyUrl).trim() !== maskProxy(proxySetting.url) ? String(input.proxyUrl).trim() : proxySetting.url;
      if (!url) return { ok: false, error: 'No proxy address to test' };
      try { const r = await testProxy(url); return { ok: true, ...r }; }
      catch (error) { return { ok: false, error: 'Proxy test failed: ' + errorText(error) }; }
    }
    if (action === 'favorite') {
      let ch = null;
      const url = String(input.url || '').trim();
      const id = String(input.id || '') || (url ? channelId(url) : '');
      if (!id) return { ok: false, error: 'id or url is required' };
      const on = input.on === undefined ? !(data.favorites || []).some((f) => f.id === id) : !!input.on;
      if (on) {
        for (const entry of cache.values()) { ch = entry.channels.find((c) => c.id === id); if (ch) break; }
        if (!ch && input.name && isHttp(url)) ch = { id, name: clip(String(input.name), 120), url, logo: '', group: String(input.group || 'Favorites'), tvgId: '' };
        if (!ch) return { ok: false, error: 'Unknown channel; open its playlist first or pass url and name' };
        if (!data.favorites.some((f) => f.id === id)) {
          if (data.favorites.length >= MAX_FAVORITES) return { ok: false, error: 'Too many favorites' };
          data.favorites.push({ id, name: ch.name, url: ch.url, logo: ch.logo, group: ch.group, tvgId: ch.tvgId || '', addedAt: new Date().toISOString() });
        }
      } else {
        data.favorites = data.favorites.filter((f) => f.id !== id);
      }
      await store.save();
      return { ok: true, id, favorite: on };
    }
    if (action === 'remote_state') {
      const st = input.state || {};
      const c = st.channel && typeof st.channel === 'object' ? st.channel : null;
      tvState = {
        channel: c ? { id: String(c.id || ''), name: clip(String(c.name || ''), 120), logo: /^https?:/i.test(String(c.logo || '')) ? String(c.logo) : '', group: clip(String(c.group || ''), 80) } : null,
        state: ['idle', 'loading', 'playing', 'error'].includes(st.state) ? st.state : 'idle',
        error: clip(String(st.error || ''), 200), paused: !!st.paused, muted: !!st.muted,
        volume: Math.max(0, Math.min(1, Number(st.volume) || 0)), index: Number.isInteger(st.index) ? st.index : -1,
        panel: !!st.panel, pip: !!st.pip, at: new Date().toISOString(),
      };
      phones.broadcast('state', publicState());
      return { ok: true };
    }
    if (action === 'remote') {
      const op = String(input.op || 'status');
      if (op === 'enable' || op === 'disable' || op === 'rotate_key') {
        const cfg = remoteCfg();
        if (op === 'enable') cfg.enabled = true;
        if (op === 'disable') cfg.enabled = false;
        if (op === 'rotate_key' || !cfg.key) cfg.key = newKey();
        if (input.port !== undefined) {
          const port = Math.floor(Number(input.port));
          if (!(port >= 1024 && port <= 65535)) return { ok: false, error: 'port must be 1024-65535' };
          cfg.port = port;
        }
        localData.remote = cfg;
        await local.save();
        if (op === 'rotate_key') phones.closeAll();
        await startRemote();
        if (cfg.enabled && !remote) return { ok: false, error: 'Could not start the remote server: ' + (remoteError || 'unknown error'), remote: remoteView() };
      }
      return { ok: true, remote: remoteView() };
    }
    if (action === 'remote_command') return remoteCommand(input);
    if (action === 'remote_poll') return pollCommands(input);
    if (action === 'last') {
      const id = String(input.id || '');
      data.last = id ? { id, name: clip(String(input.name || ''), 120), url: String(input.url || ''), logo: String(input.logo || ''), group: String(input.group || ''), at: new Date().toISOString() } : null;
      await store.save();
      return { ok: true };
    }
    const list = all.find((p) => p.id === input.id || (input.name && p.name === input.name));
    if (!list) return { ok: false, error: 'No playlist with id ' + String(input.id) };
    if (action === 'remove_playlist') {
      all.splice(all.indexOf(list), 1);
      cache.delete(list.id);
      await store.save();
      return { ok: true, removed: list.id };
    }
    if (action === 'update_playlist') {
      if (input.enabled !== undefined) list.enabled = !!input.enabled;
      if (input.name !== undefined && String(input.name).trim() && input.id) list.name = clip(String(input.name).trim(), 60);
      await store.save();
      return { ok: true, playlist: list };
    }
    if (action === 'refresh') {
      const entry = await loadPlaylist(list, true);
      return { ok: !entry.error, error: entry.error || undefined, channels: entry.channels.length };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  registerGetRoutes(ctx, () => activeProxy(false));
  registerRoute(ctx, ROUTE, run, 'iptv');
  registerTool(ctx, {
    name: 'iptv',
    description: 'Live TV (IPTV) panel in the sidebar; playback happens in the panel. Actions: channels (search enabled playlists; optional query words, group, playlist id or name, favorites=true, limit, offset, refresh), playlists (list M3U playlists), add_playlist (url, optional name; fetches it first), update_playlist (id, enabled or name), remove_playlist (id), refresh (id), favorite (id from channels, or url+name; optional on=true|false, toggles when omitted), settings (read the outbound proxy, or change it with proxyUrl, proxyEnabled, proxyPlaylists, optional test=true to check before saving), test_proxy (optional proxyUrl), remote (op status|enable|disable|rotate_key, optional port: the phone remote control web page on the LAN; returns its URL), remote_command (cmd toggle|next|prev|volume_up|volume_down|mute|stop|show|guide|tune with id|number with n|volume with value 0-1: control the TV page in the browser). The proxy (http://, https:// or socks5://, optional user:pass@) carries stream and playlist requests from the Host; the password is never returned. Channels carry name, group, stream url and favorite flag.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['channels', 'playlists', 'add_playlist', 'update_playlist', 'remove_playlist', 'refresh', 'favorite', 'settings', 'test_proxy', 'remote', 'remote_command'], description: 'Operation to perform.' },
        query: { type: 'string', description: 'channels: space-separated words that must all appear in the channel name or group.' },
        group: { type: 'string', description: 'channels: exact group title.' },
        playlist: { type: 'string', description: 'channels: limit to one playlist, by id or exact name (includes disabled playlists).' },
        favorites: { type: 'boolean', description: 'channels: only favorite channels.' },
        limit: { type: 'number', description: 'channels: maximum items, 1-500, default 120.' },
        offset: { type: 'number', description: 'channels: items to skip.' },
        refresh: { type: 'boolean', description: 'channels: refetch playlists instead of using the 6-hour cache.' },
        id: { type: 'string', description: 'Playlist id (update/remove/refresh) or channel id (favorite).' },
        url: { type: 'string', description: 'add_playlist: M3U URL. favorite: stream URL when the channel id is unknown.' },
        name: { type: 'string', description: 'add_playlist/update_playlist: display name. favorite: channel name.' },
        enabled: { type: 'boolean', description: 'update_playlist: include the playlist in channel searches.' },
        on: { type: 'boolean', description: 'favorite: true adds, false removes; omit to toggle.' },
        proxyUrl: { type: 'string', description: 'settings/test_proxy: proxy address such as http://127.0.0.1:7890 or socks5://user:pass@host:1080; empty string clears it.' },
        proxyEnabled: { type: 'boolean', description: 'settings: route requests through the proxy.' },
        proxyPlaylists: { type: 'boolean', description: 'settings: also fetch M3U playlists through the proxy (default true); streams always use it when enabled.' },
        test: { type: 'boolean', description: 'settings: check the proxy before saving and refuse to save if it fails.' },
        op: { type: 'string', enum: ['status', 'enable', 'disable', 'rotate_key'], description: 'remote: what to do with the LAN remote page.' },
        port: { type: 'number', description: 'remote: preferred LAN port (default 8790; the next free port is used when taken).' },
        cmd: { type: 'string', enum: [...REMOTE_COMMANDS], description: 'remote_command: command for the TV page.' },
        n: { type: 'number', description: 'remote_command number: 1-based channel number in the current list.' },
        value: { type: 'number', description: 'remote_command volume: 0-1.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'iptv');
}
