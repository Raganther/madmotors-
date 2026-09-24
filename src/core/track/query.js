import { HALF, WALL } from '../constants.js';
import { clamp, lerp } from '../math.js';
import { wallAt, wallPos } from '../sim/barriers.js';

export function project(tr, x, z, hint, back, fwd) {
  const N = tr.N; let lo = hint - back; if (lo < 0) lo = 0; let hi = hint + fwd; if (hi > N - 2) hi = N - 2;
  let best = Infinity, bi = lo; const xs = tr.xs, zs = tr.zs;
  for (let i = lo; i <= hi; i++) { const dx = x - xs[i], dz = z - zs[i]; const d = dx * dx + dz * dz; if (d < best) { best = d; bi = i; } }
  let i = bi, dx = x - xs[i], dz = z - zs[i], t = dx * tr.tx[i] + dz * tr.tz[i];
  if (t < 0 && i > 0) { i--; dx = x - xs[i]; dz = z - zs[i]; t = dx * tr.tx[i] + dz * tr.tz[i]; }
  if (t < 0) t = 0; if (t > 1) t = 1; if (i > N - 2) i = N - 2;
  return { i, t, s: i + t, lat: dx * tr.rx[i] + dz * tr.rz[i], dist: Math.sqrt(best) };
}
export function roadH(tr, s) { let i = Math.floor(s); if (i < 0) i = 0; if (i > tr.N - 2) i = tr.N - 2; const t = clamp(s - i, 0, 1); return tr.H[i] + (tr.H[i + 1] - tr.H[i]) * t; }
export function groundAt(W, s, lat, x, z) {
  const al = Math.abs(lat), tr = W.tr;
  const bi = s < 0 ? 0 : s > tr.N - 2 ? tr.N - 2 : s | 0;
  if (tr.bridge[bi] || tr.tunnel[bi]) return al < WALL + 1.2 ? roadH(tr, s) : W.terr.at(x, z);
  const side = lat >= 0 ? 1 : -1, hasWall = wallAt(W, bi, side) && al < wallPos(W, bi, side) + 1.2;
  if (al >= HALF + 2 && !hasWall) return W.terr.at(x, z);
  const rh = roadH(W.tr, s);
  if (al <= HALF || hasWall) return rh;
  return lerp(rh, W.terr.at(x, z), (al - HALF) / 2);
}
