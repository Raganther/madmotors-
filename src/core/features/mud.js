import { SURF } from '../constants.js';
import { clamp } from '../math.js';
import { mudRuns, RUT } from '../elements/mud.js';

// ---------- ruts (mud element) ----------
// Each bog has a grid of cells (RUT.COLS of RUT.CELL m across the road, one row per 1 m sample along it) kept on the world
// (W.ruts, like W.ferries, so the renderer can draw it). Every wheel rolling through a cell churns it into a rut
// (RUT.DIG per metre driven, a little into the cells either side). Packed ruts are firmer: grip and drag blend from
// SURF.mud toward SURF.mudPacked with the rut depth under the wheels. And they grab: straddling the edge of a rut
// pulls the car toward its bottom (tramlining), so the line forms and gets quicker, and pulling out to pass costs.
// Deterministic, no randomness.
const base = (tr, s) => { const N0 = tr.loopN || tr.N; return s >= tr.NM ? tr.bi(s | 0) + (s % 1) : ((s % N0) + N0) % N0; };
/** The rut cell index a point of a car sits on (lat metres from the centre line), or -1 if it's not in a bog. */
function cell(W, s, lat) {
  const b = base(W.tr, s);
  for (const r of W.ruts) {
    const u = Math.floor(b - r.a); if (u < 0 || u >= r.len) continue;
    const col = Math.floor(lat / RUT.CELL + RUT.COLS / 2); if (col < 0 || col >= RUT.COLS) return null;
    return { r, u, col };
  }
  return null;
}
const at = (r, u, col) => col < 0 || col >= RUT.COLS ? 0 : r.g[u * RUT.COLS + col];
/** Grip and drag for a car on mud, from the ruts it's in (c.rut, 0 fresh .. 1 packed). */
const blend = {};
export function rutSurf(c) {
  const a = SURF.mud, b = SURF.mudPacked, k = clamp(c.rut || 0, 0, 1);
  for (const key of ['engine', 'latMax', 'grip', 'drag']) blend[key] = a[key] + (b[key] - a[key]) * k;
  return blend;
}
/** How rutted the bog is at road position s, lat (0 fresh .. 1 packed), or -1 outside the bogs. */
export function rutDepth(W, s, lat) {
  if (!W.ruts || !W.ruts.length) return -1;
  const q = cell(W, s, lat); if (!q) return -1;
  return Math.max(at(q.r, q.u, q.col - 1) * 0.5, at(q.r, q.u, q.col), at(q.r, q.u, q.col + 1) * 0.5);
}
/** For the AI: the lateral offset of the best pair of ruts `ahead` samples along, or null if none has formed yet. */
export function rutLane(W, c, ahead) {
  if (!W.ruts || !W.ruts.length) return null;
  const q = cell(W, c.pr.s + ahead, 0); if (!q) return null;
  const gap = Math.round(2 * RUT.TRACK / RUT.CELL); let best = 0.35, lat = null;   // a rut under each wheel
  for (let k = 0; k + gap < RUT.COLS; k++) { const v = at(q.r, q.u, k) + at(q.r, q.u, k + gap); if (v > best) { best = v; lat = (k + gap / 2 + 0.5 - RUT.COLS / 2) * RUT.CELL; } }
  return lat;
}
function step(R, W, dt) {
  const tr = W.tr;
  for (const c of R.cars) {
    if (!c.onGround || c.surface !== 'mud') { c.rut = 0; continue; }
    const sp = Math.hypot(c.vx, c.vz), i = c.pr.i; let depth = 0, grad = 0, n = 0;
    for (const side of [-1, 1]) {
      const q = cell(W, c.pr.s, c.pr.lat + side * RUT.TRACK); if (!q) continue;
      const { r, u, col } = q, k = u * RUT.COLS + col, dig = RUT.DIG * sp * dt;
      depth += r.g[k]; grad += (at(r, u, col + 1) - at(r, u, col - 1)) / (2 * RUT.CELL); n++;
      r.g[k] = Math.min(1, r.g[k] + dig);
      for (const d of [-1, 1]) if (col + d >= 0 && col + d < RUT.COLS) r.g[k + d] = Math.min(1, r.g[k + d] + dig * RUT.SPREAD);
      r.dirty = true;
    }
    if (!n) { c.rut = 0; continue; }
    c.rut = depth / n;
    // tramlining: pulled toward the bottom of the rut, and climbing out of one scrubs a little speed
    const g = grad / n, pull = clamp(g, -1, 1) * RUT.TUG * dt;
    c.vx += tr.rx[i] * pull; c.vz += tr.rz[i] * pull;
    const scrub = 1 - Math.abs(g) * RUT.SCRUB * dt; c.vx *= scrub; c.vz *= scrub;
  }
}
/** Ruts in mud bogs. */
export const feature = {
  name: 'mud',
  init(R, W) { W.ruts = mudRuns(W.tr).map(([a, b]) => ({ a, len: b - a, g: new Float32Array((b - a) * RUT.COLS), dirty: true })); R.ruts = W.ruts; },
  after(R, W, dt) { if (W.ruts.length) step(R, W, dt); }
};
