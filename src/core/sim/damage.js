import { PANELS, SPILL } from '../../data/anatomy.js';

// ---------- car damage ----------
// Four zones (front, back, left, right) from 0 to 1. Arcade-mild: damage costs a little power and pulls the
// steering; a zone reaching 1 wrecks the car, which stops, then respawns repaired a couple of seconds later.
export const DMG_K = 0.03, WRECK_T = 1.6;
export function damageCar(c, x, z, v, k, ix, iz) {
  if (c.wreckT > 0 || c.ghost > 0) return;
  const amt = Math.max(0, v - 4) * DMG_K * k; if (amt <= 0) return;
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dx = x - c.x, dz = z - c.z;
  const fwd = (dx * fx + dz * fz) / c.hl, rgt = (dx * -fz + dz * fx) / c.hw;
  const zone = Math.abs(fwd) > Math.abs(rgt) ? (fwd > 0 ? 'f' : 'b') : (rgt > 0 ? 'r' : 'l');
  c.dmg[zone] = Math.min(1, c.dmg[zone] + amt); c.hitT = 0;
  const e = { t: 'dent', zone, amt, x, z, y: c.y, ix, iz, v }; hitPanels(c, zone, fwd, amt, e); c.events.push(e);
  if (c.dmg[zone] >= 1) { c.wreckT = c.traffic ? 1e9 : WRECK_T; c.wrecks++; c.boost = 0; c.driftT = 0; c.events.push({ t: 'wreck' }); }
}
// The panels (data/anatomy.js) a hit lands on take it too; the steps they pass (bend, open, off) ride on the dent
// event as e.panels = [[id, step], ...]. Visual only: nothing in the physics reads c.panels.
function hitPanels(c, zone, fwd, amt, e) {
  const P = c.panels || (c.panels = {}), side = zone === 'l' || zone === 'r';
  for (const p of PANELS) {
    const w = p.zone === zone ? 1 : side && p.zone === (fwd > 0 ? 'f' : 'b') ? Math.min(1, Math.abs(fwd)) * SPILL : 0; if (!w) continue;
    const was = P[p.id] || 0, now = Math.min(1, was + amt * p.k * w); P[p.id] = now;
    p.steps.forEach((t, s) => { if (was < t && now >= t) (e.panels || (e.panels = [])).push([p.id, s]); });
  }
}
export function carWear(c) { const d = c.dmg; return (d.f + d.b + d.l + d.r) / 4; }
// Damage mends itself: after HEAL.WAIT s without a knock every zone recovers HEAL.RATE a second (a battered car is
// good as new in ~20 s), with a 'repair' event once it's whole again. Racers only: road cars stay wrecked.
export const HEAL = { WAIT: 4, RATE: 0.05 };
export function healCar(c, dt) {
  if (c.wreckT > 0 || c.traffic) return;
  const d = c.dmg; if (!(d.f || d.b || d.l || d.r)) return;
  if ((c.hitT = (c.hitT || 0) + dt) < HEAL.WAIT) return;
  for (const k of ['f', 'b', 'l', 'r']) d[k] = Math.max(0, d[k] - HEAL.RATE * dt);
  if (c.panels) for (const k in c.panels) c.panels[k] = Math.max(0, c.panels[k] - HEAL.RATE * dt);
  if (!(d.f || d.b || d.l || d.r)) { c.panels = {}; c.events.push({ t: 'repair' }); }
}
