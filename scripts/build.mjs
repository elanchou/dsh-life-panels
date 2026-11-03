#!/usr/bin/env node
/**
 * Builds every plugin under plugins/ into an installable package directory.
 *
 * - Host: copies shared/host/*.js that a plugin imports ('./common.js', './merge.js') next to its index.js.
 * - Client: writes client.js from src/client.js, replacing the `/* @kit *\/` marker with shared/client/kit.js
 *   (itself including shared/client/glass.js), or a lone `/* @glass *\/` marker with glass.js.
 *
 * Generated files are git-ignored. Run `node scripts/build.mjs` after cloning or after editing shared code;
 * `--check` exits non-zero when a generated file is out of date (useful before committing).
 */
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const KIT_MARKER = '    /* @kit */\n';
const GLASS_MARKER = '    /* @glass */\n';

const glass = await fs.readFile(path.join(root, 'shared/client/glass.js'), 'utf8');
const kit = (await fs.readFile(path.join(root, 'shared/client/kit.js'), 'utf8')).replace(GLASS_MARKER, glass);
const hostShared = (await fs.readdir(path.join(root, 'shared/host'))).filter((f) => f.endsWith('.js'));
const plugins = (await fs.readdir(path.join(root, 'plugins'), { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort();

let stale = 0;
async function emit(file, content) {
  let current = null;
  try { current = await fs.readFile(file, 'utf8'); } catch { /* missing */ }
  if (current === content) return;
  if (check) { stale++; console.error('out of date: ' + path.relative(root, file)); return; }
  await fs.writeFile(file, content);
  console.log('wrote ' + path.relative(root, file));
}

/** Host modules a file imports from shared/, followed transitively (common.js imports merge.js). */
async function sharedImports(source, seen = new Set()) {
  for (const m of source.matchAll(/from\s+['"]\.\/([\w.-]+\.js)['"]/g)) {
    const name = m[1];
    if (!hostShared.includes(name) || seen.has(name)) continue;
    seen.add(name);
    await sharedImports(await fs.readFile(path.join(root, 'shared/host', name), 'utf8'), seen);
  }
  return seen;
}

for (const name of plugins) {
  const dir = path.join(root, 'plugins', name);
  const own = (await fs.readdir(dir)).filter((f) => f.endsWith('.js') && !hostShared.includes(f));
  const needed = new Set();
  for (const f of own) for (const s of await sharedImports(await fs.readFile(path.join(dir, f), 'utf8'))) needed.add(s);
  for (const s of needed) await emit(path.join(dir, s), await fs.readFile(path.join(root, 'shared/host', s), 'utf8'));

  const src = await fs.readFile(path.join(dir, 'src/client.js'), 'utf8');
  // A panel either takes the whole kit (which contains the glass styles) or only the glass styles.
  const client = src.includes(KIT_MARKER) ? src.replace(KIT_MARKER, kit) : src.replace(GLASS_MARKER, glass);
  await emit(path.join(dir, 'client.js'), client);

  if (!check) {
    for (const f of ['index.js', 'client.js', ...needed, ...own]) {
      const r = spawnSync(process.execPath, ['--check', path.join(dir, f)], { encoding: 'utf8' });
      if (r.status !== 0) { console.error(r.stderr); process.exit(1); }
    }
  }
}

if (check && stale) { console.error(stale + ' generated file(s) are stale; run node scripts/build.mjs'); process.exit(1); }
console.log((check ? 'checked ' : 'built ') + plugins.length + ' plugins: ' + plugins.join(', '));
