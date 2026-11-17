// Regenerates plugins/market/vendor/land.json: land dots for the Market panel's globe, one dot per ~1.3 degrees of
// arc, spread evenly over the sphere with a Fibonacci lattice (no latitude rows, no crowding at the poles).
// Needs `npm i world-atlas topojson-client` somewhere resolvable (not a dependency of this repo).
// Usage: node scripts/gen-land.mjs <node_modules dir containing world-atlas> [step in degrees]
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const nm = path.resolve(process.argv[2] || 'node_modules');
const step = Number(process.argv[3]) || 1.3;
const require = createRequire(path.join(nm, 'x.js'));
const { feature } = require('topojson-client');
const topo = JSON.parse(readFileSync(path.join(nm, 'world-atlas/land-110m.json'), 'utf8'));
const land = feature(topo, topo.objects.land);
const polys = [];
for (const f of land.features || [land]) {
  const g = f.geometry;
  for (const poly of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) polys.push(poly);
}
const inRing = (x, y, ring) => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]; const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};
const inPoly = (x, y, poly) => inRing(x, y, poly[0]) && !poly.slice(1).some((h) => inRing(x, y, h));
const boxes = polys.map((p) => { const xs = p[0].map((c) => c[0]); const ys = p[0].map((c) => c[1]); return [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]; });

const N = Math.round((4 * Math.PI) / (((step * Math.PI) / 180) ** 2));
const golden = Math.PI * (3 - Math.sqrt(5));
const out = [];
for (let i = 0; i < N; i++) {
  const lat = (Math.asin(1 - (2 * (i + 0.5)) / N) * 180) / Math.PI;
  let lon = ((i * golden * 180) / Math.PI) % 360;
  if (lon > 180) lon -= 360;
  for (let k = 0; k < polys.length; k++) {
    const b = boxes[k];
    if (lon < b[0] || lon > b[1] || lat < b[2] || lat > b[3]) continue;
    if (inPoly(lon, lat, polys[k])) { out.push(Math.round(lat * 10), Math.round(lon * 10)); break; }
  }
}
writeFileSync(new URL('../plugins/market/vendor/land.json', import.meta.url), JSON.stringify({ unit: 0.1, points: out }));
console.log('land dots:', out.length / 2);
