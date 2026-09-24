import { HALF, WALL } from '../constants.js';
import { clamp, lerp } from '../math.js';
import { wallAt, wallPos } from '../sim/barriers.js';
import { ferryDeckAt } from '../features/ferry.js';
import { drawDeckAt } from '../features/drawbridge.js';

export function project(tr, x, z, hint, back, fwd) {
  if (tr.nx) return projectG(tr, x, z, hint, back, fwd);
  const N = tr.N; let lo = hint - back; if (lo < 0) lo = 0; let hi = hint + fwd; if (hi > N - 2) hi = N - 2;
  let best = Infinity, bi = lo; const xs = tr.xs, zs = tr.zs;
  for (let i = lo; i <= hi; i++) { const dx = x - xs[i], dz = z - zs[i]; const d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
  let i = bi, dx = x - xs[i], dz = z - zs[i], t = dx * tr.tx[i] + dz * tr.tz[i];
  if (t < 0 && i > 0) { i--; dx = x - xs[i]; dz = z - zs[i]; t = dx * tr.tx[i] + dz * tr.tz[i]; }
  if (t < 0) t = 0; if (t > 1) t = 1; if (i > N - 2) i = N - 2;
  return { i, t, s: i + t, lat: dx * tr.rx[i] + dz * tr.rz[i], dist: Math.sqrt(best) };
}
// the same along the road graph (a stage with branches): the window follows the road from `hint`, whichever route it's on
function projectG(tr, x, z, hint, back, fwd) {
  const nx = tr.nx, pv = tr.pv, xs = tr.xs, zs = tr.zs; let i = hint;
  for (let k = 0; k < back; k++) i = pv[i];
  let best = Infinity, bi = i;
  for (let k = 0; k <= back + fwd; k++) { const dx = x - xs[i], dz = z - zs[i], d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } const j = nx[i]; if (j === i) break; i = j; }
  i = bi; let dx = x - xs[i], dz = z - zs[i], t = dx * tr.tx[i] + dz * tr.tz[i];
  if (t < 0 && pv[i] !== i) { i = pv[i]; dx = x - xs[i]; dz = z - zs[i]; t = dx * tr.tx[i] + dz * tr.tz[i]; }
  if (t < 0) t = 0; if (t > 1) t = 1;
  return { i, t, s: i + t, lat: dx * tr.rx[i] + dz * tr.rz[i], dist: Math.sqrt(best) };
}
export function roadH(tr, s) { let i = Math.floor(s); if (i < 0) i = 0; if (i > tr.N - 2) i = tr.N - 2; const t = clamp(s - i, 0, 1); return tr.H[i] + (tr.H[tr.nx ? tr.nx[i] : i + 1] - tr.H[i]) * t; }
export function groundAt(W, s, lat, x, z) {
  const al = Math.abs(lat), tr = W.tr;
  const bi = s < 0 ? 0 : s > tr.N - 2 ? tr.N - 2 : s | 0;
  if (tr.bridge[bi] || tr.tunnel[bi]) return al < WALL + 1.2 ? roadH(tr, s) : W.terr.at(x, z);
  if (tr.gap && tr.gap[tr.bi(bi)]) return W.terr.at(x, z);            // a gap: nothing but the drop
  if (tr.drawbridge && tr.drawbridge[tr.bi(bi)]) { const d = drawDeckAt(W, s, lat); return d !== null ? d : W.terr.at(x, z); }   // a leaf, or the mill race
  if (tr.ferry && tr.ferry[tr.bi(bi)]) { const d = ferryDeckAt(W, s, lat); return d !== null ? d : W.terr.at(x, z); }   // the barge deck, or the water
  const side = lat >= 0 ? 1 : -1, hasWall = wallAt(W, bi, side) && al < wallPos(W, bi, side) + 1.2;
  if (al >= HALF + 2 && !hasWall) return W.terr.at(x, z);
  const rh = roadH(W.tr, s);
  if (al <= HALF || hasWall) return rh;
  return lerp(rh, W.terr.at(x, z), (al - HALF) / 2);
}
