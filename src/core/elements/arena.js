import { BREAKABLES } from '../../data/breakables.js';
import { mulberry32 } from '../math.js';

// A derby arena (G3; the derby itself is core/modes/derby.js): stage `arena: {...}` on a small circuit. The circuit is
// only where the cars line up and what the race measures (tag its sections `open: 'field'` so it has no barriers); the
// arena is the ground round it: a flat floor out to a wall of an unbreakable kind (`ring`: tyres, a concrete barrier,
// hay at a farm), with, inside it:
//   shape   the outline, [[a, b], ...] in the segs' screen axes (a right, b up-screen), metres from the circuit's middle;
//           any shape: bays, necks, lobes. None: a circle RING m outside the circuit
//   walls   interior runs of the same wall, [[a1, b1, a2, b2], ...]: islands, wedges and alleys to drive round and through
//   ramps   earth ramps to fly off: a number (placed at random) or [{ a, b, dir }] (dir: degrees, 0 = +a, 90 = +b)
//   pits    [{ a, b, r, kind: 'mud' | 'water' }]: wallows that slow and slide you (sim/car.js surface)
//   props   [{ kind, n }]: breakables (data/breakables.js) scattered over the floor, things to smash or hide behind
// The floor is shaped in track/terrain.js (and kept clear of trees there and in track/obstacles.js); the walls and
// props are breakables, so core/features/breakables.js does their collisions. Deterministic from the stage seed.
export const ARENA = { RING: 10, SEG: 5, RAMP: { len: 9, w: 6, h: 1.4 }, CIRCLE: 48 };
const S2 = Math.SQRT2;
/** The ramps' extra height at (x, z) on arena A's floor (and a pit's dip). */
export function arenaRamps(A, x, z) {
  let y = 0;
  for (const r of A.ramps) {
    const dx = x - r.x, dz = z - r.z, a = dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw), b = dx * Math.cos(r.yaw) - dz * Math.sin(r.yaw);
    if (Math.abs(b) > r.w / 2 || a < -r.len / 2 || a > r.len / 2) continue;
    const u = (a + r.len / 2) / r.len; y = Math.max(y, r.h * (u < 0.75 ? u / 0.75 : (1 - u) / 0.25));   // up the long face, a short drop off the lip
  }
  for (const p of A.pits || []) { const d = Math.hypot(x - p.x, z - p.z); if (d < p.r) y -= 0.35 * (1 - (d / p.r) ** 2); }   // a shallow dip
  return y;
}
const segDist = (x, z, x1, z1, x2, z2) => { const dx = x2 - x1, dz = z2 - z1, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((x - x1) * dx + (z - z1) * dz) / l2)), px = x1 + dx * t, pz = z1 + dz * t; return [Math.hypot(x - px, z - pz), px, pz]; };
/** Is (x, z) inside arena A's outline? */
export function inArena(A, x, z) {
  const P = A.poly; let inside = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const [xi, zi] = P[i], [xj, zj] = P[j]; if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) inside = !inside; }
  return inside;
}
/** How far (x, z) is outside arena A's outline (0 inside). */
export function arenaOut(A, x, z) {
  if (inArena(A, x, z)) return 0;
  let d = 1e9; const P = A.poly; for (let i = 0, j = P.length - 1; i < P.length; j = i++) d = Math.min(d, segDist(x, z, P[j][0], P[j][1], P[i][0], P[i][1])[0]);
  return d;
}
/** The nearest wall to (x, z), outline or interior: { d, nx, nz } (the unit vector from the wall to the point). */
export function arenaWall(A, x, z) {
  let best = { d: 1e9, nx: 0, nz: 0 };
  const test = (x1, z1, x2, z2) => { const [d, px, pz] = segDist(x, z, x1, z1, x2, z2); if (d < best.d) best = { d, nx: (x - px) / (d || 1), nz: (z - pz) / (d || 1) }; };
  const P = A.poly; for (let i = 0, j = P.length - 1; i < P.length; j = i++) test(P[j][0], P[j][1], P[i][0], P[i][1]);
  for (const w of A.walls) test(...w);
  if (!inArena(A, x, z)) { best.nx = -best.nx; best.nz = -best.nz; best.d = -best.d; }   // outside: back the other way
  return best;
}
/** The pit (mud or water) at (x, z) in arena A, or null. */
export const arenaPit = (A, x, z) => (A.pits || []).find(p => Math.hypot(x - p.x, z - p.z) < p.r) || null;
export const element = {
  name: 'arena',
  about: 'a derby arena: a flat floor of any outline round a small circuit, wall runs inside it, props, ramps and mud pits',
  stageKeys: { arena: "{ ring: an unbreakable kind ('tyres', 'barrier', 'bales'), shape: [[a, b]], walls: [[a1, b1, a2, b2]], ramps: n | [{ a, b, dir }], pits: [{ a, b, r, kind }], props: [{ kind, n }] }" },
  track(ctx, out) {
    const { stage, xs0, zs0, H0, N0, startIdx } = ctx, A0 = stage.arena; out.arena = null;
    if (!A0) return;
    if (!BREAKABLES[A0.ring] || BREAKABLES[A0.ring].hp !== Infinity) throw new Error(`${stage.name}: arena ring must be an unbreakable kind (tyres, barrier, bales): "${A0.ring}"`);
    let x = 0, z = 0, h = 0; for (let i = 0; i < N0; i++) { x += xs0[i]; z += zs0[i]; h += H0[i]; } x /= N0; z /= N0; h /= N0;
    let r0 = 0; for (let i = 0; i < N0; i++) r0 = Math.max(r0, Math.hypot(xs0[i] - x, zs0[i] - z)); r0 += ARENA.RING;
    const W = (a, b) => [x + (a - b) / S2, z - (a + b) / S2];                       // screen axes (a, b) -> world, as stage rivers
    const poly = A0.shape ? A0.shape.map(([a, b]) => W(a, b)) : Array.from({ length: ARENA.CIRCLE }, (_, k) => { const t = k / ARENA.CIRCLE * 2 * Math.PI; return [x + Math.sin(t) * r0, z + Math.cos(t) * r0]; });
    const walls = (A0.walls || []).map(([a1, b1, a2, b2]) => [...W(a1, b1), ...W(a2, b2)]);
    const pits = (A0.pits || []).map(p => { const [px, pz] = W(p.a, p.b); return { x: px, z: pz, r: p.r, kind: p.kind || 'mud' }; });
    const A = { x, z, r: Math.max(...poly.map(([px, pz]) => Math.hypot(px - x, pz - z))), floor: h, poly, walls, pits, ramps: [], ring: A0.ring };
    const rnd = mulberry32(stage.seed * 13 + 77), list = out.breakables ? out.breakables.slice() : [], near = (px, pz) => { let b = 0, bd = 1e9; for (let i = 0; i < N0; i++) { const d = Math.hypot(xs0[i] - px, zs0[i] - pz); if (d < bd) { bd = d; b = i; } } return b; };
    const put = (kind, px, pz, yaw, len) => list.push({ id: list.length, kind, b: near(px, pz), alt: -1, x: px, z: pz, y: h, yaw, arena: true, ...(len ? { len } : {}) });
    // the wall: pieces end to end along the outline and every interior run, each cut to fit so there are no gaps (`len`)
    const run = (x1, z1, x2, z2) => { const L = Math.hypot(x2 - x1, z2 - z1), n = Math.max(1, Math.ceil(L / ARENA.SEG - 0.05)), yaw = Math.atan2(x2 - x1, z2 - z1); for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; put(A0.ring, x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, yaw, +(L / n + 0.3).toFixed(2)); } };
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; run(p[0], p[1], q[0], q[1]); }
    for (const w of walls) run(...w);
    // ramps (placed, or n at random clear of the walls), then the props over the floor, clear of the start, the walls and each other
    const spots = [], free = (px, pz, m) => inArena(A, px, pz) && arenaWall(A, px, pz).d > m && Math.hypot(px - xs0[startIdx], pz - zs0[startIdx]) > 18 && spots.every(s => Math.hypot(s[0] - px, s[1] - pz) > m + s[2]);
    const anywhere = () => { const P = A.poly, x0 = Math.min(...P.map(p => p[0])), x1 = Math.max(...P.map(p => p[0])), z0 = Math.min(...P.map(p => p[1])), z1 = Math.max(...P.map(p => p[1])); return [x0 + rnd() * (x1 - x0), z0 + rnd() * (z1 - z0)]; };
    if (Array.isArray(A0.ramps)) for (const rp of A0.ramps) {
      const [px, pz] = W(rp.a, rp.b), t = (rp.dir || 0) * Math.PI / 180, da = Math.cos(t), db = Math.sin(t);
      A.ramps.push({ x: px, z: pz, yaw: Math.atan2((da - db) / S2, -(da + db) / S2), ...ARENA.RAMP, ...(rp.h ? { h: rp.h } : {}) }); spots.push([px, pz, 8]);
    } else for (let k = 0; k < (A0.ramps || 0); k++) for (let t = 0; t < 60; t++) {
      const [px, pz] = anywhere(); if (!free(px, pz, 10)) continue;
      A.ramps.push({ x: px, z: pz, yaw: rnd() * 2 * Math.PI, ...ARENA.RAMP }); spots.push([px, pz, 8]); break;
    }
    for (const p of pits) spots.push([p.x, p.z, p.r]);
    for (const p of A0.props || []) {
      if (!BREAKABLES[p.kind]) throw new Error(`${stage.name}: arena props: no breakable "${p.kind}"`);
      for (let k = 0; k < p.n; k++) for (let t = 0; t < 60; t++) {
        const [px, pz] = anywhere(); if (!free(px, pz, 4)) continue;
        put(p.kind, px, pz, rnd() * Math.PI); spots.push([px, pz, 3]); break;
      }
    }
    out.breakables = list;
    out.arena = A;
  },
  markers: tr => tr.arena ? [{ i: tr.startIdx, label: `arena ${tr.arena.poly.length}-sided, ${tr.arena.walls.length} walls, ${tr.arena.ramps.length} ramps, ${tr.arena.pits.length} pits` }] : []
};
