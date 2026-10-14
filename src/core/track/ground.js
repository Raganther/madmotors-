import { sketch, endH } from './editing.js';

// ---------- painted ground (the Terrain builder, ui/terrain.js) ----------
// A stage can carry its own landscape: `ground` = { a0, b0, cell, cols, rows, h } is a grid of heights in metres over
// the plan (a = right, b = up-screen, the sections' axes; a0/b0 the corner of the grid, `cell` metres apart, h row by
// row along b). With it the ground away from the road is that landscape instead of the generated hills, and the
// road cuts and fills its way across it (core/track/terrain.js). roadOnGround lays a drawn road's heights along it.
export const GROUND = { CELL: 8, SIZE: 800, MIN: -60, MAX: 220, PIECE: 25, GRADE: 0.14, SMOOTH: 30 };

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
      const tg = k ? {} : (sg[0] === 's' ? sg[3] : sg[4]) || {};
      out.push(sg[0] === 's' ? ['s', Math.round(sg[1] / n * 100) / 100, endH(sg), tg] : ['a', sg[1], Math.round(sg[2] / n * 1000) / 1000, endH(sg), tg]);
    }
  }
  // the turns were rounded: give the last curve whatever is left, so the lap still turns exactly as before
  const want = segs.reduce((t, sg) => t + (sg[0] === 'a' ? sg[2] : 0), 0), got = out.reduce((t, sg) => t + (sg[0] === 'a' ? sg[2] : 0), 0);
  for (let k = out.length - 1; k >= 0; k--) if (out[k][0] === 'a') { out[k][2] = Math.round((out[k][2] + want - got) * 1000) / 1000; break; }
  return out;
}
/**
 * The road on the landscape: sections (starting at plan point `start`, heading `heading`) cut into short pieces whose
 * heights follow the ground under them, smoothed over SMOOTH metres and kept under GRADE (a climb a car can take);
 * where the ground does more than that the road cuts through or rides over it. A lap wraps round. Returns new sections.
 */
export function roadOnGround(segs, heading, ground, start = { a: 0, b: 0 }, { piece = GROUND.PIECE, grade = GROUND.GRADE, smooth = GROUND.SMOOTH } = {}) {
  if (!segs.length) return [];
  const out = chop(segs, piece), step = 2, k = sketch(out, heading, step), closed = k.gap < 1, P = k.pts, n = P.length;
  const raw = P.map(p => groundAt(ground, start.a + p.a, start.b + p.b));
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
  return out;
}
/** A copy of the landscape moved so plan point `start` becomes (0, 0) (a stage's road starts at the origin), heights to 0.1 m. */
export function groundFor(g, start) {
  return { a0: Math.round((g.a0 - start.a) * 100) / 100, b0: Math.round((g.b0 - start.b) * 100) / 100, cell: g.cell, cols: g.cols, rows: g.rows, h: Array.from(g.h, v => Math.round(v * 10) / 10) };
}
