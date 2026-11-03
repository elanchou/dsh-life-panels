// Run with `npm test` (node --test). Uses a local fake of the GitHub Contents API; no network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { merge3 } from '../shared/host/merge.js';
import { GitHubRepo, syncFile } from '../plugins/cloud-sync/engine.js';

const base = { version: 1, items: [{ id: 'a', title: 'A', updatedAt: '2026-01-01T00:00:00Z', tags: ['x'] }, { id: 'b', title: 'B' }] };

test('merge3 combines independent edits, additions and deletions', () => {
  const local = { version: 1, items: [{ id: 'a', title: 'A-local', updatedAt: '2026-01-02T00:00:00Z', tags: ['x', 'l'] }, { id: 'c', title: 'C' }] };
  const remote = { version: 1, items: [{ id: 'a', title: 'A', updatedAt: '2026-01-01T00:00:00Z', tags: ['x', 'r'], notes: 'n' }, { id: 'b', title: 'B' }, { id: 'd', title: 'D' }] };
  const stats = { conflicts: 0 };
  const m = merge3(base, local, remote, stats);
  assert.deepEqual(m.items.map((i) => i.id), ['a', 'c', 'd']);
  assert.equal(m.items[0].title, 'A-local');
  assert.equal(m.items[0].notes, 'n');
  assert.deepEqual(m.items[0].tags, ['x', 'l', 'r']);
  assert.equal(stats.conflicts, 0);
});

test('merge3 resolves a same-field conflict by the newer updatedAt', () => {
  const stats = { conflicts: 0 };
  const edit = (title, at) => ({ items: [{ ...base.items[0], title, updatedAt: at }, base.items[1]] });
  const m = merge3(base, edit('L', '2026-01-03T00:00:00Z'), edit('R', '2026-01-05T00:00:00Z'), stats);
  assert.equal(m.items[0].title, 'R');
  assert.ok(stats.conflicts > 0);
});

test('merge3 keeps an edit over a concurrent delete', () => {
  const stats = { conflicts: 0 };
  const m = merge3(base, { version: 1, items: [base.items[0]] }, { version: 1, items: [base.items[0], { id: 'b', title: 'B2' }] }, stats);
  assert.deepEqual(m.items.map((i) => i.title), ['A', 'B2']);
  assert.equal(stats.conflicts, 1);
});

test('merge3 first sync pairs records by url and handles lazily initialised lists', () => {
  const a = { feeds: [{ id: '1', url: 'u1' }, { id: '2', url: 'u2' }] };
  const b = { feeds: [{ id: '9', url: 'u1' }, { id: '8', url: 'u3' }] };
  assert.deepEqual(merge3(undefined, a, b).feeds.map((f) => f.url), ['u1', 'u2', 'u3']);
  assert.deepEqual(merge3(undefined, { feeds: null }, a), a);
});

test('merge3 merges keyed maps such as podcast progress', () => {
  const m = merge3({ progress: { e1: { position: 10 } } }, { progress: { e1: { position: 50 } } }, { progress: { e1: { position: 10 }, e2: { position: 5 } } });
  assert.deepEqual(m.progress, { e1: { position: 50 }, e2: { position: 5 } });
});

function fakeGitHub() {
  const files = new Map();
  let n = 0;
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const send = (status, obj, raw) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(raw ?? JSON.stringify(obj)); };
    const m = /^\/repos\/o\/r\/contents\/(.+)$/.exec(new URL(req.url, 'http://x').pathname);
    if (!m) return send(404, { message: 'Not Found' });
    const p = decodeURIComponent(m[1]);
    if (req.method === 'GET' && p === 'dsh-sync') {
      const list = [...files].filter(([k]) => k.startsWith('dsh-sync/')).map(([k, v]) => ({ type: 'file', name: k.slice(9), sha: v.sha }));
      return list.length ? send(200, list) : send(404, { message: 'Not Found' });
    }
    if (req.method === 'GET') { const f = files.get(p); return f ? send(200, null, f.text) : send(404, { message: 'Not Found' }); }
    if (req.method === 'PUT') {
      const b = JSON.parse(body);
      const cur = files.get(p);
      if ((cur && cur.sha !== b.sha) || (!cur && b.sha)) return send(409, { message: 'sha mismatch' });
      const sha = 's' + (++n);
      files.set(p, { sha, text: Buffer.from(b.content, 'base64').toString('utf8') });
      return send(cur ? 200 : 201, { content: { sha } });
    }
    send(405, {});
  });
  return { server, files };
}

test('two devices converge through the GitHub contents API, including a stale-sha race', async () => {
  const { server } = fakeGitHub();
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'life-panels-sync-'));
  try {
    const gh = new GitHubRepo({ token: 't', owner: 'o', repo: 'r', branch: 'main', dir: 'dsh-sync', api: 'http://127.0.0.1:' + server.address().port });
    const refreshSha = async (name) => (await gh.listing())[name] || null;
    const device = async (id) => { await fs.mkdir(path.join(dir, id)); return { localFile: path.join(dir, id, 'data.json'), baseFile: path.join(dir, id, 'base.json'), state: null }; };
    const A = await device('A'); const B = await device('B');
    const write = (D, v) => fs.writeFile(D.localFile, JSON.stringify(v));
    const read = async (D) => JSON.parse(await fs.readFile(D.localFile, 'utf8'));
    const sync = async (D, remoteSha) => {
      const sha = remoteSha !== undefined ? remoteSha : (await gh.listing()).data || null;
      const r = await syncFile({ gh, name: 'data', localFile: D.localFile, baseFile: D.baseFile, remoteSha: sha, state: D.state, message: 'test', refreshSha });
      D.state = { sha: r.sha };
      return r.status;
    };
    const ids = async (D) => (await read(D)).items.map((i) => i.id).sort();

    await write(A, { version: 1, items: [{ id: '1', title: 'one' }] });
    assert.equal(await sync(A), 'uploaded');
    await write(B, { version: 1, items: [{ id: '2', title: 'two' }] });
    assert.equal(await sync(B), 'merged');
    assert.equal(await sync(A), 'downloaded');
    assert.deepEqual(await ids(A), ['1', '2']);
    assert.equal(await sync(A), 'unchanged');

    const a = await read(A); a.items = a.items.filter((i) => i.id !== '2'); await write(A, a);
    const b = await read(B); b.items.find((i) => i.id === '1').title = 'ONE'; await write(B, b);
    await sync(A); await sync(B); await sync(A);
    assert.deepEqual(await read(A), { version: 1, items: [{ id: '1', title: 'ONE' }] });
    assert.deepEqual(await read(B), await read(A));

    const stale = (await gh.listing()).data;
    const a2 = await read(A); a2.items.push({ id: '3' }); await write(A, a2); await sync(A);
    const b2 = await read(B); b2.items.push({ id: '4' }); await write(B, b2);
    assert.equal(await sync(B, stale), 'merged');
    assert.deepEqual(await ids(B), ['1', '3', '4']);
  } finally {
    server.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('Store merges its pending changes onto a file replaced by another writer', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'life-panels-store-'));
  const prev = process.env.DSH_HOME;
  process.env.DSH_HOME = dir;
  try {
    const { Store, dataFile } = await import('../shared/host/common.js');
    const file = dataFile('reading-list');
    const store = new Store(file, () => ({ version: 1, items: [] }));
    const data = await store.load();
    data.items.push({ id: '1', title: 'one' });
    await store.save();
    const held = data.items[0];
    await new Promise((r) => setTimeout(r, 20));
    await fs.writeFile(file, JSON.stringify({ version: 1, items: [{ id: '1', title: 'one' }, { id: '2', title: 'from cloud' }] }));
    held.title = 'edited locally';
    await store.save();
    const disk = JSON.parse(await fs.readFile(file, 'utf8'));
    assert.deepEqual(disk.items.map((i) => i.title).sort(), ['edited locally', 'from cloud']);
    assert.equal((await store.load()).items.length, 2);
  } finally {
    if (prev === undefined) delete process.env.DSH_HOME; else process.env.DSH_HOME = prev;
    await fs.rm(dir, { recursive: true, force: true });
  }
});
