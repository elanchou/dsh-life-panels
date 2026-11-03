import { createHash } from 'node:crypto';
import { stripHtml, decodeEntities, clip } from './common.js';

/** Podcast RSS parsing (RSS 2.0 + iTunes namespace). Regex-based; tolerant of truncated feeds. */

function tag(block, name) {
  const re = new RegExp('<' + name + '(?:\\s[^>]*)?>([\\s\\S]*?)</' + name + '>', 'i');
  const m = re.exec(block);
  return m ? m[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') : '';
}
function attr(block, tagName, attrName) {
  const re = new RegExp('<' + tagName + '\\b([^>]*)/?>', 'i');
  const m = re.exec(block);
  if (!m) return '';
  const a = new RegExp(attrName + '\\s*=\\s*["\']([^"\']+)["\']', 'i').exec(m[1]);
  return a ? decodeEntities(a[1]).trim() : '';
}
function httpUrl(s) { return /^https?:\/\//i.test(s || '') ? s : ''; }

export function parseDuration(raw) {
  const s = String(raw || '').trim();
  if (!s) return 0;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(Number(s));
  const parts = s.split(':').map(Number);
  if (parts.some((n) => !Number.isFinite(n))) return 0;
  return parts.reduce((a, n) => a * 60 + n, 0);
}

export const shortHash = (s) => createHash('sha1').update(String(s)).digest('hex').slice(0, 12);

export function parsePodcast(xml, { limit = 60 } = {}) {
  const head = (/^[\s\S]*?(?=<item[\s>])/i.exec(xml) || [xml.slice(0, 20000)])[0];
  const show = {
    title: clip(stripHtml(tag(head, 'title')), 120),
    author: clip(stripHtml(tag(head, 'itunes:author')), 80),
    description: clip(stripHtml(tag(head, 'itunes:summary') || tag(head, 'description')), 600),
    image: httpUrl(attr(head, 'itunes:image', 'href')) || httpUrl(stripHtml(tag(tag(head, 'image'), 'url'))),
    link: httpUrl(stripHtml(tag(head, 'link'))),
  };
  const blocks = xml.match(/<item[\s>][\s\S]*?<\/item>/gi) || [];
  const episodes = [];
  for (const block of blocks.slice(0, limit)) {
    const audio = httpUrl(attr(block, 'enclosure', 'url'));
    if (!audio) continue;
    const title = clip(stripHtml(tag(block, 'title')), 300);
    const guid = stripHtml(tag(block, 'guid')) || audio;
    const ts = Date.parse(stripHtml(tag(block, 'pubDate')));
    const notesHtml = tag(block, 'content:encoded') || tag(block, 'description') || tag(block, 'itunes:summary');
    episodes.push({
      key: shortHash(guid),
      title,
      audio,
      type: attr(block, 'enclosure', 'type') || 'audio/mpeg',
      duration: parseDuration(stripHtml(tag(block, 'itunes:duration'))),
      publishedAt: Number.isFinite(ts) ? new Date(ts).toISOString() : null,
      image: httpUrl(attr(block, 'itunes:image', 'href')) || null,
      link: httpUrl(stripHtml(tag(block, 'link'))) || null,
      summary: clip(stripHtml(notesHtml), 280),
      notesHtml,
    });
  }
  return { show, episodes };
}

/** Shownotes as plain paragraphs for the UI and the agent; keeps line breaks from block tags. */
export function notesText(html, max = 6000) {
  const withBreaks = decodeEntities(String(html || '')
    .replace(/<(br|\/p|\/li|\/h\d|\/div)[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '• '))
    .replace(/<[^>]+>/g, '');
  return withBreaks.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n').slice(0, max);
}
