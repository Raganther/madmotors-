import { clamp, mulberry32 } from '../math.js';
import { damageCar } from '../sim/damage.js';

// ---------- weapons (menu: Weapons on/off; R.weapons) ----------
// Homing missile: every racer carries one; fire it and it reloads in WPN.RELOAD s. It locks on to the nearest car
// ahead (within WPN.RANGE along the road, roughly in line), flies along the road at speed and steers across onto its
// target. A hit throws the car up in a spin, kills most of its speed and dents it a little; it doesn't wreck a
// healthy car on its own. It flies on the road's line, so it follows the bends, and gives up after WPN.LIFE s.
// Door bash (Road Rash with doors): swing a door open for WPN.DOOR_T s; a car alongside on that side is shoved away
// (WPN.SHOVE m/s) and dented a touch, and you're nudged the other way. WPN.DOOR_COOL s between swings. Tuned so they needle rather than decide a race: a missile that
// homes slowly enough to dodge, the AI firing now and then, doors that dent lightly.
// The AI uses both, the keener ones more. Its own seeded generator, never R.rnd, so the race features' random
// sequence is untouched; and with weapons off nothing here runs at all.
export const WPN = { RELOAD: 15, RANGE: 110, SPEED: 20, VMIN: 44, LIFE: 3.6, TURN: 3.6, HIT_S: 2.4, HIT_LAT: 1.9, ARM: 0.12, SLOW: 0.35, POP: 6, SPIN: 5,
  DOOR_T: 0.45, DOOR_COOL: 2.5, SHOVE: 4.5, KICK: 1.2, REACH: 4.2 };

const along = (c, o) => (o.x - c.x) * Math.sin(c.yaw) + (o.z - c.z) * Math.cos(c.yaw);
const across = (c, o) => -(o.x - c.x) * Math.cos(c.yaw) + (o.z - c.z) * Math.sin(c.yaw);   // + = the car's right (core rx, rz)
const live = c => !(c.wreckT > 0) && !(c.ghost > 0) && !c.finished;
/** The car a missile from c would lock on to (index), or -1. */
export function missileTarget(R, c) {
  let best = -1, bd = WPN.RANGE;
  R.cars.forEach((o, k) => {
    if (o === c || !live(o)) return;
    const d = o.progress - c.progress; if (d < 4 || d > bd || Math.abs(o.y - c.y) > 6) return;
    if (Math.abs(across(c, o)) > 6 + d * 0.35) return;                           // roughly in front: not round the back of a hairpin
    bd = d; best = k;
  });
  return best;
}
function fire(R, c) {
  const k = missileTarget(R, c), sp = Math.hypot(c.vx, c.vz);
  R.missiles.push({ id: R.wpn.next++, from: R.cars.indexOf(c), tgt: k, s: c.progress + 2.5, lat: c.pr.lat, v: Math.max(WPN.VMIN, sp + WPN.SPEED), t: 0 });
  c.wpn.ammo = 0; c.wpn.reload = WPN.RELOAD; c.events.push({ t: 'missile-fire' });
  if (k >= 0) R.cars[k].events.push({ t: 'missile-lock', from: R.cars.indexOf(c) });
}
/** Where a missile is: on the road at progress s, lat metres across. */
export function missilePos(tr, m) {
  const n = tr.xs.length, i = clamp(Math.floor(m.s), 0, n - 2), f = clamp(m.s - i, 0, 1), j = i + 1;
  const x = tr.xs[i] + (tr.xs[j] - tr.xs[i]) * f, z = tr.zs[i] + (tr.zs[j] - tr.zs[i]) * f;
  return { x: x + tr.rx[i] * m.lat, y: tr.H[i] + (tr.H[j] - tr.H[i]) * f + 1.1, z: z + tr.rz[i] * m.lat, i };
}
function hit(R, W, m, c) {
  const p = missilePos(W.tr, m);
  c.vx *= WPN.SLOW; c.vz *= WPN.SLOW; c.vy = WPN.POP; c.onGround = false; c.airT = 0;
  c.spin += (R.wpn.rng() < 0.5 ? -1 : 1) * WPN.SPIN; c.boost = 0; c.driftT = 0;
  damageCar(c, p.x, p.z, 7.5, 1, 0, 0);
  c.events.push({ t: 'missile-hit', x: p.x, y: p.y, z: p.z, from: m.from });
}
function flyMissiles(R, W, dt) {
  const tr = W.tr;
  for (const m of R.missiles) {
    m.t += dt; m.s += m.v * dt;
    const T = m.tgt >= 0 ? R.cars[m.tgt] : null;
    if (T && live(T)) { const want = T.pr.i >= tr.NM ? m.lat : T.pr.lat; m.lat += clamp(want - m.lat, -WPN.TURN * dt, WPN.TURN * dt); }   // home in across the road
    if (m.t < WPN.ARM) continue;
    for (const c of R.cars) {                                                    // anyone in its path, not only the target
      if (R.cars.indexOf(c) === m.from || !live(c)) continue;
      if (Math.abs(c.progress - m.s) < WPN.HIT_S && Math.abs(c.pr.lat - m.lat) < WPN.HIT_LAT + c.hw * 0.5) { hit(R, W, m, c); m.dead = true; break; }
    }
    if (m.t > WPN.LIFE || m.s > tr.xs.length - 3) { m.dead = true; R.cars[m.from].events.push({ t: 'missile-fizzle', ...missilePos(tr, m) }); }
  }
  R.missiles = R.missiles.filter(m => !m.dead);
}
function swingDoor(R, c, side) {
  const w = c.wpn; w.doorT = WPN.DOOR_T; w.doorSide = side; w.doorCool = WPN.DOOR_COOL; w.doorHit = false; c.events.push({ t: 'door', side });
}
function doors(R, dt) {
  for (const c of R.cars) {
    const w = c.wpn; if (w.doorCool > 0) w.doorCool -= dt;
    if (!(w.doorT > 0)) continue;
    w.doorT -= dt; if (w.doorHit) continue;
    for (const o of R.cars) {
      if (o === c || !live(o) || Math.abs(o.y - c.y) > 1.5) continue;
      const lat = across(c, o) * w.doorSide, lon = along(c, o);
      if (lat < 0.8 || lat > c.hw + o.hw + WPN.REACH - 2 || Math.abs(lon) > c.hl + o.hl - 0.4) continue;
      const rx = -Math.cos(c.yaw) * w.doorSide, rz = Math.sin(c.yaw) * w.doorSide;   // out of that side
      o.vx += rx * WPN.SHOVE; o.vz += rz * WPN.SHOVE; o.spin += (lon > 0 ? 1 : -1) * w.doorSide * 0.6;
      c.vx -= rx * WPN.KICK; c.vz -= rz * WPN.KICK;
      damageCar(o, c.x + rx * (c.hw + 0.4), c.z + rz * (c.hw + 0.4), 5.5, 1, rx, rz);
      w.doorHit = true; o.events.push({ t: 'door-hit', by: R.cars.indexOf(c), x: c.x + rx * (c.hw + 0.5), y: c.y + 0.6, z: c.z + rz * (c.hw + 0.5) }); break;
    }
  }
}
// the AI: fire when there's someone to lock on to, swing a door at whoever's alongside; keener drivers more often
function aiWeapons(R, dt) {
  const rng = R.wpn.rng;
  for (const c of R.cars) {
    if ((c.isPlayer && !R.autoPlayer) || !live(c)) continue;
    const keen = 0.6 + (c.ai.flick || 0.3), w = c.wpn;
    if (w.ammo > 0 && R.phase === 'racing' && rng() < dt * 0.3 * keen) { const k = missileTarget(R, c); if (k >= 0 && R.cars[k].progress - c.progress > 20) fire(R, c); }
    if (!(w.doorCool > 0) && !(w.doorT > 0) && rng() < dt * 0.45 * keen) {
      for (const o of R.cars) {
        if (o === c || !live(o)) continue;
        const lat = across(c, o), lon = along(c, o);
        if (Math.abs(lat) > 1.2 && Math.abs(lat) < c.hw + o.hw + 1.6 && Math.abs(lon) < c.hl) { swingDoor(R, c, Math.sign(lat)); break; }
      }
    }
  }
}
export const feature = {
  name: 'weapons',
  init(R) { R.missiles = []; if (!R.weapons) return; R.wpn = { rng: mulberry32(R.cars.length * 104729 + 3), next: 0 }; for (const c of R.cars) c.wpn = { ammo: 1, reload: 0, doorT: 0, doorSide: 0, doorCool: 0 }; },
  after(R, W, dt) {
    if (!R.weapons) return;
    const racing = R.phase === 'racing';
    for (const c of R.cars) {
      const w = c.wpn, inp = c.inp;
      if (w.ammo === 0 && (w.reload -= dt) <= 0) { w.ammo = 1; c.events.push({ t: 'missile-ready' }); }
      if (inp.fire) { inp.fire = false; if (racing && w.ammo > 0 && live(c)) fire(R, c); }
      if (inp.door) { if (racing && !(w.doorCool > 0) && live(c)) swingDoor(R, c, inp.door); inp.door = 0; }
    }
    if (racing) aiWeapons(R, dt);
    flyMissiles(R, W, dt); doors(R, dt);
  }
};
