import { HALF, SURF } from '../constants.js';
import { clamp } from '../math.js';

// ---------- track wear: every surface remembers where the cars have been ----------
// The whole road carries a grid of cells (WEAR.COLS of WEAR.CELL m across, one row per base sample along it), kept on
// the world (W.wear, like W.ferries, so the renderer can draw it) and reset every race. Each wheel wears its cell as it
// rolls (WEAR.DIG per metre, by surface, a little into the cells beside):
//   mud     deep ruts: firmer (SURF.mud -> SURF.mudPacked with the depth under the wheels), and they grab: straddling a
//           rut's edge pulls the car toward its bottom and scrubs a little speed
//   gravel  grooves along the line: the loose stuff swept off, a touch more grip (SURF.gravel -> SURF.gravelSwept)
//   snow    the same on a snow road: packed down into a firmer line (SURF.snow -> SURF.snowPacked)
//   tarmac  a faint rubbered-in line (looks only; skid marks are drawn separately)
// A car leaving a bog carries mud on its tyres and lays a fading trail (the mud channel) over the next WEAR.CARRY m,
// until a water splash washes it off. And every wheel leaves fresh tyre tracks (the tracks channel) where it actually
// is, so a drift leaves a curved scuff: on gravel, grass (the verges too) and mud, more when sliding; on tarmac only
// skid marks do (render/effects/skids.js). Tracks and mud trail are looks only, on a wider grid (WEAR.TCOLS, reaching
// over the verges, in finer WEAR.TCELL cells so a tyre track is about a tyre wide). Deterministic, no randomness.
export const WEAR = { COLS: 28, TCOLS: 80, TCELL: 0.25, TMARK: { gravel: 0.45, grass: 0.6, mud: 0.7, snow: 0.55 }, CELL: 0.5, TRACK: 0.95, DIG: { mud: 0.2, gravel: 0.035, tarmac: 0.006, snow: 0.03 }, SPREAD: 0.35, TUG: 4.5, SCRUB: 0.4, CARRY: 30, TRAIL: 0.5 };
// Ruts with depth (the depth grid, W.wear.d: 0 fresh .. 1 dug to the surface's full depth): it builds up far slower
// than the packing above, so a loose road gets worse lap by lap. DEPTH is how deep a fully dug rut is on each surface
// (metres; tarmac doesn't rut), DEEPEN how much of that one wheel adds per metre it rolls, RIDGE how much of a rut's
// spoil is pushed up beside it. Rain (the stage's `wet`) digs faster (RAIN.DIG), softens gravel so it ruts deeper
// (RAIN.DEEP) and turns a worn line to mud (RAIN.MUD: grip and drag head for SURF.mud). FEEL: how hard the ruts steer
// and scrub a car that isn't sitting in their bottom. PUDDLE: in the rain water lies in ruts deeper than this.
export const RUT = { DEPTH: { mud: 0.24, gravel: 0.075, snow: 0.06 }, DEEPEN: { mud: 0.09, gravel: 0.08, snow: 0.09 }, RIDGE: 0.3, TRACKS: 0.95,
  RAIN: { DIG: 1.6, DEEP: 1.4, MUD: 0.5 }, FEEL: { TUG: 26, SCRUB: 1.4 }, PUDDLE: 0.075 };
// Rain on a stage (its `wet`) on every surface: the line dries as the cars use it (tarmac: the wear grid's cells there
// are how dry it is; WEATHER.DRY a wheel per metre), giving back up to DRY_GRIP of the grip the wet took; water stands
// along the edges and in the dips (W.wear.pool: per row and side, how far in from the road's edge, POOL_MAX at most),
// and a car through it aquaplanes a little (AQUA: grip lost, AQUA_DRAG: drag) with a splash (render).
export const WEATHER = { DRY: 0.03, DRY_GRIP: 0.85, POOL_MAX: 2.6, AQUA: 0.45, AQUA_DRAG: 0.35 };
/** The options (menu: Weather & wear), all on by default: grooves (the road surface sinks into its ruts: looks), feel (the
 *  wheels ride in them and they tug: physics), rain (a wet stage wears faster and its worn gravel goes to mud),
 *  puddles (water lying in the ruts in the rain: looks), aiLines (the AI drives in the ruts on gravel and snow too, not
 *  just in bogs), depth and rate (multipliers on how deep and how fast); and the rain's: shine (wet roads gleam: looks),
 *  spray (cars throw up a mist: looks), drying (the line dries: physics), drops (raindrops splash on the road: looks),
 *  standing (water along the edges and in dips: physics and looks). A race takes them as opts.wear. */
export const WEAR_OPT = { grooves: true, feel: true, rain: true, puddles: true, aiLines: true, depth: 1, rate: 1, shine: true, spray: true, drying: true, drops: true, standing: true };
const FIRM = { mud: 'mudPacked', gravel: 'gravelSwept', snow: 'snowPacked' };                          // what each surface wears into
const row = (tr, s) => s >= tr.NM ? tr.bi(s | 0) : tr.bi(Math.floor(s));
const colOf = lat => Math.floor(lat / WEAR.CELL + WEAR.COLS / 2), tcolOf = lat => Math.floor(lat / WEAR.TCELL + WEAR.TCOLS / 2);
const at = (g, r, k) => k < 0 || k >= WEAR.COLS ? 0 : g[r * WEAR.COLS + k];
/** Grip and drag for a car on worn ground (c.rut: 0 fresh .. 1 worn in), or the plain surface. */
const blend = {};
export function wornSurf(c) {
  const a = SURF[c.surface], to = FIRM[c.surface]; if (!to || !(c.rut > 0)) return a;
  const b = SURF[to], k = clamp(c.rut, 0, 1), m = c.surface === 'gravel' ? c.rutMud || 0 : 0, M = SURF.mud;
  for (const key of ['engine', 'latMax', 'grip', 'drag']) { const v = a[key] + (b[key] - a[key]) * k; blend[key] = v + (M[key] - v) * m; }   // in the rain, a dug-in gravel line turns to mud
  return blend;
}
const inBog = (W, r) => W.tr.mud && W.tr.mud[r] === 1;
/** How rutted a bog is at road position s, lat (0 fresh .. 1 packed), or -1 outside the bogs. */
export function rutDepth(W, s, lat) {
  if (!W.wear) return -1; const r = row(W.tr, s); if (!inBog(W, r)) return -1;
  const g = W.wear.g, k = colOf(lat); return Math.max(at(g, r, k - 1) * 0.5, at(g, r, k), at(g, r, k + 1) * 0.5);
}
/** For the AI: the lateral offset of the best pair of ruts in a bog `ahead` samples along, or null (no bog, no ruts yet). */
export function rutLane(W, c, ahead) {
  if (!W.wear) return null;
  const r = row(W.tr, c.pr.s + ahead); if (!inBog(W, r) && !(W.wear.opt.aiLines && W.wear.rd[r] > 0 && !W.wear.mudRow[r])) return null;
  const g = W.wear.g, gap = Math.round(2 * WEAR.TRACK / WEAR.CELL); let best = 0.35, lat = null;   // a rut under each wheel
  for (let k = 0; k + gap < WEAR.COLS; k++) { const v = at(g, r, k) + at(g, r, k + gap); if (v > best) { best = v; lat = (k + gap / 2 + 0.5 - WEAR.COLS / 2) * WEAR.CELL; } }
  return lat;
}
// ---------- the ruts' shape ----------
/** Rut height at row r, column k (metres: below 0 in a rut, above it on the spoil pushed up beside one). */
export function rutCellH(W, r, k) {
  const sc = W.wear.rd[r]; if (!sc) return 0;
  const D = W.wear.d, v = at(D, r, k), side = Math.max(at(D, r, k - 2), at(D, r, k + 2));
  return sc * (-v + RUT.RIDGE * Math.max(0, side - v));
}
/** The ruts' height at road position s, lat (bilinear between the cells: smooth to drive over and to draw). */
export function rutHeight(W, s, lat) {
  const tr = W.tr, s0 = Math.floor(s), f = s - s0, r0 = row(tr, s0), r1 = row(tr, s0 + 1);
  if (!W.wear.rd[r0] && !W.wear.rd[r1]) return 0;
  const kf = lat / WEAR.CELL + WEAR.COLS / 2 - 0.5, k = Math.floor(kf), u = kf - k;
  const rowH = r => rutCellH(W, r, k) * (1 - u) + rutCellH(W, r, k + 1) * u;
  return rowH(r0) * (1 - f) + rowH(r1) * f;
}
/** The ground under a car at s, lat: where its two wheel tracks are (so it sinks when they're in the ruts and rolls
 *  when one is), or 0 when the ruts have no feel. */
export function rutGround(W, s, lat) {
  if (!W.wear || !W.wear.opt.feel || !W.wear.dug) return 0;
  return (rutHeight(W, s, lat - RUT.TRACKS) + rutHeight(W, s, lat + RUT.TRACKS)) / 2;
}
// fresh tyre tracks and the mud trail, where each wheel actually is (a drift leaves a curved scuff)
function marks(W, c, dt, sp) {
  const tr = W.tr, { t, m } = W.wear, i = c.pr.i, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const k = WEAR.TMARK[c.surface] || 0, trail = c.surface !== 'mud' && c.mudCarry > 0 ? c.mudCarry : 0; if (!k && !trail) return;
  const amt = k * (1 + Math.min(1.5, Math.abs(c.vr) / 4)) * sp * dt, L = WEAR.TCOLS;
  for (const [a, b] of [[-1.15, -0.95], [-1.15, 0.95], [1.15, -0.95], [1.15, 0.95]]) {
    const wx = c.x + fx * a - fz * b, wz = c.z + fz * a + fx * b, dx = wx - tr.xs[i], dz = wz - tr.zs[i];
    const kk = tcolOf(dx * tr.rx[i] + dz * tr.rz[i]); if (kk < 0 || kk >= L) continue;
    const q = row(tr, c.pr.s + dx * tr.tx[i] + dz * tr.tz[i]) * L + kk;
    if (k) { t[q] = Math.min(1, t[q] + amt); for (const e of [-1, 1]) if (kk + e >= 0 && kk + e < L) t[q + e] = Math.min(1, t[q + e] + amt * 0.2); }
    if (trail && a < 0) m[q] = Math.min(1, m[q] + WEAR.TRAIL * trail * sp * dt);
  }
}
function step(R, W, dt) {
  const tr = W.tr, { g, d: Dg, opt } = W.wear, wetK = opt.rain ? tr.wet || 0 : 0, wetW = tr.wet || 0;
  for (const c of R.cars) {
    c.rut = 0; c.rutMud = 0; if (!c.onGround) continue;
    if (c.surface === 'ford') { c.mudCarry = 0; continue; }                          // washed off
    const sp = Math.hypot(c.vx, c.vz), r = row(tr, c.pr.s), i = c.pr.i, deepen = W.wear.rd[r] && RUT.DEEPEN[c.surface];
    const dries = c.surface === 'tarmac' && wetW && opt.drying, dig = dries ? (WEAR.DIG.tarmac + WEATHER.DRY * wetW) * opt.rate : WEAR.DIG[c.surface] && WEAR.DIG[c.surface] * opt.rate * (deepen ? 1 + RUT.RAIN.DIG * wetK : 1);
    c.dry = 0; c.aqua = W.wear.pool ? inPool(W, c) : 0;
    if (c.surface === 'mud') c.mudCarry = 1;
    const carry = c.mudCarry > 0 ? c.mudCarry : 0;
    if (sp > 1) { marks(W, c, dt, sp); W.wear.ver++; }
    if (!dig && !carry) continue;
    let depth = 0, grad = 0, n = 0, dug = 0;
    for (const side of [-1, 1]) {
      const k = colOf(c.pr.lat + side * WEAR.TRACK); if (k < 0 || k >= WEAR.COLS) continue;
      const q = r * WEAR.COLS + k;
      depth += g[q]; grad += (at(g, r, k + 1) - at(g, r, k - 1)) / (2 * WEAR.CELL); n++; dug += Dg[q];
      if (dig) { const d = dig * sp * dt; g[q] = Math.min(1, g[q] + d); for (const e of [-1, 1]) if (k + e >= 0 && k + e < WEAR.COLS) g[q + e] = Math.min(1, g[q + e] + d * WEAR.SPREAD); }
      if (deepen) {                                                               // and the rut gets deeper, slowly: lap by lap
        const d = deepen * opt.rate * (1 + RUT.RAIN.DIG * wetK) * sp * dt; Dg[q] = Math.min(1, Dg[q] + d); W.wear.dug = true;
        for (const e of [-1, 1]) if (k + e >= 0 && k + e < WEAR.COLS) Dg[q + e] = Math.min(1, Dg[q + e] + d * WEAR.SPREAD);
      }
    }
    if (carry && c.surface !== 'mud') c.mudCarry = Math.max(0, carry - sp * dt / WEAR.CARRY);
    if (!n) continue;
    W.wear.ver++;                                                                 // tells the renderers to redraw
    if (dries) c.dry = depth / n;                                                  // on the line, out of the wet
    if (!FIRM[c.surface]) continue;
    c.rut = depth / n;
    if (wetK && c.surface === 'gravel') c.rutMud = RUT.RAIN.MUD * wetK * clamp((dug / n - 0.3) / 0.5, 0, 1);   // a wet line, dug in: mud
    if (c.surface !== 'mud') {
      // ruts with feel steer a car that isn't in their bottom toward it, and scrub it as it climbs across them
      if (!opt.feel || !W.wear.dug || !W.wear.rd[r]) continue;
      let gh = 0; for (const side of [-1, 1]) { const l = c.pr.lat + side * RUT.TRACKS; gh += (rutHeight(W, c.pr.s, l + 0.25) - rutHeight(W, c.pr.s, l - 0.25)) / 1; }
      const pull = clamp(-gh, -1, 1) * RUT.FEEL.TUG * dt; c.vx += tr.rx[i] * pull; c.vz += tr.rz[i] * pull;
      const scrub = 1 - Math.min(0.5, Math.abs(gh) * RUT.FEEL.SCRUB * dt); c.vx *= scrub; c.vz *= scrub;
      continue;
    }
    // ruts grab: pulled toward the bottom of the rut, and climbing out of one scrubs a little speed
    const gr = grad / n, pull = clamp(gr, -1, 1) * WEAR.TUG * dt;
    c.vx += tr.rx[i] * pull; c.vz += tr.rz[i] * pull;
    const scrub = 1 - Math.abs(gr) * WEAR.SCRUB * dt; c.vx *= scrub; c.vz *= scrub;
  }
}
/** Per row: how deep its ruts go when fully dug (rd, metres; 0: it doesn't rut: tarmac, a water splash, ice, a deck,
 *  open country) and whether it's a bog (mudRow). */
export function rowDepths(W, opt) {
  const tr = W.tr, rd = new Float32Array(tr.NB), mudRow = new Uint8Array(tr.NB), wet = opt.rain ? tr.wet || 0 : 0;
  for (let r = 0; r < tr.NB; r++) {
    const i = tr.u0(r), m = tr.mud && tr.mud[r];
    if (m === 2 || (tr.ice && tr.ice[r]) || (tr.open && tr.open[r]) || (tr.voidMask && tr.voidMask[r]) || tr.bridge[i] || tr.tunnel[i]) continue;
    const surf = m === 1 ? 'mud' : tr.dirt && tr.dirt[r] ? 'gravel' : W.surf, D = RUT.DEPTH[surf]; if (!D) continue;
    rd[r] = D * opt.depth * (surf === 'gravel' ? 1 + RUT.RAIN.DEEP * wet : surf === 'mud' ? 1 + 0.3 * wet : 1); mudRow[r] = m === 1 ? 1 : 0;
  }
  return { rd, mudRow };
}
/** Where water stands on a wet stage: per row, how far in from each edge (metres; [r * 2] left, [r * 2 + 1] right),
 *  in patches along the road and deeper in its dips; none on decks, splashes, ice or open country. */
export function poolMap(W, opt) {
  const tr = W.tr; if (!(tr.wet > 0) || !opt.standing) return null;
  const P = new Float32Array(tr.NB * 2), N = tr.NB;
  for (let r = 0; r < N; r++) {
    const i = tr.u0(r); if ((tr.mud && tr.mud[r]) || (tr.ice && tr.ice[r]) || (tr.open && tr.open[r]) || (tr.voidMask && tr.voidMask[r]) || tr.bridge[i] || tr.tunnel[i]) continue;
    let lo = 0; for (let d = -14; d <= 14; d += 7) lo += tr.H[tr.u0(Math.min(N - 1, Math.max(0, r + d)))]; const dip = Math.max(0, lo / 5 - tr.H[i] - 0.15) * 3;   // lower than the road around it
    for (let side = 0; side < 2; side++) P[r * 2 + side] = Math.min(WEATHER.POOL_MAX, Math.max(0, tr.noise.n2(r * 0.035, side * 7.3 + 1.1) - 0.2) * 4 * tr.wet + dip);
  }
  return P;
}
/** How deep in standing water car c's outside wheels are (0..1), on a wet stage. */
function inPool(W, c) {
  const r = row(W.tr, c.pr.s), lat = c.pr.lat, side = lat < 0 ? 0 : 1, w = W.wear.pool[r * 2 + side]; if (!w) return 0;
  const into = Math.abs(lat) + RUT.TRACKS - (HALF - w); return into > 0 ? Math.min(1, into / 1.2) : 0;
}
/** Track wear on every stage. */
export const feature = {
  name: 'wear',
  init(R, W) {
    const tr = W.tr, n = tr.NB * WEAR.COLS, opt = { ...WEAR_OPT, ...(R.wearOpt || {}) };
    W.wear = { g: new Float32Array(n), d: new Float32Array(n), t: new Float32Array(tr.NB * WEAR.TCOLS), m: new Float32Array(tr.NB * WEAR.TCOLS), ver: 0, opt, dug: false, ...rowDepths(W, opt), pool: poolMap(W, opt) };
    R.wear = W.wear; for (const c of R.cars) c.mudCarry = 0;
  },
  after(R, W, dt) { step(R, W, dt); }
};
