import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { GitHubRepo, syncBatch, blobSha, fileText } from '../plugins/cloud-sync/engine.js';
import { parseInbox, runRequests, appendOutbox } from '../plugins/cloud-sync/inbox.js';

/** A tiny GitHub fake: Contents API reads, and the Git Data API (refs, commits, trees) for writes. */
function fakeGit() {
  const blobs = new Map(); // path -> { sha, text }
  const commits = [];      // { sha, tree: Map, parent, message }
  let head = null;
  let n = 0;
  let raceOnce = false;
  const snapshot = () => new Map(blobs);
  const server = http.createServer(async (req, res) => {
    let body = '';
    for await (const c of req) body += c;
    const send = (status, obj, raw) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(raw ?? JSON.stringify(obj)); };
    const p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let m;
    if (req.method === 'GET' && p === '/repos/o/r/contents/dsh-sync/inbox') {
      const list = [...blobs].filter(([k]) => k.startsWith('dsh-sync/inbox/')).map(([k, v]) => ({ type: 'file', name: k.slice(15), path: k, sha: v.sha }));
      return list.length ? send(200, list) : send(404, {});
    }
    if (req.method === 'GET' && p === '/repos/o/r/contents/dsh-sync') {
      const list = [...blobs].filter(([k]) => k.startsWith('dsh-sync/')).map(([k, v]) => ({ type: 'file', name: k.slice(9), sha: v.sha }));
      return list.length ? send(200, list) : send(404, { message: 'Not Found' });
    }
    if (req.method === 'GET' && (m = /^\/repos\/o\/r\/contents\/(.+)$/.exec(p))) { const f = blobs.get(m[1]); return f ? send(200, null, f.text) : send(404, {}); }
    if (req.method === 'PUT' && (m = /^\/repos\/o\/r\/contents\/(.+)$/.exec(p))) {
      const b = JSON.parse(body); const cur = blobs.get(m[1]);
      if ((cur && cur.sha !== b.sha) || (!cur && b.sha)) return send(409, {});
      const text = Buffer.from(b.content, 'base64').toString('utf8');
      blobs.set(m[1], { sha: blobSha(text), text });
      head = 'c' + (++n); commits.push({ sha: head, message: b.message, files: [m[1]] });
      return send(cur ? 200 : 201, { content: { sha: blobSha(text) } });
    }
    if (req.method === 'GET' && p === '/repos/o/r/git/ref/heads/main') return head ? send(200, { object: { sha: head } }) : send(404, {});
    if (req.method === 'GET' && (m = /^\/repos\/o\/r\/git\/commits\/(.+)$/.exec(p))) return send(200, { sha: m[1], tree: { sha: 't-' + m[1] } });
    if (req.method === 'POST' && p === '/repos/o/r/git/trees') { const b = JSON.parse(body); const id = 'tree' + (++n); pendingTrees.set(id, b.tree); return send(201, { sha: id }); }
    if (req.method === 'POST' && p === '/repos/o/r/git/commits') { const b = JSON.parse(body); const id = 'c' + (++n); pendingCommits.set(id, { parent: b.parents[0], tree: b.tree, message: b.message }); return send(201, { sha: id }); }
    if (req.method === 'PATCH' && p === '/repos/o/r/git/refs/heads/main') {
      const b = JSON.parse(body); const c = pendingCommits.get(b.sha);
      if (raceOnce) { raceOnce = false; head = 'other' + (++n); commits.push({ sha: head, message: 'someone else', files: [] }); }
      if (c.parent !== head) return send(422, { message: 'Update is not a fast forward' });
      for (const entry of pendingTrees.get(c.tree)) {
        if (entry.sha === null) blobs.delete(entry.path);
        else blobs.set(entry.path, { sha: blobSha(entry.content), text: entry.content });
      }
      head = b.sha; commits.push({ sha: head, message: c.message, files: pendingTrees.get(c.tree).map((e) => e.path) });
      return send(200, { object: { sha: head } });
    }
    send(404, { message: 'no route ' + req.method + ' ' + p });
  });
  const pendingTrees = new Map(); const pendingCommits = new Map();
  // What another agent does: commit one inbox file straight to the branch.
  const agentCommit = (filePath, text) => { blobs.set(filePath, { sha: blobSha(text), text }); head = 'agent' + (++n); commits.push({ sha: head, message: 'agent inbox', files: [filePath] }); };
  return { server, commits, blobs, snapshot, agentCommit, race: () => { raceOnce = true; } };
}

test('a sync writes every changed file in one commit, and redoes the run when the branch moves', async () => {
  const g = fakeGit();
  await new Promise((r) => g.server.listen(0, '127.0.0.1', r));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-batch-'));
  try {
    const gh = new GitHubRepo({ token: 't', owner: 'o', repo: 'r', branch: 'main', dir: 'dsh-sync', api: 'http://127.0.0.1:' + g.server.address().port });
    const device = async (id) => {
      await fs.mkdir(path.join(dir, id));
      const names = ['notes', 'calendar', 'market'];
      return { files: names.map((name) => ({ name, localFile: path.join(dir, id, name + '.json'), baseFile: path.join(dir, id, name + '.base.json'), state: null })) };
    };
    const A = await device('A'); const B = await device('B');
    const put = (D, name, v) => fs.writeFile(D.files.find((f) => f.name === name).localFile, JSON.stringify(v));
    const get = async (D, name) => JSON.parse(await fs.readFile(D.files.find((f) => f.name === name).localFile, 'utf8'));
    const sync = async (D) => {
      const r = await syncBatch({ gh, files: D.files, message: 'sync' });
      for (const x of r.results) D.files.find((f) => f.name === x.name).state = { sha: x.sha };
      return r;
    };

    // First sync on an empty repo uses the Contents API (no branch yet), one write per file.
    await put(A, 'notes', { notes: [{ id: 'n1', body: 'a' }] });
    await sync(A);
    const before = g.commits.length;

    // Three files change on A: exactly one commit.
    await put(A, 'notes', { notes: [{ id: 'n1', body: 'a' }, { id: 'n2', body: 'b' }] });
    await put(A, 'calendar', { items: [{ id: 'c1', title: 'x' }] });
    await put(A, 'market', { watchlist: [{ id: 'sh600519', key: 'sh600519' }] });
    const r1 = await sync(A);
    assert.equal(g.commits.length, before + 1);
    assert.equal(g.commits.at(-1).message, 'sync: notes, calendar, market');
    assert.equal(g.commits.at(-1).files.length, 3);
    assert.ok(r1.commit);
    // The blob shas we computed match what the server stores, so the next run sees no change.
    for (const x of r1.results) assert.equal(x.sha, g.blobs.get('dsh-sync/' + x.name + '.json').sha);
    const r2 = await sync(A);
    assert.equal(g.commits.length, before + 1, 'nothing changed, no commit');
    assert.ok(r2.results.every((x) => x.status === 'unchanged'));

    // B starts empty, pulls everything down without committing.
    await sync(B);
    assert.equal(g.commits.length, before + 1);
    assert.equal((await get(B, 'notes')).notes.length, 2);

    // Both edit; B's commit loses a race once and is redone on the new head.
    await put(A, 'notes', { notes: [{ id: 'n1', body: 'A edit' }, { id: 'n2', body: 'b' }] }); await sync(A);
    const bn = await get(B, 'notes'); bn.notes.push({ id: 'n3', body: 'from B' }); await put(B, 'notes', bn);
    g.race();
    await sync(B);
    await sync(A);
    const final = (await get(A, 'notes')).notes.map((x) => x.id + ':' + x.body).sort();
    assert.deepEqual(final, ['n1:A edit', 'n2:b', 'n3:from B']);
    assert.deepEqual(await get(B, 'notes'), await get(A, 'notes'));
    assert.equal(fileText({ a: 1 }), '{\n  "a": 1\n}\n');
  } finally {
    g.server.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('inbox requests run through the tool policy, results and deletions land in the same single commit', async () => {
  const g = fakeGit();
  await new Promise((r) => g.server.listen(0, '127.0.0.1', r));
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'sync-inbox-'));
  try {
    const gh = new GitHubRepo({ token: 't', owner: 'o', repo: 'r', branch: 'main', dir: 'dsh-sync', api: 'http://127.0.0.1:' + g.server.address().port });
    const notesFile = path.join(dir, 'notes.json');
    await fs.writeFile(notesFile, JSON.stringify({ version: 1, notes: [] }));
    const files = [{ name: 'notes', localFile: notesFile, baseFile: path.join(dir, 'notes.base.json'), state: null }];
    await syncBatch({ gh, files, message: 'sync' }); // first upload (Contents API)
    files[0].state = { sha: g.blobs.get('dsh-sync/notes.json').sha };
    // A fake notes tool that writes the local file, like the real plugins do.
    const tools = new Map([
      ['notes', { name: 'notes', parameters: { properties: { action: { enum: ['list', 'add'] } } }, run: async (args) => {
        const d = JSON.parse(await fs.readFile(notesFile, 'utf8'));
        if (args.action === 'add') { d.notes.push({ id: 'n' + (d.notes.length + 1), body: args.body, updatedAt: '2026-11-16T00:00:00Z' }); await fs.writeFile(notesFile, JSON.stringify(d)); return { ok: true, id: 'n' + d.notes.length }; }
        return { ok: true, total: d.notes.length };
      } }],
      ['cloud_sync', { name: 'cloud_sync', parameters: { properties: { action: { enum: ['status'] } } }, run: async () => ({ ok: true }) }],
    ]);
    g.agentCommit('dsh-sync/inbox/muse.jsonl', [
      '{"id":"r1","tool":"notes","args":{"action":"add","body":"from muse"}}',
      '{"id":"r2","tool":"cloud_sync","args":{"action":"status"}}',
      '{"tool":"notes","args":{"action":"delete","id":"x"}}',
      'not json',
    ].join('\n'));
    const before = g.commits.length;
    // The same steps the cloud-sync plugin takes: read inbox, run, then one batched commit.
    const listed = await gh.listDir('inbox');
    const reqs = parseInbox(await gh.readText(listed[0].path));
    const results = await runRequests(reqs, { tools: () => tools, now: () => 'T' });
    assert.deepEqual(results.map((r) => [r.id, r.ok]), [['r1', true], ['r2', false], [reqs[2].id, false], [reqs[3].id, false]]);
    assert.match(results[1].error, /Unknown tool/);
    assert.match(results[2].error, /not available/);
    const extra = () => [{ path: 'dsh-sync/outbox/results.jsonl', content: appendOutbox('', results) }, { path: listed[0].path, delete: true }];
    const out = await syncBatch({ gh, files, message: 'sync', extra });
    assert.equal(g.commits.length, before + 1, 'data change, results and inbox removal share one commit');
    assert.match(g.commits.at(-1).message, /notes, inbox$/);
    assert.ok(!g.blobs.has('dsh-sync/inbox/muse.jsonl'), 'processed inbox file is removed');
    assert.equal(g.blobs.get('dsh-sync/outbox/results.jsonl').text.trim().split('\n').length, 4);
    assert.equal(JSON.parse(g.blobs.get('dsh-sync/notes.json').text).notes[0].body, 'from muse');
    assert.ok(out.results.find((r) => r.name === 'notes').status === 'uploaded');
    // Ids without an explicit id are stable, so a line left behind never runs twice.
    assert.equal(parseInbox('{"tool":"notes"}')[0].id, parseInbox('{"tool":"notes"}')[0].id);
  } finally {
    g.server.close();
    await fs.rm(dir, { recursive: true, force: true });
  }
});
