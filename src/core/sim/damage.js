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
  c.dmg[zone] = Math.min(1, c.dmg[zone] + amt);
  c.events.push({ t: 'dent', zone, amt, x, z, y: c.y, ix, iz, v });
  if (c.dmg[zone] >= 1) { c.wreckT = c.traffic ? 1e9 : WRECK_T; c.wrecks++; c.boost = 0; c.driftT = 0; c.events.push({ t: 'wreck' }); }
}
export function carWear(c) { const d = c.dmg; return (d.f + d.b + d.l + d.r) / 4; }
