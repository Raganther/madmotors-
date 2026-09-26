import { HALF } from '../constants.js';
import { clamp, mulberry32 } from '../math.js';
import { damageCar } from '../sim/damage.js';

// ---------- weapons (menu: Weapons on/off; R.weapons) ----------
// Weapon crates lie on the road; drive through one with nothing in hand and you get a weapon, which one depending on
// where you are in the race (the back of the pack gets the catch-up weapons, the front the defensive ones). Five:
//   missile  locks on to the nearest car ahead, flies along the road's line and steers across onto it; a hit throws
//            the car up spinning, kills most of its speed and dents it
//   gun      a WPN.GUN_T s burst of tracer rounds up the road at whoever's ahead; each hit costs a little speed
//   oil      two slicks dropped behind you, one at a time: anyone driving over one loses grip for a moment (a slick
//            wears away after WPN.OIL_HITS cars)
//   pulse    a shockwave: everyone within WPN.PULSE_R m is blown away from you and their engine cuts out briefly
//   harpoon  hooks the car ahead (within WPN.HARP_R m); for WPN.TOW_T s the line reels you in and holds them back
//            (their engine can't drive against it)
// Crates are placed for everyone, not just the leader: each racer gets one offered 60-100 m up the road on its own
// timer (quicker the further back it is), and a crate nobody can reach any more is cleared away.
// Door bash (Road Rash with doors), always there: one button, the door on the side with a car beside you swings open;
// the car is shoved off its line and dented a little, and you're nudged the other way.
// The AI uses all of it, the keener drivers more. Deterministic, with its own seeded generator, never R.rnd, so the race
// features' random sequence is untouched; and with weapons off nothing here runs at all.
export const WPN = { RANGE: 110, SPEED: 20, VMIN: 44, LIFE: 3.6, TURN: 3.6, HIT_S: 2.4, HIT_LAT: 1.9, ARM: 0.12, SLOW: 0.35, POP: 6, SPIN: 5,
  DOOR_T: 0.45, DOOR_COOL: 2.5, SHOVE: 6, KICK: 1.2, REACH: 4.2, DOOR_SCRUB: 0.92,
  CRATE_EVERY: 7, CRATE_AHEAD: [60, 100], CRATE_R: 1.9, CRATE_LIFE: 40,
  GUN_T: 3, GUN_RATE: 7, BULLET_V: 95, BULLET_LIFE: 0.9, BULLET_SLOW: 0.95, OIL_R: 2.8, OIL_T: 1.4, OIL_SPIN: 2.6, OIL_SCRUB: 0.85, OIL_LIFE: 16, OIL_HITS: 3,
  PULSE_R: 13, PULSE_V: 8, STALL: 0.8, HARP_R: 70, HARP_V: 70, TOW_T: 2.2, TOW_PULL: 16, TOW_DRAG: 3.5 };
export const ITEMS = ['missile', 'gun', 'oil', 'pulse', 'harpoon'];
export const ITEM_USES = { missile: 1, gun: 1, oil: 2, pulse: 1, harpoon: 1 };
// pick-up odds by race position r (0 = leading, 1 = last): the back gets missiles and harpoons, the front oil and pulses
const ODDS = { missile: r => 0.5 + 1.5 * r, gun: () => 1, oil: r => 1.5 - r, pulse: r => 1.1 - 0.4 * r, harpoon: r => 0.15 + 1.6 * r };

const along = (c, o) => (o.x - c.x) * Math.sin(c.yaw) + (o.z - c.z) * Math.cos(c.yaw);
const across = (c, o) => -(o.x - c.x) * Math.cos(c.yaw) + (o.z - c.z) * Math.sin(c.yaw);   // + = the car's right (core rx, rz)
const live = c => !(c.wreckT > 0) && !(c.ghost > 0) && !c.finished;
const idx = (R, c) => R.cars.indexOf(c);
/** Where something travelling on the road is: at race progress s, lat metres across (y a little above the road). */
export function roadPos(tr, s, lat, up = 1.1) {
  const n = tr.xs.length, i = clamp(Math.floor(s), 0, n - 2), f = clamp(s - i, 0, 1), j = i + 1;
  const x = tr.xs[i] + (tr.xs[j] - tr.xs[i]) * f, z = tr.zs[i] + (tr.zs[j] - tr.zs[i]) * f;
  return { x: x + tr.rx[i] * lat, y: tr.H[i] + (tr.H[j] - tr.H[i]) * f + up, z: z + tr.rz[i] * lat, i };
}
export const missilePos = (tr, m) => roadPos(tr, m.s, m.lat);
/** The car a forward weapon from c would go for (index), or -1: the nearest ahead, roughly in line. */
export function missileTarget(R, c, range = WPN.RANGE) {
  let best = -1, bd = range;
  R.cars.forEach((o, k) => {
    if (o === c || !live(o)) return;
    const d = o.progress - c.progress; if (d < 4 || d > bd || Math.abs(o.y - c.y) > 6) return;
    if (Math.abs(across(c, o)) > 6 + d * 0.35) return;                           // roughly in front: not round the back of a hairpin
    bd = d; best = k;
  });
  return best;
}
const onRoad = (tr, c) => c.pr.i < tr.NM ? c.pr.lat : 0;                      // on a branch: aim down the middle

// ----- crates -----
function rankOf(R, c) { const live = R.cars.filter(o => !o.finished); const r = live.filter(o => o.progress > c.progress).length; return live.length > 1 ? r / (live.length - 1) : 0; }
function spotOK(tr, s) {
  const i = Math.round(s); if (i < tr.startIdx + 30 || i >= Math.min(tr.NM, tr.finishIdx) - 20) return false;
  const b = tr.bi(i); if (tr.jump[i] || tr.tunnel[i] || (tr.gap && tr.gap[b]) || (tr.voidMask && tr.voidMask[b])) return false;
  const N0 = tr.loopN || tr.N, w = tr.loopN ? i % N0 : i;
  return !tr.alts.some(a => w > a.F - 10 && w < a.M + 20);                       // not where the road splits
}
function crates(R, W, dt) {
  const tr = W.tr, S = R.wpn, rng = S.rng;
  for (const c of R.cars) {
    if (!live(c)) continue;
    const w = c.wpn; w.crateT -= dt; if (w.crateT > 0) continue;
    const r = rankOf(R, c), [a, b] = WPN.CRATE_AHEAD;
    w.crateT = WPN.CRATE_EVERY * (1.35 - 0.6 * r) * (0.8 + 0.4 * rng());           // further back: offered more often
    if (S.crates.some(k => k.s > c.progress + a - 20 && k.s < c.progress + b + 10)) continue;   // one already waiting up the road
    const s = c.progress + a + rng() * (b - a); if (!spotOK(tr, s)) continue;
    S.crates.push({ id: S.next++, s, lat: (rng() * 2 - 1) * (HALF - 2.2), t: 0 });
  }
  S.crates = S.crates.filter(k => {
    k.t += dt; if (k.t > WPN.CRATE_LIFE || R.cars.every(c => !live(c) || c.progress > k.s + 6)) return false;
    for (const c of R.cars) {
      if (!live(c) || c.wpn.item || Math.abs(c.progress - k.s) > WPN.CRATE_R || Math.abs(onRoad(tr, c) - k.lat) > WPN.CRATE_R + 0.4) continue;
      const rr = rankOf(R, c), odds = ITEMS.map(it => ODDS[it](rr)), sum = odds.reduce((x, y) => x + y, 0);
      let pick = rng() * sum, item = ITEMS[0]; for (let q = 0; q < ITEMS.length; q++) { pick -= odds[q]; if (pick <= 0) { item = ITEMS[q]; break; } }
      c.wpn.item = item; c.wpn.uses = ITEM_USES[item]; c.events.push({ t: 'pickup', item, x: c.x, y: c.y, z: c.z, crate: k.id });
      return false;
    }
    return true;
  });
}
// ----- using a weapon -----
function use(R, W, c) {
  const w = c.wpn, it = w.item, k = idx(R, c), tr = W.tr, sp = Math.hypot(c.vx, c.vz);
  if (it === 'missile') {
    const t = missileTarget(R, c);
    R.missiles.push({ id: R.wpn.next++, from: k, tgt: t, s: c.progress + 2.5, lat: onRoad(tr, c), v: Math.max(WPN.VMIN, sp + WPN.SPEED), t: 0 });
    if (t >= 0) R.cars[t].events.push({ t: 'missile-lock', from: k });
  } else if (it === 'gun') { w.gunT = WPN.GUN_T; w.gunAcc = 0; }
  else if (it === 'oil') R.wpn.slicks.push({ id: R.wpn.next++, s: c.progress - c.hl - 1.5, lat: onRoad(tr, c), t: 0, from: k });
  else if (it === 'pulse') {
    for (const o of R.cars) {
      if (o === c || !live(o) || Math.abs(o.y - c.y) > 3) continue;
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d > WPN.PULSE_R) continue;
      const f = WPN.PULSE_V * (1 - d / WPN.PULSE_R * 0.6); o.vx += dx / (d || 1) * f; o.vz += dz / (d || 1) * f; o.stallT = WPN.STALL; o.spin += (R.wpn.rng() - 0.5) * 2;
      o.events.push({ t: 'pulse-hit', from: k });
    }
  } else if (it === 'harpoon') {
    const t = missileTarget(R, c, WPN.HARP_R);
    R.wpn.hooks.push({ id: R.wpn.next++, from: k, to: t, s: c.progress + 2, lat: onRoad(tr, c), t: 0, tow: 0 });
  }
  c.events.push({ t: 'use', item: it });
  if (--w.uses <= 0) { w.item = null; w.uses = 0; }
}
function hitByMissile(R, W, m, c) {
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
    if (T && live(T)) m.lat += clamp(onRoad(tr, T) - m.lat, -WPN.TURN * dt, WPN.TURN * dt);   // home in across the road
    if (m.t < WPN.ARM) continue;
    for (const c of R.cars) {                                                    // anyone in its path, not only the target
      if (idx(R, c) === m.from || !live(c)) continue;
      if (Math.abs(c.progress - m.s) < WPN.HIT_S && Math.abs(onRoad(tr, c) - m.lat) < WPN.HIT_LAT + c.hw * 0.5) { hitByMissile(R, W, m, c); m.dead = true; break; }
    }
    if (!m.dead && (m.t > WPN.LIFE || m.s > tr.xs.length - 3)) { m.dead = true; R.cars[m.from].events.push({ t: 'missile-fizzle', ...missilePos(tr, m) }); }
  }
  R.missiles = R.missiles.filter(m => !m.dead);
}
// machine gun: rounds spray up the road towards the target's line, a little scatter; each hit chips speed off
function guns(R, W, dt) {
  const tr = W.tr, S = R.wpn;
  for (const c of R.cars) {
    const w = c.wpn; if (!(w.gunT > 0)) continue;
    w.gunT -= dt; w.gunAcc += dt * WPN.GUN_RATE;
    while (w.gunAcc >= 1) {
      w.gunAcc -= 1; const t = missileTarget(R, c, 90), aim = t >= 0 ? onRoad(tr, R.cars[t]) : onRoad(tr, c);
      S.bullets.push({ id: S.next++, from: idx(R, c), s: c.progress + c.hl + 0.5, lat: onRoad(tr, c), dl: (aim - onRoad(tr, c)) / 0.5 + (S.rng() - 0.5) * 4, v: WPN.BULLET_V + Math.hypot(c.vx, c.vz), t: 0 });
      c.events.push({ t: 'shot' });
    }
  }
  S.bullets = S.bullets.filter(b => {
    b.t += dt; b.s += b.v * dt; b.lat = clamp(b.lat + b.dl * dt, -HALF - 2, HALF + 2);
    for (const c of R.cars) {
      if (idx(R, c) === b.from || !live(c) || Math.abs(c.progress - b.s) > 2.2 || Math.abs(onRoad(tr, c) - b.lat) > c.hw + 0.3) continue;
      c.vx *= WPN.BULLET_SLOW; c.vz *= WPN.BULLET_SLOW; damageCar(c, c.x, c.z, 4.6, 1, 0, 0);
      const p = roadPos(tr, b.s, b.lat); c.events.push({ t: 'bullet-hit', x: p.x, y: p.y, z: p.z, from: b.from }); return false;
    }
    return b.t < WPN.BULLET_LIFE && b.s < tr.xs.length - 3;
  });
}
function slicks(R, W, dt) {
  const S = R.wpn, tr = W.tr;
  S.slicks = S.slicks.filter(o => {
    o.t += dt;
    for (const c of R.cars) {
      if (!live(c) || !c.onGround || (idx(R, c) === o.from && o.t < 1.5)) continue;
      if (Math.abs(c.progress - o.s) < WPN.OIL_R && Math.abs(onRoad(tr, c) - o.lat) < WPN.OIL_R) {
        if (!(c.oilT > 0)) {                                                       // first touch: the tail steps out and the speed goes
          c.events.push({ t: 'oil-hit', from: o.from }); o.hits = (o.hits || 0) + 1;
          c.spin += (S.rng() < 0.5 ? -1 : 1) * WPN.OIL_SPIN; c.vx *= WPN.OIL_SCRUB; c.vz *= WPN.OIL_SCRUB;
        }
        c.oilT = WPN.OIL_T;
      }
    }
    return o.t < WPN.OIL_LIFE && !(o.hits >= WPN.OIL_HITS);                       // tyres carry it away: gone after a few cars
  });
}
// harpoon: the hook flies up the road; if it catches its car, the line tows the shooter in and drags the target back
function hooks(R, W, dt) {
  const S = R.wpn, tr = W.tr;
  S.hooks = S.hooks.filter(h => {
    h.t += dt; const A = R.cars[h.from], T = h.to >= 0 ? R.cars[h.to] : null;
    if (!h.tow) {
      h.s += (WPN.HARP_V + Math.hypot(A.vx, A.vz)) * dt;
      if (T && live(T)) h.lat += clamp(onRoad(tr, T) - h.lat, -8 * dt, 8 * dt);
      if (T && live(T) && h.s >= T.progress - 1) { h.tow = WPN.TOW_T; T.events.push({ t: 'harpoon-hit', from: h.from }); }
      return h.t < 1.4 && (h.tow > 0 || h.s < tr.xs.length - 3);
    }
    h.tow -= dt; if (!live(A) || !T || !live(T) || h.tow <= 0) return false;
    const dx = T.x - A.x, dz = T.z - A.z, d = Math.hypot(dx, dz) || 1;
    if (d > 3.5) { A.vx += dx / d * WPN.TOW_PULL * dt; A.vz += dz / d * WPN.TOW_PULL * dt; }
    T.stallT = Math.max(T.stallT || 0, 0.05);                                     // held back on the line: no drive
    const tsp = Math.hypot(T.vx, T.vz); if (tsp > 4) { T.vx -= T.vx / tsp * WPN.TOW_DRAG * dt; T.vz -= T.vz / tsp * WPN.TOW_DRAG * dt; }
    return true;
  });
}
// ----- door bash: one button; the door on the side with a car next to you -----
/** Which door to swing: the side with the nearest car alongside (or just ahead / behind), else the right. */
export function doorSide(R, c) {
  let side = 0, best = 99;
  for (const o of R.cars) {
    if (o === c || !live(o) || Math.abs(o.y - c.y) > 2) continue;
    const lat = across(c, o), lon = along(c, o), d = Math.abs(lat) + Math.max(0, Math.abs(lon) - c.hl - o.hl) * 2;
    if (Math.abs(lat) > 0.6 && Math.abs(lat) < 8 && Math.abs(lon) < 9 && d < best) { best = d; side = Math.sign(lat); }
  }
  return side || 1;
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
      o.vx = o.vx * WPN.DOOR_SCRUB + rx * WPN.SHOVE; o.vz = o.vz * WPN.DOOR_SCRUB + rz * WPN.SHOVE; o.spin += (lon > 0 ? 1 : -1) * w.doorSide * 1.1;
      c.vx -= rx * WPN.KICK; c.vz -= rz * WPN.KICK;
      damageCar(o, c.x + rx * (c.hw + 0.4), c.z + rz * (c.hw + 0.4), 5.5, 1, rx, rz);
      w.doorHit = true; o.events.push({ t: 'door-hit', by: idx(R, c), x: c.x + rx * (c.hw + 0.5), y: c.y + 0.6, z: c.z + rz * (c.hw + 0.5) }); break;
    }
  }
}
// the AI: use what it's holding when it would do some good, swing a door at whoever's alongside; keener drivers more
function aiWeapons(R, W, dt) {
  const rng = R.wpn.rng;
  for (const c of R.cars) {
    if ((c.isPlayer && !R.autoPlayer) || !live(c)) continue;
    const keen = 0.6 + (c.ai.flick || 0.3), w = c.wpn;
    if (w.item && !(w.gunT > 0) && rng() < dt * 0.8 * keen) {
      const ahead = missileTarget(R, c), gap = ahead >= 0 ? R.cars[ahead].progress - c.progress : 999;
      const behind = R.cars.some(o => o !== c && live(o) && c.progress - o.progress > 3 && c.progress - o.progress < 30);
      const near = R.cars.filter(o => o !== c && live(o) && Math.hypot(o.x - c.x, o.z - c.z) < WPN.PULSE_R * 0.7).length;
      const want = { missile: gap > 20, gun: gap < 45, harpoon: gap > 12 && gap < WPN.HARP_R, oil: behind, pulse: near >= 1 }[w.item];
      if (want) use(R, W, c);
    }
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
  init(R) {
    R.missiles = []; if (!R.weapons) return;
    R.wpn = { rng: mulberry32(R.cars.length * 104729 + 3), next: 0, crates: [], bullets: [], slicks: [], hooks: [] };
    R.cars.forEach((c, k) => { c.wpn = { item: null, uses: 0, gunT: 0, gunAcc: 0, doorT: 0, doorSide: 0, doorCool: 0, crateT: 1.5 + k * 0.4 }; });
  },
  after(R, W, dt) {
    if (!R.weapons) return;
    const racing = R.phase === 'racing';
    for (const c of R.cars) {
      const w = c.wpn, inp = c.inp;
      if (inp.fire) { inp.fire = false; if (racing && w.item && !(w.gunT > 0) && live(c)) use(R, W, c); }
      if (inp.door) { if (racing && !(w.doorCool > 0) && live(c)) swingDoor(R, c, doorSide(R, c)); inp.door = 0; }
    }
    if (racing) { crates(R, W, dt); aiWeapons(R, W, dt); }
    flyMissiles(R, W, dt); guns(R, W, dt); slicks(R, W, dt); hooks(R, W, dt); doors(R, dt);
  }
};
