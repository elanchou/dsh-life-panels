import http from 'node:http';
import { Store, dataFile, registerRoute, registerTool, clip, errorText } from './common.js';
import { channelVideos, searchChannels, resolveChannel, parseAgo } from './yt.js';

export const inject = ['tools', 'webServer', 'connection'];

// YouTube refuses to play embeds whose page has no http(s) origin (error 153), and the desktop app serves the UI from
// dsh-app://. The player therefore lives in a tiny static page on 127.0.0.1 that embeds YouTube from its own origin.
const PLAYER_HTML = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="strict-origin-when-cross-origin"><title>Player</title>
<style>html,body{margin:0;height:100%;background:#000}iframe{position:absolute;inset:0;width:100%;height:100%;border:0}</style></head>
<body><script>
(function () {
  var p = new URLSearchParams(location.search), v = p.get('v') || '';
  if (!/^[\\w-]{11}$/.test(v)) return;
  var f = document.createElement('iframe');
  f.src = 'https://www.youtube-nocookie.com/embed/' + v + '?autoplay=1&rel=0&playsinline=1&hl=' + encodeURIComponent((p.get('hl') || 'en').slice(0, 8));
  f.allow = 'autoplay; encrypted-media; picture-in-picture; fullscreen; clipboard-write';
  f.allowFullscreen = true; f.referrerPolicy = 'strict-origin-when-cross-origin';
  document.body.appendChild(f);
})();
</script></body></html>`;

function startPlayerServer() {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url || '/', 'http://127.0.0.1');
    if (req.method !== 'GET' || url.pathname !== '/') { res.writeHead(404); res.end(); return; }
    res.writeHead(200, {
      'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store',
      'referrer-policy': 'strict-origin-when-cross-origin', 'x-content-type-options': 'nosniff',
    });
    res.end(PLAYER_HTML);
  });
  const ready = new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => resolve(server.address().port));
  });
  return { server, ready };
}

const ROUTE = '/plugin-api/youtube';
const FEED_TTL = 30 * 60 * 1000;
const CONCURRENCY = 4;
const MAX_CHANNELS = 200;
const MAX_WATCHED = 4000;

const thumb = (id) => 'https://i.ytimg.com/vi/' + id + '/mqdefault.jpg';
const watchUrl = (id) => 'https://www.youtube.com/watch?v=' + id;

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i], i); } };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return out;
}

export function apply(ctx) {
  // watched is a map keyed by video id so two computers merge marks per video.
  const store = new Store(dataFile('youtube'), () => ({ version: 1, channels: [], watched: {} }));
  const player = startPlayerServer();
  player.ready.catch(() => {});
  ctx.effect(() => () => { player.server.close(); }, 'youtube: player page');
  const feeds = new Map(); // channelId -> { at, error, videos, pending }
  const firstSeen = new Map(); // videoId -> estimated publish ms; relative times only get coarser, so keep the earliest estimate.

  async function loadFeed(ch, force) {
    const hit = feeds.get(ch.id);
    if (hit && hit.pending) return hit.pending;
    if (!force && hit && Date.now() - hit.at < FEED_TTL) return hit;
    const pending = (async () => {
      try {
        const { channel, videos } = await channelVideos(ch.id);
        const now = Date.now();
        const list = videos.map((v, i) => {
          let at = parseAgo(v.ago, now);
          // Keep the tab's newest-first order stable when several videos share the same coarse "3 weeks ago".
          if (at !== null) at -= i * 1000;
          const prev = firstSeen.get(v.id);
          if (at === null) at = prev ?? null; else if (prev !== undefined && prev < at) at = prev;
          if (at !== null) firstSeen.set(v.id, at);
          return { ...v, publishedAt: at !== null ? new Date(at).toISOString() : null };
        });
        const entry = { at: now, error: null, channel, videos: list };
        feeds.set(ch.id, entry);
        return entry;
      } catch (error) {
        const entry = { at: Date.now(), error: errorText(error), channel: null, videos: hit && hit.videos ? hit.videos : [] };
        feeds.set(ch.id, entry);
        return entry;
      }
    })();
    feeds.set(ch.id, { ...(hit || { at: 0, videos: [] }), pending });
    return pending;
  }

  /** Refreshes stored channel names and avatars when YouTube reports new ones. */
  async function absorbMeta(data, results) {
    let changed = false;
    for (const { ch, feed } of results) {
      const meta = feed.channel;
      if (!meta) continue;
      const stored = data.channels.find((c) => c.id === ch.id);
      if (!stored) continue;
      for (const k of ['title', 'handle', 'avatar']) {
        if (meta[k] && stored[k] !== meta[k]) { stored[k] = meta[k]; changed = true; }
      }
      if (changed) stored.updatedAt = new Date().toISOString();
    }
    if (changed) await store.save();
  }

  function videoView(v, ch, data) {
    return {
      id: v.id, title: v.title, channelId: ch.id, channel: ch.title, channelAvatar: ch.avatar || null,
      duration: v.duration, views: v.views, ago: v.ago, publishedAt: v.publishedAt,
      thumbnail: thumb(v.id), url: watchUrl(v.id), watched: !!data.watched[v.id],
    };
  }
  function pruneWatched(data) {
    const entries = Object.entries(data.watched);
    if (entries.length <= MAX_WATCHED) return;
    entries.sort((a, b) => String(a[1].at).localeCompare(String(b[1].at)));
    for (const [id] of entries.slice(0, entries.length - MAX_WATCHED)) delete data.watched[id];
  }
  async function subscribe(data, ref) {
    const id = await resolveChannel(ref);
    if (!id) throw new Error('Not a YouTube channel: ' + clip(String(ref), 80) + '. Use a channel URL, an @handle, a channel id, or search first.');
    const existing = data.channels.find((c) => c.id === id);
    if (existing) return { channel: existing, already: true };
    if (data.channels.length >= MAX_CHANNELS) throw new Error('Subscription limit reached (' + MAX_CHANNELS + ').');
    const feed = await loadFeed({ id }, true);
    if (feed.error) throw new Error('Could not load the channel: ' + feed.error);
    const now = new Date().toISOString();
    const meta = feed.channel || {};
    const channel = { id, title: meta.title || id, handle: meta.handle || '', avatar: meta.avatar || '', addedAt: now, updatedAt: now };
    data.channels.push(channel);
    await store.save();
    return { channel, already: false, videos: feed.videos.length };
  }

  const NEW_DAYS = 14;
  const isNew = (v, data) => !data.watched[v.id] && v.publishedAt && Date.now() - Date.parse(v.publishedAt) < NEW_DAYS * 864e5;

  async function run(input) {
    const data = await store.load();
    const action = input.action || 'latest';

    if (action === 'player') {
      try { return { ok: true, base: 'http://127.0.0.1:' + await player.ready }; } catch (error) { return { ok: false, error: 'Player page unavailable: ' + errorText(error) }; }
    }
    if (action === 'search') {
      const q = String(input.query || '').trim();
      if (!q) return { ok: false, error: 'query is required' };
      const results = await searchChannels(q);
      return { ok: true, results: results.map((r) => ({ ...r, subscribed: data.channels.some((c) => c.id === r.id) })) };
    }
    if (action === 'subscribe') {
      const ref = input.channel || input.id || input.url;
      if (!ref) return { ok: false, error: 'channel is required (URL, @handle or channel id)' };
      const r = await subscribe(data, ref);
      return { ok: true, ...r };
    }
    if (action === 'unsubscribe') {
      const i = data.channels.findIndex((c) => c.id === input.id);
      if (i < 0) return { ok: false, error: 'Not subscribed: ' + String(input.id) };
      const [removed] = data.channels.splice(i, 1);
      const feed = feeds.get(removed.id);
      if (feed && feed.videos) for (const v of feed.videos) delete data.watched[v.id];
      feeds.delete(removed.id);
      await store.save();
      return { ok: true, removed: removed.id };
    }
    if (action === 'channels' || action === 'latest') {
      const chans = input.channelId ? data.channels.filter((c) => c.id === input.channelId) : data.channels;
      if (input.channelId && !chans.length) return { ok: false, error: 'Not subscribed: ' + String(input.channelId) };
      const results = await mapLimit(chans, CONCURRENCY, async (ch) => ({ ch, feed: await loadFeed(ch, !!input.refresh) }));
      await absorbMeta(data, results);
      const channels = results.map(({ ch, feed }) => ({
        ...ch, error: feed.error || null, newCount: feed.videos.filter((v) => isNew(v, data)).length,
        lastUpload: (feed.videos.find((v) => v.publishedAt) || {}).publishedAt || null,
      }));
      if (action === 'channels') return { ok: true, channels };
      let videos = results.flatMap(({ ch, feed }) => feed.videos.map((v) => videoView(v, data.channels.find((c) => c.id === ch.id) || ch, data)));
      if (input.unwatched) videos = videos.filter((v) => !v.watched);
      const q = String(input.query || '').trim().toLowerCase();
      if (q) videos = videos.filter((v) => (v.title + ' ' + v.channel).toLowerCase().includes(q));
      videos.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
      const limit = Math.max(1, Math.min(300, Number(input.limit) || 120));
      const newCount = channels.reduce((a, c) => a + c.newCount, 0);
      return { ok: true, total: videos.length, newCount, newDays: NEW_DAYS, channels, videos: videos.slice(0, limit) };
    }
    if (action === 'watched') {
      const ids = Array.isArray(input.ids) ? input.ids : [input.id];
      const valid = ids.filter((id) => typeof id === 'string' && /^[\w-]{11}$/.test(id));
      if (!valid.length) return { ok: false, error: 'id must be a YouTube video id' };
      const on = input.watched !== false;
      const now = new Date().toISOString();
      for (const id of valid) { if (on) data.watched[id] = { at: now, updatedAt: now }; else delete data.watched[id]; }
      if (on) pruneWatched(data);
      await store.save();
      return { ok: true, ids: valid, watched: on };
    }
    if (action === 'mark_all_watched') {
      const chans = input.channelId ? data.channels.filter((c) => c.id === input.channelId) : data.channels;
      const now = new Date().toISOString();
      let n = 0;
      for (const ch of chans) {
        const feed = feeds.get(ch.id);
        for (const v of (feed && feed.videos) || []) if (!data.watched[v.id]) { data.watched[v.id] = { at: now, updatedAt: now }; n++; }
      }
      pruneWatched(data);
      await store.save();
      return { ok: true, marked: n };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  registerRoute(ctx, ROUTE, run, 'youtube');
  registerTool(ctx, {
    name: 'youtube',
    description: 'YouTube channel subscriptions in the sidebar YouTube panel (no Google account; the panel plays videos in an embedded player). Actions: search (query; finds channels); subscribe (channel: channel URL, @handle or channel id); unsubscribe (id); channels (subscriptions with newCount, unwatched uploads from the last 14 days); latest (recent uploads across subscriptions, newest first; optional channelId, unwatched, query, limit, refresh); watched (id or ids, watched=false to unmark); mark_all_watched (optional channelId). Publish times are estimated from YouTube\'s relative labels such as "3 days ago".',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'subscribe', 'unsubscribe', 'channels', 'latest', 'watched', 'mark_all_watched'], description: 'Operation to perform.' },
        query: { type: 'string', description: 'search: channel name. latest: keyword filter on title and channel.' },
        channel: { type: 'string', description: 'subscribe: channel URL, @handle or UC… channel id.' },
        id: { type: 'string', description: 'unsubscribe: channel id. watched: video id.' },
        ids: { type: 'array', items: { type: 'string' }, description: 'watched: several video ids.' },
        watched: { type: 'boolean', description: 'watched: false to mark unwatched.' },
        channelId: { type: 'string', description: 'latest/channels/mark_all_watched: only this channel.' },
        unwatched: { type: 'boolean', description: 'latest: hide watched videos.' },
        limit: { type: 'number', description: 'latest: maximum videos, default 120.' },
        refresh: { type: 'boolean', description: 'latest/channels: refetch instead of the 30-minute cache.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'youtube');
}
