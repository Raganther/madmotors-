import { closeLoop, fromStroke, sketch, endH } from './editing.js';
import { mulberry32 } from '../math.js';

// ---------- painted ground (once the Terrain builder's; the Track Studio's New track makes them now) ----------
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


// ---------- generated: the Terrain builder's Generate land / Generate road ----------
// Land from value noise (a hash per lattice point, smoothly blended, several octaves): each style shapes it its own
// way, always gentler in the middle (where a road goes) than out at the edges. Seeded, so a seed gives the same land.
const hash = (i, j, s) => { let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(s, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const sm = t => t * t * (3 - 2 * t), mix = (a, b, t) => a + (b - a) * t;
function vnoise(x, y, s) { const i = Math.floor(x), j = Math.floor(y), u = sm(x - i), v = sm(y - j); return mix(mix(hash(i, j, s), hash(i + 1, j, s), u), mix(hash(i, j + 1, s), hash(i + 1, j + 1, s), u), v) * 2 - 1; }
function fbm(x, y, s, oct, ridged) { let t = 0, a = 1, f = 1, n = 0; for (let o = 0; o < oct; o++) { let v = vnoise(x * f, y * f, s + o * 101); if (ridged) v = (1 - Math.abs(v)) ** 2 * 2 - 1; t += v * a; n += a; a *= 0.5; f *= 2.03; } return t / n; }
export const LAND_STYLES = { hills: 'Rolling hills', mountains: 'Mountains', valley: 'River valley', canyon: 'Canyon country', mesas: 'Mesas' };
/** A generated landscape (a grid like blankGround's) in one of LAND_STYLES. */
export function generateGround(style = 'hills', seed = 1, size = GROUND.SIZE) {
  const g = blankGround(0, 0, 0, size), rnd = mulberry32(seed), s = (seed * 7919) | 0, rot = rnd() * Math.PI, ca = Math.cos(rot), sa = Math.sin(rot), half = size / 2;
  const meander = [rnd() * 6.28, 0.6 + rnd() * 0.8, rnd() * 6.28];   // the river's wander
  for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
    const a = g.a0 + c * g.cell, b = g.b0 + r * g.cell, x = (a * ca - b * sa), y = (a * sa + b * ca), d = Math.hypot(a, b) / half, edge = sm(Math.min(1, Math.max(0, (d - 0.35) / 0.6)));
    let h;
    if (style === 'mountains') h = 18 * fbm(x / 160, y / 160, s, 4) + (40 + 150 * edge) * Math.max(0, fbm(x / 260, y / 260, s + 7, 5, true) * 0.5 + 0.5) ** 1.6;
    else if (style === 'valley') { const across = y - Math.sin(x / 140 * meander[1] + meander[0]) * 60 - Math.sin(x / 61 + meander[2]) * 14; h = 70 * sm(Math.min(1, Math.abs(across) / 230)) + 22 * fbm(x / 150, y / 150, s, 4) - 22 * Math.exp(-(across * across) / (2 * 26 * 26)); }
    else if (style === 'canyon') { const n = fbm(x / 210, y / 210, s, 4, true); h = 36 + 12 * fbm(x / 90, y / 90, s + 3, 3) - 58 * sm(Math.min(1, Math.max(0, (n - 0.15) / 0.5))); }
    else if (style === 'mesas') { const n = fbm(x / 170, y / 170, s, 4) * 0.5 + 0.5, step = Math.floor(n * 5) / 5, f = n * 5 - Math.floor(n * 5); h = 85 * (step + sm(Math.min(1, Math.max(0, (f - 0.75) / 0.25))) / 5) - 20 + 6 * fbm(x / 60, y / 60, s + 5, 2); }
    else h = 32 * fbm(x / 230, y / 230, s, 4) + 30 * edge * (fbm(x / 120, y / 120, s + 9, 3) * 0.5 + 0.5);
    g.h[r * g.cols + c] = Math.round(Math.max(GROUND.MIN, Math.min(GROUND.MAX, h)) * 10) / 10;
  }
  return g;
}
export const ROAD_LENGTHS = { short: [130, 170], medium: [190, 250], long: [260, 330] };
/**
 * A road laid on the landscape for you: a lap round the middle, a closed loop with a few bends in it (an ellipse with
 * harmonics on its radius, so it never crosses itself). Several are tried, and the one that sits best on the land
 * wins: climbs a car can take, some rise and fall, and not off the edge. With `pieces`, a crest jump where it tops out and
 * a water splash in its lowest dip. Returns { segs, heading, start, lift, pieces } like the builder's own road, or null.
 */
export function autoRoad(ground, { seed = 1, length = 'medium', wiggle = 1, pieces = true, tries = 18 } = {}) {
  const rnd = mulberry32(seed * 31 + 5), [r0, r1] = ROAD_LENGTHS[length] || ROAD_LENGTHS.medium;
  const ca = ground.a0 + (ground.cols - 1) * ground.cell / 2, cb = ground.b0 + (ground.rows - 1) * ground.cell / 2, room = (ground.cols - 1) * ground.cell / 2 - 40;
  let best = null;
  for (let t = 0; t < tries; t++) {
    const ra = r0 + rnd() * (r1 - r0), rb = ra * (0.55 + rnd() * 0.4), rot = rnd() * Math.PI, oa = (rnd() - 0.5) * 80, ob = (rnd() - 0.5) * 80;
    const harm = [2, 3, 4, 5].map(k => [k, (0.05 + rnd() * 0.09) * wiggle * 2 / k, rnd() * 6.28]);
    const pts = [];
    for (let q = 0; q < 220; q++) {
      const th = q / 220 * Math.PI * 2; let k = 1; for (const [n, a, ph] of harm) k += a * Math.cos(n * th + ph);
      const x = Math.cos(th) * ra * k, y = Math.sin(th) * rb * k; pts.push({ a: ca + oa + x * Math.cos(rot) - y * Math.sin(rot), b: cb + ob + x * Math.sin(rot) + y * Math.cos(rot) });
    }
    pts.push({ ...pts[0] });
    if (pts.some(p => Math.abs(p.a - ca) > room || Math.abs(p.b - cb) > room)) continue;
    // how well it sits: steepness beyond what a car can take costs (cuttings, embankments), some rise and fall is good
    let cost = 0, lo = Infinity, hi = -Infinity;
    for (let q = 1; q < pts.length; q++) { const h0 = groundAt(ground, pts[q - 1].a, pts[q - 1].b), h1 = groundAt(ground, pts[q].a, pts[q].b), d = Math.hypot(pts[q].a - pts[q - 1].a, pts[q].b - pts[q - 1].b) || 1; cost += Math.max(0, Math.abs(h1 - h0) / d - GROUND.GRADE * 0.8) * d * 4; lo = Math.min(lo, h1); hi = Math.max(hi, h1); }
    cost += Math.max(0, 12 - (hi - lo)) * 6 + Math.max(0, hi - lo - 70) * 2 + rnd() * 5;
    if (!best || cost < best.cost) best = { cost, pts };
  }
  if (!best) return null;
  const r = fromStroke(best.pts, { tol: 4, closeDist: 40 }); if (!r || !r.segs.length) return null;
  const c = closeLoop(r.segs, r.heading); if (!c.ok) return null;
  const road = { segs: c.segs, heading: r.heading, start: { a: r.start.a, b: r.start.b }, lift: [], pieces: [] };
  if (pieces) {   // a crest jump where the road tops out, a water splash in its lowest dip (well clear of the start and each other)
    const laid = roadOnGround(road.segs, road.heading, ground, road.start), k = sketch(laid, road.heading, 4), run = runOf(k), L = run[run.length - 1];
    const ok = i => run[i] > 120 && run[i] < L - 80, n = k.pts.length, ahead = (i, m) => k.pts[Math.min(n - 1, i + Math.round(m / 4))].h - k.pts[i].h;
    const jumpable = i => [0, 20, 40].every(m => { const q = k.pts[Math.min(n - 1, i + m / 4)]; return laid[q.sec] && laid[q.sec][0] === 's'; }) && ahead(i, 60) > -3.5;   // a straight run-off and a gentle landing
    let top = -1, low = -1;
    k.pts.forEach((p, i) => { if (!ok(i)) return; if (jumpable(i) && (top < 0 || p.h > k.pts[top].h)) top = i; if (low < 0 || p.h < k.pts[low].h) low = i; });
    if (top >= 0) road.pieces.push({ s: Math.round(run[top]), tag: 'yump', v: 2.6 });
    if (low >= 0 && (top < 0 || Math.abs(run[low] - run[top]) > 150)) road.pieces.push({ s: Math.round(run[low]), tag: 'mud', v: 'water' });
    road.pieces.sort((x, y) => x.s - y.s);
  }
  return road;
}
