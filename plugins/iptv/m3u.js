import { createHash } from 'node:crypto';

/** M3U / M3U8 playlist parsing for the IPTV panel (pure functions, no I/O). */

export const channelId = (url) => createHash('sha1').update(String(url)).digest('hex').slice(0, 12);

/** key="value" attributes of an #EXTINF line. */
function attributes(line) {
  const out = {};
  for (const m of line.matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)) out[m[1].toLowerCase()] = m[2];
  return out;
}

function hostName(url) {
  try { return new URL(url).hostname; } catch { return url; }
}

/**
 * Parse an M3U playlist into channels. A bare HLS media/master playlist (#EXT-X-*) counts as one channel,
 * so pasting a single stream URL works too. Duplicate stream URLs collapse into the first entry.
 * Returns { channels: [{ id, name, url, logo, group, tvgId }], groups: [{ name, count }] }.
 */
export function parsePlaylist(text, sourceUrl = '', fallbackGroup = 'Other') {
  const lines = String(text || '').replace(/^\uFEFF/, '').split(/\r?\n/);
  const channels = [];
  const seen = new Set();
  let meta = null;
  let group = '';
  const isStream = lines.some((l) => /^#EXT-X-(STREAM-INF|TARGETDURATION|MEDIA-SEQUENCE)/.test(l));
  if (isStream && sourceUrl) {
    const url = sourceUrl;
    return finish([{ id: channelId(url), name: hostName(url), url, logo: '', group: fallbackGroup, tvgId: '' }]);
  }
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    if (line.startsWith('#EXTINF')) {
      const comma = line.indexOf(',', line.lastIndexOf('"') + 1 || 0);
      const attrs = attributes(line);
      meta = {
        name: (comma >= 0 ? line.slice(comma + 1) : '').trim(),
        logo: attrs['tvg-logo'] || '',
        group: attrs['group-title'] || group,
        tvgId: attrs['tvg-id'] || '',
        tvgName: attrs['tvg-name'] || '',
      };
    } else if (line.startsWith('#EXTGRP:')) {
      group = line.slice(8).trim();
      if (meta && !meta.group) meta.group = group;
    } else if (line.startsWith('#')) {
      continue;
    } else if (/^[a-z][a-z0-9+.-]*:\/\//i.test(line)) {
      if (seen.has(line)) { meta = null; continue; }
      seen.add(line);
      const m = meta || {};
      channels.push({
        id: channelId(line),
        name: m.name || m.tvgName || hostName(line),
        url: line,
        logo: /^https?:/i.test(m.logo || '') ? m.logo : '',
        group: (m.group || fallbackGroup).trim() || fallbackGroup,
        tvgId: m.tvgId || '',
      });
      meta = null;
    }
  }
  return finish(channels);
}

function finish(channels) {
  const counts = new Map();
  for (const c of channels) counts.set(c.group, (counts.get(c.group) || 0) + 1);
  const groups = [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
  return { channels, groups };
}

/** Rewrite every URI in an HLS playlist through `wrap(absoluteUrl)`; `base` resolves relative references. */
export function rewriteHls(text, base, wrap) {
  const abs = (ref) => {
    try {
      const u = new URL(ref, base);
      return u.protocol === 'http:' || u.protocol === 'https:' ? wrap(u.href) : ref;
    } catch { return ref; }
  };
  return String(text).split(/\r?\n/).map((line) => {
    const t = line.trim();
    if (!t) return line;
    if (t.startsWith('#')) return line.replace(/URI="([^"]*)"/g, (_m, ref) => 'URI="' + abs(ref) + '"');
    return abs(t);
  }).join('\n');
}
