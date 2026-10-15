import { sketch, endH } from './editing.js';

// ---------- painted ground (the Terrain builder, ui/terrain.js) ----------
// A stage can carry its own landscape: `ground` = { a0, b0, cell, cols, rows, h } is a grid of heights in metres over
// the plan (a = right, b = up-screen, the sections' axes; a0/b0 the corner of the grid, `cell` metres apart, h row by
// row along b). With it the ground away from the road is that landscape instead of the generated hills, and the
// road cuts and fills its way across it (core/track/terrain.js). roadOnGround lays a drawn road's heights along it.
export const GROUND = { CELL: 8, SIZE: 800, MIN: -60, MAX: 220, PIECE: 25, GRADE: 0.14, SMOOTH: 30,
  LIFT_STEP: 10, LIFT_MAX: 40, BRIDGE: 6, TUNNEL: 9 };   // the road's own lift, every LIFT_STEP m (m); held this far over the ground it's a bridge, this far under, a tunnel

/** A blank landscape, SIZE metres square around (a, b), flat at height h. */
export function blankGround(a = 0, b = 0, h = 0, size = GROUND.SIZE, cell = GROUND.CELL) {
  const n = Math.round(size / cell) + 1;
  return { a0: a - size / 2, b0: b - size / 2, cell, cols: n, rows: n, h: new Array(n * n).fill(h) };
}
/** Height of the painted ground at plan point (a, b): bilinear between grid points, held at the edge outside it. */
export function groundAt(g, a, b) {
  const fc = Math.max(0, Math.min(g.cols - 1.0001, (a - g.a0) / g.cell)), fr = Math.max(0, Math.min(g.rows - 1.0001, (b - g.b0) / g.cell));
  const c = Math.floor(fc), r = Math.floor(fr), u = fc - c, v = fr - r, k = r * g.cols + c, h = g.h;
  return (h[k] * (1 - u) + h[k + 1] * u) * (1 - v) + (h[k + g.cols] * (1 - u) + h[k + g.cols + 1] * u) * v;
}
/** The same in world x/z (circuit.js turns the plan 45 degrees into the world: x = (a - b) / sqrt 2, z = -(a + b) / sqrt 2). */
export const groundXZ = g => (x, z) => groundAt(g, (x - z) / Math.SQRT2, -(x + z) / Math.SQRT2);

// sections no longer than `piece` metres, so the heights can follow the ground (a section's height runs straight
// from its start to its end); the first piece keeps the section's tags
function chop(segs, piece) {
  const out = [];
  for (const sg of segs) {
    const len = sg[0] === 's' ? sg[1] : sg[1] * Math.abs(sg[2]) * Math.PI / 180, n = Math.max(1, Math.ceil(len / piece));
    for (let k = 0; k < n; k++) {
      const tg = k ? {} : { ...((sg[0] === 's' ? sg[3] : sg[4]) || {}) };
      out.push(sg[0] === 's' ? ['s', Math.round(sg[1] / n * 100) / 100, endH(sg), tg] : ['a', sg[1], Math.round(sg[2] / n * 1000) / 1000, endH(sg), tg]);
    }
  }
  // the turns were rounded: give the last curve whatever is left, so the lap still turns exactly as before
  const want = segs.reduce((t, sg) => t + (sg[0] === 'a' ? sg[2] : 0), 0), got = out.reduce((t, sg) => t + (sg[0] === 'a' ? sg[2] : 0), 0);
  for (let k = out.length - 1; k >= 0; k--) if (out[k][0] === 'a') { out[k][2] = Math.round((out[k][2] + want - got) * 1000) / 1000; break; }
  return out;
}
const STRAIGHT = new Set(['chicane', 'crumble', 'drawbridge']);   // pieces that only go on a straight
/** The road's own lift at `s` metres along it (the builder's road-height brush): `lift` holds one every LIFT_STEP m. */
export const liftAt = (lift, s) => { if (!lift || !lift.length) return 0; const f = Math.max(0, s / GROUND.LIFT_STEP), i = Math.floor(f), u = f - i; return (lift[Math.min(i, lift.length - 1)] || 0) * (1 - u) + (lift[Math.min(i + 1, lift.length - 1)] || 0) * u; };
/** Metres along the road at each of sketch k's points. */
export const runOf = k => { const out = [0]; for (let i = 1; i < k.pts.length; i++) out.push(out[i - 1] + Math.hypot(k.pts[i].a - k.pts[i - 1].a, k.pts[i].b - k.pts[i - 1].b)); return out; };
/**
 * The road on the landscape: sections (starting at plan point `start`, heading `heading`) cut into short pieces whose
 * heights follow the ground under them, smoothed over SMOOTH metres and kept under GRADE (a climb a car can take);
 * where the ground does more than that the road cuts through or rides over it. A lap wraps round. Returns new sections.
 * `lift` raises or sinks the road off the ground (the builder's road-height brush); where it ends up BRIDGE m over the
 * ground the piece is a bridge, TUNNEL m under it a tunnel. `pieces` ({ s: metres along, tag, v }) put an element's tag
 * on the piece at that spot (a jump, a water splash, a chicane...).
 */
export function roadOnGround(segs, heading, ground, start = { a: 0, b: 0 }, { piece = GROUND.PIECE, grade = GROUND.GRADE, smooth = GROUND.SMOOTH, lift = null, pieces = null } = {}) {
  if (!segs.length) return [];
  const out = chop(segs, piece), step = 2, k = sketch(out, heading, step), closed = k.gap < 1, P = k.pts, n = P.length, run = runOf(k);
  const bare = P.map(p => groundAt(ground, start.a + p.a, start.b + p.b)), raw = bare.map((v, i) => v + liftAt(lift, run[i]));
  const at = i => closed ? raw[((i % (n - 1)) + (n - 1)) % (n - 1)] : raw[Math.max(0, Math.min(n - 1, i))];
  const w = Math.max(1, Math.round(smooth / step / 2)), h = raw.map((_, i) => { let s = 0; for (let j = -w; j <= w; j++) s += at(i + j); return s / (2 * w + 1); });
  // no steeper than `grade`: pull peaks down and fill dips, round and round a lap until it settles
  const dh = grade * step;
  for (let pass = 0; pass < (closed ? 6 : 2); pass++) {
    for (let i = 1; i < n; i++) h[i] = Math.max(h[i - 1] - dh, Math.min(h[i - 1] + dh, h[i]));
    for (let i = n - 2; i >= 0; i--) h[i] = Math.max(h[i + 1] - dh, Math.min(h[i + 1] + dh, h[i]));
    if (closed) h[n - 1] = h[0] = (h[0] + h[n - 1]) / 2;
  }
  out.forEach((sg, s) => { const i = s + 1 < out.length ? k.starts[s + 1].i : n - 1, v = Math.round(h[i] * 10) / 10; if (sg[0] === 's') sg[2] = v; else sg[3] = v; });
  if (closed) { const last = out[out.length - 1], v = Math.round(h[0] * 10) / 10; if (last[0] === 's') last[2] = v; else last[3] = v; }
  // held well above the ground: a bridge; well below it: a tunnel (judged at the middle of each piece)
  const tagOf = s => out[s][0] === 's' ? out[s][3] : out[s][4], i0 = s => k.starts[s].i, i1 = s => s + 1 < out.length ? k.starts[s + 1].i : n - 1;
  out.forEach((sg, s) => { const m = Math.round((i0(s) + i1(s)) / 2), d = h[m] - bare[m], tg = tagOf(s); if (d > GROUND.BRIDGE) tg.bridge = true; else if (d < -GROUND.TUNNEL) tg.tunnel = true; });
  for (const pc of pieces || []) {
    let s = out.findIndex((_, q) => run[i1(q)] > pc.s); if (s < 0) s = out.length - 1;
    if (STRAIGHT.has(pc.tag) && out[s][0] !== 's') { let best = -1; out.forEach((sg, q) => { if (sg[0] === 's' && (best < 0 || Math.abs(q - s) < Math.abs(best - s))) best = q; }); if (best < 0) continue; s = best; }   // a chicane or a timber bridge: the nearest straight
    tagOf(s)[pc.tag] = pc.v;
  }
  return out;
}
/** A copy of the landscape moved so plan point `start` becomes (0, 0) (a stage's road starts at the origin), heights to 0.1 m. */
export function groundFor(g, start) {
  return { a0: Math.round((g.a0 - start.a) * 100) / 100, b0: Math.round((g.b0 - start.b) * 100) / 100, cell: g.cell, cols: g.cols, rows: g.rows, h: Array.from(g.h, v => Math.round(v * 10) / 10) };
}

// ---------- a landscape described, not painted (a stage file: data, no grids) ----------
// `ground: { size, cell, base, hills: [[a, b, height, radius], ...], ridges: [[a1, b1, a2, b2, height, radius], ...] }`:
// round hills (negative: hollows) and ridges along a line (negative: valleys), each a smooth bump `radius` wide, added to
// `base`, over a square `size` m across round the circuit's middle. `drape: { lift: [[from, to, metres], ...], pieces }`
// lays the road over it the way the Terrain builder does (lift: the road held up or sunk between those metres along the
// lap, eased in and out over 30 m). prepareGround turns both into the grid and sections a stage builds from.
const bump = (d, r) => Math.exp(-(d * d) / (2 * r * r));
const toSeg = (p, a, b) => { const dx = b[0] - a[0], dy = b[1] - a[1], L = dx * dx + dy * dy || 1, t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L)); return Math.hypot(p[0] - a[0] - dx * t, p[1] - a[1] - dy * t); };
export function groundFromSpec(spec, mid = { a: 0, b: 0 }) {
  const g = blankGround(mid.a, mid.b, spec.base || 0, spec.size || GROUND.SIZE, spec.cell || GROUND.CELL);
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const p = [g.a0 + c * g.cell, g.b0 + r * g.cell]; let v = g.h[r * g.cols + c];
    for (const [a, b, h, rad] of spec.hills || []) v += h * bump(Math.hypot(p[0] - a, p[1] - b), rad);
    for (const [a1, b1, a2, b2, h, rad] of spec.ridges || []) v += h * bump(toSeg(p, [a1, b1], [a2, b2]), rad);
    g.h[r * g.cols + c] = Math.round(v * 10) / 10;
  }
  return g;
}
/** The road's lift every LIFT_STEP m from spans [from, to, metres] (eased in and out over 30 m). */
export function liftFromSpans(spans, len) {
  const out = [];
  for (let s = 0; s <= len + GROUND.LIFT_STEP; s += GROUND.LIFT_STEP) {
    let v = 0; for (const [a, b, h] of spans || []) { const e = Math.min(1, Math.max(0, (s - a + 30) / 30), Math.max(0, (b + 30 - s) / 30)); v += h * (0.5 - 0.5 * Math.cos(Math.PI * e)); }
    out.push(Math.round(v * 10) / 10);
  }
  return out;
}
/** A stage with a described landscape: its ground grid, and its sections laid over it (once; the stage keeps them). */
export function prepareGround(stage) {
  if (!stage.ground || stage.ground.h) return stage;
  const flat = stage.segs, k = sketch(flat, stage.startHeading || 0, 4), len = k.lens.reduce((a, b) => a + b, 0);
  let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity; for (const p of k.pts) { a0 = Math.min(a0, p.a); a1 = Math.max(a1, p.a); b0 = Math.min(b0, p.b); b1 = Math.max(b1, p.b); }
  const ground = groundFromSpec(stage.ground, { a: (a0 + a1) / 2, b: (b0 + b1) / 2 }), d = stage.drape || {};
  stage.segs = roadOnGround(flat, stage.startHeading || 0, ground, { a: 0, b: 0 }, { lift: liftFromSpans(d.lift, len), pieces: d.pieces });
  stage.ground = ground;
  return stage;
}

