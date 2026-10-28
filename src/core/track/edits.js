import { mulberry32 } from '../math.js';
import { BUILDINGS, BUILDING_TYPES } from '../../data/structures.js';

// The Track Studio's edits (ui/studio.js), laid over any stage as data: stage.edits = {
//   sculpt: { cell, d: { "c,r": metres } }   the land raised or lowered: a sparse grid in world x / z, `cell` m apart
//                                           (cell c, r is at x = c * cell, z = r * cell), added to the ground and to the
//                                           road over it (a hump in the road, a jump, a hill, a drop)
//   props: [{ k, x, z, s, ry }]              scenery put there: k one of PROPS (trees, bushes, rocks, cacti), s its size
//   clears: [[x, z, r], ...]                 the stage's own scattered scenery taken away inside these circles
//   houses: [{ type, x, z, f }]              buildings put there (data/structures.js types; f: degrees, the way the front
//                                           faces), as breakable as any other building
// }. A stage without edits builds exactly as before. Applied by core/track/circuit.js and downhill.js (the road),
// terrain.js (the ground), obstacles.js (props, clears) and build.js (houses).
export const SCULPT = { CELL: 4, MAX: 60 };
export const PROPS = { pine: 'Pine', tree: 'Tree', bush: 'Bush', rock: 'Rock', boulder: 'Boulder', cactus: 'Cactus' };
/** How much the land is raised at world (x, z) (0 without edits). */
export function sculptAt(sc, x, z) {
  if (!sc || !sc.d) return 0;
  const C = sc.cell || SCULPT.CELL, fx = x / C, fz = z / C, c = Math.floor(fx), r = Math.floor(fz), u = fx - c, v = fz - r, d = sc.d;
  const g = (a, b) => d[a + ',' + b] || 0;
  return (g(c, r) * (1 - u) + g(c + 1, r) * u) * (1 - v) + (g(c, r + 1) * (1 - u) + g(c + 1, r + 1) * u) * v;
}
/** The road's heights raised with the land under it (samples xs, zs; H changed in place). */
export function sculptRoad(edits, xs, zs, H, n = H.length) {
  const sc = edits && edits.sculpt; if (!sc || !sc.d) return;
  for (let i = 0; i < n; i++) H[i] += sculptAt(sc, xs[i], zs[i]);
}
const fall = t => t >= 1 ? 0 : (1 - t * t) ** 2;
/**
 * One dab of a brush at (x, z), radius r, strength k (0..1), on sculpt sc (changed in place). op: raise, lower, smooth,
 * flatten (to height `to`). base(x, z): the ground's height without any sculpting, so smooth and flatten work on the
 * land as it stands. Returns the cells it changed.
 */
export function sculptDab(sc, op, x, z, r, k, base, to = 0) {
  const C = sc.cell || (sc.cell = SCULPT.CELL), d = sc.d || (sc.d = {}), c0 = Math.floor((x - r) / C), c1 = Math.ceil((x + r) / C), r0 = Math.floor((z - r) / C), r1 = Math.ceil((z + r) / C);
  const total = (c, q) => base(c * C, q * C) + (d[c + ',' + q] || 0), changed = [];
  const next = [];
  for (let c = c0; c <= c1; c++) for (let q = r0; q <= r1; q++) {
    const w = fall(Math.hypot(c * C - x, q * C - z) / r) * k; if (w <= 0) continue;
    const key = c + ',' + q, now = d[key] || 0; let v = now;
    if (op === 'raise') v = now + 0.35 * w;
    else if (op === 'lower') v = now - 0.35 * w;
    else if (op === 'flatten') v = now + (to - total(c, q)) * w * 0.5;
    else if (op === 'smooth') { let s = 0; for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) s += total(c + a, q + b); v = now + (s / 8 - total(c, q)) * w * 0.5; }
    next.push([key, Math.max(-SCULPT.MAX, Math.min(SCULPT.MAX, v))]);
  }
  for (const [key, v] of next) { if (Math.abs(v) < 0.005) delete d[key]; else d[key] = Math.round(v * 100) / 100; changed.push(key); }
  return changed;
}
/** Scenery items (core/track/obstacles.js kinds) for the stage's props, after taking its own away inside the clears. */
export function editObstacles(edits, items, terr, stage, OB) {
  if (!edits) return;
  for (const [x, z, r] of edits.clears || []) for (let k = items.length - 1; k >= 0; k--) if (Math.hypot(items[k].x - x, items[k].z - z) < r) items.splice(k, 1);
  const C = stage.colors, rnd = mulberry32(stage.seed * 13 + 77), pick = a => a[Math.floor(rnd() * a.length)];
  for (const p of edits.props || []) {
    const s = p.s || 1, y = terr.at(p.x, p.z), ry = p.ry || 0, x = p.x, z = p.z;
    if (p.k === 'pine') items.push({ kind: OB.PINE, x, y: y - 0.2, z, s, sy: s * 1.1, ry, color: pick(C.pine), r: 0.3 * s, brush: 0.75 * s });
    else if (p.k === 'tree') items.push({ kind: OB.ROUND, x, y: y - 0.2, z, s, sy: s, ry, color: pick(C.round), r: 0.32 * s });
    else if (p.k === 'bush') items.push({ kind: OB.BUSH, x, y: y + 0.2 * s, z, s, sy: s * 0.7, ry, color: pick(C.round), r: 0.9 * s, soft: true });
    else if (p.k === 'cactus') items.push({ kind: OB.CACTUS, x, y: y - 0.2, z, s, sy: s, ry, dh: 0, dl: 0, r: 0.34 * s });
    else if (p.k === 'rock' || p.k === 'boulder') { const b = p.k === 'boulder' ? 2.6 : 1.2, S = s * b; items.push({ kind: OB.ROCK, x, y: y - 0.2 * S, z, s: S, sx: S * 1.1, sy: S * 0.75, sz: S, ry, rx: 0.15, dl: 0, r: 0.8 * S, shape: Math.abs(Math.round(x + z)) % 3 }); }
  }
}
/** The stage's placed buildings, appended to the track's own (tr.structures: core/elements/structures.js shapes). */
export function editHouses(tr, stage) {
  const H = stage.edits && stage.edits.houses; if (!H || !H.length) return;
  const rnd = mulberry32(stage.seed * 19 + 913), pick = a => a[Math.floor(rnd() * a.length)], out = tr.structures || (tr.structures = []);
  for (const B of H) {
    const T = BUILDINGS[B.type]; if (!T) throw new Error(`${stage.name}: edits.houses: no type "${B.type}" (${BUILDING_TYPES.join(', ')})`);
    out.push({ id: out.length, type: B.type, mat: T.mat, x: B.x, z: B.z, f: (B.f || 0) * Math.PI / 180, w: T.w, d: T.d, floors: T.floors, open: !!T.open, shop: !!T.shop, road: false,
      wall: pick(T.walls), roofC: pick(T.roofC), roof: T.roof, placed: true });
  }
}
