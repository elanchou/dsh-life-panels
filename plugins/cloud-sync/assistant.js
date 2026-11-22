import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';

/**
 * The personal-assistant plugin keeps its data outside plugin-data/ (settings, task board, Telegram session) and its
 * secrets in the Harness credential store. This module turns all of that into one JSON document that the normal
 * sync engine can merge, and applies a merged document back. Everything goes to the private sync repository in clear
 * text, secrets included, because the user asked for it.
 *
 * Document: { version, settings, tasks: [{ id }], credentials: { REF: value }, session: { name, data(base64) } }
 *  - settings merge key by key, tasks merge per id, credentials per reference name.
 *  - The Telegram session is adopted once: a machine without the session file gets it, a machine that has one keeps
 *    it. Two machines using the same Telegram session at once makes Telegram revoke it.
 */

export const ASSISTANT = 'personal-assistant';

const home = () => process.env.DSH_HOME || path.join(os.homedir(), '.dsh');
const dir = () => path.join(home(), 'personal-assistant');
const files = () => ({
  settings: path.join(dir(), 'settings.json'),
  tasks: path.join(dir(), 'tasks.json'),
  worker: path.join(dir(), 'worker'),
});

const DEFAULT_REFS = {
  livekitUrlEnv: 'LIVEKIT_URL', livekitApiKeyEnv: 'LIVEKIT_API_KEY', livekitApiSecretEnv: 'LIVEKIT_API_SECRET',
  bridgeTokenEnv: 'DSH_VOICE_BRIDGE_TOKEN', telegramApiIdEnv: 'TG_API_ID', telegramApiHashEnv: 'TG_API_HASH',
};
const SAFE = /^[A-Za-z0-9_.-]{1,100}$/;
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function readJson(file) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return undefined; }
}
async function writePrivate(file, data) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + '.' + process.pid + '.sync.tmp';
  await fs.writeFile(tmp, data, { mode: 0o600 });
  await fs.rename(tmp, file);
}
const refsOf = (settings) => [...new Set(Object.entries(DEFAULT_REFS).map(([key, fallback]) => {
  const v = settings && typeof settings[key] === 'string' ? settings[key].trim() : '';
  return SAFE.test(v) ? v : fallback;
}))];
const sessionName = (settings) => {
  const v = settings && typeof settings.telegramSession === 'string' ? settings.telegramSession.trim() : '';
  return SAFE.test(v) ? v : 'dsh-voice';
};

/** Newest modification time among the files the document is built from, for change detection. */
export async function sourceMtime() {
  const f = files();
  let latest = null;
  for (const file of [f.settings, f.tasks]) {
    try { const m = (await fs.stat(file)).mtimeMs; if (latest === null || m > latest) latest = m; } catch { /* not there yet */ }
  }
  return latest;
}

/** Build the document from the local files and the credential store. previous: the document exported last time. */
export async function exportDoc(credentials, previous) {
  const f = files();
  const doc = { version: 1 };
  const settings = await readJson(f.settings);
  if (settings && typeof settings === 'object' && !Array.isArray(settings)) doc.settings = settings;
  const tasks = await readJson(f.tasks);
  if (Array.isArray(tasks)) doc.tasks = tasks.filter((t) => t && typeof t === 'object' && t.id);
  if (credentials) {
    const found = {};
    for (const ref of refsOf(doc.settings)) {
      try { const hit = await credentials.resolve(ref); if (hit && hit.value) found[ref] = String(hit.value); } catch { /* not stored */ }
    }
    if (Object.keys(found).length) doc.credentials = found;
  }
  const name = sessionName(doc.settings);
  if (previous && previous.session && previous.session.name === name && previous.session.data) doc.session = previous.session;
  else {
    try { doc.session = { name, data: (await fs.readFile(path.join(f.worker, name + '.session'))).toString('base64') }; } catch { /* no session yet */ }
  }
  return Object.keys(doc).length > 1 ? doc : null;
}

/** Apply a merged document to the local files and the credential store. Returns what changed. */
export async function importDoc(doc, credentials) {
  const changed = [];
  if (!doc || typeof doc !== 'object') return changed;
  const f = files();
  if (doc.settings && typeof doc.settings === 'object' && !same(doc.settings, await readJson(f.settings))) {
    await writePrivate(f.settings, JSON.stringify(doc.settings, null, 2)); changed.push('settings');
  }
  if (Array.isArray(doc.tasks) && !same(doc.tasks, await readJson(f.tasks))) {
    await writePrivate(f.tasks, JSON.stringify(doc.tasks, null, 2)); changed.push('tasks');
  }
  if (credentials && doc.credentials && typeof doc.credentials === 'object') {
    for (const [ref, value] of Object.entries(doc.credentials)) {
      if (!SAFE.test(ref) || typeof value !== 'string' || !value) continue;
      let current = null;
      try { const hit = await credentials.resolve(ref); current = hit && hit.value ? String(hit.value) : null; } catch { /* not stored */ }
      if (current !== value) { await credentials.set(ref, value); changed.push('credential:' + ref); }
    }
  }
  const s = doc.session;
  if (s && SAFE.test(String(s.name || '')) && typeof s.data === 'string' && s.data) {
    const target = path.join(f.worker, s.name + '.session');
    let exists = true;
    try { await fs.access(target); } catch { exists = false; }
    if (!exists) { await writePrivate(target, Buffer.from(s.data, 'base64')); changed.push('session'); }
  }
  return changed;
}
