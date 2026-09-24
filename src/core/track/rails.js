import { clamp } from '../math.js';

// Section-tagged circuits. Segments: ['s', len, endH, tag] and ['a', radius, degrees (+ = left), endH, tag].
// A straight's length can be {toA: v} / {toB: v}: drive until that screen coordinate is reached (used to close the loop).
// Tags describe the ground either side: far = terrain height above the road on the up-screen side, near = on the
// camera side (negative = a drop), with rampF / rampN metres to get there (small = sheer). Also bridge, tunnel, jump.
// ---------- railways ----------
// A line is a polyline (screen a/b coords + height) with optional rounded corners. Trains may run past both ends,
// which are placed out of view or inside a hill (portals: the visible span stops where the ground rises over the rails).
export function makeRailLine(def) {
  let P = def.pts.map(([a, b, h]) => ({ x: (a - b) / Math.SQRT2, z: -(a + b) / Math.SQRT2, h }));
  if (def.round) {   // fillet each inner corner with an arc of radius `round`
    const out = [P[0]];
    for (let k = 1; k < P.length - 1; k++) {
      const A = P[k - 1], B = P[k], C = P[k + 1], d1 = Math.hypot(B.x - A.x, B.z - A.z), d2 = Math.hypot(C.x - B.x, C.z - B.z);
      const u1 = [(B.x - A.x) / d1, (B.z - A.z) / d1], u2 = [(C.x - B.x) / d2, (C.z - B.z) / d2];
      const turn = Math.acos(clamp(u1[0] * u2[0] + u1[1] * u2[1], -1, 1)), tl = Math.min(def.round * Math.tan(turn / 2), d1 * 0.45, d2 * 0.45);
      const p0 = { x: B.x - u1[0] * tl, z: B.z - u1[1] * tl }, p2 = { x: B.x + u2[0] * tl, z: B.z + u2[1] * tl }, n = Math.max(2, Math.ceil(turn * def.round / 3));
      for (let q = 0; q <= n; q++) {   // quadratic Bezier through the corner is close enough to an arc here
        const t = q / n, x = (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * B.x + t * t * p2.x, z = (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * B.z + t * t * p2.z;
        out.push({ x, z, h: B.h });
      }
    }
    out.push(P[P.length - 1]); P = out;
  }
  const S = [0]; for (let k = 1; k < P.length; k++) S.push(S[k - 1] + Math.hypot(P[k].x - P[k - 1].x, P[k].z - P[k - 1].z));
  return { def, id: def.id, P, S, len: S[S.length - 1], speed: def.speed, visA: 0, visB: S[S.length - 1], crossings: [] };
}
// position along a line; beyond either end the line carries straight on
export function railAt(L, s) {
  const P = L.P, S = L.S; let k = 0;
  if (s <= 0) k = 0; else if (s >= L.len) k = P.length - 2; else while (k < P.length - 2 && S[k + 1] < s) k++;
  const a = P[k], b = P[k + 1], seg = S[k + 1] - S[k], t = (s - S[k]) / seg;
  return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, h: a.h + (b.h - a.h) * clamp(t, 0, 1), yaw: Math.atan2(b.x - a.x, b.z - a.z) };
}
export function railProject(L, x, z) {
  let best = 1e9, bs = 0; const P = L.P, S = L.S;
  for (let k = 0; k < P.length - 1; k++) {
    const ax = P[k].x, az = P[k].z, dx = P[k + 1].x - ax, dz = P[k + 1].z - az, l2 = dx * dx + dz * dz, t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
    const d = Math.hypot(x - ax - dx * t, z - az - dz * t); if (d < best) { best = d; bs = S[k] + t * Math.sqrt(l2); }
  }
  return { d: best, s: bs };
}
export function trainCars(L) { const out = [16]; for (let k = 0; k < L.def.cars; k++) out.push(14); return out; }
export function trainLen(L) { return trainCars(L).reduce((a, b) => a + b + 1.5, -1.5); }
