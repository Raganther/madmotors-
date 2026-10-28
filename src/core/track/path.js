// The Track Studio's road (ui/studio.js Road tool): the road's line as control points you drag about, laid over any
// stage. stage.edits.path = { pts: [[x, z, dh], ...], closed } in world metres: the road runs through every point on a
// smooth curve (centripetal Catmull-Rom), dh lifts (or sinks) it there, eased from point to point. Everything the stage
// had along its road (heights, tunnels and bridges, set pieces, a gorge's banks and cliffs, jumps) is carried over to
// the new line by distance round the lap, so the road keeps what it had where it had it, just on a new line. Branches
// (shortcuts) are dropped: their joins were made for the old line. Applied to a generator's output before the track is
// finished (core/track/circuit.js buildLoop, build.js for downhill runs).
import { GROUND, groundXZ } from './ground.js';
export const PATH = { STEP: 1, MIN_GAP: 6 };

/** Control points from a built road (base samples): one wherever the road has turned ~20 degrees, or every 45 m. */
export function pathFromTrack(tr) {
  const N = tr.loopN || tr.N, closed = !!tr.loopN, pts = [];
  let last = 0, turn = 0; pts.push([r1(tr.xs[0]), r1(tr.zs[0]), 0]);
  for (let i = 1; i < N - 1; i++) {
    turn += Math.abs(wrap(tr.th[i] - tr.th[i - 1]));
    if (turn > 0.35 || i - last >= 45) { pts.push([r1(tr.xs[i]), r1(tr.zs[i]), 0]); last = i; turn = 0; }
  }
  if (!closed) pts.push([r1(tr.xs[N - 1]), r1(tr.zs[N - 1]), 0]);
  else if (N - last < 15) pts.pop();   // (the last point would crowd the first)
  return { pts, closed };
}
const r1 = v => Math.round(v * 10) / 10, wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
/** The road along the control points, a sample every metre: { xs, zs, dh }. */
export function samplePath(path) {
  const P = path.pts, n = P.length, closed = !!path.closed; if (n < 2) return { xs: [], zs: [], dh: [] };
  const at = i => closed ? P[(i % n + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const dense = [];
  for (let s = 0; s < (closed ? n : n - 1); s++) {
    const p0 = at(s - 1), p1 = at(s), p2 = at(s + 1), p3 = at(s + 2);
    // centripetal Catmull-Rom (no loops or cusps when points bunch up)
    const knot = (a, b) => Math.max(1e-3, Math.hypot(b[0] - a[0], b[1] - a[1]) ** 0.5), t1 = knot(p0, p1), t2 = t1 + knot(p1, p2), t3 = t2 + knot(p2, p3);
    const len = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]), m = Math.max(2, Math.ceil(len / 0.5));
    for (let q = 0; q < m; q++) {
      const t = t1 + (t2 - t1) * q / m;
      const A1 = L2(p0, p1, t, 0, t1), A2 = L2(p1, p2, t, t1, t2), A3 = L2(p2, p3, t, t2, t3), B1 = L2(A1, A2, t, 0, t2), B2 = L2(A2, A3, t, t1, t3), C = L2(B1, B2, t, t1, t2);
      const u = q / m, e = u * u * (3 - 2 * u); dense.push([C[0], C[1], (p1[2] || 0) * (1 - e) + (p2[2] || 0) * e]);
    }
  }
  if (!closed) { const e = P[n - 1]; dense.push([e[0], e[1], e[2] || 0]); }
  // even steps of STEP metres along it
  const xs = [dense[0][0]], zs = [dense[0][1]], dh = [dense[0][2]]; let carry = 0;
  for (let i = 1; i < dense.length; i++) {
    const a = dense[i - 1], b = dense[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]); let s = PATH.STEP - carry;
    while (s <= d) { const k = s / d; xs.push(a[0] + (b[0] - a[0]) * k); zs.push(a[1] + (b[1] - a[1]) * k); dh.push(a[2] + (b[2] - a[2]) * k); s += PATH.STEP; }
    carry = d - (s - PATH.STEP);
  }
  return { xs, zs, dh };
}
function L2(a, b, t, ta, tb) { const k = (t - ta) / (tb - ta || 1e-3); return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]; }
/** A generator's output (circuit.js genCircuit / genLoop / genPass, downhill.js genPath) moved onto the stage's path. */
export function onPath(stage, g) {
  const path = stage.edits && stage.edits.path; if (!path || !path.pts || path.pts.length < 2) return g;
  const p = samplePath(path), N0 = g.xs.length, N1 = p.xs.length, map = j => Math.min(N0 - 1, Math.round(j * N0 / N1)), back = i => Math.min(N1 - 1, Math.round(i * N1 / N0));
  const remap = a => Array.from({ length: N1 }, (_, j) => a[map(j)]);
  const out = { ...g, xs: p.xs, zs: p.zs, dh: p.dh, alts: [] };
  for (const k of Object.keys(g)) if (k !== 'xs' && k !== 'zs' && Array.isArray(g[k]) && g[k].length === N0) out[k] = remap(g[k]);
  if (g.hs && stage.ground && stage.ground.h) out.hs = drape(stage.ground, p, !!path.closed);   // a painted landscape: the road lies on the land along its new line
  else if (g.hs) out.hs = out.hs.map((h, j) => h + p.dh[j]);
  if (g.ch) out.ch = Object.fromEntries(Object.entries(g.ch).map(([k, a]) => [k, remap(a)]));
  if (g.marks) out.marks = Object.fromEntries(Object.entries(g.marks).map(([k, list]) => [k, list.map(v => typeof v === 'number' ? back(v) : Array.isArray(v) ? v.map((x, j) => j < 2 ? back(x) : x) : Object.fromEntries(Object.entries(v).map(([q, x]) => [q, ['i', 'a', 'b'].includes(q) ? back(x) : x])))]));
  return out;
}
// the road's heights along its new line on a painted landscape (core/track/ground.js): the land under it, smoothed and
// kept under GROUND.GRADE (as roadOnGround does for the Terrain builder), plus the points' own lift
function drape(ground, p, closed) {
  const at = groundXZ(ground), n = p.xs.length, raw = p.xs.map((x, i) => at(x, p.zs[i])), w = GROUND.SMOOTH / 2 | 0, get = i => closed ? raw[(i % n + n) % n] : raw[Math.max(0, Math.min(n - 1, i))];
  const h = raw.map((_, i) => { let s = 0; for (let j = -w; j <= w; j++) s += get(i + j); return s / (2 * w + 1); });
  for (let pass = 0; pass < (closed ? 6 : 2); pass++) {
    for (let i = 1; i < n; i++) h[i] = Math.max(h[i - 1] - GROUND.GRADE, Math.min(h[i - 1] + GROUND.GRADE, h[i]));
    for (let i = n - 2; i >= 0; i--) h[i] = Math.max(h[i + 1] - GROUND.GRADE, Math.min(h[i + 1] + GROUND.GRADE, h[i]));
  }
  return h.map((v, i) => v + p.dh[i]);
}
