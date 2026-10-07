import { BREAKABLES } from '../../data/breakables.js';
import { mulberry32 } from '../math.js';

// A derby arena (G3; the derby itself is core/modes/derby.js): stage `arena: { ring, props, ramps }` on a small
// circuit. The circuit is only where the cars line up and what the race measures (tag its sections `open: 'field'` so
// it has no barriers); the arena is the bowl it runs round: a flat floor out to a ring of wall `ring` (an unbreakable
// kind: tyres, a concrete wall, hay at a farm), with breakable `props` scattered over the floor ([{ kind, n }]: data/
// breakables.js kinds, things to smash or hide behind) and `ramps` earth mounds to fly off. Its centre and radius come
// from the circuit (the ring stands RING m outside it). The floor is shaped in track/terrain.js (and kept clear of
// trees there and in track/obstacles.js); the walls and props are breakables, so core/features/breakables.js does
// their collisions: cars bounce off the ring and smash the props. Deterministic from the stage seed.
export const ARENA = { RING: 10, SEG: 5, RAMP: { len: 9, w: 6, h: 1.4 } };
/** The ramps' extra height at (x, z) on arena A's floor. */
export function arenaRamps(A, x, z) {
  let y = 0;
  for (const r of A.ramps) {
    const dx = x - r.x, dz = z - r.z, a = dx * Math.sin(r.yaw) + dz * Math.cos(r.yaw), b = dx * Math.cos(r.yaw) - dz * Math.sin(r.yaw);
    if (Math.abs(b) > r.w / 2 || a < -r.len / 2 || a > r.len / 2) continue;
    const u = (a + r.len / 2) / r.len; y = Math.max(y, r.h * (u < 0.75 ? u / 0.75 : (1 - u) / 0.25));   // up the long face, a short drop off the lip
  }
  return y;
}
export const element = {
  name: 'arena',
  about: 'a derby arena: a flat bowl round a small circuit, a wall ring, props to smash and ramps',
  stageKeys: { arena: "{ ring: an unbreakable kind for the wall ('tyres', 'barrier', 'bales'), props: [{ kind, n }], ramps: n }" },
  track(ctx, out) {
    const { stage, xs0, zs0, H0, N0, startIdx } = ctx, A0 = stage.arena; out.arena = null;
    if (!A0) return;
    if (!BREAKABLES[A0.ring] || BREAKABLES[A0.ring].hp !== Infinity) throw new Error(`${stage.name}: arena ring must be an unbreakable kind (tyres, barrier, bales): "${A0.ring}"`);
    let x = 0, z = 0, h = 0; for (let i = 0; i < N0; i++) { x += xs0[i]; z += zs0[i]; h += H0[i]; } x /= N0; z /= N0; h /= N0;
    let r = 0; for (let i = 0; i < N0; i++) r = Math.max(r, Math.hypot(xs0[i] - x, zs0[i] - z)); r += ARENA.RING;
    const rnd = mulberry32(stage.seed * 13 + 77), list = out.breakables ? out.breakables.slice() : [], near = (px, pz) => { let b = 0, bd = 1e9; for (let i = 0; i < N0; i++) { const d = Math.hypot(xs0[i] - px, zs0[i] - pz); if (d < bd) { bd = d; b = i; } } return b; };
    const put = (kind, px, pz, yaw) => list.push({ id: list.length, kind, b: near(px, pz), alt: -1, x: px, z: pz, y: h, yaw, arena: true });
    // the ring: wall pieces end to end round the bowl
    const n = Math.ceil(2 * Math.PI * r / ARENA.SEG);
    for (let k = 0; k < n; k++) { const a = (k + 0.5) / n * 2 * Math.PI; put(A0.ring, x + Math.sin(a) * r, z + Math.cos(a) * r, a + Math.PI / 2); }
    // ramps first (props keep off them), then the props scattered over the floor, clear of the start line and each other
    const ramps = [], spots = [], free = (px, pz, m) => Math.hypot(px - xs0[startIdx], pz - zs0[startIdx]) > 18 && spots.every(s => Math.hypot(s[0] - px, s[1] - pz) > m + s[2]);
    for (let k = 0; k < (A0.ramps || 0); k++) for (let t = 0; t < 30; t++) {
      const a = rnd() * 2 * Math.PI, d = r * (0.25 + rnd() * 0.4), px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
      if (!free(px, pz, 10)) continue; ramps.push({ x: px, z: pz, yaw: rnd() * 2 * Math.PI, ...ARENA.RAMP }); spots.push([px, pz, 8]); break;
    }
    for (const p of A0.props || []) {
      if (!BREAKABLES[p.kind]) throw new Error(`${stage.name}: arena props: no breakable "${p.kind}"`);
      for (let k = 0; k < p.n; k++) for (let t = 0; t < 30; t++) {
        const a = rnd() * 2 * Math.PI, d = r * Math.sqrt(rnd()) * 0.8, px = x + Math.sin(a) * d, pz = z + Math.cos(a) * d;
        if (!free(px, pz, 4)) continue; put(p.kind, px, pz, rnd() * Math.PI); spots.push([px, pz, 3]); break;
      }
    }
    out.breakables = list;
    out.arena = { x, z, r, floor: h, ramps, ring: A0.ring };
  },
  markers: tr => tr.arena ? [{ i: tr.startIdx, label: `arena r ${Math.round(tr.arena.r)} m` }] : []
};
