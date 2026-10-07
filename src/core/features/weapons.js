import { HALF } from '../constants.js';
import { clamp, mulberry32, wrapAngle } from '../math.js';
import { damageCar } from '../sim/damage.js';
import { SIGNATURES, WEAPONS, levelOf } from '../../data/weapons.js';

// ---------- weapons (menu: Weapons on/off; R.weapons) ----------
// Weapon crates lie on the road; drive through one with nothing in hand and you get a weapon, which one depending on
// where you are in the race (the back of the pack gets the catch-up weapons, the front the defensive ones). Five:
//   missile  locks on to the nearest car ahead, flies along the road's line and steers across onto it; a hit throws
//            the car up spinning, kills most of its speed and dents it
//   gun      a WPN.GUN_T s burst of tracer rounds straight ahead (swung a little at whoever's ahead); each hit costs a little speed
//   oil      two slicks dropped behind you, one at a time: anyone driving over one loses grip for a moment (a slick
//            wears away after WPN.OIL_HITS cars)
//   pulse    a shockwave: everyone within WPN.PULSE_R m is blown away from you and their engine cuts out briefly
//   harpoon  hooks the car ahead (within WPN.HARP_R m); for WPN.TOW_T s the line reels you in and holds them back
//            (their engine can't drive against it)
// Crates are placed for everyone, not just the leader: each racer gets one offered 60-100 m up the road on its own
// timer (quicker the further back it is), and a crate nobody can reach any more is cleared away.
// Door bash (Road Rash with doors), always there: one button, the door on the side with a car beside you swings open;
// the car is shoved off its line and dented a little, and you're nudged the other way.
// Levels, gear and signature weapons (F6, data/weapons.js): a car's def can carry `wpn: { lv, gear }`. A weapon's level
// swaps some of WPN's numbers for its own (WEAPONS[it].fx: a longer burst, a wider slick, twin missiles, glue); gear
// works by itself (flares draw off a missile, a shield soaks up the next hit, a magnet pulls crates in); and five
// vehicles find their own signature weapon in crates too:
//   water    fire engine: a jet ahead for WATER_T s that shoves cars aside and leaves them sliding
//   cement   mixer: a trail of wet cement behind for CEMENT_T s; a car in it bogs down
//   stinger  police: a spike strip across the road behind; the first STINGER_HITS cars over it lose speed and spin
//   crush    monster truck: a leap; landing within CRUSH_R m of a car slams it (damage, speed, a stall)
//   jingle   ice cream van: JINGLE_T s of chimes; every car within JINGLE_R m stutters (its engine cuts in and out)
// The AI uses all of it, the keener drivers more. Deterministic, with its own seeded generator, never R.rnd, so the race
// features' random sequence is untouched; and with weapons off nothing here runs at all.
export const WPN = { RANGE: 110, SPEED: 20, VMIN: 44, LIFE: 3.6, TURN: 3.6, HIT_S: 2.4, HIT_LAT: 1.9, ARM: 0.12, SLOW: 0.35, POP: 6, SPIN: 5,
  DOOR_T: 0.45, DOOR_COOL: 2.5, SHOVE: 6, KICK: 1.2, REACH: 4.2, DOOR_SCRUB: 0.92,
  CRATE_EVERY: 7, CRATE_AHEAD: [60, 100], CRATE_R: 1.9, CRATE_LIFE: 40,
  GUN_T: 3, GUN_RATE: 7, GUN_SWING: 0.26, GUN_SCATTER: 0.05, BULLET_V: 95, BULLET_LIFE: 0.9, BULLET_SLOW: 0.95, OIL_R: 2.8, OIL_T: 1.4, OIL_SPIN: 2.6, OIL_SCRUB: 0.85, OIL_LIFE: 16, OIL_HITS: 3,
  PULSE_R: 13, PULSE_V: 8, STALL: 0.8, HARP_R: 70, HARP_V: 70, TOW_T: 2.2, TOW_PULL: 16, TOW_DRAG: 3.5,
  MISSILE_DMG: 7.5, BULLET_DMG: 4.6, DOOR_DMG: 5.5, TURN2: 1.6, TWIN: 0, GLUE: 0,
  WATER_T: 2.5, WATER_R: 22, WATER_CONE: 0.45, WATER_PUSH: 22, WATER_SCRUB: 1.2, WATER_SLIP: 0.35,
  CEMENT_T: 1.6, CEMENT_EVERY: 0.22, CEMENT_R: 2.4, CEMENT_LIFE: 14, CEMENT_DRAG: 0.45,
  STINGER_HITS: 2, STINGER_LIFE: 20, STINGER_SCRUB: 0.6, STINGER_DMG: 4,
  CRUSH_V: 7.5, CRUSH_R: 7, CRUSH_DMG: 6.5, CRUSH_SCRUB: 0.6,
  JINGLE_T: 2.5, JINGLE_R: 22, JINGLE_DUTY: 0.33,
  FLARE_COOL: 20, SHIELD_COOL: 18, SHIELD_ON: 1, MAGNET: 2.4, SIG_ODDS: 1.3 };
export const ITEMS = ['missile', 'gun', 'oil', 'pulse', 'harpoon', 'water', 'cement', 'stinger', 'crush', 'jingle'];
export const ITEM_USES = { missile: 1, gun: 1, oil: 2, pulse: 1, harpoon: 1, water: 1, cement: 1, stinger: 2, crush: 1, jingle: 1 };
export const SIG_ITEMS = ITEMS.filter(it => WEAPONS[it].sig);
/** Weapon number k for car c's item it: its level's (data/weapons.js) or WPN's. */
export const wv = (c, it, k) => { const f = WEAPONS[it].fx[levelOf(c.wpn && c.wpn.load, it) - 1]; return f[k] !== undefined ? f[k] : WPN[k]; };
// pick-up odds by race position r (0 = leading, 1 = last): the back gets missiles and harpoons, the front oil and pulses
const ODDS = { missile: r => 0.5 + 1.5 * r, gun: () => 1, oil: r => 1.5 - r, pulse: r => 1.1 - 0.4 * r, harpoon: r => 0.15 + 1.6 * r };

const along = (c, o) => (o.x - c.x) * Math.sin(c.yaw) + (o.z - c.z) * Math.cos(c.yaw);
const across = (c, o) => -(o.x - c.x) * Math.cos(c.yaw) + (o.z - c.z) * Math.sin(c.yaw);   // + = the car's right (core rx, rz)
const live = c => !(c.wreckT > 0) && !(c.ghost > 0) && !c.finished;
const idx = (R, c) => R.cars.indexOf(c);
/** Does car c's shield take this hit? (gear: soaks up the first hit, and anything else in the next SHIELD_ON s) */
function shielded(c) {
  const w = c.wpn; if (!w || w.gear !== 'shield') return false;
  if (w.shieldOn > 0) return true;
  if (w.shieldT > 0) return false;
  w.shieldT = WPN.SHIELD_COOL; w.shieldOn = WPN.SHIELD_ON; c.events.push({ t: 'shield', x: c.x, y: c.y, z: c.z }); return true;
}
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
      const reach = c.wpn.gear === 'magnet' ? WPN.MAGNET : 1;
      if (!live(c) || c.wpn.item || Math.abs(c.progress - k.s) > WPN.CRATE_R * reach || Math.abs(onRoad(tr, c) - k.lat) > (WPN.CRATE_R + 0.4) * reach) continue;
      // the five standard weapons by race position, and the car's own signature weapon if it has one
      const rr = rankOf(R, c), bias = (c.def.wpn && c.def.wpn.bias) || {}, odds = ITEMS.map(it => (WEAPONS[it].sig ? (it === c.wpn.sig ? WPN.SIG_ODDS : 0) : ODDS[it](rr)) * (bias[it] ?? 1)), sum = odds.reduce((x, y) => x + y, 0);
      let pick = rng() * sum, item = ITEMS[0]; for (let q = 0; q < ITEMS.length; q++) { if (!odds[q]) continue; pick -= odds[q]; if (pick <= 0) { item = ITEMS[q]; break; } }
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
    const t = missileTarget(R, c), turn = wv(c, it, 'TURN'), fire = (tg, lat) => {
      R.missiles.push({ id: R.wpn.next++, from: k, tgt: tg, s: c.progress + 2.5, lat, v: Math.max(WPN.VMIN, sp + WPN.SPEED), t: 0, turn });
      if (tg >= 0) lock(R, R.cars[tg], k);
    };
    if (wv(c, it, 'TWIN')) { const t2 = secondTarget(R, c, t); fire(t, onRoad(tr, c) - 1.2); fire(t2 >= 0 ? t2 : t, onRoad(tr, c) + 1.2); }   // twin: one each at the two cars ahead
    else fire(t, onRoad(tr, c));
  } else if (it === 'gun') { w.gunT = wv(c, it, 'GUN_T'); w.gunAcc = 0; }
  else if (it === 'oil') R.wpn.slicks.push({ id: R.wpn.next++, s: c.progress - c.hl - 1.5, lat: onRoad(tr, c), t: 0, from: k, r: wv(c, it, 'OIL_R'), glue: wv(c, it, 'GLUE') });
  else if (it === 'pulse') {
    const PR = wv(c, it, 'PULSE_R'); w.pulseR = PR;
    for (const o of R.cars) {
      if (o === c || !live(o) || Math.abs(o.y - c.y) > 3) continue;
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d > PR || shielded(o)) continue;
      const f = WPN.PULSE_V * (1 - d / PR * 0.6); o.vx += dx / (d || 1) * f; o.vz += dz / (d || 1) * f; o.stallT = WPN.STALL; o.spin += (R.wpn.rng() - 0.5) * 2;
      o.events.push({ t: 'pulse-hit', from: k });
    }
  } else if (it === 'harpoon') {
    const t = missileTarget(R, c, WPN.HARP_R);
    R.wpn.hooks.push({ id: R.wpn.next++, from: k, to: t, s: c.progress + 2, lat: onRoad(tr, c), t: 0, tow: 0, towT: wv(c, it, 'TOW_T') });
  }
  else if (it === 'water') { w.waterT = wv(c, it, 'WATER_T'); w.soaked = []; }
  else if (it === 'cement') { w.cementT = wv(c, it, 'CEMENT_T'); w.cementAcc = 1; }
  else if (it === 'stinger') R.wpn.strips.push({ id: R.wpn.next++, s: c.progress - c.hl - 3, t: 0, from: k, left: wv(c, it, 'STINGER_HITS'), hit: [] });
  else if (it === 'crush') { c.vy = WPN.CRUSH_V; c.onGround = false; c.airT = 0; w.crushT = 2; w.crushR = wv(c, it, 'CRUSH_R'); w.crushUp = 0.15; }
  else if (it === 'jingle') { w.jingleT = WPN.JINGLE_T; w.jingleR = wv(c, it, 'JINGLE_R'); w.jingled = []; }
  c.events.push({ t: 'use', item: it, lv: levelOf(w.load, it) });
  if (--w.uses <= 0) { w.item = null; w.uses = 0; }
}
// a missile locking on: flares (gear) draw it off, if they're charged
function lock(R, T, k) {
  const m = R.missiles[R.missiles.length - 1], w = T.wpn;
  if (w && w.gear === 'flares' && !(w.flareT > 0)) { w.flareT = WPN.FLARE_COOL; m.tgt = -1; m.decoy = 1; T.events.push({ t: 'flares', x: T.x, y: T.y, z: T.z, from: k }); return; }
  T.events.push({ t: 'missile-lock', from: k });
}
/** The second car ahead of c (for twin missiles), not `first`. */
function secondTarget(R, c, first) {
  let best = -1, bd = WPN.RANGE;
  R.cars.forEach((o, k) => { if (k === first || o === c || !live(o)) return; const d = o.progress - c.progress; if (d < 4 || d > bd || Math.abs(o.y - c.y) > 6 || Math.abs(across(c, o)) > 6 + d * 0.35) return; bd = d; best = k; });
  return best;
}
function hitByMissile(R, W, m, c) {
  const p = missilePos(W.tr, m);
  if (shielded(c)) { c.events.push({ t: 'shield-hit', x: p.x, y: p.y, z: p.z, from: m.from }); return; }
  c.vx *= WPN.SLOW; c.vz *= WPN.SLOW; c.vy = WPN.POP; c.onGround = false; c.airT = 0;
  c.spin += (R.wpn.rng() < 0.5 ? -1 : 1) * WPN.SPIN; c.boost = 0; c.driftT = 0;
  damageCar(c, p.x, p.z, WPN.MISSILE_DMG, 1, 0, 0);
  c.events.push({ t: 'missile-hit', x: p.x, y: p.y, z: p.z, from: m.from });
}
function flyMissiles(R, W, dt) {
  const tr = W.tr;
  for (const m of R.missiles) {
    m.t += dt; m.s += m.v * dt;
    const T = m.tgt >= 0 ? R.cars[m.tgt] : null;
    if (T && live(T)) m.lat += clamp(onRoad(tr, T) - m.lat, -(m.turn || WPN.TURN) * dt, (m.turn || WPN.TURN) * dt);   // home in across the road
    else if (m.decoy) m.lat += WPN.TURN2 * dt * (m.id % 2 ? 1 : -1);                    // after the flares: off the road
    if (m.t < WPN.ARM) continue;
    for (const c of R.cars) {                                                    // anyone in its path, not only the target
      if (idx(R, c) === m.from || !live(c)) continue;
      if (Math.abs(c.progress - m.s) < WPN.HIT_S && Math.abs(onRoad(tr, c) - m.lat) < WPN.HIT_LAT + c.hw * 0.5) { hitByMissile(R, W, m, c); m.dead = true; break; }
    }
    if (!m.dead && (m.t > WPN.LIFE || m.s > tr.xs.length - 3)) { m.dead = true; R.cars[m.from].events.push({ t: 'missile-fizzle', ...missilePos(tr, m) }); }
  }
  R.missiles = R.missiles.filter(m => !m.dead);
}
// machine gun: rounds fly dead straight from the gun on the roof, the way the car is pointing, swung a few degrees
// towards whoever's ahead (never more: point the car to aim) with a little scatter; each hit chips speed off. A round
// that misses carries on off the road.
function guns(R, W, dt) {
  const S = R.wpn;
  for (const c of R.cars) {
    const w = c.wpn; if (!(w.gunT > 0)) continue;
    w.gunT -= dt; w.gunAcc += dt * WPN.GUN_RATE;
    while (w.gunAcc >= 1) {
      w.gunAcc -= 1; const t = missileTarget(R, c, 90), T = t >= 0 ? R.cars[t] : null;
      let yaw = c.yaw, vy = 0;
      if (T) {   // swung at the target (and tipped up or down to its height: the road climbs and falls)
        const d = Math.hypot(T.x - c.x, T.z - c.z), lead = d / WPN.BULLET_V; yaw += clamp(wrapAngle(Math.atan2(T.x + T.vx * lead - c.x, T.z + T.vz * lead - c.z) - c.yaw), -WPN.GUN_SWING, WPN.GUN_SWING);
        vy = clamp((T.y - c.y - 0.5) / Math.max(0.05, lead), -12, 12);
      }
      yaw += (S.rng() - 0.5) * WPN.GUN_SCATTER;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dx = Math.sin(yaw), dz = Math.cos(yaw);
      S.bullets.push({ id: S.next++, from: idx(R, c), x: c.x + fx * (c.hl + 0.6), y: c.y + 1.3, z: c.z + fz * (c.hl + 0.6), vx: c.vx + dx * WPN.BULLET_V, vy, vz: c.vz + dz * WPN.BULLET_V, t: 0 });
      c.events.push({ t: 'shot' });
    }
  }
  S.bullets = S.bullets.filter(b => {
    const x0 = b.x, z0 = b.z; b.t += dt; b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    const sx = b.x - x0, sz = b.z - z0, L2 = sx * sx + sz * sz || 1;
    for (const c of R.cars) {
      if (idx(R, c) === b.from || !live(c) || Math.abs(c.y + 0.8 - b.y) > 2.2) continue;
      const u = clamp(((c.x - x0) * sx + (c.z - z0) * sz) / L2, 0, 1), px = x0 + sx * u, pz = z0 + sz * u;   // nearest point of this step's path
      if (Math.hypot(c.x - px, c.z - pz) > c.hw + 0.35) continue;
      if (shielded(c)) { c.events.push({ t: 'shield-hit', x: px, y: c.y, z: pz, from: b.from }); return false; }
      c.vx *= WPN.BULLET_SLOW; c.vz *= WPN.BULLET_SLOW; damageCar(c, px, pz, WPN.BULLET_DMG, 1, 0, 0);
      c.events.push({ t: 'bullet-hit', x: px, y: c.y, z: pz, from: b.from }); return false;
    }
    return b.t < WPN.BULLET_LIFE;
  });
}
function slicks(R, W, dt) {
  const S = R.wpn, tr = W.tr;
  S.slicks = S.slicks.filter(o => {
    o.t += dt;
    for (const c of R.cars) {
      if (!live(c) || !c.onGround || (idx(R, c) === o.from && o.t < 1.5)) continue;
      const r = o.r || WPN.OIL_R;
      if (Math.abs(c.progress - o.s) < r && Math.abs(onRoad(tr, c) - o.lat) < r) {
        if (!(c.oilT > 0)) {                                                       // first touch: the tail steps out and the speed goes
          if (shielded(c)) { o.hits = (o.hits || 0) + 1; continue; }
          c.events.push({ t: 'oil-hit', from: o.from }); o.hits = (o.hits || 0) + 1;
          c.spin += (S.rng() < 0.5 ? -1 : 1) * WPN.OIL_SPIN; c.vx *= WPN.OIL_SCRUB; c.vz *= WPN.OIL_SCRUB;
          if (o.glue) { c.vx *= o.glue; c.vz *= o.glue; }                          // glue: it grabs as well as slides
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
      if (T && live(T) && h.s >= T.progress - 1) { if (shielded(T)) return false; h.tow = h.towT || WPN.TOW_T; T.events.push({ t: 'harpoon-hit', from: h.from }); }
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
// ----- signature weapons (and the gear's recharge) -----
const aim = (c, o) => { const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz) || 1; return { d, ux: dx / d, uz: dz / d, ang: Math.abs(wrapAngle(Math.atan2(dx, dz) - c.yaw)) }; };
/** First contact of one use of an area weapon with car o: false if o's shield takes it (it's spared the rest). */
function touch(list, o, k) { const e = list.find(x => x.k === k); if (e) return e.ok; const ok = !shielded(o); list.push({ k, ok }); return ok; }
function signatures(R, W, dt) {
  const S = R.wpn, tr = W.tr;
  for (const c of R.cars) {
    const w = c.wpn, k = idx(R, c);
    if (w.flareT > 0) w.flareT -= dt; if (w.shieldT > 0) w.shieldT -= dt; if (w.shieldOn > 0) w.shieldOn -= dt;
    // water cannon: everything in the jet's cone is shoved away down it, scrubbed and left sliding
    if (w.waterT > 0) {
      w.waterT -= dt;
      for (const [j, o] of R.cars.entries()) {
        if (o === c || !live(o) || Math.abs(o.y - c.y) > 3) continue;
        const a = aim(c, o); if (a.d > WPN.WATER_R || a.ang > WPN.WATER_CONE || !touch(w.soaked, o, j)) continue;
        if (!w.soaked.find(x => x.k === j).hit) { w.soaked.find(x => x.k === j).hit = 1; o.events.push({ t: 'water-hit', from: k }); }
        const f = WPN.WATER_PUSH * (1 - a.d / WPN.WATER_R * 0.5) * dt; o.vx += a.ux * f; o.vz += a.uz * f;
        o.vx *= 1 - WPN.WATER_SCRUB * dt; o.vz *= 1 - WPN.WATER_SCRUB * dt; o.oilT = Math.max(o.oilT || 0, WPN.WATER_SLIP);
      }
    }
    // cement: a patch dropped behind every CEMENT_EVERY s while the drum pours
    if (w.cementT > 0) { w.cementT -= dt; w.cementAcc += dt; if (w.cementAcc >= WPN.CEMENT_EVERY) { w.cementAcc = 0; S.cement.push({ id: S.next++, s: c.progress - c.hl - 1.2, lat: onRoad(tr, c), t: 0, from: k }); } }
    // crush: once the leap has left the ground, the landing slams everyone close
    if (w.crushT > 0) {
      w.crushT -= dt; if (!c.onGround) w.crushAir = 1;
      if (w.crushAir && c.onGround) {
        w.crushT = 0; w.crushAir = 0; c.events.push({ t: 'crush', x: c.x, y: c.y, z: c.z, r: w.crushR });
        for (const o of R.cars) {
          if (o === c || !live(o) || Math.abs(o.y - c.y) > 3 || Math.hypot(o.x - c.x, o.z - c.z) > w.crushR || shielded(o)) continue;
          o.vx *= WPN.CRUSH_SCRUB; o.vz *= WPN.CRUSH_SCRUB; o.vy = 3; o.onGround = false; o.stallT = WPN.STALL;
          damageCar(o, (o.x + c.x) / 2, (o.z + c.z) / 2, WPN.CRUSH_DMG, 1, 0, 0); o.events.push({ t: 'crush-hit', from: k, x: o.x, y: o.y, z: o.z });
        }
      }
    }
    // jingle: everyone in earshot stutters (the engine cuts out a third of the time)
    if (w.jingleT > 0) {
      w.jingleT -= dt; const on = (w.jingleT * 2) % 1 < WPN.JINGLE_DUTY;
      R.cars.forEach((o, j) => {
        if (o === c || !live(o) || Math.hypot(o.x - c.x, o.z - c.z) > w.jingleR || !touch(w.jingled, o, j)) return;
        const e = w.jingled.find(x => x.k === j); if (!e.hit) { e.hit = 1; o.events.push({ t: 'jingle-hit', from: k }); }
        if (on) o.stallT = Math.max(o.stallT || 0, 1 / 30);
      });
    }
  }
  // wet cement: drags anyone in it
  S.cement = S.cement.filter(o => {
    o.t += dt;
    for (const c of R.cars) {
      if (!live(c) || !c.onGround || (idx(R, c) === o.from && o.t < 2) || Math.abs(c.progress - o.s) > WPN.CEMENT_R || Math.abs(onRoad(tr, c) - o.lat) > WPN.CEMENT_R) continue;
      if (!(c.cementT > 0)) { if (shielded(c)) continue; c.events.push({ t: 'cement-hit', from: o.from }); }
      c.cementT = 0.6; c.vx *= 1 - WPN.CEMENT_DRAG * dt; c.vz *= 1 - WPN.CEMENT_DRAG * dt;
    }
    return o.t < WPN.CEMENT_LIFE;
  });
  for (const c of R.cars) if (c.cementT > 0) c.cementT -= dt;
  // stinger: a strip right across the road; the first few cars over it are punctured
  S.strips = S.strips.filter(o => {
    o.t += dt;
    R.cars.forEach((c, j) => {
      if (!live(c) || j === o.from || o.left <= 0 || o.hit.includes(j) || !c.onGround || Math.abs(c.progress - o.s) > c.hl + 0.8) return;
      o.hit.push(j); if (shielded(c)) return; o.left--;
      c.vx *= WPN.STINGER_SCRUB; c.vz *= WPN.STINGER_SCRUB; c.spin += (S.rng() < 0.5 ? -1 : 1) * 1.6; c.oilT = Math.max(c.oilT || 0, 0.8);
      damageCar(c, c.x, c.z, WPN.STINGER_DMG, 1, 0, 0); c.events.push({ t: 'stinger-hit', from: o.from, x: c.x, y: c.y, z: c.z });
    });
    return o.left > 0 && o.t < WPN.STINGER_LIFE && R.cars.some(c => live(c) && c.progress < o.s + 2);
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
      damageCar(o, c.x + rx * (c.hw + 0.4), c.z + rz * (c.hw + 0.4), WPN.DOOR_DMG, 1, rx, rz);
      w.doorHit = true; o.events.push({ t: 'door-hit', by: idx(R, c), x: c.x + rx * (c.hw + 0.5), y: c.y + 0.6, z: c.z + rz * (c.hw + 0.5) }); break;
    }
  }
}
// the AI: use what it's holding when it would do some good, swing a door at whoever's alongside; keener drivers more
function aiWeapons(R, W, dt) {
  const rng = R.wpn.rng;
  for (const c of R.cars) {
    if ((c.isPlayer && !R.autoPlayer) || c.hold || !live(c)) continue;
    const keen = 0.6 + (c.ai.flick || 0.3), w = c.wpn;
    if (w.item && !(w.gunT > 0) && rng() < dt * 0.8 * keen) {
      const ahead = missileTarget(R, c), gap = ahead >= 0 ? R.cars[ahead].progress - c.progress : 999;
      const behind = R.cars.some(o => o !== c && live(o) && c.progress - o.progress > 3 && c.progress - o.progress < 30);
      const near = R.cars.filter(o => o !== c && live(o) && Math.hypot(o.x - c.x, o.z - c.z) < WPN.PULSE_R * 0.7).length;
      const close = R.cars.filter(o => o !== c && live(o) && Math.hypot(o.x - c.x, o.z - c.z) < 7).length;
      const inJet = R.cars.some(o => o !== c && live(o) && (a => a.d < WPN.WATER_R * 0.85 && a.ang < WPN.WATER_CONE * 0.8)(aim(c, o)));
      const heard = R.cars.filter(o => o !== c && live(o) && Math.hypot(o.x - c.x, o.z - c.z) < WPN.JINGLE_R * 0.8).length;
      const want = { missile: gap > 20, gun: gap < 45, harpoon: gap > 12 && gap < WPN.HARP_R, oil: behind, pulse: near >= 1,
        water: inJet, cement: behind, stinger: behind, crush: close >= 1 && c.onGround, jingle: heard >= 2 }[w.item];
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
    R.wpn = { rng: mulberry32(R.cars.length * 104729 + 3), next: 0, crates: [], bullets: [], slicks: [], hooks: [], cement: [], strips: [] };
    R.cars.forEach((c, k) => {
      const load = c.def.wpn || null;   // levels and gear (data/weapons.js); the signature weapon comes with the vehicle
      c.wpn = { item: null, uses: 0, gunT: 0, gunAcc: 0, doorT: 0, doorSide: 0, doorCool: 0, crateT: 1.5 + k * 0.4,
        load, gear: (load && load.gear) || null, sig: SIGNATURES[c.def.vehicle || c.def.model] || null, flareT: 0, shieldT: 0, shieldOn: 0, soaked: [], jingled: [] };
    });
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
    flyMissiles(R, W, dt); guns(R, W, dt); slicks(R, W, dt); hooks(R, W, dt); signatures(R, W, dt); doors(R, dt);
  }
};
