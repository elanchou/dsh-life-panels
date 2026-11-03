import { Store, dataFile, registerRoute, registerTool, fetchText, stripHtml, decodeEntities, clip, errorText, uid } from './common.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/news-feeds';
const TTL_MS = 15 * 60 * 1000;
const CATEGORIES = ['tech', 'business', 'world', 'other'];

const DEFAULT_FEEDS = [
  { title: 'Hacker News', url: 'https://hnrss.org/frontpage', category: 'tech' },
  { title: '少数派', url: 'https://sspai.com/feed', category: 'tech' },
  { title: 'IT之家', url: 'https://www.ithome.com/rss/', category: 'tech' },
  { title: 'Solidot', url: 'https://www.solidot.org/index.rss', category: 'tech' },
  { title: 'The Verge', url: 'https://www.theverge.com/rss/index.xml', category: 'tech' },
  { title: 'Ars Technica', url: 'https://feeds.arstechnica.com/arstechnica/index', category: 'tech' },
  { title: '36氪', url: 'https://36kr.com/feed', category: 'business' },
  { title: 'BBC 中文', url: 'https://feeds.bbci.co.uk/zhongwen/trad/rss.xml', category: 'world' },
  { title: '纽约时报中文网', url: 'https://cn.nytimes.com/rss/', category: 'world' },
  { title: 'BBC World', url: 'https://feeds.bbci.co.uk/news/world/rss.xml', category: 'world' },
];

function tag(block, name) {
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i');
  const m = re.exec(block);
  return m ? m[1] : '';
}
function attr(block, tagName, attrName, filter) {
  const re = new RegExp('<' + tagName + '\\b([^>]*)/?>', 'gi');
  let m;
  while ((m = re.exec(block))) {
    if (filter && !filter(m[1])) continue;
    const a = new RegExp(attrName + '\\s*=\\s*["\']([^"\']+)["\']', 'i').exec(m[1]);
    if (a) return decodeEntities(a[1]);
  }
  return '';
}
function cdata(s) { return String(s || '').replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'); }

function parseFeed(xml, feed) {
  const isAtom = /<feed[\s>]/i.test(xml.slice(0, 2000)) && !/<rss[\s>]/i.test(xml.slice(0, 2000));
  const blocks = xml.match(isAtom ? /<entry[\s>][\s\S]*?<\/entry>/gi : /<item[\s>][\s\S]*?<\/item>/gi) || [];
  const items = [];
  for (const block of blocks.slice(0, 40)) {
    const title = stripHtml(cdata(tag(block, 'title')));
    if (!title) continue;
    let link = isAtom
      ? attr(block, 'link', 'href', (a) => !/rel\s*=\s*["'](?!alternate)/i.test(a))
      : stripHtml(cdata(tag(block, 'link'))) || attr(block, 'link', 'href');
    if (!link) link = stripHtml(cdata(tag(block, 'guid')));
    const date = stripHtml(tag(block, 'pubDate') || tag(block, 'published') || tag(block, 'updated') || tag(block, 'dc:date'));
    const ts = Date.parse(date);
    const rawBody = cdata(tag(block, 'description') || tag(block, 'summary') || tag(block, 'content:encoded') || tag(block, 'content'));
    const body = decodeEntities(rawBody);
    let image = attr(block, 'media:thumbnail', 'url') || attr(block, 'media:content', 'url')
      || attr(block, 'enclosure', 'url', (a) => /image/i.test(a));
    if (!image) { const im = /<img[^>]+src=["']([^"']+)["']/i.exec(body); if (im) image = decodeEntities(im[1]); }
    if (image && !/^https?:/i.test(image)) image = '';
    const summary = clip(stripHtml(body), 240);
    items.push({
      id: feed.id + ':' + (link || title),
      title: clip(title, 300),
      link,
      summary: summary === title ? '' : summary,
      image: image || null,
      publishedAt: Number.isFinite(ts) ? new Date(ts).toISOString() : null,
      source: feed.title,
      feedId: feed.id,
      category: feed.category,
    });
  }
  return items;
}

export function apply(ctx) {
  const store = new Store(dataFile('news-feeds'), () => ({ version: 1, feeds: null }));
  const cache = new Map();

  async function feeds() {
    const data = await store.load();
    if (!Array.isArray(data.feeds)) {
      data.feeds = DEFAULT_FEEDS.map((f) => ({ id: uid(), enabled: true, ...f }));
      await store.save();
    }
    return data.feeds;
  }

  async function loadFeed(feed, force) {
    const hit = cache.get(feed.id);
    if (!force && hit && Date.now() - hit.fetchedAt < TTL_MS) return hit;
    if (hit && hit.pending) return hit.pending;
    const pending = (async () => {
      try {
        const { text } = await fetchText(feed.url, { timeoutMs: 12000, accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' });
        const items = parseFeed(text, feed);
        if (!items.length) throw new Error('no items found (not an RSS/Atom feed?)');
        const entry = { items, fetchedAt: Date.now(), error: null };
        cache.set(feed.id, entry);
        return entry;
      } catch (error) {
        const entry = { items: hit ? hit.items : [], fetchedAt: Date.now(), error: errorText(error) };
        cache.set(feed.id, entry);
        return entry;
      }
    })();
    cache.set(feed.id, { ...(hit || { items: [], fetchedAt: 0, error: null }), pending });
    return pending;
  }

  async function headlines(input) {
    const all = await feeds();
    let selected = all.filter((f) => f.enabled);
    if (input.feed) selected = all.filter((f) => f.id === input.feed || f.title === input.feed);
    if (input.category && input.category !== 'all') selected = selected.filter((f) => f.category === input.category);
    const results = await Promise.all(selected.map((f) => loadFeed(f, !!input.refresh)));
    let items = results.flatMap((r) => r.items);
    if (input.query) {
      const q = String(input.query).toLowerCase();
      items = items.filter((i) => (i.title + ' ' + i.summary).toLowerCase().includes(q));
    }
    items.sort((a, b) => (b.publishedAt || '').localeCompare(a.publishedAt || ''));
    const limit = Math.max(1, Math.min(Number(input.limit) || 60, 200));
    const status = selected.map((f, i) => ({ id: f.id, title: f.title, count: results[i].items.length, error: results[i].error, fetchedAt: new Date(results[i].fetchedAt).toISOString() }));
    return { ok: true, items: items.slice(0, limit), total: items.length, feeds: status };
  }

  async function run(input) {
    const action = input.action || 'headlines';
    if (action === 'headlines') return headlines(input);
    const all = await feeds();
    if (action === 'feeds') return { ok: true, feeds: all, categories: CATEGORIES };
    if (action === 'add_feed') {
      const url = String(input.url || '').trim();
      if (!/^https?:\/\//i.test(url)) return { ok: false, error: 'url must start with http:// or https://' };
      if (all.some((f) => f.url === url)) return { ok: false, error: 'This feed is already subscribed' };
      const category = CATEGORIES.includes(input.category) ? input.category : 'other';
      const feed = { id: uid(), title: '', url, category, enabled: true };
      let text;
      try { ({ text } = await fetchText(url, { timeoutMs: 12000 })); }
      catch (error) { return { ok: false, error: 'Could not fetch the feed: ' + errorText(error) }; }
      const channel = /<channel[\s>]([\s\S]*?)<(item|entry)[\s>]/i.exec(text);
      const guess = stripHtml(cdata(tag(channel ? channel[1] : text.slice(0, 4000), 'title')));
      feed.title = clip(String(input.title || '').trim() || guess || new URL(url).hostname, 60);
      const items = parseFeed(text, feed);
      if (!items.length) return { ok: false, error: 'No RSS/Atom items found at this URL' };
      cache.set(feed.id, { items, fetchedAt: Date.now(), error: null });
      const current = await feeds(); // re-read: cloud sync may have replaced the file during the fetch
      if (current.some((f) => f.url === url)) return { ok: false, error: 'This feed is already subscribed' };
      current.push(feed);
      await store.save();
      return { ok: true, feed, sample: items.slice(0, 3).map((i) => i.title) };
    }
    const feed = all.find((f) => f.id === input.id);
    if (!feed) return { ok: false, error: 'No feed with id ' + String(input.id) };
    if (action === 'remove_feed') {
      all.splice(all.indexOf(feed), 1);
      cache.delete(feed.id);
      await store.save();
      return { ok: true, removed: feed.id };
    }
    if (action === 'update_feed') {
      if (input.enabled !== undefined) feed.enabled = !!input.enabled;
      if (input.title !== undefined && String(input.title).trim()) feed.title = clip(String(input.title).trim(), 60);
      if (input.category !== undefined && CATEGORIES.includes(input.category)) {
        feed.category = input.category;
        cache.delete(feed.id);
      }
      await store.save();
      return { ok: true, feed };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  registerRoute(ctx, ROUTE, run, 'news-feeds');
  registerTool(ctx, {
    name: 'news_feeds',
    description: 'Read and manage the RSS news panel in the sidebar. Actions: headlines (latest items across enabled feeds; optional category tech|business|world|other, feed id or title, query keyword filter, limit, refresh=true to bypass the 15-minute cache), feeds (list subscriptions), add_feed (url, optional title, category), update_feed (id plus enabled, title or category), remove_feed (id). Items carry title, link, source, publishedAt and a short summary; use web_fetch on a link for the full article.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['headlines', 'feeds', 'add_feed', 'update_feed', 'remove_feed'], description: 'Operation to perform.' },
        category: { type: 'string', enum: ['all', ...CATEGORIES], description: 'headlines: category filter. add_feed/update_feed: the feed category.' },
        feed: { type: 'string', description: 'headlines: limit to one feed, by id or exact title (includes disabled feeds).' },
        query: { type: 'string', description: 'headlines: case-insensitive keyword filter on title and summary.' },
        limit: { type: 'number', description: 'headlines: maximum items, 1-200, default 60.' },
        refresh: { type: 'boolean', description: 'headlines: refetch feeds instead of using the cache.' },
        url: { type: 'string', description: 'add_feed: RSS or Atom URL.' },
        title: { type: 'string', description: 'add_feed/update_feed: display name.' },
        id: { type: 'string', description: 'update_feed/remove_feed: feed id from the feeds action.' },
        enabled: { type: 'boolean', description: 'update_feed: include the feed in headlines.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'news-feeds');
}
