// Regenerates plugins/market/vendor/globe.js: the Market panel's 3D globe (scripts/market-globe/globe.js) bundled
// with three.js, d3-geo and the Natural Earth 110m land map into one script that defines window.MkdGlobe.
// Needs `npm i esbuild three d3-geo topojson-client world-atlas` somewhere resolvable (not a dependency of this repo).
// Usage: node scripts/gen-market-globe.mjs <node_modules dir>
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const nm = path.resolve(process.argv[2] || 'node_modules');
const { build } = createRequire(path.join(nm, 'x.js'))('esbuild');
const out = await build({
  entryPoints: [path.join(root, 'scripts/market-globe/globe.js')], bundle: true, minify: true, format: 'iife', globalName: 'MkdGlobe',
  write: false, target: 'es2020', legalComments: 'none', loader: { '.json': 'json' }, nodePaths: [nm],
});
writeFileSync(path.join(root, 'plugins/market/vendor/globe.js'), out.outputFiles[0].text);
console.log('plugins/market/vendor/globe.js', (out.outputFiles[0].text.length / 1024).toFixed(0) + ' KB');
