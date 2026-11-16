import { promises as fs } from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
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
  /** Files in a sub-folder of the sync folder: [{ name, path, sha }]. Empty when it does not exist. */
  async listDir(sub) {
    const r = await this.request('GET', this.repoPath() + '/contents/' + (this.dir + '/' + sub).split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(this.branch));
    if (r.status === 404 || r.status === 409) return [];
    if (r.status !== 200) throw ghError(r, 'list ' + sub);
    return (Array.isArray(r.data) ? r.data : []).filter((f) => f.type === 'file').map((f) => ({ name: f.name, path: f.path, sha: f.sha }));
  }
  /** Raw text of a file by repository path, or undefined when it does not exist. */
  async readText(repoPath) {
    const r = await this.request('GET', this.repoPath() + '/contents/' + repoPath.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(this.branch), null, 'application/vnd.github.raw+json');
    if (r.status === 404) return undefined;
    if (r.status !== 200) throw ghError(r, 'read ' + repoPath);
    return r.text;
  }
  async read(name) {
    const r = await this.request('GET', this.filePath(name) + '?ref=' + encodeURIComponent(this.branch), null, 'application/vnd.github.raw+json');
    if (r.status === 404) return undefined;
    if (r.status !== 200) throw ghError(r, 'read ' + name);
    return JSON.parse(r.text);
  }
  /** Conditional write: sha must match the current blob (or be null for a new file). Returns { sha } or { conflict: true }. */
  async write(name, value, sha, message) {
    const content = Buffer.from(fileText(value), 'utf8').toString('base64');
    const r = await this.request('PUT', this.filePath(name), { message, content, branch: this.branch, ...(sha ? { sha } : {}) });
    if (r.status === 409 || r.status === 422) return { conflict: true };
    if (r.status !== 200 && r.status !== 201) throw ghError(r, 'write ' + name);
    return { sha: r.data.content.sha };
  }
}

/** The text a file is stored as, and its git blob sha (what the Contents API reports for it). */
export const fileText = (value) => JSON.stringify(value, null, 2) + '\n';
export function blobSha(text) {
  const buf = Buffer.from(text, 'utf8');
  return createHash('sha1').update('blob ' + buf.length + '\0').update(buf).digest('hex');
}

/**
 * Write several files in ONE commit through the Git Data API: tree on top of the branch head, commit, then a
 * fast-forward ref update. Returns { commit, shas } or { conflict: true } when the branch moved meanwhile.
 * An empty repository (no branch yet) falls back to one Contents API write per file.
 */
GitHubRepo.prototype.commitFiles = async function commitFiles(changes, message, extra = []) {
  const names = Object.keys(changes);
  if (!names.length && !extra.length) return { commit: null, shas: {} };
  const shas = {};
  const ref = await this.request('GET', this.repoPath() + '/git/ref/heads/' + this.branch.split('/').map(encodeURIComponent).join('/'));
  if (ref.status === 404 || ref.status === 409) {
    for (const name of names) {
      const w = await this.write(name, changes[name].value, changes[name].sha, message);
      if (w.conflict) return { conflict: true };
      shas[name] = w.sha;
    }
    return { commit: null, shas, extraSkipped: extra.length > 0 };
  }
  if (ref.status !== 200) throw ghError(ref, 'read branch');
  const head = ref.data.object.sha;
  const commit = await this.request('GET', this.repoPath() + '/git/commits/' + head);
  if (commit.status !== 200) throw ghError(commit, 'read head commit');
  const tree = await this.request('POST', this.repoPath() + '/git/trees', {
    base_tree: commit.data.tree.sha,
    tree: names.map((name) => {
      const text = fileText(changes[name].value);
      shas[name] = blobSha(text);
      return { path: (this.dir ? this.dir + '/' : '') + name + '.json', mode: '100644', type: 'blob', content: text };
    }).concat(extra.map((x) => (x.delete
      ? { path: x.path, mode: '100644', type: 'blob', sha: null } // sha null removes the file
      : { path: x.path, mode: '100644', type: 'blob', content: x.content }))),
  });
  if (tree.status !== 201) throw ghError(tree, 'write tree');
  const made = await this.request('POST', this.repoPath() + '/git/commits', { message, tree: tree.data.sha, parents: [head] });
  if (made.status !== 201) throw ghError(made, 'write commit');
  const moved = await this.request('PATCH', this.repoPath() + '/git/refs/heads/' + this.branch.split('/').map(encodeURIComponent).join('/'), { sha: made.data.sha, force: false });
  if (moved.status === 409 || moved.status === 422) return { conflict: true };
  if (moved.status !== 200) throw ghError(moved, 'update branch');
  return { commit: made.data.sha, shas };
};

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

/**
 * Sync many data files with at most ONE commit. Each file is merged as in syncFile; every file that must go up is
 * written in a single commit, and the whole run is redone when the branch moved underneath it. Local files are
 * then replaced under the shared file lock, unless a plugin saved them meanwhile: such a file keeps its newer
 * contents, its base becomes the merged version, and the next run uploads the difference.
 * files: [{ name, localFile, baseFile, state }]. Returns { results, commit }.
 */
export async function syncBatch({ gh, files, message, extra = () => [] }) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const listing = await gh.listing();
    const plans = [];
    for (const f of files) {
      const local = await readJson(f.localFile);
      const base = (await readJson(f.baseFile)).value;
      const remoteSha = listing[f.name] || null;
      const remoteUnchanged = !!remoteSha && !!f.state && f.state.sha === remoteSha && base !== undefined;
      if (remoteUnchanged && local.value !== undefined && same(local.value, base)) { plans.push({ f, status: 'unchanged', sha: remoteSha }); continue; }
      if (!remoteSha && local.value === undefined) { plans.push({ f, status: 'empty', sha: null }); continue; }
      const remote = !remoteSha ? undefined : remoteUnchanged ? base : await gh.read(f.name);
      const stats = { conflicts: 0 };
      const merged = local.value === undefined ? remote : remote === undefined ? local.value : merge3(base, local.value, remote, stats);
      plans.push({
        f, local, merged, sha: remoteSha, conflicts: stats.conflicts,
        upload: remote === undefined || !same(merged, remote), download: local.value === undefined || !same(merged, local.value),
      });
    }
    const ups = plans.filter((p) => p.upload);
    const changes = Object.fromEntries(ups.map((p) => [p.f.name, { value: p.merged, sha: p.sha }]));
    const names = ups.map((p) => p.f.name);
    const more = extra();
    const label = names.concat(more.length ? ['inbox'] : []);
    const w = await gh.commitFiles(changes, message + (label.length ? ': ' + label.join(', ') : ''), more);
    if (w.conflict) continue;
    const results = [];
    for (const p of plans) {
      if (p.status) { results.push({ name: p.f.name, status: p.status, sha: p.sha, conflicts: 0 }); continue; }
      const sha = p.upload ? w.shas[p.f.name] : p.sha;
      let status = p.upload && p.download ? 'merged' : p.upload ? 'uploaded' : p.download ? 'downloaded' : 'unchanged';
      if (p.download) {
        const wrote = await withFileLock(p.f.localFile, async () => {
          if ((await mtimeOf(p.f.localFile)) !== p.local.mtime) return false;
          await writeJsonAtomic(p.f.localFile, p.merged);
          return true;
        });
        if (!wrote) status = p.upload ? 'uploaded' : 'pending';
      }
      await writeJsonAtomic(p.f.baseFile, p.merged);
      results.push({ name: p.f.name, status, sha, conflicts: p.conflicts });
    }
    return { results, commit: w.commit, extraSkipped: !!w.extraSkipped };
  }
  throw new Error('the sync repository kept changing during sync; it will be retried on the next run');
}
