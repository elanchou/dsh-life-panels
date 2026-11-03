import { promises as fs } from 'node:fs';
import path from 'node:path';
import { merge3, withFileLock } from './merge.js';

/** GitHub Contents API client scoped to one repo, branch and folder. */
export class GitHubRepo {
  constructor({ token, owner, repo, branch, dir, api }) {
    Object.assign(this, { token, owner, repo, branch, dir, api: api || 'https://api.github.com' });
  }
  async request(method, url, body, accept) {
    const res = await fetch(this.api + url, {
      method,
      headers: {
        authorization: 'Bearer ' + this.token,
        accept: accept || 'application/vnd.github+json',
        'x-github-api-version': '2022-11-28',
        'user-agent': 'dsh-cloud-sync',
        ...(body ? { 'content-type': 'application/json' } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(20000),
    });
    const text = await res.text();
    let data = null;
    if (!accept) { try { data = text ? JSON.parse(text) : null; } catch { data = null; } }
    return { status: res.status, data, text, headers: res.headers };
  }
  repoPath() { return '/repos/' + encodeURIComponent(this.owner) + '/' + encodeURIComponent(this.repo); }
  filePath(name) { return this.repoPath() + '/contents/' + this.dir.split('/').map(encodeURIComponent).join('/') + '/' + encodeURIComponent(name + '.json'); }

  /** Map of file name (without .json) to blob sha for the sync folder. Empty when the folder or the repo has no commits yet. */
  async listing() {
    const r = await this.request('GET', this.repoPath() + '/contents/' + this.dir.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(this.branch));
    if (r.status === 404 || r.status === 409) return {};
    if (r.status !== 200) throw ghError(r, 'list folder');
    const out = {};
    for (const f of Array.isArray(r.data) ? r.data : []) if (f.type === 'file' && f.name.endsWith('.json')) out[f.name.slice(0, -5)] = f.sha;
    return out;
  }
  async read(name) {
    const r = await this.request('GET', this.filePath(name) + '?ref=' + encodeURIComponent(this.branch), null, 'application/vnd.github.raw+json');
    if (r.status === 404) return undefined;
    if (r.status !== 200) throw ghError(r, 'read ' + name);
    return JSON.parse(r.text);
  }
  /** Conditional write: sha must match the current blob (or be null for a new file). Returns { sha } or { conflict: true }. */
  async write(name, value, sha, message) {
    const content = Buffer.from(JSON.stringify(value, null, 2) + '\n', 'utf8').toString('base64');
    const r = await this.request('PUT', this.filePath(name), { message, content, branch: this.branch, ...(sha ? { sha } : {}) });
    if (r.status === 409 || r.status === 422) return { conflict: true };
    if (r.status !== 200 && r.status !== 201) throw ghError(r, 'write ' + name);
    return { sha: r.data.content.sha };
  }
}

export function ghError(r, what) {
  const msg = (r.data && r.data.message) || r.text.slice(0, 200) || 'HTTP ' + r.status;
  if (r.status === 401) return new Error('GitHub rejected the token (401). Create a new token and reconnect.');
  if (r.status === 403 && r.headers.get('x-ratelimit-remaining') === '0') return new Error('GitHub API rate limit reached; sync will retry later.');
  if (r.status === 403 || r.status === 404) return new Error('GitHub ' + what + ' failed (' + r.status + '): ' + msg + '. Check that the token can read and write Contents of this repository.');
  return new Error('GitHub ' + what + ' failed (' + r.status + '): ' + msg);
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

async function readJson(file) {
  try {
    const st = await fs.stat(file);
    return { value: JSON.parse(await fs.readFile(file, 'utf8')), mtime: st.mtimeMs };
  } catch (error) {
    if (error && error.code === 'ENOENT') return { value: undefined, mtime: null };
    throw error;
  }
}
async function mtimeOf(file) { try { return (await fs.stat(file)).mtimeMs; } catch { return null; } }
export async function writeJsonAtomic(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true });
  const tmp = file + '.' + process.pid + '.sync.tmp';
  await fs.writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
  await fs.rename(tmp, file);
}

/**
 * Sync one plugin data file against the repo. state is { sha } from the previous run; baseFile holds the last agreed content.
 * Order: merge, upload (conditional on the remote sha), then replace the local file under the shared file lock,
 * only if no plugin saved it meanwhile (otherwise merge again).
 */
export async function syncFile({ gh, name, localFile, baseFile, remoteSha, state, message, refreshSha }) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const local = await readJson(localFile);
    const base = (await readJson(baseFile)).value;
    const remoteUnchanged = !!remoteSha && !!state && state.sha === remoteSha && base !== undefined;
    if (remoteUnchanged && local.value !== undefined && same(local.value, base)) return { name, status: 'unchanged', sha: remoteSha, conflicts: 0 };
    if (!remoteSha && local.value === undefined) return { name, status: 'empty', sha: null, conflicts: 0 };
    const remote = !remoteSha ? undefined : remoteUnchanged ? base : await gh.read(name);
    const stats = { conflicts: 0 };
    const merged = local.value === undefined ? remote : remote === undefined ? local.value : merge3(base, local.value, remote, stats);
    let sha = remoteSha;
    const upload = remote === undefined || !same(merged, remote);
    if (upload) {
      const w = await gh.write(name, merged, remoteSha, message);
      if (w.conflict) { remoteSha = await refreshSha(name); continue; }
      sha = w.sha;
    }
    const download = local.value === undefined || !same(merged, local.value);
    if (download) {
      const wrote = await withFileLock(localFile, async () => {
        if ((await mtimeOf(localFile)) !== local.mtime) return false;
        await writeJsonAtomic(localFile, merged);
        return true;
      });
      if (!wrote) { await writeJsonAtomic(baseFile, merged); state = { sha }; remoteSha = sha; continue; }
    }
    await writeJsonAtomic(baseFile, merged);
    return { name, status: upload && download ? 'merged' : upload ? 'uploaded' : download ? 'downloaded' : 'unchanged', sha, conflicts: stats.conflicts };
  }
  throw new Error(name + ' kept changing during sync; it will be retried on the next run');
}
