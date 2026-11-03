import { Store, dataFile, registerRoute, registerTool, fetchText, stripHtml, decodeEntities, clip, errorText, uid } from './common.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/reading-list';
const STATUSES = ['unread', 'reading', 'done'];
const MAX_TEXT = 60000;

function meta(html, names) {
  for (const n of names) {
    const re = new RegExp('<meta[^>]+(?:property|name)=["\']' + n + '["\'][^>]*>', 'i');
    const m = re.exec(html);
    if (m) {
      const c = /content=["']([^"']*)["']/i.exec(m[0]);
      if (c && c[1].trim()) return decodeEntities(c[1]).trim();
    }
  }
  return '';
}

/** Rough readable-text extraction: prefer <article>/<main>, keep paragraph breaks. */
function extract(html) {
  const title = meta(html, ['og:title', 'twitter:title']) || stripHtml((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html) || [])[1] || '');
  const description = meta(html, ['og:description', 'description', 'twitter:description']);
  const site = meta(html, ['og:site_name', 'application-name']);
  const image = meta(html, ['og:image', 'twitter:image']);
  let body = html.replace(/<(script|style|noscript|svg|nav|header|footer|aside|form|iframe)[\s\S]*?<\/\1>/gi, ' ').replace(/<!--[\s\S]*?-->/g, ' ');
  const pick = /<article[\s>][\s\S]*<\/article>/i.exec(body) || /<main[\s>][\s\S]*<\/main>/i.exec(body) || /<body[\s>][\s\S]*<\/body>/i.exec(body);
  if (pick) body = pick[0];
  const paragraphs = [];
  const blockRe = /<(p|h[1-4]|li|blockquote|pre)[^>]*>([\s\S]*?)<\/\1>/gi;
  let m;
  while ((m = blockRe.exec(body))) {
    const text = stripHtml(m[2]);
    if (text.length < 2) continue;
    const kind = m[1].toLowerCase();
    if (kind === 'li' && text.length < 24) continue;
    if (kind === 'p' && text.length < 8) continue;
    paragraphs.push(kind[0] === 'h' ? '## ' + text : kind === 'li' ? '• ' + text : text);
  }
  let text = paragraphs.join('\n\n');
  if (text.length < 200) text = stripHtml(body);
  return { title: trimSiteSuffix(title), description, site, image: /^https?:/i.test(image) ? image : '', text: text.slice(0, MAX_TEXT) };
}

function trimSiteSuffix(title) {
  const m = /^(.{6,}?)\s*(?:\s[-|–—]\s|_)\s*([^-|–—_]{1,14})$/.exec(title);
  return m ? m[1].trim() : title;
}

function readingMinutes(text) {
  if (!text) return 0;
  const cjk = (text.match(/[\u3400-\u9fff]/g) || []).length;
  const words = (text.replace(/[\u3400-\u9fff]/g, ' ').match(/\S+/g) || []).length;
  return Math.max(1, Math.round(cjk / 400 + words / 220));
}

function publicView(item, withText) {
  const { text, ...rest } = item;
  return withText ? { ...rest, text: text || '' } : { ...rest, hasText: !!text };
}

function cleanTags(tags) {
  const list = Array.isArray(tags) ? tags : String(tags || '').split(/[,，#\s]+/);
  return [...new Set(list.map((t) => String(t).trim().replace(/^#+/, '')).filter(Boolean).map((t) => t.slice(0, 24)))].slice(0, 12);
}

export function apply(ctx) {
  const store = new Store(dataFile('reading-list'), () => ({ version: 1, items: [] }));

  /** Fetches the article, then applies the result to the item as it stands now: cloud sync may have reloaded the file meanwhile. */
  async function fetchArticle(snapshot) {
    const patch = {};
    try {
      const { text, finalUrl } = await fetchText(snapshot.url, { timeoutMs: 12000, maxBytes: 3 * 1024 * 1024, accept: 'text/html,application/xhtml+xml' });
      const art = extract(text);
      if (art.title) patch.title = clip(art.title, 300);
      if (art.description) patch.summary = clip(art.description, 400);
      patch.source = art.site || new URL(finalUrl).hostname.replace(/^www\./, '');
      if (art.image) patch.image = art.image;
      patch.text = art.text;
      patch.minutes = readingMinutes(art.text);
      patch.fetchError = null;
    } catch (error) {
      patch.fetchError = errorText(error);
    }
    const data = await store.load();
    const item = data.items.find((i) => i.id === snapshot.id);
    if (!item) return null;
    if (patch.title && !item.titleLocked) item.title = patch.title;
    if (patch.summary && !item.summary) item.summary = patch.summary;
    if (patch.source && !item.source) item.source = patch.source;
    if (patch.image) item.image = patch.image;
    if ('text' in patch) { item.text = patch.text; item.minutes = patch.minutes; }
    item.fetchError = patch.fetchError;
    item.fetching = false;
    item.updatedAt = new Date().toISOString();
    await store.save();
    return item;
  }

  async function run(input) {
    const data = await store.load();
    const items = data.items;
    const action = input.action || 'list';
    if (action === 'list') {
      let list = items;
      if (input.status && input.status !== 'all') list = list.filter((i) => i.status === input.status);
      if (input.tag) list = list.filter((i) => (i.tags || []).includes(input.tag));
      if (input.query) {
        const q = String(input.query).toLowerCase();
        list = list.filter((i) => [i.title, i.summary, i.notes, i.source, (i.tags || []).join(' ')].join(' ').toLowerCase().includes(q));
      }
      list = [...list].sort((a, b) => (b.addedAt || '').localeCompare(a.addedAt || ''));
      const counts = { unread: 0, reading: 0, done: 0 };
      for (const i of items) counts[i.status] = (counts[i.status] || 0) + 1;
      return { ok: true, items: list.map((i) => publicView(i, false)), counts, total: items.length };
    }
    if (action === 'add') {
      const url = String(input.url || '').trim();
      const text = String(input.text || '').trim();
      if (!url && !text) return { ok: false, error: 'Provide a url or text' };
      if (url && !/^https?:\/\//i.test(url)) return { ok: false, error: 'url must start with http:// or https://' };
      if (url) {
        const dup = items.find((i) => i.url === url);
        if (dup) return { ok: true, item: publicView(dup, false), duplicate: true };
      }
      const now = new Date().toISOString();
      const item = {
        id: uid(), url: url || null,
        title: clip(String(input.title || '').trim() || (url ? url : text.split('\n')[0]), 300),
        titleLocked: !!String(input.title || '').trim(),
        source: String(input.source || '').trim() || (url ? new URL(url).hostname.replace(/^www\./, '') : ''),
        summary: clip(String(input.summary || '').trim(), 400),
        image: null, text: text.slice(0, MAX_TEXT), minutes: readingMinutes(text),
        notes: String(input.notes || '').slice(0, 5000), tags: cleanTags(input.tags),
        status: 'unread', progress: 0, addedAt: now, updatedAt: now, finishedAt: null,
        fetching: !!url && !text, fetchError: null,
      };
      items.push(item);
      await store.save();
      if (item.fetching) fetchArticle(item).catch(() => {});
      return { ok: true, item: publicView(item, false) };
    }
    const item = items.find((i) => i.id === input.id);
    if (!item) return { ok: false, error: 'No item with id ' + String(input.id) };
    if (action === 'get') return { ok: true, item: publicView(item, true) };
    if (action === 'delete') {
      items.splice(items.indexOf(item), 1);
      await store.save();
      return { ok: true, deleted: item.id };
    }
    if (action === 'refetch') {
      if (!item.url) return { ok: false, error: 'This item has no URL' };
      item.fetching = true;
      await store.save();
      const fresh = await fetchArticle(item);
      if (!fresh) return { ok: false, error: 'The item was removed while fetching' };
      return { ok: true, item: publicView(fresh, false) };
    }
    if (action === 'update') {
      if (input.status !== undefined) {
        if (!STATUSES.includes(input.status)) return { ok: false, error: 'status must be unread, reading or done' };
        item.status = input.status;
        if (item.status === 'done') { item.progress = 100; item.finishedAt = new Date().toISOString(); }
        else item.finishedAt = null;
        if (item.status === 'unread') item.progress = 0;
      }
      if (input.progress !== undefined) {
        const p = Math.round(Number(input.progress));
        if (!Number.isFinite(p) || p < 0 || p > 100) return { ok: false, error: 'progress must be 0-100' };
        item.progress = p;
        if (input.status === undefined) {
          item.status = p >= 100 ? 'done' : p > 0 ? 'reading' : 'unread';
          item.finishedAt = p >= 100 ? (item.finishedAt || new Date().toISOString()) : null;
        }
      }
      if (input.title !== undefined && String(input.title).trim()) { item.title = clip(String(input.title).trim(), 300); item.titleLocked = true; }
      if (input.notes !== undefined) item.notes = String(input.notes).slice(0, 5000);
      if (input.tags !== undefined) item.tags = cleanTags(input.tags);
      item.updatedAt = new Date().toISOString();
      await store.save();
      return { ok: true, item: publicView(item, false) };
    }
    return { ok: false, error: 'Unknown action: ' + String(action) };
  }

  registerRoute(ctx, ROUTE, run, 'reading-list');
  registerTool(ctx, {
    name: 'reading_list',
    description: 'Manage the user\'s read-later shelf shown in the sidebar Reading panel. Actions: list (optional status unread|reading|done|all, tag, query), add (url and/or text, optional title, notes, tags; the article text is fetched in the background), get (id; returns the saved article text for summarizing), update (id plus status, progress 0-100, title, notes, tags), refetch (id), delete (id).',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['list', 'add', 'get', 'update', 'refetch', 'delete'], description: 'Operation to perform.' },
        id: { type: 'string', description: 'Item id from list or add.' },
        url: { type: 'string', description: 'add: article URL.' },
        text: { type: 'string', description: 'add: pasted article or note text, used instead of fetching.' },
        title: { type: 'string', description: 'add/update: title.' },
        notes: { type: 'string', description: 'add/update: the user\'s notes; replaces existing notes on update.' },
        tags: { type: 'array', items: { type: 'string' }, description: 'add/update: tag list; replaces existing tags on update.' },
        status: { type: 'string', enum: ['unread', 'reading', 'done', 'all'], description: 'list: filter (default all). update: new status.' },
        progress: { type: 'number', description: 'update: reading progress percentage 0-100.' },
        tag: { type: 'string', description: 'list: only items with this tag.' },
        query: { type: 'string', description: 'list: keyword filter.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, run, 'reading-list');
}
