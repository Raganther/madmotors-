import { FERRY } from '../elements/ferry.js';
import { clamp } from '../math.js';
import { respawn } from '../sim/car.js';

// ---------- the barge (ferry element) ----------
// Each ferry crossing (tr.ferries: dock A at sample a, dock B at b) has a barge LEN metres long that shuttles along it.
//   A    docked at A, rear ramp down: cars drive on and stop at the raised front ramp. It leaves DWELL s after docking
//        once everyone aboard has stopped and nobody else is on the way (within APPROACH m of the dock), or WAIT s
//        after the first car boarded, whoever is still coming.
//   toB  crossing: both ramps up, the cars ride along (and can jostle on the deck).
//   B    docked at B, front ramp down: cars drive off; it leaves LEAVE_B s after the deck is clear.
//   toA  going back empty. While the barge isn't at A the gate at dock A is shut.
// Barge state lives on the world (W.ferries, like W.bar) so the ground query can see the deck. No randomness.
const base = (tr, s) => { if (s >= tr.NM) return -1e6; const N0 = tr.loopN || tr.N; return ((s % N0) + N0) % N0; };   // a branch is nowhere near a ferry
/** Deck height if (s, lat) is on a barge deck, else null (water). */
export function ferryDeckAt(W, s, lat) {
  if (!W.ferries) return null; const b = base(W.tr, s);
  for (const f of W.ferries) if (b >= f.s - 0.3 && b <= f.s + FERRY.LEN + 0.3 && Math.abs(lat) <= FERRY.HALF) return f.h;
  return null;
}
const onDeck = (W, f, c) => { const b = base(W.tr, c.pr.s); return b >= f.s - 0.5 && b <= f.s + FERRY.LEN + 0.5 && Math.abs(c.pr.lat) < FERRY.HALF + 1 && Math.abs(c.y - f.h) < 2.5; };
/** For the AI: the speed to be doing so as to stop at the gate or the front of the deck (99 = no limit). */
export function ferryTarget(W, c) {
  if (!W.ferries) return 99;
  const b = base(W.tr, c.pr.s);
  for (const f of W.ferries) {
    let stop = null;
    if (onDeck(W, f, c)) { if (f.phase !== 'B') stop = f.s + FERRY.LEN - c.hl - 1.2; }
    else if (f.a - b > -1 && f.a - b < FERRY.APPROACH) stop = f.phase === 'A' ? f.s + FERRY.LEN - c.hl - 1.2 : f.a - 1.5 - c.hl;
    if (stop !== null) { const d = stop - b; return d <= 0 ? 0 : Math.sqrt(d * 12); }
  }
  return 99;
}
// move a car along/across the road at its sample by (ds, dl) metres
function shift(tr, c, ds, dl) { const i = c.pr.i; c.x += tr.tx[i] * ds + tr.rx[i] * dl; c.z += tr.tz[i] * ds + tr.rz[i] * dl; c.pr.s += ds; c.pr.lat += dl; }
function step(R, W, dt) {
  const tr = W.tr, L = FERRY.LEN, racers = R.cars.filter(c => !c.out && !c.finished), P = R.player;
  for (const f of W.ferries) {
    const aboard = racers.filter(c => onDeck(W, f, c));
    // the barge
    let ds = 0;
    if (f.phase === 'A') {
      f.t += dt; if (aboard.length) f.tBoard += dt;
      const coming = racers.filter(c => { const d = f.a - base(tr, c.pr.s); return d > 0 && d < FERRY.APPROACH && !aboard.includes(c); });
      const settled = aboard.every(c => Math.hypot(c.vx, c.vz) < 2.5);                // everyone aboard has pulled up
      if (f.t >= FERRY.DWELL && aboard.length && ((!coming.length && settled) || f.tBoard >= FERRY.WAIT)) {
        f.phase = 'toB'; f.trips++; P.events.push({ t: 'ferry-depart', aboard: aboard.map(c => R.cars.indexOf(c)), left: coming.map(c => R.cars.indexOf(c)) });
      }
    } else if (f.phase === 'toB' || f.phase === 'toA') {
      const end = f.phase === 'toB' ? f.b - L : f.a, dist = Math.abs(end - f.s), gone = Math.abs(f.s - (f.phase === 'toB' ? f.a : f.b - L));
      const v = FERRY.SPEED * clamp(Math.min(dist, gone) / 5 + 0.25, 0.25, 1);        // ease away from and into the docks
      ds = Math.sign(end - f.s) * Math.min(v * dt, dist); f.s += ds;
      if (Math.abs(end - f.s) < 1e-6) { f.s = end; f.phase = f.phase === 'toB' ? 'B' : 'A'; f.t = 0; f.tBoard = 0; if (f.phase === 'B') P.events.push({ t: 'ferry-arrive' }); }
    } else if (f.phase === 'B') { f.t += dt; if (!aboard.length && f.t >= FERRY.LEAVE_B) f.phase = 'toA'; }
    // the cars: ride along, stay on the deck, wait at the gate
    for (const c of racers) {
      const b = base(tr, c.pr.s), on = aboard.includes(c);
      if (on) {
        if (ds) shift(tr, c, ds, 0);
        const lm = FERRY.HALF - c.hw - 0.2;                                               // side rails
        if (Math.abs(c.pr.lat) > lm) { const o = Math.sign(c.pr.lat); shift(tr, c, 0, (lm - Math.abs(c.pr.lat)) * o); const vn = c.vx * tr.rx[c.pr.i] + c.vz * tr.rz[c.pr.i]; if (vn * o > 0) { c.vx -= tr.rx[c.pr.i] * vn; c.vz -= tr.rz[c.pr.i] * vn; } }
        const nb = base(tr, c.pr.s), lo = f.phase === 'A' ? -Infinity : f.s + c.hl + 0.3, hi = f.phase === 'B' ? Infinity : f.s + L - c.hl - 0.3;   // ramps
        const along = c.vx * tr.tx[c.pr.i] + c.vz * tr.tz[c.pr.i];
        if (nb > hi) { shift(tr, c, hi - nb, 0); if (along > 0) { c.vx -= tr.tx[c.pr.i] * along; c.vz -= tr.tz[c.pr.i] * along; } }
        if (nb < lo) { shift(tr, c, lo - nb, 0); if (along < 0) { c.vx -= tr.tx[c.pr.i] * along; c.vz -= tr.tz[c.pr.i] * along; } }
        if (c.isPlayer && !f.pOn && R.time - (f.boardT ?? -9) > 3) { c.events.push({ t: 'ferry-board' }); f.boardT = R.time; }
      } else if (f.phase !== 'A' && b > f.a - 8 && b < f.a + 2) {                        // gate at dock A
        const lim = f.a - 1 - c.hl, along = c.vx * tr.tx[c.pr.i] + c.vz * tr.tz[c.pr.i];
        if (b > lim) { shift(tr, c, lim - b, 0); if (along > 0) { c.vx -= tr.tx[c.pr.i] * along; c.vz -= tr.tz[c.pr.i] * along; } }
      } else if (b >= f.a && b <= f.b && c.y < f.h - 4) {                               // in the water: back to dock A
        c.events.push({ t: 'splash' }); c.lastGood = c.pr.i - b + f.a - 6; respawn(c, W);
      }
      if (c.isPlayer) f.pOn = on;
      if (b > f.a - FERRY.APPROACH && b < f.b + 4) { c.stuckT = 0; c.wallStuck = 0; }  // queueing isn't being stuck
    }
  }
}
/** Barges on ferry crossings. */
export const feature = {
  name: 'ferry',
  init(R, W) { W.ferries = (W.tr.ferries || []).map(f => ({ ...f, s: f.a, phase: 'A', t: 0, tBoard: 0, trips: 0, pOn: false })); R.ferries = W.ferries; },
  after(R, W, dt) { if (W.ferries.length) step(R, W, dt); }
};
