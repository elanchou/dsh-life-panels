/**
 * Minimal client for YouTube's web ("innertube") JSON API, the same endpoints youtube.com calls.
 * No API key or login. It is not a public API, so every parser here is defensive and returns
 * empty results instead of throwing on unexpected shapes.
 */
const BASE = 'https://www.youtube.com/youtubei/v1/';
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const VIDEOS_TAB = 'EgZ2aWRlb3PyBgQKAjoA';
const CHANNEL_FILTER = 'EgIQAg==';
const HL = 'zh-CN';
let clientVersion = '2.20250101.00.00';
let versionChecked = false;

export const CHANNEL_ID_RE = /^UC[\w-]{22}$/;

async function post(endpoint, body) {
  const res = await fetch(BASE + endpoint + '?prettyPrint=false', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': UA, 'accept-language': HL + ',zh;q=0.9,en;q=0.8' },
    body: JSON.stringify({ context: { client: { clientName: 'WEB', clientVersion, hl: HL } }, ...body }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw Object.assign(new Error('YouTube HTTP ' + res.status), { status: res.status });
  return res.json();
}
/** Retries once with the client version the YouTube home page currently advertises. */
async function call(endpoint, body) {
  try { return await post(endpoint, body); } catch (error) {
    if (versionChecked || !(error.status >= 400 && error.status < 500)) throw error;
    versionChecked = true;
    const html = await (await fetch('https://www.youtube.com/', { headers: { 'user-agent': UA }, signal: AbortSignal.timeout(15000) })).text();
    const m = /"INNERTUBE_CLIENT_VERSION":"([\d.]+)"/.exec(html);
    if (!m || m[1] === clientVersion) throw error;
    clientVersion = m[1];
    return post(endpoint, body);
  }
}

function collect(node, key, out = []) {
  if (Array.isArray(node)) { for (const v of node) collect(v, key, out); return out; }
  if (node && typeof node === 'object') {
    for (const [k, v] of Object.entries(node)) { if (k === key) out.push(v); else collect(v, key, out); }
  }
  return out;
}
const text = (t) => (!t ? '' : typeof t === 'string' ? t : t.simpleText || t.content || (t.runs || []).map((r) => r.text).join('') || '');
const https = (u) => (u && u.startsWith('//') ? 'https:' + u : u || '');
/** Smallest-sufficient avatar; Google image URLs carry their size as =sNNN, so ask for 176px. */
const pickThumb = (list) => https(((list || []).slice().sort((a, b) => (b.width || 0) - (a.width || 0)).find((t) => (t.width || 0) <= 200) || (list || [])[0] || {}).url)
  .replace(/=s\d+-/, '=s176-');

const UNIT_MS = { s: 1e3, mi: 6e4, h: 36e5, d: 864e5, w: 6048e5, mo: 2592e6, y: 31536e6 };
const ZH_UNIT = { 秒: 's', 秒钟: 's', 分钟: 'mi', 小时: 'h', 天: 'd', 周: 'w', 星期: 'w', 个月: 'mo', 月: 'mo', 年: 'y' };
const EN_UNIT = { second: 's', minute: 'mi', hour: 'h', day: 'd', week: 'w', month: 'mo', year: 'y' };
/** "16小时前" / "2 weeks ago" -> approximate epoch ms, or null. */
export function parseAgo(s, now = Date.now()) {
  if (!s) return null;
  let m = /(\d+)\s*(秒钟|秒|分钟|小时|天|星期|周|个月|月|年)前/.exec(s);
  if (m) return now - Number(m[1]) * UNIT_MS[ZH_UNIT[m[2]]];
  m = /(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i.exec(s);
  if (m) return now - Number(m[1]) * UNIT_MS[EN_UNIT[m[2].toLowerCase()]];
  return null;
}

function videoFromLockup(v) {
  if (!v || v.contentType !== 'LOCKUP_CONTENT_TYPE_VIDEO' || !v.contentId) return null;
  const md = (v.metadata && v.metadata.lockupMetadataViewModel) || {};
  const parts = (collect(md, 'metadataParts')[0] || []).map((p) => text(p.text));
  const badge = collect(v.contentImage, 'thumbnailBadgeViewModel').map((b) => b.text).find(Boolean) || '';
  return { id: v.contentId, title: text(md.title), views: parts[0] || '', ago: parts[1] || '', duration: badge };
}
function videoFromRenderer(v) {
  if (!v || !v.videoId) return null;
  return { id: v.videoId, title: text(v.title), views: text(v.shortViewCountText) || text(v.viewCountText), ago: text(v.publishedTimeText), duration: text(v.lengthText) };
}

/** Latest uploads from a channel's Videos tab (newest first, about 30), plus channel metadata. */
export async function channelVideos(channelId) {
  const json = await call('browse', { browseId: channelId, params: VIDEOS_TAB });
  const meta = collect(json, 'channelMetadataRenderer')[0] || {};
  const channel = {
    id: meta.externalId || channelId,
    title: meta.title || '',
    handle: ((meta.vanityChannelUrl || '').match(/\/(@[^/?#]+)/) || [])[1] || '',
    avatar: pickThumb(meta.avatar && meta.avatar.thumbnails),
  };
  if (channel.handle) try { channel.handle = decodeURIComponent(channel.handle); } catch { /* keep encoded */ }
  const seen = new Set();
  const videos = [...collect(json, 'lockupViewModel').map(videoFromLockup), ...collect(json, 'videoRenderer').map(videoFromRenderer)]
    .filter((v) => v && !seen.has(v.id) && seen.add(v.id));
  return { channel, videos };
}

/** Channel search results. In the current layout the "subscriber" field holds the @handle and the "video count" field the subscriber count. */
export async function searchChannels(query) {
  const json = await call('search', { query, params: CHANNEL_FILTER });
  return collect(json, 'channelRenderer').filter((c) => c.channelId).slice(0, 12).map((c) => {
    const a = text(c.subscriberCountText); const b = text(c.videoCountText);
    const handle = a.startsWith('@') ? a : '';
    return {
      id: c.channelId, title: text(c.title), handle, avatar: pickThumb(c.thumbnail && c.thumbnail.thumbnails),
      subscribers: handle ? b : a, description: text(c.descriptionSnippet).slice(0, 160),
    };
  });
}

/** Accepts a channel id, a channel/@handle URL, or a bare @handle and returns the channel id, or null. */
export async function resolveChannel(input) {
  const s = String(input || '').trim();
  if (CHANNEL_ID_RE.test(s)) return s;
  const direct = /youtube\.com\/channel\/(UC[\w-]{22})/.exec(s);
  if (direct) return direct[1];
  let url = null;
  if (/^@[^\s/]+$/.test(s)) url = 'https://www.youtube.com/' + s;
  else if (/^(https?:\/\/)?(www\.|m\.)?youtube\.com\/(@|c\/|user\/)[^\s]+/i.test(s)) url = s.startsWith('http') ? s : 'https://' + s;
  if (!url) return null;
  const json = await call('navigation/resolve_url', { url: url.replace(/^http:/, 'https:') });
  const id = json && json.endpoint && json.endpoint.browseEndpoint && json.endpoint.browseEndpoint.browseId;
  return id && CHANNEL_ID_RE.test(id) ? id : null;
}
