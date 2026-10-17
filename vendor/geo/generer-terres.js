// Usage : node vendor/geo/generer-terres.js land-50m.json vendor/geo/terres.js 0.02 0.005
// land-50m.json : https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/land-50m.json (ne pas le committer).
// Convertit land-50m.json (topojson world-atlas) en anneaux simplifiés, encodés « polyline ».
const fs = require('fs');
const [src, dst, tolArg, aireArg] = process.argv.slice(2);
const topo = JSON.parse(fs.readFileSync(src, 'utf8'));
const tr = topo.transform;
const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(p => { x += p[0]; y += p[1]; return [x * tr.scale[0] + tr.translate[0], y * tr.scale[1] + tr.translate[1]]; }); });
function arc(i) { return i >= 0 ? arcs[i] : arcs[~i].slice().reverse(); }
function anneau(ids) { const r = []; ids.forEach(i => { const a = arc(i); a.forEach((p, k) => { if (k || !r.length) r.push(p); }); }); return r; }
const anneaux = [];
const geoms = topo.objects.land.geometries || [topo.objects.land];
geoms.forEach(g => {
  const polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
  polys.forEach(poly => poly.forEach(ids => anneaux.push(anneau(ids))));
});
const tol = +tolArg || 0.05, aireMin = +aireArg || 0.02;
function dp(pts, tol) {
  if (pts.length < 4) return pts;
  const garde = new Uint8Array(pts.length); garde[0] = garde[pts.length - 1] = 1;
  const pile = [[0, pts.length - 1]];
  while (pile.length) {
    const [a, b] = pile.pop(); let dmax = 0, idx = -1;
    const [x1, y1] = pts[a], [x2, y2] = pts[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1e-12;
    for (let i = a + 1; i < b; i++) { const d = L > 1e-9 ? Math.abs(dy * pts[i][0] - dx * pts[i][1] + x2 * y1 - y2 * x1) / L : Math.hypot(pts[i][0] - x1, pts[i][1] - y1); if (d > dmax) { dmax = d; idx = i; } }
    if (dmax > tol) { garde[idx] = 1; pile.push([a, idx], [idx, b]); }
  }
  return pts.filter((p, i) => garde[i]);
}
function aire(r) { let s = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(s / 2); }
const Q = 50;
function enc(v) { v = v < 0 ? ~(v << 1) : v << 1; let s = ''; while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; } return s + String.fromCharCode(v + 63); }
let n = 0; const out = [];
anneaux.forEach(r => {
  if (aire(r) < aireMin) return;
  let s = dp(r, tol); if (s.length < 4) return;
  let px = 0, py = 0, str = '';
  s.forEach(p => { const x = Math.round(p[0] * Q), y = Math.round(p[1] * Q); str += enc(x - px) + enc(y - py); px = x; py = y; n++; });
  out.push(str);
});
const js = `/* Contours des terres émergées pour Sonar (cartes réelles).
   Source : Natural Earth 1:50m « land » (domaine public), via world-atlas 2.0.2 (licence ISC,
   © Michael Bostock). Anneaux simplifiés (Douglas-Peucker, tolérance ${tol}°), îles de moins de
   ${aireMin} degré² retirées, coordonnées au 1/${Q}e de degré, encodées en « polyline » (deltas
   zigzag en base 32, caractères 63 à 126) pour rester compact sans fetch (file://).
   Généré par un script Node : ne pas éditer à la main. */
window.DL_TERRES = { q: ${Q}, anneaux: ${JSON.stringify(out)} };
`;
fs.writeFileSync(dst, js);
console.log('anneaux', out.length, 'points', n, 'octets', js.length);
