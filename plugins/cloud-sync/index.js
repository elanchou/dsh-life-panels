import os from 'node:os';
import path from 'node:path';
import { promises as fs } from 'node:fs';
import { dataFile, registerRoute, registerTool, errorText } from './common.js';
import { GitHubRepo, ghError, syncFile, writeJsonAtomic } from './engine.js';

export const inject = ['tools', 'webServer', 'connection'];

const ROUTE = '/plugin-api/cloud-sync';
const TOKEN_REF = 'DSH_CLOUD_SYNC_GITHUB_TOKEN';
const FILES = ['calendar-reminders', 'news-feeds', 'reading-list', 'travel-planner', 'podcasts', 'vocabulary', 'focus', 'youtube'];
const DIR = path.join(path.dirname(dataFile('x')), '.cloud-sync');
const STATE_FILE = path.join(DIR, 'state.json');
const baseFile = (name) => path.join(DIR, 'base', name + '.json');
const NAME_RE = /^[A-Za-z0-9_.-]{1,100}$/;
const CHANGE_DELAY = 90 * 1000;

const initialState = () => ({
  version: 1, config: null, auto: true, intervalMin: 10,
  files: {}, lastSyncAt: null, lastError: null, log: [],
});

export function apply(ctx) {
  let state = null;
  let running = null;
  let pendingTimer = null;
  const seenMtime = new Map();

  async function loadState() {
    if (state) return state;
    try { state = { ...initialState(), ...JSON.parse(await fs.readFile(STATE_FILE, 'utf8')) }; }
    catch (error) { if (error && error.code !== 'ENOENT') throw error; state = initialState(); }
    return state;
  }
  const saveState = () => writeJsonAtomic(STATE_FILE, state);

  function credentials() {
    const c = ctx.get('credentials');
    if (!c) throw new Error('The Harness credentials service is not available in this profile, so the token cannot be stored safely.');
    return c;
  }
  async function token() {
    const hit = await credentials().resolve(TOKEN_REF);
    return hit && hit.value ? hit.value : null;
  }
  async function repo() {
    const s = await loadState();
    if (!s.config) throw new Error('Not connected. Open the Cloud Sync panel and connect a private GitHub repository.');
    const t = await token();
    if (!t) throw new Error('The GitHub token is missing. Reconnect in the Cloud Sync panel.');
    return new GitHubRepo({ token: t, ...s.config });
  }

  function publicStatus(s) {
    return {
      ok: true,
      connected: !!s.config,
      repo: s.config ? { owner: s.config.owner, repo: s.config.repo, branch: s.config.branch, dir: s.config.dir, login: s.config.login, url: 'https://github.com/' + s.config.owner + '/' + s.config.repo + '/commits/' + encodeURIComponent(s.config.branch) } : null,
      auto: s.auto, intervalMin: s.intervalMin, device: os.hostname(),
      syncing: !!running, lastSyncAt: s.lastSyncAt, lastError: s.lastError,
      files: FILES.map((name) => ({ name, ...(s.files[name] || {}) })),
      log: s.log.slice(0, 20),
    };
  }

  async function connect(input) {
    const t = String(input.token || '').trim() || (await token());
    if (!t) return { ok: false, error: 'A GitHub token is required' };
    if (/\s/.test(t) || t.length > 400) return { ok: false, error: 'That does not look like a GitHub token' };
    const probe = new GitHubRepo({ token: t, owner: '', repo: '', branch: '', dir: '' });
    const me = await probe.request('GET', '/user');
    if (me.status !== 200) throw ghError(me, 'token check');
    const login = me.data.login;
    const owner = String(input.owner || '').trim() || login;
    const name = String(input.repo || '').trim() || 'dsh-life-data';
    if (!NAME_RE.test(owner) || !NAME_RE.test(name)) return { ok: false, error: 'owner and repo may only contain letters, digits, - _ .' };
    let info = await probe.request('GET', '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name));
    if (info.status === 404 && input.create) {
      if (owner !== login) return { ok: false, error: 'Automatic creation only works for repositories under your own account (' + login + ')' };
      const created = await probe.request('POST', '/user/repos', { name, private: true, description: 'DeepSeek Harness life-panels data (calendar, news, reading, travel, podcasts)', auto_init: true });
      if (created.status !== 201) throw ghError(created, 'create repository');
      info = await probe.request('GET', '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(name));
    }
    if (info.status === 404) return { ok: false, error: 'Repository ' + owner + '/' + name + ' was not found, or the token cannot see it. Create it as a private repository, or tick "create".', notFound: true };
    if (info.status !== 200) throw ghError(info, 'repository check');
    if (!info.data.private) return { ok: false, error: owner + '/' + name + ' is public. Sync only writes to private repositories, because the data includes your notes and plans.' };
    if (info.data.permissions && info.data.permissions.push === false) return { ok: false, error: 'The token has no write access to ' + owner + '/' + name };
    if (input.token) await credentials().set(TOKEN_REF, t);
    const s = await loadState();
    const config = { owner, repo: name, branch: info.data.default_branch || 'main', dir: 'dsh-sync', login };
    const changedTarget = !s.config || s.config.owner !== owner || s.config.repo !== name;
    s.config = config;
    if (changedTarget) { s.files = {}; await fs.rm(path.join(DIR, 'base'), { recursive: true, force: true }); }
    s.lastError = null;
    await saveState();
    syncAll('connect').catch(() => {});
    return publicStatus(s);
  }

  function syncAll(reason) {
    if (running) return running;
    running = (async () => {
      const s = await loadState();
      const started = new Date().toISOString();
      const results = [];
      try {
        const gh = await repo();
        const listing = await gh.listing();
        const refreshSha = async (name) => (await gh.listing())[name] || null;
        const message = 'sync from ' + os.hostname() + ' (' + reason + ')';
        for (const name of FILES) {
          try {
            const r = await syncFile({ gh, name, localFile: dataFile(name), baseFile: baseFile(name), remoteSha: listing[name] || null, state: s.files[name], message: message + ': ' + name, refreshSha });
            s.files[name] = { sha: r.sha || null, status: r.status, conflicts: r.conflicts || 0, at: started, error: null };
            results.push(r);
          } catch (error) {
            s.files[name] = { ...(s.files[name] || {}), error: errorText(error), at: started };
            results.push({ name, status: 'error', error: errorText(error) });
          }
          seenMtime.set(name, await mtime(dataFile(name)));
        }
        const failed = results.filter((r) => r.status === 'error');
        s.lastError = failed.length ? failed.map((r) => r.name + ': ' + r.error).join('; ') : null;
      } catch (error) {
        s.lastError = errorText(error);
      }
      s.lastSyncAt = started;
      const changed = results.filter((r) => !['unchanged', 'empty', 'error'].includes(r.status));
      s.log.unshift({ at: started, reason, error: s.lastError, changes: changed.map((r) => ({ name: r.name, status: r.status, conflicts: r.conflicts || 0 })) });
      s.log = s.log.slice(0, 50);
      await saveState();
      return { results, error: s.lastError };
    })().finally(() => { running = null; });
    return running;
  }

  async function mtime(file) { try { return (await fs.stat(file)).mtimeMs; } catch { return null; } }

  /* Auto sync: on start, every intervalMin, and ~90s after a local data file changes. Polling stat() is cheap and avoids fs.watch quirks with atomic renames. */
  ctx.effect(() => {
    let stopped = false;
    let lastFull = 0;
    const tickMtime = new Map();
    const tick = async () => {
      if (stopped) return;
      try {
        const s = await loadState();
        if (!s.config || !s.auto || running) return;
        const due = Date.now() - lastFull >= s.intervalMin * 60 * 1000;
        // Debounce: sync CHANGE_DELAY after the last local edit. Continuous edits (podcast progress every 15s) fall back to the interval.
        let editedSinceTick = false;
        for (const name of FILES) {
          const m = await mtime(dataFile(name));
          if (seenMtime.has(name) && m !== seenMtime.get(name) && m !== tickMtime.get(name)) editedSinceTick = true;
          tickMtime.set(name, m);
        }
        if (editedSinceTick) {
          if (pendingTimer) clearTimeout(pendingTimer);
          pendingTimer = setTimeout(() => { pendingTimer = null; if (!stopped) syncAll('local change').catch(() => {}); }, CHANGE_DELAY);
        }
        if (due) { const reason = lastFull ? 'interval' : 'startup'; lastFull = Date.now(); await syncAll(reason); }
      } catch { /* reported through state.lastError */ }
    };
    const first = setTimeout(tick, 20 * 1000);
    const timer = setInterval(tick, 30 * 1000);
    return () => { stopped = true; clearTimeout(first); clearInterval(timer); if (pendingTimer) clearTimeout(pendingTimer); pendingTimer = null; };
  }, 'cloud-sync: auto sync timer');

  async function run(input) {
    const action = input.action || 'status';
    const s = await loadState();
    switch (action) {
      case 'status': {
        const c = ctx.get('credentials');
        const info = c ? await c.describe(TOKEN_REF).catch(() => null) : null;
        return { ...publicStatus(s), tokenSaved: !!(info && info.configured), credentialsWritable: !!(info && info.writable) };
      }
      case 'connect': return connect(input);
      case 'sync': {
        if (!s.config) return { ok: false, error: 'Not connected. Use connect first.' };
        const r = await syncAll(input.reason === 'manual' || !input.reason ? 'manual' : String(input.reason).slice(0, 40));
        return { ...publicStatus(await loadState()), results: r.results };
      }
      case 'settings': {
        if (input.auto !== undefined) s.auto = !!input.auto;
        if (input.intervalMin !== undefined) {
          const n = Number(input.intervalMin);
          if (!Number.isFinite(n) || n < 5 || n > 1440) return { ok: false, error: 'intervalMin must be between 5 and 1440' };
          s.intervalMin = Math.round(n);
        }
        await saveState();
        return publicStatus(s);
      }
      case 'disconnect': {
        s.config = null; s.files = {}; s.lastError = null;
        await fs.rm(path.join(DIR, 'base'), { recursive: true, force: true });
        await saveState();
        if (input.forgetToken !== false) { try { await credentials().unset(TOKEN_REF); } catch { /* not stored */ } }
        return publicStatus(s);
      }
      default: return { ok: false, error: 'Unknown action: ' + String(action) };
    }
  }

  registerRoute(ctx, ROUTE, run, 'cloud-sync');
  registerTool(ctx, {
    name: 'cloud_sync',
    description: 'Status and control of GitHub sync for the calendar, news feeds, reading list, travel and podcast panels. Actions: status (connection, last sync, per-file result, recent log), sync (run a sync now), settings (auto on/off, intervalMin 5-1440). Connecting needs a GitHub token, which the user enters in the Cloud Sync sidebar panel; never ask the user to paste a token into chat.',
    parameters: {
      type: 'object',
      properties: {
        action: { type: 'string', enum: ['status', 'sync', 'settings'], description: 'Operation to perform.' },
        auto: { type: 'boolean', description: 'settings: enable automatic sync.' },
        intervalMin: { type: 'number', description: 'settings: minutes between automatic syncs, 5-1440.' },
      },
      required: ['action'],
      additionalProperties: false,
    },
  }, (input) => (['status', 'sync', 'settings'].includes(input.action) ? run(input) : { ok: false, error: 'Unknown action' }), 'cloud-sync');
}
