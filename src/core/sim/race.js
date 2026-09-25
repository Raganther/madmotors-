import { FEATURES } from '../features/index.js';
import { initShowdown, sdLeader, showdownStep } from '../modes/showdown.js';
import { clamp, mulberry32 } from '../math.js';
import { aiControl } from './ai.js';
import { makeBarriers } from './barriers.js';
import { makeCar, stepCar } from './car.js';
import { collideCars } from './collide.js';

/** Where each car lines up, [sample, lateral]: two abreast for up to four cars, three abreast in rows 6 m apart for
 *  a bigger field (14 cars still start at sample 6 or later, so a downhill stage has road under all of them). */
export function gridSlots(n) {
  if (n <= 4) return [[30, -2.8], [30, 2.8], [22, -2.8], [22, 2.8]];
  return Array.from({ length: n }, (_, k) => [30 - Math.floor(k / 3) * 6, [-3.5, 0, 3.5][k % 3]]);
}
/** Start a race on a built world. @param {import('../types.js').World} W @param {object[]} defs  one per car (see data/cars.js) @param {{mode?: 'race'|'showdown'}} [opts] @returns {import('../types.js').Race} */
export function createRace(W, defs, opts = {}) {
  W.bar = makeBarriers(W.tr, W.armco);
  const grid = gridSlots(defs.length), cars = defs.map((d, k) => makeCar(W, grid[k][0], grid[k][1], d));
  const R = { cars, player: cars.find(c => c.isPlayer) || cars[0], time: 0, phase: 'grid', nFinished: 0, autoPlayer: false, rnd: mulberry32((W.tr.seed || 1) * 31 + 7) };
  for (const f of FEATURES) if (f.init) f.init(R, W);
  R.mode = opts.mode || 'race';
  if (R.mode === 'showdown') initShowdown(R);
  return R;
}
/** Advance the whole race by one fixed step (STEP = 1/120 s). @param {import('../types.js').Race} R @param {number} dt @param {import('../types.js').World} W */
export function raceStep(R, dt, W) {
  const racing = R.phase === 'racing';
  if (racing) R.time += dt;
  const P = R.player, tr = W.tr, all = R.cars.concat(...FEATURES.filter(f => f.vehicles).map(f => f.vehicles(R)));
  const lead = R.sd && sdLeader(R);
  // slipstream: a racer tucked in 3-20 m behind another (roughly in line, both at speed) gets a tow, strongest up close
  for (const c of R.cars) {
    let want = 0; const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), sp = Math.hypot(c.vx, c.vz);
    if (sp > 15 && !c.finished && c.onGround) for (const o of R.cars) {
      if (o === c || Math.abs(o.y - c.y) > 2 || !(o.wreckT <= 0)) continue;
      const dx = o.x - c.x, dz = o.z - c.z, ahead = dx * fx + dz * fz, side = Math.abs(dx * fz - dz * fx);
      if (ahead > 3 && ahead < 20 && side < 2.2) want = Math.max(want, 1 - (ahead - 3) / 17);
    }
    c.draft = (c.draft || 0) + (want - (c.draft || 0)) * Math.min(1, dt * 4);
  }
  for (const c of R.cars) {
    if (!c.isPlayer || c.finished || R.autoPlayer) aiControl(c, W, all, dt, R.hazards);
    if (c.finished && c.progress > tr.finishIdx + 18) { c.inp.throttle = 0; c.inp.brake = c.vf > 0.5 ? 0.7 : 0; c.inp.handbrake = c.vf > 0.5 ? 0 : 1; }   // pull up and stay put (no creeping backwards)
    c.mod = lead ? clamp(1 + (lead.progress - c.progress) / 300, 1, 1.08)                // Showdown: everyone chasing the leader gets a tow
      : c.isPlayer ? 1 : clamp(1 + (P.progress - c.progress) / 1400, 0.93, 1.08);
    stepCar(c, dt, W, racing);
    if (!c.finished) {
      const slide = Math.abs(c.vr), sp = Math.hypot(c.vx, c.vz);
      if (c.onGround && c.surface !== 'grass' && slide > 4 && sp > 13) c.driftT += dt;
      else if (c.driftT > 0 && (slide < 2.5 || !c.onGround || c.surface === 'grass')) {
        if (c.driftT > 0.6 && c.surface !== 'grass' && c.onGround) { c.boost = Math.max(c.boost, clamp(c.driftT * 0.7, 0.5, 1.4)); c.events.push({ t: 'drift', amt: c.driftT }); }
        c.driftT = 0;
      }
    }
    if (tr.loopN && racing && !c.finished) {
      const ln = Math.floor((c.progress - tr.startIdx) / tr.loopN);
      if (ln > c.lap && ln < tr.laps) { c.lap = ln; c.events.push({ t: 'lap', n: ln + 1 }); }
    }
    if (racing && !c.finished && !R.sd && c.progress >= tr.finishIdx) { c.finished = true; c.finishTime = R.time; c.place = ++R.nFinished; c.events.push({ t: 'finish' }); }
  }
  for (const f of FEATURES) if (f.move) f.move(R, W, dt, all, racing);
  for (const f of FEATURES) if (f.spawn) f.spawn(R, W, dt);
  collideCars(all); collideCars(all);
  for (const f of FEATURES) if (f.after) f.after(R, W, dt);
  if (R.sd) showdownStep(R, W, dt);
}
export function ranking(R) {
  return R.cars.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1; if (b.finished) return 1;
    return b.progress - a.progress;
  });
}
