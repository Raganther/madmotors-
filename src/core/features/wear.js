import { SURF } from '../constants.js';
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
// over the verges). Deterministic, no randomness.
export const WEAR = { COLS: 28, TCOLS: 40, TMARK: { gravel: 0.45, grass: 0.6, mud: 0.7, snow: 0.55 }, CELL: 0.5, TRACK: 0.95, DIG: { mud: 0.2, gravel: 0.035, tarmac: 0.006, snow: 0.03 }, SPREAD: 0.35, TUG: 4.5, SCRUB: 0.4, CARRY: 30, TRAIL: 0.5 };
const FIRM = { mud: 'mudPacked', gravel: 'gravelSwept', snow: 'snowPacked' };                          // what each surface wears into
const row = (tr, s) => s >= tr.NM ? tr.bi(s | 0) : tr.bi(Math.floor(s));
const colOf = lat => Math.floor(lat / WEAR.CELL + WEAR.COLS / 2), tcolOf = lat => Math.floor(lat / WEAR.CELL + WEAR.TCOLS / 2);
const at = (g, r, k) => k < 0 || k >= WEAR.COLS ? 0 : g[r * WEAR.COLS + k];
/** Grip and drag for a car on worn ground (c.rut: 0 fresh .. 1 worn in), or the plain surface. */
const blend = {};
export function wornSurf(c) {
  const a = SURF[c.surface], to = FIRM[c.surface]; if (!to || !(c.rut > 0)) return a;
  const b = SURF[to], k = clamp(c.rut, 0, 1);
  for (const key of ['engine', 'latMax', 'grip', 'drag']) blend[key] = a[key] + (b[key] - a[key]) * k;
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
  if (!W.wear || !W.tr.mud) return null;
  const r = row(W.tr, c.pr.s + ahead); if (!inBog(W, r)) return null;
  const g = W.wear.g, gap = Math.round(2 * WEAR.TRACK / WEAR.CELL); let best = 0.35, lat = null;   // a rut under each wheel
  for (let k = 0; k + gap < WEAR.COLS; k++) { const v = at(g, r, k) + at(g, r, k + gap); if (v > best) { best = v; lat = (k + gap / 2 + 0.5 - WEAR.COLS / 2) * WEAR.CELL; } }
  return lat;
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
    if (k) { t[q] = Math.min(1, t[q] + amt); for (const e of [-1, 1]) if (kk + e >= 0 && kk + e < L) t[q + e] = Math.min(1, t[q + e] + amt * 0.35); }
    if (trail && a < 0) m[q] = Math.min(1, m[q] + WEAR.TRAIL * trail * sp * dt);
  }
}
function step(R, W, dt) {
  const tr = W.tr, { g } = W.wear;
  for (const c of R.cars) {
    c.rut = 0; if (!c.onGround) continue;
    if (c.surface === 'ford') { c.mudCarry = 0; continue; }                          // washed off
    const dig = WEAR.DIG[c.surface], sp = Math.hypot(c.vx, c.vz), r = row(tr, c.pr.s), i = c.pr.i;
    if (c.surface === 'mud') c.mudCarry = 1;
    const carry = c.mudCarry > 0 ? c.mudCarry : 0;
    if (sp > 1) { marks(W, c, dt, sp); W.wear.ver++; }
    if (!dig && !carry) continue;
    let depth = 0, grad = 0, n = 0;
    for (const side of [-1, 1]) {
      const k = colOf(c.pr.lat + side * WEAR.TRACK); if (k < 0 || k >= WEAR.COLS) continue;
      const q = r * WEAR.COLS + k;
      depth += g[q]; grad += (at(g, r, k + 1) - at(g, r, k - 1)) / (2 * WEAR.CELL); n++;
      if (dig) { const d = dig * sp * dt; g[q] = Math.min(1, g[q] + d); for (const e of [-1, 1]) if (k + e >= 0 && k + e < WEAR.COLS) g[q + e] = Math.min(1, g[q + e] + d * WEAR.SPREAD); }
    }
    if (carry && c.surface !== 'mud') c.mudCarry = Math.max(0, carry - sp * dt / WEAR.CARRY);
    if (!n) continue;
    W.wear.ver++;                                                                 // tells the renderers to redraw
    if (!FIRM[c.surface]) continue;
    c.rut = depth / n;
    if (c.surface !== 'mud') continue;
    // ruts grab: pulled toward the bottom of the rut, and climbing out of one scrubs a little speed
    const gr = grad / n, pull = clamp(gr, -1, 1) * WEAR.TUG * dt;
    c.vx += tr.rx[i] * pull; c.vz += tr.rz[i] * pull;
    const scrub = 1 - Math.abs(gr) * WEAR.SCRUB * dt; c.vx *= scrub; c.vz *= scrub;
  }
}
/** Track wear on every stage. */
export const feature = {
  name: 'wear',
  init(R, W) { const n = W.tr.NB * WEAR.COLS; W.wear = { g: new Float32Array(n), t: new Float32Array(W.tr.NB * WEAR.TCOLS), m: new Float32Array(W.tr.NB * WEAR.TCOLS), ver: 0 }; R.wear = W.wear; for (const c of R.cars) c.mudCarry = 0; },
  after(R, W, dt) { step(R, W, dt); }
};
