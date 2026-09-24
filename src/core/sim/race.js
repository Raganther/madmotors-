import { makeParked } from '../features/parked.js';
import { rockStep } from '../features/rockfall.js';
import { trafficControl, updateTraffic } from '../features/traffic.js';
import { makeTrains, trainStep } from '../features/trains.js';
import { clamp, mulberry32 } from '../math.js';
import { aiControl } from './ai.js';
import { makeBarriers } from './barriers.js';
import { makeCar, stepCar } from './car.js';
import { collideCars } from './collide.js';

export function createRace(W, defs) {
  const grid = [[30, -2.8], [30, 2.8], [22, -2.8], [22, 2.8]];
  W.bar = makeBarriers(W.tr, W.armco);
  const cars = defs.map((d, k) => makeCar(W, grid[k][0], grid[k][1], d));
  const rnd = mulberry32((W.tr.seed || 1) * 31 + 7);
  return { cars, player: cars.find(c => c.isPlayer) || cars[0], time: 0, phase: 'grid', nFinished: 0, autoPlayer: false, traffic: [], trafT: 1.5, rnd, trains: makeTrains(W, rnd), parked: makeParked(W, rnd), rocks: [], rockT: 4 };
}
export function raceStep(R, dt, W) {
  const racing = R.phase === 'racing';
  if (racing) R.time += dt;
  const P = R.player, tr = W.tr, all = R.traffic.length || R.parked.length ? R.cars.concat(R.traffic, R.parked) : R.cars;
  for (const c of R.cars) {
    if (!c.isPlayer || c.finished || R.autoPlayer) aiControl(c, W, all, dt);
    if (c.finished && c.progress > tr.finishIdx + 18) { c.inp.throttle = 0; c.inp.brake = c.vf > 0.5 ? 0.7 : 0; c.inp.handbrake = c.vf > 0.5 ? 0 : 1; }   // pull up and stay put (no creeping backwards)
    c.mod = c.isPlayer ? 1 : clamp(1 + (P.progress - c.progress) / 1400, 0.93, 1.08);
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
    if (racing && !c.finished && c.progress >= tr.finishIdx) { c.finished = true; c.finishTime = R.time; c.place = ++R.nFinished; c.events.push({ t: 'finish' }); }
  }
  for (const c of R.traffic) { if (c.wreckT <= 0) trafficControl(c, W, all, dt); stepCar(c, dt, W, racing); }
  for (const c of R.parked) { c.inp.throttle = 0; c.inp.brake = 0; c.inp.steer = 0; c.inp.handbrake = 1; stepCar(c, dt, W, racing); }
  if (R.parked.some(c => c.dead)) R.parked = R.parked.filter(c => !c.dead);
  updateTraffic(R, W, dt);
  collideCars(all); collideCars(all);
  trainStep(R, W, dt);
  rockStep(R, W, dt);
}
export function ranking(R) {
  return R.cars.slice().sort((a, b) => {
    if (a.finished && b.finished) return a.finishTime - b.finishTime;
    if (a.finished) return -1; if (b.finished) return 1;
    return b.progress - a.progress;
  });
}
