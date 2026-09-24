import { HALF } from '../constants.js';
import { makeCar } from '../sim/car.js';
import { TRAFFIC_COLORS, TRAFFIC_KINDS } from '../../data/cars.js';

// ---------- parked cars (town) ----------
// Parked against the kerb on straight bits of town street, away from the grid and the level crossing.
export function makeParked(W, rnd) {
  const tr = W.tr; if (!tr.town) return [];
  const N0 = tr.loopN, out = []; let last = -1e9, side = 1;
  for (let i = 60; i < N0 - 12; i++) {
    if (!tr.town[i] || Math.abs(tr.ks[i]) > 1 / 200 || i - last < 34) continue;
    if (tr.rails && tr.rails.crossings.some(C => Math.abs(C.i - i) < 16)) continue;
    let straight = true; for (let j = i - 6; j <= i + 6; j++) if (!tr.town[(j + N0) % N0] || Math.abs(tr.ks[(j + N0) % N0]) > 1 / 200) straight = false;
    if (!straight) continue;
    const K = TRAFFIC_KINDS[rnd() < 0.7 ? 0 : 1];
    const c = makeCar(W, i, side * (HALF - 1.25), { name: 'parked', traffic: true, parked: true, kind: K.kind, hw: K.hw, hl: K.hl, im: K.im * 1.2, color: TRAFFIC_COLORS[(rnd() * TRAFFIC_COLORS.length) | 0], accent: 0x8E939B, skill: 0.5 });
    c.parked = true; out.push(c); last = i; side = -side;
  }
  return out;
}
