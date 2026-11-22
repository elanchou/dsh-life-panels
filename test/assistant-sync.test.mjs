import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';

const home = await fs.mkdtemp(path.join(os.tmpdir(), 'assistant-sync-'));
process.env.DSH_HOME = home;
const { exportDoc, importDoc } = await import('../plugins/cloud-sync/assistant.js');

const vault = () => {
  const m = new Map();
  return { m, resolve: async (ref) => (m.has(ref) ? { value: m.get(ref) } : null), set: async (ref, v) => { m.set(ref, v); } };
};
const dir = path.join(home, 'personal-assistant');

test('export carries settings, tasks, the credentials the settings point at, and the Telegram session', async () => {
  await fs.mkdir(path.join(dir, 'worker'), { recursive: true });
  await fs.writeFile(path.join(dir, 'settings.json'), JSON.stringify({ assistantName: 'Lucy', livekitApiKeyEnv: 'MY_LK_KEY', telegramSession: 'dsh-voice' }));
  await fs.writeFile(path.join(dir, 'tasks.json'), JSON.stringify([{ id: 't1', title: 'a' }, { title: 'no id' }]));
  await fs.writeFile(path.join(dir, 'worker', 'dsh-voice.session'), Buffer.from([1, 2, 3]));
  const v = vault();
  v.m.set('MY_LK_KEY', 'key-1'); v.m.set('LIVEKIT_URL', 'wss://x'); v.m.set('UNRELATED', 'nope');
  const doc = await exportDoc(v);
  assert.equal(doc.settings.assistantName, 'Lucy');
  assert.deepEqual(doc.tasks.map((t) => t.id), ['t1']);
  assert.deepEqual(doc.credentials, { MY_LK_KEY: 'key-1', LIVEKIT_URL: 'wss://x' });
  assert.equal(doc.session.data, Buffer.from([1, 2, 3]).toString('base64'));
});

test('import writes files and credentials on a new machine, and never replaces an existing session', async () => {
  const other = await fs.mkdtemp(path.join(os.tmpdir(), 'assistant-sync-b-'));
  process.env.DSH_HOME = other;
  const doc = { version: 1, settings: { assistantName: 'Lucy' }, tasks: [{ id: 't1' }], credentials: { LIVEKIT_URL: 'wss://x', 'bad ref': 'x' }, session: { name: 'dsh-voice', data: Buffer.from('abc').toString('base64') } };
  const v = vault();
  const changed = await importDoc(doc, v);
  assert.deepEqual(changed.sort(), ['credential:LIVEKIT_URL', 'session', 'settings', 'tasks']);
  assert.equal(v.m.get('LIVEKIT_URL'), 'wss://x');
  assert.equal(v.m.has('bad ref'), false);
  const sessionFile = path.join(other, 'personal-assistant', 'worker', 'dsh-voice.session');
  assert.equal((await fs.readFile(sessionFile)).toString(), 'abc');
  assert.equal((await fs.stat(sessionFile)).mode & 0o077, 0, 'private file mode');
  await fs.writeFile(sessionFile, 'mine');
  doc.session.data = Buffer.from('theirs').toString('base64');
  assert.deepEqual(await importDoc(doc, v), []);
  assert.equal((await fs.readFile(sessionFile)).toString(), 'mine');
});
