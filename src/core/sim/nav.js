import { HALF, SURF } from '../constants.js';
import { clamp } from '../math.js';
import { GATE, OPEN } from '../elements/open.js';

// Finding the way across open country (elements/open.js). For every waypoint (each gate, and each place an open leg
// rejoins a road) a distance field over a 2 m grid covering the open country: how far it is to drive to the waypoint
// from each cell, going round trees and boulders, dearer up steep slopes, through bushes and water, cheaper on a road.
// A gate's field only counts arriving through it, between the posts. The AI in open country (aiControl) follows its
// next waypoint's field downhill: it aims a little way along that path and slows for how sharply the path bends.
// Built once per world (W.nav), deterministic, from the ground and the scenery.
const CELL = 2, MARGIN = 90, BLOCK = 1.35, NEAR = 3.4;
function build(W) {
  const tr = W.tr, T = W.terr, N = tr.loopN || tr.N;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
  const grow = (x, z) => { x0 = Math.min(x0, x - MARGIN); x1 = Math.max(x1, x + MARGIN); z0 = Math.min(z0, z - MARGIN); z1 = Math.max(z1, z + MARGIN); };
  for (let i = 0; i < N; i++) if (tr.open[tr.bi(i)]) grow(tr.xs[i], tr.zs[i]);
  x0 = Math.max(x0, T.x0 + 2); z0 = Math.max(z0, T.z0 + 2); x1 = Math.min(x1, T.x0 + (T.cols - 1) * T.S - 2); z1 = Math.min(z1, T.z0 + (T.rows - 1) * T.S - 2);
  const cols = Math.floor((x1 - x0) / CELL) + 1, rows = Math.floor((z1 - z0) / CELL) + 1, n = cols * rows;
  // what a cell costs to cross (per metre): 1 on open grass; Infinity where a car can't go
  const cost = new Float32Array(n).fill(1);
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
    const x = x0 + c * CELL, z = z0 + r * CELL, k = r * cols + c;
    const sl = Math.hypot(T.at(x + 1, z) - T.at(x - 1, z), T.at(x, z + 1) - T.at(x, z - 1)) / 2;
    if (sl > 0.85) { cost[k] = Infinity; continue; }
    cost[k] += sl * sl * 12;
    if (T.dist[Math.round((z - T.z0) / T.S) * T.cols + Math.round((x - T.x0) / T.S)] < HALF) cost[k] *= 0.6;   // a road
  }
  const stamp = (x, z, rad, f) => {
    const c0 = Math.max(0, Math.floor((x - rad - x0) / CELL)), c1 = Math.min(cols - 1, Math.ceil((x + rad - x0) / CELL)), r0 = Math.max(0, Math.floor((z - rad - z0) / CELL)), r1 = Math.min(rows - 1, Math.ceil((z + rad - z0) / CELL));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) { const d = Math.hypot(x0 + c * CELL - x, z0 + r * CELL - z); if (d <= rad) f(r * cols + c, d); }
  };
  for (const o of T.obst.items) {
    if (o.x < x0 - 10 || o.x > x1 + 10 || o.z < z0 - 10 || o.z > z1 + 10) continue;
    if (o.soft) { stamp(o.x, o.z, o.r + 1, k => { cost[k] += 0.6; }); continue; }
    if (!o.r) continue;
    stamp(o.x, o.z, o.r + NEAR, (k, d) => { if (d < o.r + BLOCK) cost[k] = Infinity; else cost[k] += 1.5; });
  }
  for (let i = 0; i < N; i++) if (tr.open[tr.bi(i)] === OPEN.stream) stamp(tr.xs[i], tr.zs[i], 70, k => { cost[k] += 1.5; });
  // waypoints: every gate, and where each open leg joins a road again (as a wide gate across the road there)
  const wps = new Map(), gateB = new Set((tr.gates || []).map(i => tr.bi(i)));
  for (const b of gateB) wps.set(b, { b, hw: GATE.W / 2 - 1.2, strict: true });
  for (let b = 0; b < N; b++) if (!tr.open[b] && tr.open[tr.bi(tr.nb0(b, -1))] && !wps.has(b)) wps.set(b, { b, hw: HALF - 1, strict: false });
  for (const w of wps.values()) w.f = field(w);
  // the next waypoint along the route from each base sample
  const next = new Int32Array(N).fill(-1);
  for (let pass = 0; pass < 2; pass++) for (let b = N - 1; b >= 0; b--) { const nb = tr.bi(tr.nb0(b, 1)); next[b] = wps.has(nb) ? nb : next[nb]; }
  function field(w) {
    const i = tr.u0(w.b), gx = tr.xs[i], gz = tr.zs[i], tx = tr.tx[i], tz = tr.tz[i], rx = tr.rx[i], rz = tr.rz[i];
    const cc = cost.slice(), D = new Float64Array(n).fill(Infinity), heap = new Heap();   // doubles: float32 rounding re-queues equal paths without end
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) {
      const k = r * cols + c, dx = x0 + c * CELL - gx, dz = z0 + r * CELL - gz, a = dx * tx + dz * tz, l = Math.abs(dx * rx + dz * rz);
      // the goal is the mouth of the gate, just short of its line between the posts (the last few metres are driven
      // straight through: navControl); the line either side of the posts is a wall, so the way in is always the mouth
      if (a > -9 && a < -1 && l < w.hw - (w.strict ? 1 : 0)) { D[k] = 0; heap.push(k, 0); }
      else if (w.strict && a > -1 && a <= 1.5 && l >= w.hw && l < w.hw + 45) cc[k] = Infinity;
    }
    const DI = [1, -1, cols, -cols, cols + 1, cols - 1, -cols + 1, -cols - 1], DL = [1, 1, 1, 1, Math.SQRT2, Math.SQRT2, Math.SQRT2, Math.SQRT2];
    while (heap.n) {
      const k = heap.pop(), dk = D[k]; if (heap.lastP > dk) continue;                          // a stale entry
      const c = k % cols;
      for (let q = 0; q < 8; q++) {
        const j = k + DI[q]; if (j < 0 || j >= n) continue; const cj = j % cols; if (Math.abs(cj - c) > 1 || cc[j] === Infinity) continue;
        const nd = dk + DL[q] * CELL * (cc[k] + cc[j]) / 2; if (nd < D[j]) { D[j] = nd; heap.push(j, nd); }
      }
    }
    return Float32Array.from(D);
  }
  return { x0, z0, cols, rows, cost, wps, next };
}
class Heap {   // a binary min-heap of cells by distance
  constructor() { this.k = []; this.p = []; this.n = 0; this.lastP = 0; }
  push(k, p) { let i = this.n++; this.k[i] = k; this.p[i] = p; while (i > 0) { const u = (i - 1) >> 1; if (this.p[u] <= p) break; this.k[i] = this.k[u]; this.p[i] = this.p[u]; i = u; } this.k[i] = k; this.p[i] = p; }
  pop() {
    const top = this.k[0]; this.lastP = this.p[0]; const k = this.k[--this.n], p = this.p[this.n]; let i = 0;
    for (;;) { let m = 2 * i + 1; if (m >= this.n) break; if (m + 1 < this.n && this.p[m + 1] < this.p[m]) m++; if (this.p[m] >= p) break; this.k[i] = this.k[m]; this.p[i] = this.p[m]; i = m; }
    this.k[i] = k; this.p[i] = p; return top;
  }
}
/** The world's navigation fields (null on a stage without open country). */
export function navOf(W) {
  if (!W.tr.open) return null;
  if (!W.terr.nav || W.terr.nav.tr !== W.tr) { W.terr.nav = build(W); W.terr.nav.tr = W.tr; }
  return W.terr.nav;
}
/** The way to go from (x, z): points every CELL m down the field for up to `len` m (fewer if it arrives). */
function pathFrom(nv, D, x, z, len, out) {
  out.length = 0; let c = Math.round((x - nv.x0) / CELL), r = Math.round((z - nv.z0) / CELL);
  if (c < 1 || r < 1 || c >= nv.cols - 1 || r >= nv.rows - 1) return out;
  let k = r * nv.cols + c;
  if (D[k] === Infinity) {                                                                 // wedged against something: the nearest open cell
    let best = Infinity, bk = -1; for (let dr = -2; dr <= 2; dr++) for (let dc = -2; dc <= 2; dc++) { const j = k + dr * nv.cols + dc; if (j >= 0 && j < D.length && D[j] < best) { best = D[j]; bk = j; } }
    if (bk < 0) return out; k = bk;
  }
  for (let s = 0; s < len / CELL; s++) {
    let best = D[k], bk = -1;
    for (const d of [1, -1, nv.cols, -nv.cols, nv.cols + 1, nv.cols - 1, -nv.cols + 1, -nv.cols - 1]) { const j = k + d; if (j >= 0 && j < D.length && D[j] < best) { best = D[j]; bk = j; } }
    if (bk < 0) break; k = bk; out.push(nv.x0 + (k % nv.cols) * CELL, nv.z0 + Math.floor(k / nv.cols) * CELL);
  }
  return out;
}
const _path = [];
/** Drive a car across open country: steer along its next waypoint's field and hold a speed the path's bends allow.
 *  Returns false where there's nothing for it to do (on a road leg, off the grid), and aiControl carries on. */
export function navControl(c, W) {
  const nv = navOf(W); if (!nv) return false;
  const tr = W.tr, pr = c.pr, b = tr.bi(Math.floor(c.progress)), inOpen = tr.open[tr.bi(pr.i)];
  if (!inOpen && !(pr.dist > HALF + 3) && !c.gateMiss) return false;                    // on a road leg, on the road: the road AI (unless it has missed a gate: back to it)
  const w = nv.wps.get(nv.next[b]); if (!w) return false;                                // progress stops short of a gate not yet taken, so this is it
  const sp = Math.hypot(c.vx, c.vz), look = 7 + sp * 0.4, gi = tr.u0(w.b);
  // in the gate's mouth (or near enough and lined up): straight on through it
  const ga = (c.x - tr.xs[gi]) * tr.tx[gi] + (c.z - tr.zs[gi]) * tr.tz[gi], gl = (c.x - tr.xs[gi]) * tr.rx[gi] + (c.z - tr.zs[gi]) * tr.rz[gi];
  const through = ga > -14 && ga < 2 && Math.abs(gl) < w.hw;
  const P = through ? null : pathFrom(nv, w.f, c.x, c.z, Math.max(look, sp * 1.6 + 16), _path);
  if (!through && P.length < 2) return false;
  let tx, tz;
  if (through) { tx = tr.xs[gi] + tr.tx[gi] * 12 + tr.rx[gi] * gl * 0.3; tz = tr.zs[gi] + tr.tz[gi] * 12 + tr.rz[gi] * gl * 0.3; }
  else { const li = Math.min(P.length - 2, Math.round(look / CELL) * 2); tx = P[li]; tz = P[li + 1]; }
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dx = tx - c.x, dz = tz - c.z;
  c.inp.steer = clamp(Math.atan2(-dx * fz + dz * fx, dx * fx + dz * fz) * 2.6, -1, 1);
  // speed: the tightest bend along the path ahead (6 m chords), and how far off it is
  const lat = SURF.grass.latMax * 0.75 * (0.85 + 0.15 * c.ai.skill); let target = 30 * c.ai.skill;
  if (P) for (let q = 6; q + 6 < P.length; q += 2) {
    const ax = P[q] - P[q - 6], az = P[q + 1] - P[q - 5], bx = P[q + 6] - P[q], bz = P[q + 7] - P[q + 1];
    const turn = Math.abs(Math.atan2(ax * bz - az * bx, ax * bx + az * bz)); if (turn < 0.05) continue;
    const R = 6 / (2 * Math.sin(turn / 2)), v = Math.sqrt(lat * R), dist = q / 2 * CELL;
    target = Math.min(target, Math.sqrt(v * v + 40 * dist));
  }
  const off = Math.abs(Math.atan2(-dx * fz + dz * fx, dx * fx + dz * fz)); if (off > 0.9) target = Math.min(target, 9);   // pointing the wrong way: turn round first
  if (sp > target + 1.2) { c.inp.throttle = 0; c.inp.brake = clamp((sp - target) / 5, 0.25, 1); }
  else { c.inp.brake = 0; c.inp.throttle = sp < target - 1.5 ? 1 : 0.35; }
  c.inp.handbrake = 0;
  return true;
}
