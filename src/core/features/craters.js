import { HALF } from '../constants.js';
import { damageCar } from '../sim/damage.js';

// ---------- craters: weapons that dig holes in the road (core/features/weapons.js) ----------
// A mortar shell, a missile going off and a mine blow a crater in the road where they explode. It stays for the rest
// of the race, so the road wears into a battlefield lap by lap. A car that drops into one gets a jolt: it loses a
// share of its speed, is kicked up off the far lip, slews a little, and at speed takes a knock (the faster, the
// worse); while its wheels are in the hole it drags. The AI steers round the craters it sees ahead (sim/ai.js).
// Only on the road surface (not a bridge deck, a jump's ramp or over a gap: nothing to dig there). R.craters is the
// list: { id, x, y, z, r, i, lat }; render/weapons.js draws them.
export const CRATER = { MAX: 48, R: { mortar: 3.2, missile: 2.3, mine: 2.6 }, SLOW: 0.08, POP: 0.6, POP_V: 0.03, POP_MAX: 2.2, SPIN: 0.25, DMG_V: 24, DMG: 0.08, DRAG: 0.4, MERGE: 1.2 };

/** Blow a crater of `kind` at (x, z), if that's on the road; craters close together grow into one bigger hole. */
export function addCrater(R, W, x, z, kind, by = -1) {
  const tr = W.tr, q = tr.nearestT(x, z); if (!q) return null;
  const i = q.i, lat = (x - tr.xs[i]) * tr.rx[i] + (z - tr.zs[i]) * tr.rz[i], b = tr.bi(i);
  if (Math.abs(lat) > HALF + 1 || tr.bridge[i] || tr.jump[i] || tr.tunnel[i] || (tr.voidMask && tr.voidMask[b]) || (tr.gap && tr.gap[b])) return null;
  const list = R.craters || (R.craters = []), r = CRATER.R[kind] || 2.5;
  const near = list.find(o => Math.hypot(o.x - x, o.z - z) < (o.r + r) * 0.5);
  if (near) { near.r = Math.min(5, Math.hypot(near.r, r * 0.6)); near.ver = (near.ver || 0) + 1; return near; }   // the same hole, blown bigger
  const o = { id: (R.craterN = (R.craterN || 0) + 1), x, y: tr.H[i], z, r, i, lat, by };
  list.push(o); if (list.length > CRATER.MAX) list.shift();
  return o;
}
/** The crater car c's wheels are in, or null. */
export function craterUnder(R, c) {
  if (!R.craters || !R.craters.length) return null;
  for (const o of R.craters) if (Math.abs(c.y - o.y) < 1.5 && Math.hypot(c.x - o.x, c.z - o.z) < o.r * CRATER.MERGE * 0.75 + c.hw * 0.3) return o;
  return null;
}
/** Cars and craters, each step: the jolt on the way in, the drag while in. */
export function craterStep(R, dt) {
  if (!R.craters || !R.craters.length) return;
  for (const c of R.cars) {
    if (c.wreckT > 0 || c.ghost > 0 || c.finished) { c.craterId = 0; continue; }
    const o = craterUnder(R, c); if (!o) { c.craterId = 0; continue; }
    if (!c.onGround) continue;
    const v = Math.hypot(c.vx, c.vz);
    if (c.craterId !== o.id) {                                                    // dropping in: the jolt
      c.craterId = o.id; const k = Math.min(1, o.r / 3.2), keep = 1 - CRATER.SLOW * k;
      c.vx *= keep; c.vz *= keep; c.vy = Math.min(CRATER.POP_MAX, CRATER.POP + v * CRATER.POP_V) * k; c.onGround = false; c.airT = 0;
      c.spin += ((o.id * 7919 + (c.def.num || 1) * 31) % 2 ? 1 : -1) * CRATER.SPIN * Math.min(1, v / 30);   // which way it slews: fixed per car and hole (no RNG)
      if (v > CRATER.DMG_V) damageCar(c, c.x + Math.sin(c.yaw) * c.hl, c.z + Math.cos(c.yaw) * c.hl, (v - CRATER.DMG_V) * CRATER.DMG + 4, 1, 0, 0);
      c.events.push({ t: 'crater-hit', x: c.x, y: c.y, z: c.z, v });
    } else { const d = Math.max(0, 1 - CRATER.DRAG * dt); c.vx *= d; c.vz *= d; }   // in the hole: dragging
  }
}
