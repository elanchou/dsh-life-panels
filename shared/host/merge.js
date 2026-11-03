/**
 * Three-way JSON merge for the life-panels data files.
 * base = the version both sides last agreed on (null on first sync), local and remote = current versions.
 * - Plain objects merge key by key.
 * - Arrays whose elements are objects with an `id` (or `key`) merge per element; deletions are detected against base.
 * - Arrays of primitives (tags) merge as sets.
 * - Anything else is a value: the side that changed wins; if both changed, the record with the newer `updatedAt` wins, else local.
 * Without a base (first sync) both sides count as additions, and elements also match by url/feedUrl so default lists do not double.
 */

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const idOf = (v) => (isObj(v) ? (v.id ?? v.key) : undefined);
const naturalOf = (v) => (isObj(v) ? (v.url || v.feedUrl) : undefined);
const isRecordArray = (arr) => arr.length > 0 && arr.every((v) => idOf(v) !== undefined && idOf(v) !== null);
const isPrimitiveArray = (arr) => arr.every((v) => v === null || typeof v !== 'object');

function newerSide(localCtx, remoteCtx) {
  const l = Date.parse((localCtx && localCtx.updatedAt) || '');
  const r = Date.parse((remoteCtx && remoteCtx.updatedAt) || '');
  return Number.isFinite(r) && (!Number.isFinite(l) || r > l) ? 'remote' : 'local';
}

export function merge3(base, local, remote, stats = { conflicts: 0 }, ctx = {}) {
  if (same(local, remote)) return local;
  if (base !== undefined && same(local, base)) return remote;
  if (base !== undefined && same(remote, base)) return local;
  if (local === undefined || (local === null && base === undefined)) return remote; // added remotely, or lazily initialised (news feeds start as null)
  if (remote === undefined || (remote === null && base === undefined)) return local;
  if (isObj(local) && isObj(remote)) {
    const b = isObj(base) ? base : undefined;
    const next = { local: 'updatedAt' in local ? local : ctx.local, remote: 'updatedAt' in remote ? remote : ctx.remote };
    const out = {};
    const keys = new Set([...Object.keys(local), ...Object.keys(remote)]);
    for (const k of keys) {
      const bv = b ? b[k] : undefined;
      const inL = k in local; const inR = k in remote; const inB = !!b && k in b;
      if (inB && !inL && (!inR || same(remote[k], bv))) continue; // deleted locally
      if (inB && !inR && (!inL || same(local[k], bv))) continue; // deleted remotely
      const v = merge3(bv, local[k], remote[k], stats, next);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remote)) {
    const b = Array.isArray(base) ? base : null;
    if ((isRecordArray(local) || !local.length) && (isRecordArray(remote) || !remote.length) && (local.length || remote.length)) {
      return mergeRecords(b, local, remote, stats, ctx);
    }
    if (isPrimitiveArray(local) && isPrimitiveArray(remote) && (!b || isPrimitiveArray(b))) {
      const bs = new Set((b || []).map((v) => JSON.stringify(v)));
      const ls = new Set(local.map((v) => JSON.stringify(v)));
      const rs = new Set(remote.map((v) => JSON.stringify(v)));
      const keep = (s) => (ls.has(s) && rs.has(s)) || (!bs.has(s) && (ls.has(s) || rs.has(s)));
      const out = [];
      const seen = new Set();
      for (const v of [...local, ...remote]) { const s = JSON.stringify(v); if (!seen.has(s) && keep(s)) { seen.add(s); out.push(v); } }
      return out;
    }
  }
  stats.conflicts++;
  return newerSide(ctx.local, ctx.remote) === 'remote' ? remote : local;
}

function mergeRecords(base, local, remote, stats, ctx) {
  const baseById = new Map((base || []).filter((v) => idOf(v) !== undefined).map((v) => [String(idOf(v)), v]));
  const remoteById = new Map(remote.map((v) => [String(idOf(v)), v]));
  const localIds = new Set(local.map((v) => String(idOf(v))));
  // First sync only: pair records that share a url/feedUrl but were created with different ids on each machine.
  const alias = new Map();
  if (!base) {
    const localByNatural = new Map(local.filter(naturalOf).map((v) => [naturalOf(v), String(idOf(v))]));
    for (const r of remote) {
      const rid = String(idOf(r));
      const lid = naturalOf(r) && localByNatural.get(naturalOf(r));
      if (lid && !remoteById.has(lid) && !localIds.has(rid)) alias.set(rid, lid);
    }
  }
  const remoteFor = (lid) => {
    if (remoteById.has(lid)) return remoteById.get(lid);
    for (const [rid, l] of alias) if (l === lid) return remoteById.get(rid);
    return undefined;
  };
  const out = [];
  for (const l of local) {
    const id = String(idOf(l));
    const b = baseById.get(id);
    const r = remoteFor(id);
    if (r === undefined && b !== undefined) {
      if (same(l, b)) continue; // deleted remotely, untouched here
      stats.conflicts++; // edited here, deleted remotely: keep the edit
    }
    out.push(r === undefined ? l : merge3(b, l, alias.has(String(idOf(r))) ? { ...r, id: idOf(l) } : r, stats, ctx));
  }
  for (const r of remote) {
    const id = String(idOf(r));
    if (localIds.has(id) || alias.has(id)) continue;
    const b = baseById.get(id);
    if (b !== undefined) {
      if (same(r, b)) continue; // deleted here, untouched remotely
      stats.conflicts++; // deleted here, edited remotely: keep the edit
    }
    out.push(r);
  }
  return out;
}

/**
 * Process-wide lock per data file, shared by every plugin copy through globalThis,
 * so a plugin save and a cloud-sync write never interleave between "check mtime" and "rename".
 */
const LOCKS = (globalThis[Symbol.for('dsh.lifePanels.fileLocks')] ||= new Map());
export function withFileLock(file, fn) {
  const prev = LOCKS.get(file) || Promise.resolve();
  const next = prev.then(fn, fn);
  const tail = next.catch(() => {});
  LOCKS.set(file, tail);
  tail.then(() => { if (LOCKS.get(file) === tail) LOCKS.delete(file); });
  return next;
}
