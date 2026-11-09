// Daily podcast picks: the model answers with candidate numbers; the plugin validates them and caches per day.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { parsePicks } from '../plugins/podcasts/picks.js';

const cands = [
  { id: 'a:1', showId: 'a', title: 'A1' }, { id: 'a:2', showId: 'a', title: 'A2' },
  { id: 'b:1', showId: 'b', title: 'B1' }, { id: 'c:1', showId: 'c', title: 'C1' },
];

test('parsePicks ignores invented numbers and duplicates, tolerates code fences', () => {
  const out = parsePicks('```json\n{"picks":[{"n":9,"reason":"x"},{"n":3,"reason":"good"},{"n":3,"reason":"dup"},{"n":4,"reason":"ok"}]}\n```', cands);
  assert.deepEqual(out.map((p) => p.id), ['b:1', 'c:1']);
  assert.equal(out[0].reason, 'good');
});

test('parsePicks prefers one episode per show while there is room', () => {
  const out = parsePicks('{"picks":[{"n":1,"reason":"r"},{"n":2,"reason":"r"},{"n":3,"reason":"r"},{"n":4,"reason":"r"}]}', cands);
  assert.deepEqual(out.map((p) => p.id), ['a:1', 'b:1', 'c:1']);
});

test("parsePicks fills from the same show when variety is not possible", () => {
  const out = parsePicks(`{"picks":[{"n":1,"reason":"r"},{"n":2,"reason":"r"}]}`, cands);
  assert.deepEqual(out.map((p) => p.id), ["a:1", "a:2"]);
});

test('parsePicks rejects answers without valid picks', () => {
  assert.throws(() => parsePicks('no json here', cands));
  assert.throws(() => parsePicks('{"picks":[{"n":99}]}', cands));
});

const homes = [];
after(() => Promise.all(homes.map((d) => fs.rm(d, { recursive: true, force: true }))));

test('picks tool generates once per day, then serves the cache', async () => {
  const home = await fs.mkdtemp(path.join(os.tmpdir(), 'picks-'));
  homes.push(home);
  process.env.DSH_HOME = home;
  const items = [1, 2, 3, 4].map((i) => `<item><title>Ep${i}</title><guid>g${i}</guid><pubDate>${new Date(Date.now() - i * 3600000).toUTCString()}</pubDate><description>desc ${i}</description><enclosure url="http://x/a${i}.mp3" type="audio/mpeg" length="1"/></item>`).join('');
  const rss = `<?xml version="1.0"?><rss version="2.0"><channel><title>T</title>${items}</channel></rss>`;
  const server = http.createServer((req, res) => { res.setHeader('content-type', 'application/rss+xml'); res.end(rss); });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const url = `http://127.0.0.1:${server.address().port}/f.xml`;
  let calls = 0;
  const llm = {
    async prepareCall(cfg) {
      return { config: cfg, async *stream() { calls++; yield { type: 'text-delta', index: 0, text: '{"picks":[{"n":1,"reason":"new"},{"n":2,"reason":"two"},{"n":3,"reason":"three"}]}' }; yield { type: 'finish', reason: { kind: 'stop' } }; } };
    },
  };
  let run;
  const ctx = {
    effect: (f, label) => { if (/tool/.test(label)) f(); }, webServer: { register() {} }, connection: {}, tools: { register: (d) => { run = d.execute; } },
    get: (name) => (name === 'llm' ? llm : name === 'agentDefaultModel' ? { currentSelection: () => ({ provider: 'p', model: 'm' }) } : undefined),
  };
  const { apply } = await import('../plugins/podcasts/index.js');
  apply(ctx);
  try {
    assert.equal((await run({ action: 'subscribe', feedUrl: url })).ok, true);
    const first = await run({ action: 'picks' });
    assert.equal(first.episodes.length, 3);
    assert.equal(first.episodes[0].reason, 'new');
    const second = await run({ action: 'picks' });
    assert.equal(second.episodes.length, 3);
    assert.equal(calls, 1, 'second call is served from the cache');
    await run({ action: 'picks', refresh: true });
    assert.equal(calls, 2);
  } finally { server.closeAllConnections(); server.close(); }
});
