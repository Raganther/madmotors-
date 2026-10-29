import { HALF } from '../constants.js';
import { clamp, mulberry32, wrapAngle } from '../math.js';
import { carWear, damageCar } from '../sim/damage.js';
import { SIGNATURES, WEAPONS, levelOf } from '../../data/weapons.js';
import { BREAKABLES } from '../../data/breakables.js';
import { blastStructures, solidAt as wallAt } from './structures.js';
import { splashLevelOf } from '../elements/mud.js';

// ---------- weapons (menu: Weapons on/off; R.weapons) ----------
// Weapon crates lie on the road; drive through one with nothing in hand and you get a weapon, which one depending on
// where you are in the race (the back of the pack gets the catch-up weapons, the front the defensive ones). Five:
//   missile  holding one builds a lock on the car ahead (WPN.LOCK_T s with it in your sights; it keeps the car it has
//            while that car stays roughly ahead). Fired locked, it flies along the road's line and steers across onto
//            that car; fired before the lock, it flies straight down the road at whoever's in the way. A hit throws the
//            car up spinning, kills most of its speed and dents it
//   gun      a WPN.GUN_T s burst of tracer rounds straight ahead, aimed by pointing the car (a laser sight shows where);
//            each hit knocks the car sideways off its line, twists it and costs a little speed
//   oil      two drums dropped off the back, one at a time: each tumbles down the road, bounces and bursts into a slick
//            (anyone driving over one loses grip for a moment; it wears away after WPN.OIL_HITS cars); a drum that lands
//            on a car bursts all over it: a long slide, and the car comes out black (render: dirt.js); a blast near
//            a slick (a missile, a shell, a mine) sets it alight: FIRE_T s of flames that scorch whoever drives through
//   pulse    a shockwave: everyone within WPN.PULSE_R m is blown away from you and their engine cuts out briefly
//   harpoon  hooks the car ahead (within WPN.HARP_R m); for WPN.TOW_T s the line reels you in and holds them back
//            (their engine can't drive against it)
//   mine     two proximity mines thrown off the back, one at a time: each tumbles and bounces down the road (going off
//            against any car it hits on the way), settles, arms MINE_ARM s later, and then the first car within MINE_TRIG
//            m sets it off; everything within MINE_BLAST m is thrown up and slowed
// Blasts reach the scenery too (blastScenery): a missile that hits or runs out, a mine, a mortar shell, a shockwave and a crush landing
// break fences, crates and walls near them and crack or bring down buildings (core/features/structures.js), and shove
// rubble about. A missile that flies into a building or a breakable goes off there.
//   mortar   a shell lobbed high up the road: it lands MORTAR_FLIGHT s later where the car ahead will be (or MORTAR_AHEAD
//            m up the road), with a ring on the road showing where; the blast throws, slows and dents everyone within
//            MORTAR_R m and leaves a crater in the road. Craters (missiles that miss leave small ones too) are real holes
//            (features/dents.js; deeper in a jump's ramp) and stay for CRATER_LIFE s: a car driving into one drops in,
//            is jolted up over the lip, scrubbed and knocked off its line.
// Crates are placed for everyone, not just the leader: each racer gets one offered 60-100 m up the road on its own
// timer (quicker the further back it is), and a crate nobody can reach any more is cleared away.
// Door bash (Road Rash with doors), always there: one button, the door on the side with a car beside you swings open;
// the car is shoved off its line and dented a little, and you're nudged the other way.
// Defence: a second slot beside the weapon (c.wpn.def), filled from the blue crates (DEF_CRATE of them), used with its
// own button (inp.defend: G), one at a time:
//   flares   FLARE_ON s of decoys: a missile homing on you goes for them instead, and nobody can lock on meanwhile.
//            Fire them on the lock warning: too early and they've burnt out before the missile comes
//   shield   a bubble for SHIELD_ON s: missiles, rounds, blasts, slicks, hooks and the rest glance off (shielded)
//   smoke    a cloud laid behind you for SMOKE_T s: a car in it can't lock on (nor be locked on), a missile homing on a
//            car in it loses that car, and it drags a little on whoever drives through
//   repair   the car mended on the spot (every dent and panel)
// Levels, gear and signature weapons (F6, data/weapons.js): a car's def can carry `wpn: { lv, gear }`. A weapon's level
// swaps some of WPN's numbers for its own (WEAPONS[it].fx: a longer burst, a wider slick, twin missiles, glue); gear
// flares or a shield means the car starts with that in its defence slot and gets it back FLARE_COOL / SHIELD_COOL s
// after using it (when the slot's empty); a magnet pulls crates in. Five vehicles find their own signature weapon in
// crates too:
//   water    fire engine: a jet ahead for WATER_T s that shoves cars aside and leaves them sliding
//   cement   mixer: a trail of wet cement behind for CEMENT_T s; a car in it bogs down
//   stinger  police: a spike strip across the road behind; the first STINGER_HITS cars over it lose speed and spin
//   crush    monster truck: a leap; landing within CRUSH_R m of a car slams it (damage, speed, a stall)
//   jingle   ice cream van: JINGLE_T s of chimes; every car within JINGLE_R m stutters (its engine cuts in and out)
// The AI uses all of it, the keener drivers more. Deterministic, with its own seeded generator, never R.rnd, so the race
// features' random sequence is untouched; and with weapons off nothing here runs at all.
export const WPN = { RANGE: 110, SPEED: 20, VMIN: 44, LIFE: 3.6, TURN: 3.6, HIT_S: 2.4, HIT_LAT: 1.9, ARM: 0.12, SLOW: 0.35, POP: 6, SPIN: 5,
  DOOR_T: 0.45, DOOR_COOL: 2.5, SHOVE: 6, KICK: 1.2, REACH: 4.2, DOOR_SCRUB: 0.92,
  CRATE_EVERY: 5.5, CRATE_AHEAD: [60, 100], CRATE_R: 1.9, CRATE_LIFE: 40,
  GUN_T: 3, GUN_RATE: 14, GUN_SWING: 0.26, GUN_SCATTER: 0.05, BULLET_V: 95, BULLET_LIFE: 0.9, BULLET_SLOW: 0.945, BULLET_PUSH: 1.4, BULLET_SPIN: 0.6, OIL_R: 2.8, OIL_T: 1.4, OIL_SPIN: 2.6, OIL_SCRUB: 0.85, OIL_LIFE: 16, OIL_HITS: 3,
  FIRE_T: 4, FIRE_DMG: 5, FIRE_REACH: 4, DRUM_G: 22, DRUM_UP: 2.6, DRUM_FWD: 0.55, DRUM_BOUNCE: 0.42, DRUM_FUSE: 1.4, DRUM_HIT: 0.75, DRUM_OIL: 1.6,
  PULSE_R: 13, PULSE_V: 8, STALL: 1.1, HARP_R: 70, HARP_V: 70, TOW_T: 2.2, TOW_PULL: 16, TOW_DRAG: 3.5,
  MISSILE_DMG: 7.5, LOCK_T: 1.1, LOCK_KEEP: 1.25, BULLET_DMG: 2.3, DOOR_DMG: 5.5, TURN2: 1.6, TWIN: 0, GLUE: 0,
  WATER_T: 2.5, WATER_R: 22, WATER_CONE: 0.45, WATER_PUSH: 22, WATER_SCRUB: 1.2, WATER_SLIP: 0.35,
  CEMENT_T: 1.6, CEMENT_EVERY: 0.22, CEMENT_R: 2.4, CEMENT_LIFE: 14, CEMENT_DRAG: 0.45,
  STINGER_HITS: 2, STINGER_LIFE: 20, STINGER_SCRUB: 0.5, STINGER_DMG: 4, STINGER_SLIP: 1.4,
  CRUSH_V: 7.5, CRUSH_R: 7, CRUSH_DMG: 6.5, CRUSH_SCRUB: 0.6,
  JINGLE_T: 2.5, JINGLE_R: 22, JINGLE_DUTY: 0.33,
  MORTAR_R: 5.5, MORTAR_FLIGHT: 1.7, MORTAR_RANGE: 130, MORTAR_AHEAD: 60, MORTAR_DMG: 4, MORTAR_POP: 5, MORTAR_PUSH: 7, MORTAR_SCRUB: 0.55, SHELLS: 1, SHELL_GAP: 0.3,
  CRATER_R: 3.1, CRATER_DEEP: 0.15, CRATER_JUMP: 1.5, CRATER_LIFE: 60, CRATER_MAX: 14, CRATER_HOP: 1.3, CRATER_SCRUB: 0.96, CRATER_SPIN: 0.8, CRATER_KICK: 1.5, FIZZLE_CRATER: 1.7,
  FLARE_COOL: 20, SHIELD_COOL: 18, FLARE_ON: 1.6, SHIELD_ON: 3, MAGNET: 2.4, SIG_ODDS: 1.5, DEF_CRATE: 0.33,
  SMOKE_T: 1.8, SMOKE_EVERY: 0.2, SMOKE_R: 4.5, SMOKE_LIFE: 6, SMOKE_DRAG: 0.3,
  MINE_ARM: 0.8, MINE_FWD: 0.5, MINE_UP: 3.4, MINE_BOUNCE: 0.4, MINE_GRIP: 3.5, MINE_TRIG: 3, MINE_BLAST: 5, MINE_DMG: 6.5, MINE_POP: 6.5, MINE_SLOW: 0.42, MINE_LIFE: 40,
  BLAST_MISSILE: [5, 48], BLAST_MINE: [5, 40], BLAST_MORTAR: [6, 50], BLAST_PULSE: 26, BLAST_CRUSH: 36 };   // scenery blasts: [radius m, power (as a car's impact)]
export const ITEMS = ['missile', 'gun', 'oil', 'pulse', 'harpoon', 'water', 'cement', 'stinger', 'crush', 'jingle', 'mortar', 'mine'];
export const ITEM_USES = { missile: 1, gun: 1, oil: 2, pulse: 1, harpoon: 1, water: 1, cement: 1, stinger: 2, crush: 1, jingle: 1, mortar: 1, mine: 2 };
export const SIG_ITEMS = ITEMS.filter(it => WEAPONS[it].sig);
/** The defence slot's items (blue crates), and what each gear piece starts you with. */
export const DEFENCE = ['flares', 'shield', 'smoke', 'repair'];
const GEAR_DEF = { flares: 'flares', shield: 'shield' };
/** Weapon number k for car c's item it: its level's (data/weapons.js) or WPN's. */
export const wv = (c, it, k) => { const f = WEAPONS[it].fx[levelOf(c.wpn && c.wpn.load, it) - 1]; return f[k] !== undefined ? f[k] : WPN[k]; };
// pick-up odds by race position r (0 = leading, 1 = last): the back gets missiles and harpoons, the front oil and pulses
const ODDS = { missile: r => 0.5 + 1.5 * r, gun: () => 1, oil: r => 1.5 - r, pulse: r => 1.1 - 0.4 * r, harpoon: r => 0.15 + 1.6 * r, mortar: r => 0.35 + 1.1 * r, mine: r => 1.1 - 0.6 * r };
// and a blue crate's: the front (the one being shot at) gets flares and smoke, a battered car the repair kit
const DEF_ODDS = { flares: r => 1.3 - 0.6 * r, shield: () => 1, smoke: r => 1.3 - 0.7 * r, repair: (r, wear) => 0.4 + 3 * wear };

const along = (c, o) => (o.x - c.x) * Math.sin(c.yaw) + (o.z - c.z) * Math.cos(c.yaw);
const across = (c, o) => -(o.x - c.x) * Math.cos(c.yaw) + (o.z - c.z) * Math.sin(c.yaw);   // + = the car's right (core rx, rz)
const live = c => !(c.wreckT > 0) && !(c.ghost > 0) && !c.finished;
const idx = (R, c) => R.cars.indexOf(c);
/** Does car c's shield take this hit? (the bubble's up: SHIELD_ON s from using it) */
const shielded = c => !!(c.wpn && c.wpn.shieldOn > 0);
/** Is car c in a smoke cloud? */
const inSmoke = (R, c) => R.wpn.clouds.some(k => Math.abs(c.y - k.y) < 4 && Math.hypot(c.x - k.x, c.z - k.z) < k.r);
/** Can't c see o for a lock? Flares burning on o, o pouring smoke, or smoke round either. */
const blinded = (R, c, o) => !!o && (o.wpn.flareOn > 0 || o.wpn.smokeT > 0 || inSmoke(R, o) || inSmoke(R, c));
/** A blast at (x, z): breakables (data/breakables.js) within r m break if `power` (falling off with distance) beats
 *  their hp, whatever their minimum mass; buildings' walls break or crack (blastStructures); loose rubble and blocks
 *  are thrown outwards. `by` (a car index, or -1) gets the credit. Returns what broke. */
export function blastScenery(R, x, z, r, power, by) {
  let n = blastStructures(R, x, z, r, power, by);
  for (const o of R.brk || []) {
    if (o.broken) continue; const K = BREAKABLES[o.kind]; if (!(K.hp < Infinity)) continue;
    const d = Math.max(0, Math.hypot(o.x - x, o.z - z) - Math.max(o.hl, o.hw) * 0.5); if (d > r) continue;
    if (power * (1 - d / r) < K.hp) continue;
    o.broken = true; o.by = by; n++;
    const dx = (o.x - x) / (Math.hypot(o.x - x, o.z - z) || 1), dz = (o.z - z) / (Math.hypot(o.x - x, o.z - z) || 1);
    for (let k = 0; k < (K.chunks || 0); k++) R.chunks.push({ x: o.x + Math.sin(o.yaw) * (k - 1) * K.w / 3, z: o.z + Math.cos(o.yaw) * (k - 1) * K.w / 3, y: o.y + 0.4, vx: dx * 7, vz: dz * 7, vy: 3, age: 0, hint: R.player.pr.i, spin: 1, a: 0 });
    if (by >= 0) R.cars[by].events.push({ t: 'break', id: o.id, kind: o.kind, x: o.x, y: o.y, z: o.z, nx: -dx, nz: -dz, v: 12, blast: true });
  }
  const shove = q => { const dx = q.x - x, dz = q.z - z, d = Math.hypot(dx, dz); if (d > r * 1.4) return; const f = 9 * (1 - d / (r * 1.4)); q.vx += dx / (d || 1) * f; q.vz += dz / (d || 1) * f; q.vy = Math.max(q.vy || 0, 2 + f * 0.4); };
  for (const q of R.chunks || []) shove(q);
  if (R.st) for (const q of R.st.lumps) shove(q);   // (furniture: blastStructures)
  return n;
}
/** Does a point at (x, y, z) stand in an unbroken wall or breakable (a missile flying into it)? */
function solidAt(R, x, y, z) {
  if (wallAt(R, x, y, z)) return true;
  for (const o of R.brk || []) {
    if (o.broken || y > o.y + 2.5) continue; const dx = x - o.x, dz = z - o.z, a = dx * Math.sin(o.yaw) + dz * Math.cos(o.yaw), b = dx * Math.cos(o.yaw) - dz * Math.sin(o.yaw);
    if (Math.abs(a) < o.hl + 0.3 && Math.abs(b) < o.hw + 0.3) return true;
  }
  return false;
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
/** The odds of each of ITEMS out of a crate for car c: the standard weapons by race position, its own signature weapon if it has one. */
export function pickupOdds(R, c) {
  const rr = rankOf(R, c), bias = (c.def.wpn && c.def.wpn.bias) || {};
  return ITEMS.map(it => (WEAPONS[it].sig ? (it === c.wpn.sig ? WPN.SIG_ODDS : 0) : ODDS[it](rr)) * (bias[it] ?? 1));
}
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
    S.crates.push({ id: S.next++, s, lat: (rng() * 2 - 1) * (HALF - 2.2), t: 0, def: rng() < WPN.DEF_CRATE });   // def: a blue crate (defence)
  }
  S.crates = S.crates.filter(k => {
    k.t += dt; if (k.t > WPN.CRATE_LIFE || R.cars.every(c => !live(c) || c.progress > k.s + 6)) return false;
    for (const c of R.cars) {
      const reach = c.wpn.gear === 'magnet' ? WPN.MAGNET : 1;
      if (!live(c) || (k.def ? c.wpn.def : c.wpn.item) || Math.abs(c.progress - k.s) > WPN.CRATE_R * reach || Math.abs(onRoad(tr, c) - k.lat) > (WPN.CRATE_R + 0.4) * reach) continue;
      if (k.def) {   // a blue crate: something for the defence slot
        const r = rankOf(R, c), wear = carWear(c), odds = DEFENCE.map(d => DEF_ODDS[d](r, wear)), sum = odds.reduce((x, y) => x + y, 0);
        let pick = rng() * sum, def = DEFENCE[0]; for (let q = 0; q < DEFENCE.length; q++) { pick -= odds[q]; if (pick <= 0) { def = DEFENCE[q]; break; } }
        c.wpn.def = def; c.events.push({ t: 'pickup', def, x: c.x, y: c.y, z: c.z, crate: k.id });
        return false;
      }
      // the five standard weapons by race position, and the car's own signature weapon if it has one
      const odds = pickupOdds(R, c), sum = odds.reduce((x, y) => x + y, 0);
      let pick = rng() * sum, item = ITEMS[0]; for (let q = 0; q < ITEMS.length; q++) { if (!odds[q]) continue; pick -= odds[q]; if (pick <= 0) { item = ITEMS[q]; break; } }
      c.wpn.item = item; c.wpn.uses = ITEM_USES[item]; c.events.push({ t: 'pickup', item, x: c.x, y: c.y, z: c.z, crate: k.id });
      return false;
    }
    return true;
  });
}
// ----- the missile's lock: the car in your sights, held there for LOCK_T s -----
/** Can car c keep its lock on o? Still racing, ahead within a little past range, and not far off to one side. */
function lockable(c, o) {
  if (!o || o === c || !live(o)) return false;
  const d = o.progress - c.progress; return d > 2 && d < WPN.RANGE * WPN.LOCK_KEEP && Math.abs(o.y - c.y) < 7 && Math.abs(across(c, o)) < 8 + d * 0.45;
}
function locking(R, W, dt) {
  R.cars.forEach((c, k) => {
    const w = c.wpn; if (w.item !== 'missile' || !live(c)) { w.lockTgt = -1; w.lockK = 0; return; }
    if (!lockable(c, R.cars[w.lockTgt])) { const t = missileTarget(R, c); if (t !== w.lockTgt) { w.lockTgt = t; w.lockK = 0; } }   // a new car in the sights starts again
    if (w.lockTgt < 0 || blinded(R, c, R.cars[w.lockTgt])) { w.lockK = 0; return; }   // flares burning, or smoke between: no lock
    const was = w.lockK; w.lockK = Math.min(1, w.lockK + dt / wv(c, 'missile', 'LOCK_T'));
    if (was < 1 && w.lockK >= 1) { c.events.push({ t: 'locked', tgt: w.lockTgt }); R.cars[w.lockTgt].events.push({ t: 'locked-on', from: k }); }
  });
}
/** Car c's locked target (index), or -1 when the lock isn't complete. */
export const lockedOn = (R, c) => c.wpn && c.wpn.lockK >= 1 && lockable(c, R.cars[c.wpn.lockTgt]) && !blinded(R, c, R.cars[c.wpn.lockTgt]) ? c.wpn.lockTgt : -1;
// ----- using a weapon -----
function use(R, W, c) {
  const w = c.wpn, it = w.item, k = idx(R, c), tr = W.tr, sp = Math.hypot(c.vx, c.vz);
  if (it === 'missile') {
    const t = lockedOn(R, c), turn = wv(c, it, 'TURN'), fire = (tg, lat) => {   // locked: it homes; not yet: straight down the road
      R.missiles.push({ id: R.wpn.next++, from: k, tgt: tg, s: c.progress + 2.5, lat, v: Math.max(WPN.VMIN, sp + WPN.SPEED), t: 0, turn });
      if (tg >= 0) R.cars[tg].events.push({ t: 'missile-lock', from: k });
    };
    if (wv(c, it, 'TWIN')) { const t2 = t >= 0 ? secondTarget(R, c, t) : -1; fire(t, onRoad(tr, c) - 1.2); fire(t2 >= 0 ? t2 : t, onRoad(tr, c) + 1.2); }   // twin: one each at the two cars ahead
    else fire(t, onRoad(tr, c));
    w.lockK = 0;
  } else if (it === 'gun') { w.gunT = wv(c, it, 'GUN_T'); w.gunAcc = 0; }
  else if (it === 'oil') {   // a drum off the back: rolling on down the road at about half the car's speed, tossed up a little
    const fv = (c.vx * Math.sin(c.yaw) + c.vz * Math.cos(c.yaw)) * WPN.DRUM_FWD;
    R.wpn.drums.push({ id: R.wpn.next++, s: c.progress - c.hl - 0.8, lat: onRoad(tr, c), y: c.y + 1.2, vs: fv, vl: (R.wpn.rng() - 0.5) * 2, vy: WPN.DRUM_UP, t: 0, n: 0, from: k, r: wv(c, it, 'OIL_R'), glue: wv(c, it, 'GLUE') });
  }
  else if (it === 'pulse') {
    const PR = wv(c, it, 'PULSE_R'); w.pulseR = PR;
    for (const o of R.cars) {
      if (o === c || !live(o) || Math.abs(o.y - c.y) > 3) continue;
      const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz); if (d > PR || shielded(o)) continue;
      const f = WPN.PULSE_V * (1 - d / PR * 0.6); o.vx += dx / (d || 1) * f; o.vz += dz / (d || 1) * f; o.stallT = WPN.STALL; o.spin += (R.wpn.rng() - 0.5) * 2;
      o.events.push({ t: 'pulse-hit', from: k });
    }
    blastScenery(R, c.x, c.z, PR * 0.7, WPN.BLAST_PULSE, k);
  } else if (it === 'harpoon') {
    const t = missileTarget(R, c, WPN.HARP_R);
    R.wpn.hooks.push({ id: R.wpn.next++, from: k, to: t, s: c.progress + 2, lat: onRoad(tr, c), t: 0, tow: 0, towT: wv(c, it, 'TOW_T') });
  }
  else if (it === 'mortar') { const n = wv(c, it, 'SHELLS'), r = wv(c, it, 'MORTAR_R'); for (let q = 0; q < n; q++) R.wpn.shells.push({ id: R.wpn.next++, from: k, wait: q * WPN.SHELL_GAP, t: 0, r, ...aimShell(R, W, c, q, n) }); }
  else if (it === 'water') { w.waterT = wv(c, it, 'WATER_T'); w.soaked = []; }
  else if (it === 'cement') { w.cementT = wv(c, it, 'CEMENT_T'); w.cementAcc = 1; }
  else if (it === 'stinger') R.wpn.strips.push({ id: R.wpn.next++, s: c.progress - c.hl - 3, t: 0, from: k, left: wv(c, it, 'STINGER_HITS'), hit: [] });
  else if (it === 'crush') { c.vy = WPN.CRUSH_V; c.onGround = false; c.airT = 0; w.crushT = 2; w.crushR = wv(c, it, 'CRUSH_R'); w.crushUp = 0.15; }
  else if (it === 'jingle') { w.jingleT = WPN.JINGLE_T; w.jingleR = wv(c, it, 'JINGLE_R'); w.jingled = []; }
  else if (it === 'mine') {   // launched off the back like a drum: it tumbles and bounces down the road before it settles and arms
    const fv = (c.vx * Math.sin(c.yaw) + c.vz * Math.cos(c.yaw)) * WPN.MINE_FWD, s = c.progress - c.hl - 0.8, lat = onRoad(tr, c), p = roadPos(tr, s, lat, 0);
    R.wpn.mines.push({ id: R.wpn.next++, s, lat, x: p.x, y: c.y + 1.1, z: p.z, vs: fv, vl: (R.wpn.rng() - 0.5) * 2.6, vy: WPN.MINE_UP, n: 0, t: 0, from: k, blast: wv(c, it, 'MINE_BLAST'), dmg: wv(c, it, 'MINE_DMG') });
  }
  c.events.push({ t: 'use', item: it, lv: levelOf(w.load, it) });
  if (--w.uses <= 0) { w.item = null; w.uses = 0; }
}
// ----- defence (the second slot) -----
function defend(R, W, c) {
  const w = c.wpn, it = w.def, k = idx(R, c);
  if (it === 'flares') w.flareOn = WPN.FLARE_ON;                                  // (flyMissiles draws off whatever's homing on c)
  else if (it === 'shield') w.shieldOn = WPN.SHIELD_ON;
  else if (it === 'smoke') { w.smokeT = WPN.SMOKE_T; w.smokeAcc = 1; }
  else if (it === 'repair') { c.dmg = { f: 0, b: 0, l: 0, r: 0 }; c.panels = {}; c.hitT = 0; c.events.push({ t: 'repair' }); }
  c.events.push({ t: 'defend', item: it, k, x: c.x, y: c.y, z: c.z });
  w.def = null;
}
// a missile homing on T loses it: flares draw it off to the side away from the car, for good (it may still hit
// another); in smoke it just flies on blind down the road
function decoy(R, W, m, T, flares) {
  if (flares) { m.spare = m.tgt; m.decoy = m.lat >= onRoad(W.tr, T) ? 1 : -1; }
  m.tgt = -1; T.events.push({ t: 'decoyed', from: m.from, flares, x: T.x, y: T.y, z: T.z });
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
  blastScenery(R, p.x, p.z, WPN.BLAST_MISSILE[0], WPN.BLAST_MISSILE[1], m.from); ignite(R, W, p.x, p.z, WPN.BLAST_MISSILE[0]);
}
function flyMissiles(R, W, dt) {
  const tr = W.tr;
  for (const m of R.missiles) {
    m.t += dt; m.s += m.v * dt;
    const T = m.tgt >= 0 ? R.cars[m.tgt] : null;
    if (T && (T.wpn.flareOn > 0 || T.wpn.smokeT > 0 || inSmoke(R, T))) decoy(R, W, m, T, T.wpn.flareOn > 0);
    else if (T && live(T)) m.lat += clamp(onRoad(tr, T) - m.lat, -(m.turn || WPN.TURN) * dt, (m.turn || WPN.TURN) * dt);   // home in across the road
    else if (m.decoy) m.lat += WPN.TURN2 * dt * m.decoy;                                // after the flares: off the road, away from the car it was after
    if (m.t < WPN.ARM) continue;
    for (const c of R.cars) {                                                    // anyone in its path, not only the target
      if (idx(R, c) === m.from || idx(R, c) === m.spare || !live(c)) continue;
      if (Math.abs(c.progress - m.s) < WPN.HIT_S && Math.abs(onRoad(tr, c) - m.lat) < WPN.HIT_LAT + c.hw * 0.5) { hitByMissile(R, W, m, c); m.dead = true; break; }
    }
    if (!m.dead && (m.t > WPN.LIFE || m.s > tr.xs.length - 3 || solidAt(R, ...Object.values(missilePos(tr, m)).slice(0, 3)))) {   // ran out, or flew into something: it goes off there
      m.dead = true; const p = missilePos(tr, m); R.cars[m.from].events.push({ t: 'missile-fizzle', ...p, boom: true });
      blastScenery(R, p.x, p.z, WPN.BLAST_MISSILE[0], WPN.BLAST_MISSILE[1], m.from); if (Math.abs(m.lat) < HALF) addCrater(R, W, m.s, m.lat, WPN.FIZZLE_CRATER); ignite(R, W, p.x, p.z, WPN.BLAST_MISSILE[0]);   // into the road: a small crater
    }
  }
  R.missiles = R.missiles.filter(m => !m.dead);
}
// machine gun: rounds fly dead straight from the gun on the roof, the way the car is pointing (no lock, no auto-aim: the
// player points the car, and the laser sight shows where; render/weapons.js), tipped to follow the road's climb, with a
// little scatter. The AI can't aim by steering, so its gun swings a few degrees at whoever's ahead. Each hit knocks
// the car sideways off its line and twists it (more the further off its middle it lands) and chips speed off. A round
// that misses carries on off the road. w.aimYaw / w.aimVy: where the gun points now (the laser).
export const gunAim = (R, W, c) => {
  const tr = W.tr, i = clamp(c.pr ? c.pr.i : 0, 0, tr.xs.length - 12), j = i + 10, run = Math.hypot(tr.xs[j] - tr.xs[i], tr.zs[j] - tr.zs[i]) || 1;
  let yaw = c.yaw, vy = clamp((tr.H[j] - tr.H[i]) / run, -0.3, 0.3) * WPN.BULLET_V;
  if (!c.isPlayer || R.autoPlayer) {
    const t = missileTarget(R, c, 90), T = t >= 0 ? R.cars[t] : null;
    if (T) {   // swung at the target (and tipped up or down to its height)
      const d = Math.hypot(T.x - c.x, T.z - c.z), lead = d / WPN.BULLET_V; yaw += clamp(wrapAngle(Math.atan2(T.x + T.vx * lead - c.x, T.z + T.vz * lead - c.z) - c.yaw), -WPN.GUN_SWING, WPN.GUN_SWING);
      vy = clamp((T.y - c.y - 0.5) / Math.max(0.05, lead), -12, 12);
    }
  }
  return { yaw, vy };
};
function guns(R, W, dt) {
  const S = R.wpn;
  for (const c of R.cars) {
    const w = c.wpn; if (!(w.gunT > 0) && w.item !== 'gun') continue;
    const aim = gunAim(R, W, c); w.aimYaw = aim.yaw; w.aimVy = aim.vy;
    if (!(w.gunT > 0)) continue;
    w.gunT -= dt; w.gunAcc += dt * WPN.GUN_RATE;
    while (w.gunAcc >= 1) {
      w.gunAcc -= 1; const yaw = aim.yaw + (S.rng() - 0.5) * WPN.GUN_SCATTER;
      const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), dx = Math.sin(yaw), dz = Math.cos(yaw);
      S.bullets.push({ id: S.next++, from: idx(R, c), x: c.x + fx * (c.hl + 0.6), y: c.y + 1.3, z: c.z + fz * (c.hl + 0.6), vx: c.vx + dx * WPN.BULLET_V, vy: aim.vy, vz: c.vz + dz * WPN.BULLET_V, t: 0 });
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
      const L = Math.sqrt(L2), ux = sx / L, uz = sz / L, off = (c.x - px) * uz - (c.z - pz) * ux;   // off: which side of the car's middle the round passes
      // knocked sideways, off its line (a round from behind would only shove it on): the round's sideways part, or away from the side it struck
      const rx = Math.cos(c.yaw), rz = -Math.sin(c.yaw), side = ux * rx + uz * rz, k = Math.abs(side) > 0.35 ? Math.sign(side) : (off >= 0 ? -1 : 1);
      c.vx = c.vx * WPN.BULLET_SLOW + rx * k * WPN.BULLET_PUSH; c.vz = c.vz * WPN.BULLET_SLOW + rz * k * WPN.BULLET_PUSH; c.spin += clamp(off, -1, 1) * WPN.BULLET_SPIN;
      damageCar(c, px, pz, WPN.BULLET_DMG, 1, 0, 0);
      c.events.push({ t: 'bullet-hit', x: px, y: c.y, z: pz, from: b.from, dx: ux, dz: uz, i: c.pr.i }); return false;
    }
    return b.t < WPN.BULLET_LIFE;
  });
}
function slicks(R, W, dt) {
  const S = R.wpn, tr = W.tr;
  S.slicks = S.slicks.filter(o => {
    o.t += dt;
    if (o.fire > 0) {   // on fire: a scorch for whoever drives through, then it's burnt away
      o.fire -= dt; const r = o.r || WPN.OIL_R;
      R.cars.forEach((c, j) => { if (!live(c) || o.burnt.includes(j) || Math.abs(c.progress - o.s) > r || Math.abs(onRoad(tr, c) - o.lat) > r) return; o.burnt.push(j); if (shielded(c)) return; damageCar(c, c.x, c.z, WPN.FIRE_DMG, 1, 0, 0); c.events.push({ t: 'fire-hit', from: o.from, x: c.x, y: c.y, z: c.z }); });
      return o.fire > 0;
    }
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
        c.oilT = Math.max(c.oilT || 0, WPN.OIL_T);   // (never cut short a drum's dousing)
      }
    }
    return o.t < WPN.OIL_LIFE && !(o.hits >= WPN.OIL_HITS);                       // tyres carry it away: gone after a few cars
  });
}
// oil drums: tumbling down the road in road terms (s along, lat across, y up), bouncing twice and bursting into a
// slick where they stop, or when their fuse runs out, or all over a car they land on
function drums(R, W, dt) {
  const S = R.wpn, tr = W.tr;
  S.drums = S.drums.filter(o => {
    o.t += dt; o.s += o.vs * dt; o.lat += o.vl * dt; o.vy -= WPN.DRUM_G * dt; o.y += o.vy * dt;
    if (Math.abs(o.lat) > HALF - 0.6) { o.lat = Math.sign(o.lat) * (HALF - 0.6); o.vl = -o.vl * 0.5; }   // off the barrier
    const ground = roadPos(tr, o.s, o.lat, 0).y;
    let burst = null;
    for (const c of R.cars) {                                                     // landing on (or hit by) a car
      if (!live(c) || (idx(R, c) === o.from && o.t < 0.6)) continue;
      if (Math.abs(c.progress - o.s) < c.hl + 0.7 && Math.abs(onRoad(tr, c) - o.lat) < c.hw + 0.7 && Math.abs(c.y + 0.8 - o.y) < 1.8) { burst = c; break; }
    }
    if (burst) {
      if (!shielded(burst)) {
        burst.oilT = WPN.OIL_T * WPN.DRUM_OIL; burst.vx *= WPN.DRUM_HIT * (o.glue || 1); burst.vz *= WPN.DRUM_HIT * (o.glue || 1); burst.spin += (S.rng() < 0.5 ? -1 : 1) * WPN.OIL_SPIN * 1.3;
        burst.events.push({ t: 'drum-hit', from: o.from, x: burst.x, y: burst.y, z: burst.z });
      }
    } else if (o.y <= ground) {
      o.y = ground;
      if (o.vy < -2.5 && o.n < 2) { o.vy = -o.vy * WPN.DRUM_BOUNCE; o.vs *= 0.7; o.vl *= 0.7; o.n++; const p = roadPos(tr, o.s, o.lat, 0); R.cars[o.from].events.push({ t: 'drum-bounce', ...p }); return true; }
      o.vy = 0; o.vs *= Math.exp(-2 * dt); if (o.t < WPN.DRUM_FUSE && Math.abs(o.vs) > 1) return true;
    } else if (o.t < WPN.DRUM_FUSE * 1.5) return true;
    const p = roadPos(tr, o.s, o.lat, 0);                                         // it bursts: the slick spreads from here
    R.cars[o.from].events.push({ t: 'drum-burst', ...p, onCar: !!burst, r: o.r });
    S.slicks.push({ id: S.next++, s: o.s, lat: o.lat, t: 0, from: o.from, r: o.r, glue: o.glue });
    return false;
  });
}
/** Where an oil drum is (x, y, z), for drawing it. */
export const drumPos = (tr, o) => { const p = roadPos(tr, o.s, o.lat, 0); return { x: p.x, y: o.y + 0.5, z: p.z, i: p.i }; };
/** A blast at (x, z) with reach r: any oil slick in it catches fire (burning off: no more slide, a scorch instead). */
function ignite(R, W, x, z, r) {
  if (!R.wpn) return;
  for (const o of R.wpn.slicks) { if (o.fire > 0) continue; const p = roadPos(W.tr, o.s, o.lat, 0); if (Math.hypot(p.x - x, p.z - z) < r + (o.r || WPN.OIL_R) + WPN.FIRE_REACH) { o.fire = WPN.FIRE_T; o.burnt = []; R.cars[o.from].events.push({ t: 'oil-fire', ...p, r: o.r || WPN.OIL_R }); } }
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
// ----- the mortar and its craters -----
/** The car the mortar goes for (index), or -1: the nearest ahead within MORTAR_RANGE, anywhere across the road. */
export function mortarTarget(R, c) {
  let best = -1, bd = WPN.MORTAR_RANGE;
  R.cars.forEach((o, k) => { if (o === c || !live(o)) return; const d = o.progress - c.progress; if (d < 18 || d > bd || Math.abs(o.y - c.y) > 12) return; bd = d; best = k; });
  return best;
}
// where shell q of n lands: where the target will be when it comes down (a barrage walks up the road round it), or up the road
function aimShell(R, W, c, q, n) {
  const tr = W.tr, t = mortarTarget(R, c), T = t >= 0 ? R.cars[t] : null, spread = (q - (n - 1) / 2) * 7;
  const s = clamp(T ? T.progress + Math.hypot(T.vx, T.vz) * WPN.MORTAR_FLIGHT + spread : c.progress + WPN.MORTAR_AHEAD + spread, c.progress + 10, tr.xs.length - 4);
  const lat = clamp(T ? onRoad(tr, T) : onRoad(tr, c), -HALF + 1, HALF - 1);
  return { s, lat, tgt: t, x0: c.x, y0: c.y + 1.6, z0: c.z };
}
// a crater: a real hole in the ground (features/dents.js: groundAt rides it), deeper in the face of a jump (it blows a
// chunk out of the ramp); not in a deck or a tunnel floor. surf: what it's dug in, for its looks (render/craters.js)
function addCrater(R, W, s, lat, r) {
  const tr = W.tr, i = Math.round(s); if (i < 1 || i >= tr.xs.length - 2 || tr.tunnel[i] || (tr.bridge && tr.bridge[i])) return;
  const b = tr.bi(i); if (['gap', 'drawbridge', 'crumble', 'ferry'].some(e => tr[e] && tr[e][b])) return;   // nothing to dig: a drop, a deck, a barge
  const p = roadPos(tr, s, lat, 0), C = R.wpn.craters, m = tr.mud && tr.mud[b];
  const surf = m === 1 ? 'mud' : m === 2 ? 'splash' : tr.ice && tr.ice[b] ? 'ice' : tr.dirt && tr.dirt[b] ? 'gravel' : W.surf;
  C.push({ id: R.wpn.next++, s, lat, x: p.x, y: p.y, z: p.z, r, dep: r * WPN.CRATER_DEEP * (tr.jump[i] ? WPN.CRATER_JUMP : 1), jump: !!tr.jump[i], surf, t: 0, in: [] }); if (C.length > WPN.CRATER_MAX) C.shift();
}
function shells(R, W, dt) {
  const S = R.wpn, tr = W.tr;
  S.shells = S.shells.filter(sh => {
    if (sh.wait > 0) { sh.wait -= dt; return true; }
    sh.t += dt; if (sh.t < WPN.MORTAR_FLIGHT) return true;
    const p = roadPos(tr, sh.s, sh.lat, 0);                                    // down: the blast
    R.cars.forEach((o, j) => {
      if (!live(o) || Math.abs(o.y - p.y) > 4) return;
      const dx = o.x - p.x, dz = o.z - p.z, d = Math.hypot(dx, dz); if (d > sh.r || shielded(o)) return;
      const f = 1 - d / sh.r * 0.7, ux = dx / (d || 1), uz = dz / (d || 1), sc = 1 - (1 - WPN.MORTAR_SCRUB) * f;
      o.vx = o.vx * sc + ux * WPN.MORTAR_PUSH * f; o.vz = o.vz * sc + uz * WPN.MORTAR_PUSH * f; o.vy = WPN.MORTAR_POP * f + 1; o.onGround = false; o.airT = 0;
      o.spin += (S.rng() - 0.5) * 2 * WPN.SPIN * f; o.stallT = Math.max(o.stallT || 0, WPN.STALL * f); o.boost = 0;
      damageCar(o, p.x, p.z, 4 + WPN.MORTAR_DMG * f, 1, 0, 0); o.events.push({ t: 'mortar-hit', from: sh.from, x: o.x, y: o.y, z: o.z, me: j === sh.from });
    });
    const i = Math.round(sh.s), lv = tr.mud && tr.mud[tr.bi(i)] === 2 ? splashLevelOf(tr, i) : null, wet = lv !== null && tr.H[i] < lv - 0.05;   // into a water splash: no fire
    R.cars[sh.from].events.push({ t: 'mortar-blast', x: p.x, y: p.y, z: p.z, r: sh.r, wet: wet ? lv : null }); if (!wet) ignite(R, W, p.x, p.z, sh.r);
    blastScenery(R, p.x, p.z, WPN.BLAST_MORTAR[0] * sh.r / WPN.MORTAR_R, WPN.BLAST_MORTAR[1], sh.from);
    addCrater(R, W, sh.s, sh.lat, WPN.CRATER_R * sh.r / WPN.MORTAR_R);
    return false;
  });
  // the craters: driving into one jolts the car up, scrubs it and kicks it away from the side it caught
  for (const k of S.craters) {
    k.t += dt;
    R.cars.forEach((c, j) => {
      if (!live(c)) return;
      const d = Math.hypot(c.x - k.x, c.z - k.z), was = k.in.includes(j);
      if (d > k.r + 1.5) { if (was) k.in.splice(k.in.indexOf(j), 1); return; }
      if (was || d > k.r + c.hw * 0.4 || !c.onGround || Math.abs(c.y - k.y) > 2) return;
      k.in.push(j);
      const sp = Math.hypot(c.vx, c.vz), q = Math.min(1, sp / 24), side = Math.sign(across(c, k)) || 1, rx = -Math.cos(c.yaw), rz = Math.sin(c.yaw);
      c.vy = Math.max(c.vy, WPN.CRATER_HOP * q * (k.r / WPN.CRATER_R)); c.onGround = false; c.airT = 0;
      c.vx = c.vx * WPN.CRATER_SCRUB - rx * side * WPN.CRATER_KICK * q; c.vz = c.vz * WPN.CRATER_SCRUB - rz * side * WPN.CRATER_KICK * q;
      c.spin += -side * WPN.CRATER_SPIN * q + (S.rng() - 0.5) * 0.6;
      c.events.push({ t: 'crater-hit', x: c.x, y: c.y, z: c.z, v: sp });
    });
  }
  S.craters = S.craters.filter(k => k.t < WPN.CRATER_LIFE);
}
// ----- signature weapons (and the gear's recharge) -----
const aim = (c, o) => { const dx = o.x - c.x, dz = o.z - c.z, d = Math.hypot(dx, dz) || 1; return { d, ux: dx / d, uz: dz / d, ang: Math.abs(wrapAngle(Math.atan2(dx, dz) - c.yaw)) }; };
/** First contact of one use of an area weapon with car o: false if o's shield takes it (it's spared the rest). */
function touch(list, o, k) { const e = list.find(x => x.k === k); if (e) return e.ok; const ok = !shielded(o); list.push({ k, ok }); return ok; }
function signatures(R, W, dt) {
  const S = R.wpn, tr = W.tr;
  for (const c of R.cars) {
    const w = c.wpn, k = idx(R, c);
    if (w.flareOn > 0) w.flareOn -= dt; if (w.shieldOn > 0) w.shieldOn -= dt;
    // gear (flares, shield): the slot fills again COOL s after it's emptied
    const g = GEAR_DEF[w.gear];
    if (g) { if (w.def) w.defT = 0; else if (!(w.defT > 0)) w.defT = g === 'flares' ? WPN.FLARE_COOL : WPN.SHIELD_COOL; else if ((w.defT -= dt) <= 0) { w.def = g; w.defT = 0; c.events.push({ t: 'recharged', item: g }); } }
    // smoke: a puff of cloud laid behind every SMOKE_EVERY s while it pours
    if (w.smokeT > 0) {
      w.smokeT -= dt; w.smokeAcc += dt;
      if (w.smokeAcc >= WPN.SMOKE_EVERY) { w.smokeAcc = 0; const b = c.hl + 2; S.clouds.push({ id: S.next++, x: c.x - Math.sin(c.yaw) * b, y: c.y, z: c.z - Math.cos(c.yaw) * b, r: 0, t: 0, from: k }); }
    }
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
        blastScenery(R, c.x, c.z, w.crushR * 0.6, WPN.BLAST_CRUSH, k);
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
  // smoke clouds: swelling to SMOKE_R, thinning away; a drag on anyone else driving through
  S.clouds = S.clouds.filter(o => { o.t += dt; o.r = WPN.SMOKE_R * Math.min(1, 0.4 + o.t * 0.8) * (o.t > WPN.SMOKE_LIFE - 1 ? WPN.SMOKE_LIFE - o.t : 1); return o.t < WPN.SMOKE_LIFE; });
  for (const [j, c] of R.cars.entries()) {
    if (!live(c) || !S.clouds.some(o => o.from !== j && Math.abs(c.y - o.y) < 4 && Math.hypot(c.x - o.x, c.z - o.z) < o.r)) { c.fogT = 0; continue; }
    if (!(c.fogT > 0)) c.events.push({ t: 'smoke-hit', from: S.clouds.find(o => o.from !== j && Math.hypot(c.x - o.x, c.z - o.z) < o.r).from });
    c.fogT = (c.fogT || 0) + dt; c.vx *= 1 - WPN.SMOKE_DRAG * dt; c.vz *= 1 - WPN.SMOKE_DRAG * dt;
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
      c.vx *= WPN.STINGER_SCRUB; c.vz *= WPN.STINGER_SCRUB; c.spin += (S.rng() < 0.5 ? -1 : 1) * 1.6; c.oilT = Math.max(c.oilT || 0, WPN.STINGER_SLIP);   // the tyres torn up: a slide
      damageCar(c, c.x, c.z, WPN.STINGER_DMG, 1, 0, 0); c.events.push({ t: 'stinger-hit', from: o.from, x: c.x, y: c.y, z: c.z });
    });
    return o.left > 0 && o.t < WPN.STINGER_LIFE && R.cars.some(c => live(c) && c.progress < o.s + 2);
  });
}
// proximity mines: armed after MINE_ARM s (their layer is safe from its own for twice that); the first car near one
// sets it off, and the blast throws up and slows everyone in reach, falling off with distance
function mines(R, W, dt) {
  const S = R.wpn, tr = W.tr;
  S.mines = S.mines.filter(m => {
    m.t += dt;
    if (m.s !== undefined && !m.rest) {   // still tumbling down the road (road terms, like a drum): a car it runs into sets it off
      m.s += m.vs * dt; m.lat += m.vl * dt; m.vy -= WPN.DRUM_G * dt; m.y += m.vy * dt;
      if (Math.abs(m.lat) > HALF - 0.5) { m.lat = Math.sign(m.lat) * (HALF - 0.5); m.vl = -m.vl * 0.5; }
      const p = roadPos(tr, m.s, m.lat, 0); m.x = p.x; m.z = p.z;
      const hit = R.cars.find((c, j) => live(c) && (j !== m.from || m.t > 0.6) && Math.abs(c.progress - m.s) < c.hl + 0.5 && Math.abs(onRoad(tr, c) - m.lat) < c.hw + 0.5 && Math.abs(c.y + 0.6 - m.y) < 1.7);
      if (hit) { boom(R, W, m, hit); return false; }
      if (m.y <= p.y) {
        m.y = p.y;
        if (m.vy < -2.2 && m.n < 3) { m.vy = -m.vy * WPN.MINE_BOUNCE; m.vs *= 0.6; m.vl *= 0.6; m.n++; R.cars[m.from].events.push({ t: 'mine-bounce', x: p.x, y: p.y, z: p.z }); return true; }
        m.vy = 0; const f = Math.exp(-WPN.MINE_GRIP * dt); m.vs *= f; m.vl *= f;
        if (Math.abs(m.vs) < 0.8 || m.t > 2.5) { m.rest = true; m.t = 0; R.cars[m.from].events.push({ t: 'mine-settle', x: p.x, y: p.y, z: p.z }); }   // settled: the arming clock starts
      }
      return true;
    }
    if (m.t < WPN.MINE_ARM) return true;
    const trig = R.cars.find((c, j) => live(c) && (j !== m.from || m.t > WPN.MINE_ARM * 2) && Math.abs(c.y - m.y) < 2 && Math.hypot(c.x - m.x, c.z - m.z) < WPN.MINE_TRIG + c.hw);
    if (!trig) return m.t < WPN.MINE_LIFE;
    boom(R, W, m, trig); return false;
  });
}
// a mine going off under (or against) car `trig`: everyone in reach is thrown up and slowed, falling off with distance
function boom(R, W, m, trig) {
  const S = R.wpn;
  R.cars[m.from].events.push({ t: 'mine-boom', x: m.x, y: m.y, z: m.z, r: m.blast }); ignite(R, W, m.x, m.z, m.blast);
  for (const c of R.cars) {
    const d = Math.hypot(c.x - m.x, c.z - m.z); if (!live(c) || d > m.blast || Math.abs(c.y - m.y) > 3 || shielded(c)) continue;
    const f = c === trig ? 1 : 1 - d / m.blast * 0.6; c.vx *= 1 - (1 - WPN.MINE_SLOW) * f; c.vz *= 1 - (1 - WPN.MINE_SLOW) * f; c.vy = WPN.MINE_POP * f; c.onGround = false; c.airT = 0;
    c.spin += (S.rng() < 0.5 ? -1 : 1) * 3 * f; c.boost = 0; damageCar(c, m.x, m.z, m.dmg * f, 1, 0, 0);
    c.events.push({ t: 'mine-hit', from: m.from, x: c.x, y: c.y, z: c.z });
  }
  blastScenery(R, m.x, m.z, WPN.BLAST_MINE[0], WPN.BLAST_MINE[1], m.from);
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
    if ((c.isPlayer && !R.autoPlayer) || !live(c)) continue;
    const P = c.ai.persona, bold = P === 'bomber' || P === 'nemesis', keen = (0.6 + (c.ai.flick || 0.3)) * (P === 'bomber' ? 2.5 : P === 'nemesis' ? 1.6 : 1), w = c.wpn;   // personalities (G5): fire sooner, at more
    w.heldT = w.item ? (w.heldT || 0) + dt : 0;
    if (w.item && !c.hold && !(w.gunT > 0) && rng() < dt * 0.8 * keen) {
      const ahead = missileTarget(R, c), gap = ahead >= 0 ? R.cars[ahead].progress - c.progress : 999;
      const behind = R.cars.some(o => o !== c && live(o) && c.progress - o.progress > (bold ? 2 : 3) && c.progress - o.progress < (bold ? 45 : 30));
      const near = R.cars.filter(o => o !== c && live(o) && Math.hypot(o.x - c.x, o.z - c.z) < WPN.PULSE_R * 0.7).length;
      const close = R.cars.filter(o => o !== c && live(o) && Math.hypot(o.x - c.x, o.z - c.z) < 7).length;
      const inJet = R.cars.some(o => o !== c && live(o) && (a => a.d < WPN.WATER_R * 0.85 && a.ang < WPN.WATER_CONE * 0.8)(aim(c, o)));
      const heard = R.cars.filter(o => o !== c && live(o) && Math.hypot(o.x - c.x, o.z - c.z) < WPN.JINGLE_R * 0.8).length;
      const want = { missile: lockedOn(R, c) >= 0 && gap > (bold ? 8 : 20), gun: gap < (bold ? 70 : 45), harpoon: gap > 12 && gap < WPN.HARP_R, oil: behind, pulse: near >= 1,
        water: inJet, cement: behind, stinger: behind, crush: close >= 1 && c.onGround, jingle: heard >= 2, mortar: mortarTarget(R, c) >= 0, mine: behind }[w.item];
      if (want || w.heldT > 10) use(R, W, c);   // held too long with no use for it (the leader with a missile): fire it anyway, to make room for the next crate
    }
    // defence (a Workshop dummy held still too): on the threat it's for; the sharper the driver, the quicker (a poor one may be too late)
    if (w.def && rng() < dt * (1 + 7 * (c.ai.skill ?? 0.7) ** 2)) {
      const k = idx(R, c), homing = R.missiles.filter(m => m.tgt === k), lockedBy = R.cars.some(o => o !== c && o.wpn.item === 'missile' && o.wpn.lockTgt === k && o.wpn.lockK >= 0.8);
      const incoming = homing.some(m => c.progress - m.s < 30) || R.wpn.shells.some(sh => sh.tgt === k && !(sh.wait > 0) && sh.t > WPN.MORTAR_FLIGHT - 0.8) || R.wpn.hooks.some(h => h.to === k && !h.tow && c.progress - h.s < 25);
      const tailed = R.cars.some(o => o !== c && live(o) && (o.wpn.item === 'missile' || o.wpn.item === 'gun' || o.wpn.gunT > 0) && c.progress - o.progress > 4 && c.progress - o.progress < 40);
      const d = c.dmg, want = { flares: homing.length > 0 || lockedBy, shield: incoming, smoke: lockedBy || (tailed && rng() < 0.05), repair: carWear(c) > 0.3 || Math.max(d.f, d.b, d.l, d.r) > 0.65 }[w.def];
      if (want) defend(R, W, c);
    }
    if (!c.hold && !(w.doorCool > 0) && !(w.doorT > 0) && rng() < dt * 0.45 * keen) {
      for (const o of R.cars) {
        if (o === c || !live(o)) continue;
        const lat = across(c, o), lon = along(c, o);
        if (Math.abs(lat) > 1.2 && Math.abs(lat) < c.hw + o.hw + 1.6 && Math.abs(lon) < c.hl) { swingDoor(R, c, Math.sign(lat)); break; }
      }
    }
  }
}
/** Fit gear g (data/weapons.js GEAR, or null) to car c: flares or a shield go straight into its defence slot. */
export function setGear(c, g) { const w = c.wpn; w.gear = g || null; w.defT = 0; if (GEAR_DEF[g]) w.def = GEAR_DEF[g]; }
export const feature = {
  name: 'weapons',
  init(R, W) {
    R.missiles = []; if (W) W.craters = W.dents = null; if (!R.weapons) return;
    R.wpn = { rng: mulberry32(R.cars.length * 104729 + 3), next: 0, crates: [], bullets: [], slicks: [], hooks: [], cement: [], strips: [], shells: [], craters: [], mines: [], drums: [], clouds: [] };
    R.cars.forEach((c, k) => {
      const load = c.def.wpn || null;   // levels and gear (data/weapons.js); the signature weapon comes with the vehicle
      c.wpn = { item: null, uses: 0, gunT: 0, gunAcc: 0, doorT: 0, doorSide: 0, doorCool: 0, crateT: 1.5 + k * 0.4,
        load, gear: null, def: null, defT: 0, sig: SIGNATURES[c.def.vehicle || c.def.model] || null, flareOn: 0, shieldOn: 0, smokeT: 0, soaked: [], jingled: [], lockTgt: -1, lockK: 0 };
      setGear(c, load && load.gear);
    });
  },
  after(R, W, dt) {
    if (!R.weapons) return;
    const racing = R.phase === 'racing';
    for (const c of R.cars) {
      const w = c.wpn, inp = c.inp;
      if (inp.fire) { inp.fire = false; if (racing && w.item && !(w.gunT > 0) && live(c)) use(R, W, c); }
      if (inp.defend) { inp.defend = false; if (racing && w.def && live(c)) defend(R, W, c); }
      if (inp.door) { if (racing && !(w.doorCool > 0) && live(c)) swingDoor(R, c, doorSide(R, c)); inp.door = 0; }
    }
    if (racing) { locking(R, W, dt); crates(R, W, dt); aiWeapons(R, W, dt); }
    W.dents = R.wpn.craters;                                                    // the holes the cars ride (track/query.js groundAt)
    W.craters = R.wpn.craters.concat(R.wpn.shells.filter(sh => !(sh.wait > 0) && sh.t > WPN.MORTAR_FLIGHT * 0.3));   // what the AI steers round (sim/ai.js): craters, and where shells are coming down
    flyMissiles(R, W, dt); shells(R, W, dt); guns(R, W, dt); drums(R, W, dt); slicks(R, W, dt); hooks(R, W, dt); signatures(R, W, dt); mines(R, W, dt); doors(R, dt);
  }
};
