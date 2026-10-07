import { HALF } from '../constants.js';
import { TAU, mulberry32 } from '../math.js';
import { GATE, OPEN, TRAIL, onTrail } from '../elements/open.js';
import { arenaOut } from '../elements/arena.js';

// Scenery you can hit: trees, cacti and rocks are solid, bushes are soft (you plough through, they flatten). Placed
// once per stage from its seed (render/world/scenery.js draws exactly these), and kept in a coarse grid so a car only
// looks at the few near it (sim/obstacles.js). Kinds:
export const OB = { PINE: 0, ROUND: 1, CACTUS: 2, ROCK: 3, BUSH: 4 };
const CELL = 12;
export function placeObstacles(tr, terr, stage) {
  const rnd = mulberry32(stage.seed * 7 + 3), C = stage.colors;
  const pick = a => a[Math.floor(rnd() * a.length)];
  // anything standing high above a nearby road throws its shadow across the road: keep it back from the edge
  const overhangs = (x, z, q) => { if (!q) return false; const up = terr.at(x, z) - tr.H[q.i]; return up > 4 && q.d < 12 + up * 0.75; };
  const slopeAt = (x, z) => Math.hypot(terr.at(x + 1.5, z) - terr.at(x - 1.5, z), terr.at(x, z + 1.5) - terr.at(x, z - 1.5)) / 3;
  const x0 = Math.min(-195, tr.minX - 90), x1 = Math.max(195, tr.maxX + 90), z0 = tr.minZ - 80, z1 = tr.maxZ + 110, area = (x1 - x0) * (z1 - z0);
  const kit = terr.kit, at0 = () => [x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)];
  // inside a town (core/kit/layout.js) nothing grows: a candidate there is drawn again (only stages with towns)
  // nor inside a derby arena's ring (core/elements/arena.js)
  const ar = tr.arena, taken = (x, z) => (kit && kit.inZone(x, z, 2)) || (ar && Math.hypot(x - ar.x, z - ar.z) < ar.r + 6 && arenaOut(ar, x, z) < 6);
  const at = kit || ar ? () => { let p = at0(); for (let k = 0; k < 8 && taken(p[0], p[1]); k++) p = at0(); return p; } : at0;
  const items = [];
  // trees: a pine or a round-topped tree on a trunk; r is what a car hits (a pine's low skirt of branches, a trunk)
  for (let k = 0, n = Math.round(area * (stage.trees ? stage.trees.density : 0)); k < n; k++) {
    const [x, z] = at(), q = tr.nearest(x, z);
    if (q && q.d < HALF + 11) continue; if (q && onTrail(tr, tr.bi(q.i), (x - tr.xs[q.i]) * tr.rx[q.i] + (z - tr.zs[q.i]) * tr.rz[q.i], TRAIL.CLEAR)) continue; if (slopeAt(x, z) > 0.8 || overhangs(x, z, q)) continue; if (tr.town && q && tr.town[tr.bi(q.i)] && q.d < 32) continue; if (tr.falls && tr.falls.some(f => Math.hypot(x - tr.xs[f.i], z - tr.zs[f.i]) < 32)) continue; { const qt = tr.nearestTun(x, z); if (qt && qt.d < HALF + 16) continue; }
    const y = terr.at(x, z) - 0.2, s = 0.8 + rnd() * 0.7, ry = rnd() * TAU;
    const pine = (!!stage.alpine && y > stage.alpine.treeLine) || rnd() < stage.trees.pine;
    if (pine) items.push({ kind: OB.PINE, x, y, z, s, sy: s * (0.9 + rnd() * 0.4), ry, color: pick(C.pine), r: 0.3 * s, brush: 0.75 * s });
    else items.push({ kind: OB.ROUND, x, y, z, s, sy: s * (0.85 + rnd() * 0.3), ry, color: pick(C.round), r: 0.32 * s });
  }
  // saguaro cacti (desert stages): dh / dl shift the hue and lightness of the cactus green
  for (let k = 0, n = Math.round(area * (stage.cacti || 0)); k < n; k++) {
    const [x, z] = at(), q = tr.nearest(x, z);
    if (q && q.d < HALF + 8) continue; if (slopeAt(x, z) > 0.6 || overhangs(x, z, q)) continue;
    const s = 0.7 + rnd() * 0.6, dh = (rnd() - 0.5) * 0.04, dl = (rnd() - 0.5) * 0.08;
    items.push({ kind: OB.CACTUS, x, y: terr.at(x, z) - 0.2, z, s, sy: s * (0.85 + rnd() * 0.4), ry: rnd() * TAU, dh, dl, r: 0.34 * s });
  }
  // rocks: the small ones are rubble you drive over, the rest are solid (dl: lightness shift of the stage's rock colour)
  for (let k = 0, n = Math.round(area * (stage.rocks || 0)); k < n; k++) {
    const [x, z] = at(), q = tr.nearest(x, z); if (q && q.d < HALF + 5) continue;
    if (overhangs(x, z, q)) continue;
    const s = 0.8 + rnd() * 2.2, dl = (rnd() - 0.5) * 0.12, sx = s * (0.8 + rnd() * 0.6), sy = s * (0.5 + rnd() * 0.5), sz = s * (0.8 + rnd() * 0.6);
    items.push({ kind: OB.ROCK, x, y: terr.at(x, z) - 0.2 * s, z, s, sx, sy, sz, ry: rnd() * TAU, rx: rnd() * 0.4, dl, r: sy > 0.7 ? 0.8 * Math.min(sx, sz) : 0, shape: Math.floor(rnd() * 3) });
  }
  for (let k = 0, n = Math.round(area * (stage.bushes || 0)); k < n; k++) {
    const [x, z] = at(), q = tr.nearest(x, z); if (q && q.d < HALF + 4) continue; if (overhangs(x, z, q)) continue;
    if (stage.alpine && terr.at(x, z) > stage.alpine.treeLine) continue;
    const s = 0.6 + rnd() * 0.8;
    items.push({ kind: OB.BUSH, x, y: terr.at(x, z) + 0.2 * s, z, s, sy: s * 0.7, ry: rnd() * TAU, color: pick(C.round), r: 0.9 * s, soft: true });
  }
  if (tr.open) placeOpen(tr, terr, stage, items, rnd, pick);
  if (ar) for (let k = items.length - 1; k >= 0; k--) if (arenaOut(ar, items[k].x, items[k].z) < 4) items.splice(k, 1);   // an arena's floor is clear
  const grid = new Map(), key = (cx, cz) => cx * 100003 + cz;
  items.forEach((o, k) => { if (!o.r) return; const g = key(Math.floor(o.x / CELL), Math.floor(o.z / CELL)); let a = grid.get(g); if (!a) grid.set(g, a = []); a.push(k); });
  return {
    items,
    /** Obstacle indices that could touch a circle at (x, z) of radius <= CELL. */
    near(x, z, out = []) {
      out.length = 0; const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
      for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const l = grid.get(key(cx + a, cz + b)); if (l) for (const k of l) out.push(k); }
      return out;
    }
  };
}
// Open country (elements/open.js): each leg's land out to ZONE.W m either side of its route. Forest: trees no closer
// than ZONE.GAP[kind] m (trunk to trunk), so there's always a way through for a car, just not a straight one; rock
// gardens: boulders to steer round and rubble to drive over; fields: the odd bush. Kept clear round the gates and near
// the roads, so a gate is never blocked and the road legs keep their verges.
const ZONE = { W: 55, STEP: 4.5, GAP: { 1: 14, 2: 6.2, 3: 8 }, P: { 1: 0.05, 2: 0.72, 3: 0.4 } };
function placeOpen(tr, terr, stage, items, rnd, pick) {
  const C = stage.colors, N = tr.loopN || tr.N, cell = new Map(), key = (x, z) => Math.floor(x / 8) * 100003 + Math.floor(z / 8);
  const gates = (tr.gates || []).filter(i => i < tr.startIdx + N).map(i => [tr.xs[i], tr.zs[i]]);
  const clear = (x, z, gap) => { const cx = Math.floor(x / 8), cz = Math.floor(z / 8); for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) for (const o of cell.get((cx + a) * 100003 + cz + b) || []) if (Math.hypot(o.x - x, o.z - z) < gap) return false; return true; };
  for (let i = 0; i < N; i += 3) {
    const kind = tr.open[tr.bi(i)]; if (!kind || kind === OPEN.stream) continue;
    for (let o = -ZONE.W; o <= ZONE.W; o += ZONE.STEP) {
      if (rnd() > ZONE.P[kind]) continue;
      const x = tr.xs[i] + tr.rx[i] * o + (rnd() - 0.5) * 3.5, z = tr.zs[i] + tr.rz[i] * o + (rnd() - 0.5) * 3.5, q = tr.nearest(x, z);
      if (!q || !tr.open[tr.bi(q.i)] || tr.open[tr.bi(q.i)] !== kind) continue;              // this leg's own land, not a road's or another leg's
      if (onTrail(tr, tr.bi(q.i), (x - tr.xs[q.i]) * tr.rx[q.i] + (z - tr.zs[q.i]) * tr.rz[q.i], TRAIL.CLEAR)) continue;   // the trail stays clear
      if (gates.some(([gx, gz]) => Math.hypot(gx - x, gz - z) < GATE.W)) continue;
      const g = ZONE.GAP[kind]; if (!clear(x, z, g)) continue;
      const y = terr.at(x, z), s = 0.9 + rnd() * 0.6, ry = rnd() * TAU; let it;
      if (kind === OPEN.forest && rnd() < 0.22) it = { kind: OB.BUSH, x, y: y + 0.2 * s, z, s: s * 1.1, sy: s * 0.9, ry, color: pick(C.round), r: 0.9 * s, soft: true };   // undergrowth you plough through
      else if (kind === OPEN.forest) it = rnd() < stage.trees.pine ? { kind: OB.PINE, x, y: y - 0.2, z, s, sy: s * (0.9 + rnd() * 0.4), ry, color: pick(C.pine), r: 0.3 * s, brush: 0.75 * s } : { kind: OB.ROUND, x, y: y - 0.2, z, s, sy: s * (0.85 + rnd() * 0.3), ry, color: pick(C.round), r: 0.32 * s };
      else if (kind === OPEN.rocks) {   // a few big boulders to steer round; the rest low rubble you drive over
        const big = rnd() < 0.35, k = big ? 1.9 + rnd() * 1.1 : 0.5 + rnd() * 0.6, sx = k * (0.8 + rnd() * 0.6), sy = k * (big ? 0.75 + rnd() * 0.35 : 0.3 + rnd() * 0.25), sz = k * (0.8 + rnd() * 0.6);
        it = { kind: OB.ROCK, x, y: y - 0.2 * k, z, s: k, sx, sy, sz, ry, rx: rnd() * 0.4, dl: (rnd() - 0.5) * 0.12, r: sy > 0.7 ? 0.8 * Math.min(sx, sz) : 0, shape: Math.floor(rnd() * 3) };
      } else it = { kind: OB.BUSH, x, y: y + 0.2 * s, z, s, sy: s * 0.7, ry, color: pick(C.round), r: 0.9 * s, soft: true };
      items.push(it); const kk = key(x, z); let a = cell.get(kk); if (!a) cell.set(kk, a = []); a.push(it);
    }
  }
}
