import { HALF } from '../constants.js';
import { TAU, mulberry32 } from '../math.js';

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
  const items = [], at = () => [x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)];
  // trees: a pine or a round-topped tree on a trunk; r is what a car hits (a pine's low skirt of branches, a trunk)
  for (let k = 0, n = Math.round(area * (stage.trees ? stage.trees.density : 0)); k < n; k++) {
    const [x, z] = at(), q = tr.nearest(x, z);
    if (q && q.d < HALF + 11) continue; if (slopeAt(x, z) > 0.8 || overhangs(x, z, q)) continue; if (tr.town && q && tr.town[tr.bi(q.i)] && q.d < 32) continue; if (tr.falls && tr.falls.some(f => Math.hypot(x - tr.xs[f.i], z - tr.zs[f.i]) < 32)) continue; { const qt = tr.nearestTun(x, z); if (qt && qt.d < HALF + 16) continue; }
    const y = terr.at(x, z) - 0.2, s = 0.8 + rnd() * 0.7, ry = rnd() * TAU;
    const pine = (!!stage.alpine && y > stage.alpine.treeLine) || rnd() < stage.trees.pine;
    if (pine) items.push({ kind: OB.PINE, x, y, z, s, sy: s * (0.9 + rnd() * 0.4), ry, color: pick(C.pine), r: 0.75 * s });
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
