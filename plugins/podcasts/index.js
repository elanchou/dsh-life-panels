import { Store, dataFile, registerRoute, registerTool, fetchText, clip, errorText, uid } from './common.js';
import { parsePodcast, notesText, shortHash } from './feed.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/podcasts';
const FEED_TTL = 30 * 60 * 1000;
const COUNTRY = 'cn';

async function itunes(pathAndQuery) {
  const { text } = await fetchText('https://itunes.apple.com/' + pathAndQuery, { timeoutMs: 10000 });
  return JSON.parse(text);
}
const art = (r) => r.artworkUrl600 || r.artworkUrl100 || null;

export function apply(ctx) {
  const store = new Store(dataFile('podcasts'), () => ({ version: 1, shows: [], progress: {}, queue: [] }));
  const feeds = new Map();

  async function loadFeed(show, force) {
    const hit = feeds.get(show.id);
    if (!force && hit && Date.now() - hit.at < FEED_TTL) return hit;
    if (hit && hit.pending) return hit.pending;
    const pending = (async () => {
      try {
        const { text } = await fetchText(show.feedUrl, { timeoutMs: 15000, maxBytes: 1536 * 1024 });
        const parsed = parsePodcast(text);
        if (!parsed.episodes.length) throw new Error('no audio episodes found');
        const entry = { at: Date.now(), error: null, ...parsed };
        feeds.set(show.id, entry);
        return entry;
      } catch (error) {
        const entry = { at: Date.now(), error: errorText(error), show: {}, episodes: hit && hit.episodes ? hit.episodes : [] };
        feeds.set(show.id, entry);
        return entry;
      }
    })();
    feeds.set(show.id, { ...(hit || { at: 0, episodes: [], show: {} }), pending });
    return pending;
  }

  function view(show, ep, data, withNotes) {
    const id = show.id + ':' + ep.key;
    const p = data.progress[id] || {};
    const out = {
      id, showId: show.id, show: show.title, title: ep.title, audio: ep.audio, type: ep.type,
      duration: p.duration || ep.duration || 0, publishedAt: ep.publishedAt, image: ep.image || show.image,
      link: ep.link, summary: ep.summary,
      position: p.position || 0, played: !!p.played, queued: data.queue.some((q) => q.id === id),
    };
    if (withNotes) out.notes = notesText(ep.notesHtml);
    return out;
  }

  async function findEpisode(data, id) {
    const [showId, key] = String(id || '').split(':');
    const show = data.shows.find((s) => s.id === showId);
    if (!show) {
      const q = data.queue.find((x) => x.id === id);
      return q ? { show: null, snapshot: q } : null;
    }
    const feed = await loadFeed(show, false);
    const ep = feed.episodes.find((e) => e.key === key);
    if (ep) return { show, ep };
    const q = data.queue.find((x) => x.id === id);
    return q ? { show, snapshot: q } : null;
  }

  async function subscribe(data, input) {
    let feedUrl = String(input.feedUrl || '').trim();
    let meta = {};
    if (!feedUrl && input.itunesId) {
      const r = await itunes('lookup?entity=podcast&country=' + COUNTRY + '&id=' + encodeURIComponent(String(input.itunesId)));
      const hit = (r.results || []).find((x) => x.feedUrl);
      if (!hit) return { ok: false, error: 'This podcast has no public RSS feed' };
      feedUrl = hit.feedUrl;
      meta = { title: hit.collectionName, author: hit.artistName, image: art(hit) };
    }
    if (!/^https?:\/\//i.test(feedUrl)) return { ok: false, error: 'Provide feedUrl (http/https) or itunesId' };
    const dup = data.shows.find((s) => s.feedUrl === feedUrl);
    if (dup) return { ok: true, show: dup, duplicate: true };
    const show = { id: shortHash(feedUrl), feedUrl, title: meta.title || '', author: meta.author || '', image: meta.image || null, description: '', addedAt: new Date().toISOString() };
    const feed = await loadFeed(show, true);
    if (feed.error) return { ok: false, error: 'Could not read the feed: ' + feed.error };
    show.title = clip(meta.title || feed.show.title || new URL(feedUrl).hostname, 120);
    show.author = meta.author || feed.show.author || '';
    show.image = meta.image || feed.show.image || null;
    show.description = feed.show.description || '';
    const current = await store.load(); // re-read: cloud sync may have replaced the file during the fetch
    const again = current.shows.find((s) => s.feedUrl === feedUrl);
    if (again) return { ok: true, show: again, duplicate: true };
    current.shows.push(show);
    await store.save();
    return { ok: true, show, episodes: feed.episodes.length };
  }

  async function run(input) {
    const data = await store.load();
    const action = input.action || 'latest';
    switch (action) {
      case 'search': {
        const term = String(input.query || '').trim();
        if (!term) return { ok: false, error: 'query is required' };
        const r = await itunes('search?media=podcast&entity=podcast&limit=24&country=' + COUNTRY + '&term=' + encodeURIComponent(term));
        const subscribed = new Set(data.shows.map((s) => s.feedUrl));
        return { ok: true, results: (r.results || []).filter((x) => x.feedUrl).map((x) => ({
          itunesId: x.collectionId, title: x.collectionName, author: x.artistName, image: art(x), feedUrl: x.feedUrl,
          genre: x.primaryGenreName, episodes: x.trackCount, subscribed: subscribed.has(x.feedUrl),
        })) };
      }
      case 'top': {
        const r = await itunes(COUNTRY + '/rss/toppodcasts/limit=30/json');
        return { ok: true, results: ((r.feed && r.feed.entry) || []).map((e) => ({
          itunesId: Number(e.id && e.id.attributes && e.id.attributes['im:id']), title: e['im:name'] && e['im:name'].label,
          author: e['im:artist'] && e['im:artist'].label, image: e['im:image'] && e['im:image'].length ? e['im:image'][e['im:image'].length - 1].label : null,
          genre: e.category && e.category.attributes && e.category.attributes.label,
        })) };
      }
      case 'subscribe': return subscribe(data, input);
      case 'shows': {
        return { ok: true, shows: data.shows.map((s) => { const f = feeds.get(s.id); return { ...s, error: f ? f.error : null, latestAt: f && f.episodes && f.episodes[0] ? f.episodes[0].publishedAt : null }; }) };
      }
      case 'unsubscribe': {
        const i = data.shows.findIndex((s) => s.id === input.id);
        if (i < 0) return { ok: false, error: 'No show with id ' + String(input.id) };
        const [show] = data.shows.splice(i, 1);
        feeds.delete(show.id);
        data.queue = data.queue.filter((q) => q.showId !== show.id);
        for (const k of Object.keys(data.progress)) if (k.startsWith(show.id + ':')) delete data.progress[k];
        await store.save();
        return { ok: true, removed: show.id };
      }
      case 'latest':
      case 'episodes': {
        const shows = input.showId ? data.shows.filter((s) => s.id === input.showId) : data.shows;
        if (input.showId && !shows.length) return { ok: false, error: 'No show with id ' + String(input.showId) };
        const results = await Promise.all(shows.map((s) => loadFeed(s, !!input.refresh)));
        let items = [];
        shows.forEach((s, i) => { for (const ep of results[i].episodes) items.push(view(s, ep, data, false)); });
        if (input.unplayed) items = items.filter((x) => !x.played);
        if (input.query) { const q = String(input.query).toLowerCase(); items = items.filter((x) => (x.title + ' ' + x.summary + ' ' + x.show).toLowerCase().includes(q)); }
        items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
        const limit = Math.max(1, Math.min(Number(input.limit) || 60, 300));
        const errors = shows.map((s, i) => ({ id: s.id, title: s.title, error: results[i].error })).filter((x) => x.error);
        return { ok: true, episodes: items.slice(0, limit), total: items.length, errors };
      }
      case 'episode': {
        const found = await findEpisode(data, input.id);
        if (!found) return { ok: false, error: 'No episode with id ' + String(input.id) };
        if (found.ep) return { ok: true, episode: view(found.show, found.ep, data, true) };
        return { ok: true, episode: { ...found.snapshot, ...(data.progress[input.id] || {}), queued: true, notes: '' } };
      }
      case 'progress': {
        const id = String(input.id || '');
        if (!/^[0-9a-f]{12}:[0-9a-f]{12}$/.test(id)) return { ok: false, error: 'invalid episode id' };
        const p = data.progress[id] || {};
        if (input.position !== undefined) { const v = Number(input.position); if (!Number.isFinite(v) || v < 0) return { ok: false, error: 'position must be seconds >= 0' }; p.position = Math.round(v); }
        if (input.duration !== undefined) { const v = Number(input.duration); if (Number.isFinite(v) && v > 0) p.duration = Math.round(v); }
        if (input.played !== undefined) { p.played = !!input.played; if (p.played) p.position = 0; }
        else if (p.duration && p.position >= p.duration - 30) { p.played = true; p.position = 0; }
        p.updatedAt = new Date().toISOString();
        data.progress[id] = p;
        if (p.played) data.queue = data.queue.filter((q) => q.id !== id);
        await store.save();
        return { ok: true, progress: p };
      }
      case 'queue': {
        return { ok: true, queue: data.queue.map((q) => ({ ...q, ...(data.progress[q.id] || {}), queued: true })) };
      }
      case 'queue_add': {
        if (data.queue.some((q) => q.id === input.id)) return { ok: true, duplicate: true };
        const found = await findEpisode(data, input.id);
        if (!found || !found.ep) return { ok: false, error: 'No episode with id ' + String(input.id) };
        const v = view(found.show, found.ep, data, false);
        const snap = { id: v.id, showId: v.showId, show: v.show, title: v.title, audio: v.audio, type: v.type, duration: v.duration, publishedAt: v.publishedAt, image: v.image, addedAt: new Date().toISOString() };
        if (input.next) data.queue.unshift(snap); else data.queue.push(snap);
        await store.save();
        return { ok: true, queued: snap.id, length: data.queue.length };
      }
      case 'queue_remove': {
        const before = data.queue.length;
        data.queue = data.queue.filter((q) => q.id !== input.id);
        await store.save();
        return { ok: true, removed: before !== data.queue.length };
      }
      default:
        return { ok: false, error: 'Unknown action: ' + String(action) };
    }
  }

  registerRoute(ctx, ROUTE, run, 'podcasts');
  registerTool(ctx, {
    name: 'podcasts',
    description: 'Podcast subscriptions in the sidebar Podcast panel (playback happens in the panel). Actions: search (query; Apple Podcasts directory, China store), top (chart), subscribe (itunesId from search/top, or feedUrl), shows, unsubscribe (id), latest (new episodes across subscriptions; optional showId, unplayed, query, limit, refresh), episode (id; includes shownotes text for summarizing), progress (id plus position seconds, duration, played), queue, queue_add (id, next=true to play next), queue_remove (id).',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['search', 'top', 'subscribe', 'shows', 'unsubscribe', 'latest', 'episode', 'progress', 'queue', 'queue_add', 'queue_remove'], description: 'Operation to perform.' },
        query: { type: 'string', description: 'search: directory query. latest: keyword filter.' },
        itunesId: { type: 'number', description: 'subscribe: Apple Podcasts collection id.' },
        feedUrl: { type: 'string', description: 'subscribe: podcast RSS URL.' },
        id: { type: 'string', description: 'Show id (unsubscribe) or episode id (episode, progress, queue_*).' },
        showId: { type: 'string', description: 'latest: only this show.' },
        unplayed: { type: 'boolean', description: 'latest: hide played episodes.' },
        limit: { type: 'number', description: 'latest: maximum episodes, default 60.' },
        refresh: { type: 'boolean', description: 'latest: refetch feeds instead of the 30-minute cache.' },
        position: { type: 'number', description: 'progress: playback position in seconds.' },
        duration: { type: 'number', description: 'progress: episode length in seconds.' },
        played: { type: 'boolean', description: 'progress: mark played or unplayed.' },
        next: { type: 'boolean', description: 'queue_add: insert at the front.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'podcasts');
}
