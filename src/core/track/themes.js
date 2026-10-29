import { HALF } from '../constants.js';

// Themes for the Track Studio (ui/studio.js) and New track (core/track/generate.js): a look (an existing stage's colours,
// light and scenery), the land and road it suits, the asset mixes its brush offers first, the wall it builds, and for
// some a stamp: a set piece laid out whole (the Castle's walled town). A theme only ever writes data a stage can carry
// (its look keys and stage.edits), so a themed track builds like any other.
export const THEMES = {
  meadow: { name: 'Meadow', look: 'Summit Meadow', land: 'hills', surface: 'tarmac', mixes: ['woods', 'forest', 'village', 'farm'], wall: 'hedge' },
  forest: { name: 'Forest village', look: 'Pine Forest', land: 'valley', surface: 'gravel', mixes: ['forest', 'woods', 'autumnwood', 'village'], wall: 'fence' },
  mountain: { name: 'Mountain town', look: 'Alpine Viaduct', land: 'mountains', surface: 'tarmac', mixes: ['forest', 'rocky', 'village', 'town'], wall: 'wall' },
  seaside: { name: 'Seaside', look: 'Harbour Sprint', land: 'hills', surface: 'tarmac', mixes: ['town', 'village', 'streetset'], wall: 'railing' },
  desert: { name: 'Desert', look: 'Red Mesa Canyon', land: 'canyon', surface: 'gravel', mixes: ['desert', 'rocky'], wall: 'wall' },
  castle: { name: 'Castle', look: 'Village Green', land: 'hills', surface: 'tarmac', mixes: ['castle', 'woods', 'village', 'farm'], wall: 'castlewall', stamp: 'walledtown' },
};
// the look keys a theme copies from its stage onto a track
export const LOOK_KEYS = ['light', 'colors', 'trees', 'rocks', 'bushes', 'cacti'];

/**
 * A walled town the road runs through, centred on road sample i (Castle): curtain walls round a rectangle `len` m along
 * the road and `wide` m across it, square towers at its corners, a gatehouse where the road goes in and out (towers
 * either side and, on a circuit, an arch over the road), houses, a tavern and market stalls lining the street inside,
 * and the keep at the back. Returns { kit, houses, pieces } in stage.edits' shapes (core/track/edits.js); nothing that
 * would stand on the road (the road's own line decides, so a bend inside the walls just loses a house or two).
 */
export function walledTown(tr, i, { len = 110, wide = 84, seed = 1 } = {}) {
  const N = tr.loopN || tr.N, at = d => tr.loopN ? ((i + d) % N + N) % N : Math.max(0, Math.min(N - 1, i + d));
  const tx = tr.tx[i], tz = tr.tz[i], rx = tr.rx[i], rz = tr.rz[i], P = (u, v) => [tr.xs[i] + tx * v + rx * u, tr.zs[i] + tz * v + rz * u];   // u across, v along
  const gap = (x, z, m) => { const q = tr.nearest(x, z); return !q || q.d >= HALF + m; }, r1 = v => Math.round(v * 10) / 10, deg = a => Math.round(a * 1800 / Math.PI) / 10;
  const out = { kit: [], houses: [], pieces: [] }, run = 'castle' + i, L = len / 2, W = wide / 2;
  let s = seed * 9301 + i; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
  // the curtain walls: round the rectangle in 5 m pieces, a gap where the road passes
  const ring = [[-W, -L], [W, -L], [W, L], [-W, L], [-W, -L]];
  for (let e = 0; e < 4; e++) {
    const [u0, v0] = ring[e], [u1, v1] = ring[e + 1], n = Math.ceil(Math.hypot(u1 - u0, v1 - v0) / 5);
    for (let k = 0; k < n; k++) {
      const a = P(u0 + (u1 - u0) * k / n, v0 + (v1 - v0) * k / n), b = P(u0 + (u1 - u0) * (k + 1) / n, v0 + (v1 - v0) * (k + 1) / n), m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      if (![a, m, b].every(([x, z]) => gap(x, z, 2.5))) continue;
      out.kit.push({ k: 'castlewall', x: r1(m[0]), z: r1(m[1]), yaw: deg(Math.atan2(b[0] - a[0], b[1] - a[1])), w: r1(Math.hypot(b[0] - a[0], b[1] - a[1])), run });
    }
  }
  const tower = ([x, z]) => { if (gap(x, z, 4)) out.kit.push({ k: 'tower', x: r1(x), z: r1(z), yaw: deg(Math.atan2(tx, tz)), run }); };
  for (const [u, v] of ring.slice(0, 4)) tower(P(u, v));
  // the gatehouses: where the road crosses the walls (found along the road), towers either side and an arch over it
  for (const sgn of [-1, 1]) {
    let j = i; for (let d = 0; d < L * 2.5; d++) { const q = at(sgn * d), along = (tr.xs[q] - tr.xs[i]) * tx + (tr.zs[q] - tr.zs[i]) * tz, across = (tr.xs[q] - tr.xs[i]) * rx + (tr.zs[q] - tr.zs[i]) * rz; j = q; if (Math.abs(along) >= L || Math.abs(across) >= W) break; }
    for (const side of [-1, 1]) tower([tr.xs[j] + tr.rx[j] * side * (HALF + 4.5), tr.zs[j] + tr.rz[j] * side * (HALF + 4.5)]);
    if (tr.loopN) out.pieces.push({ s: Math.max(0, tr.bi(j) - 5), k: 'arch' });
  }
  // the street: houses, a tavern and stalls either side, facing the road; the keep at the back on the wider side
  const types = ['cottage', 'house', 'tavern', 'cottage', 'terrace', 'house', 'shop'];
  for (const side of [-1, 1]) for (let v = -L + 12; v <= L - 12; v += 17) {
    const q = tr.nearest(...P(0, v)); if (!q) continue; const k = q.i, type = types[Math.floor(rnd() * types.length)], back = HALF + 9 + rnd() * 2;
    const x = tr.xs[k] + tr.rx[k] * side * back, z = tr.zs[k] + tr.rz[k] * side * back;
    if (!gap(x, z, 6) || Math.abs((x - tr.xs[i]) * rx + (z - tr.zs[i]) * rz) > W - 6) continue;
    out.houses.push({ type, x: r1(x), z: r1(z), f: deg(Math.atan2(tr.xs[k] - x, tr.zs[k] - z)) });
    if (rnd() < 0.45) { const sx = tr.xs[k] + tr.rx[k] * side * (HALF + 3.2) + tr.tx[k] * 6, sz = tr.zs[k] + tr.rz[k] * side * (HALF + 3.2) + tr.tz[k] * 6; if (gap(sx, sz, 2.5)) out.houses.push({ type: 'stall', x: r1(sx), z: r1(sz), f: deg(Math.atan2(tr.xs[k] - sx, tr.zs[k] - sz)) }); }
  }
  for (const side of [1, -1]) { const [x, z] = P(side * (W - 13), L * 0.25); if (gap(x, z, 14)) { out.houses.push({ type: 'keep', x: r1(x), z: r1(z), f: deg(Math.atan2(-rx * side, -rz * side)) }); break; } }
  return out;
}
