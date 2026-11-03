import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { merge3, withFileLock } from './merge.js';

/** Shared Host helpers for the local life-panel plugins (calendar, news, reading, travel). */

export const uid = () => randomUUID();

export function localToday() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

export function dataFile(name) {
  const home = process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
  return path.join(home, 'plugin-data', name + '.json');
}

/** JSON document store; writes are serialized and atomic (temp file + rename). */
async function mtimeOf(file) {
  try { return (await fs.stat(file)).mtimeMs; } catch { return null; }
}

/**
 * JSON document store. Writes are serialized, atomic (temp file + rename) and hold the shared per-file lock.
 * Another writer (cloud sync) may replace the file: load() then re-reads it, and save() three-way merges
 * this process's changes onto the newer file instead of overwriting it.
 */
export class Store {
  constructor(file, initial) {
    this.file = file;
    this.initial = initial;
    this.data = null;
    this.baseText = null;
    this.mtime = null;
    this.queue = Promise.resolve();
  }
  async load() {
    const mtime = await mtimeOf(this.file);
    if (this.data && mtime === this.mtime) return this.data;
    const disk = await readDoc(this.file);
    this.data = { ...this.initial(), ...(disk || {}) };
    this.baseText = JSON.stringify(this.data);
    this.mtime = mtime;
    return this.data;
  }
  save() {
    const run = () => withFileLock(this.file, async () => {
      const mtime = await mtimeOf(this.file);
      if (this.baseText !== null && mtime !== this.mtime) {
        const disk = { ...this.initial(), ...((await readDoc(this.file)) || {}) };
        replaceContents(this.data, merge3(JSON.parse(this.baseText), this.data, disk));
      }
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      const text = JSON.stringify(this.data, null, 2);
      const tmp = this.file + '.' + process.pid + '.tmp';
      await fs.writeFile(tmp, text);
      await fs.rename(tmp, this.file);
      this.baseText = JSON.stringify(this.data);
      this.mtime = await mtimeOf(this.file);
    });
    this.queue = this.queue.then(run, run);
    return this.queue;
  }
}

async function readDoc(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch (error) {
    if (error && error.code === 'ENOENT') return null;
    throw error;
  }
}
/** Keep the top-level object identity (callers hold `data`) while adopting the merged contents. */
function replaceContents(target, source) {
  for (const k of Object.keys(target)) if (!(k in source)) delete target[k];
  Object.assign(target, source);
}

/** Authenticated JSON POST route used by the plugin's own Web UI. */
export function registerRoute(ctx, routePath, run, label) {
  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: routePath,
    async handler(req, res) {
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify(body));
      };
      const rejection = ctx.connection.requestRejection({ headers: req.headers });
      if (rejection) return send(rejection, { ok: false, error: 'unauthorized' });
      if (req.method !== 'POST') return send(405, { ok: false, error: 'POST only' });
      try {
        let raw = '';
        for await (const chunk of req) {
          raw += chunk;
          if (raw.length > 256 * 1024) return send(413, { ok: false, error: 'request too large' });
        }
        const input = raw ? JSON.parse(raw) : {};
        send(200, await run(input, undefined));
      } catch (error) {
        send(500, { ok: false, error: errorText(error) });
      }
    },
  }), label + ': route');
}

/** Agent tool that calls the same operation as the UI route. */
export function registerTool(ctx, definition, run, label) {
  ctx.effect(() => ctx.tools.register({
    ...definition,
    output: {
      schema: { type: 'object' },
      render: (_args, value) => [{ type: 'text', text: JSON.stringify(value, null, 2) }],
    },
    async execute(args, exec) {
      const result = await run(args || {}, exec && exec.agent ? exec.agent.id : undefined);
      if (!result.ok) throw new Error(result.error);
      return result;
    },
  }), label + ': tool');
}

export function errorText(error) {
  return error && error.message ? error.message : String(error);
}

/** Fetch text with a timeout and a size cap; only http(s) URLs are accepted. */
export async function fetchText(url, { timeoutMs = 10000, maxBytes = 2 * 1024 * 1024, accept } = {}) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('invalid URL'); }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('only http(s) URLs are supported');
  const response = await fetch(parsed, {
    redirect: 'follow',
    signal: AbortSignal.timeout(timeoutMs),
    headers: {
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) DSH-LifePanels/1.0',
      accept: accept || '*/*',
    },
  });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    chunks.push(value);
    if (size > maxBytes) { await reader.cancel(); break; }
  }
  const buf = Buffer.concat(chunks.map((c) => Buffer.from(c)));
  const type = response.headers.get('content-type') || '';
  let charset = (/charset=([\w-]+)/i.exec(type) || [])[1];
  if (!charset) charset = (/<meta[^>]+charset=["']?([\w-]+)/i.exec(buf.subarray(0, 4096).toString('latin1')) || [])[1];
  if (!charset) charset = (/encoding=["']([\w-]+)["']/i.exec(buf.subarray(0, 200).toString('latin1')) || [])[1];
  let text;
  try { text = new TextDecoder(charset || 'utf-8').decode(buf); } catch { text = buf.toString('utf8'); }
  return { text, finalUrl: response.url || String(parsed) };
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', middot: '·' };
export function decodeEntities(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (m, e) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
      try { return String.fromCodePoint(code); } catch { return m; }
    }
    return ENTITIES[e.toLowerCase()] ?? m;
  });
}

export function stripHtml(s) {
  return decodeEntities(String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' '))
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function clip(s, n) {
  const str = String(s || '');
  return str.length > n ? str.slice(0, n - 1).trimEnd() + '…' : str;
}
