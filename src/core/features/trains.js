import { carSAT } from '../sim/collide.js';
import { damageCar } from '../sim/damage.js';
import { railAt, trainCars, trainLen } from '../track/rails.js';

// ---------- trains ----------
// One kinematic train per line. Barriers close 4 s before it reaches a crossing and open once its tail is 8 m past.
// Besides the regular timetable, a train is often sent to meet the player at a crossing so it isn't rare.
export const TRAIN_WARN = 4;
export function makeTrains(W, rnd) {
  const rl = W.tr.rails; if (!rl) return [];
  for (const C of rl.crossings) { C.closed = false; C.assist = -1; }
  return rl.lines.map(L => ({ L, cars: trainCars(L), len: trainLen(L), s: -1e4, ps: -1e4, dir: 1, active: false, idleT: 8 + rnd() * 8, horn: false }));
}
export function dispatchTrain(T, dir, s) { T.dir = dir; T.s = T.ps = s; T.active = true; T.horn = false; }
export function trainBoxes(T) {
  const out = []; let off = 0;
  for (const cl of T.cars) { const p = railAt(T.L, T.s - T.dir * (off + cl / 2)); out.push({ x: p.x, z: p.z, h: p.h, yaw: p.yaw, hw: 1.6, hl: cl / 2 }); off += cl + 1.5; }
  return out;
}
export function trainStep(R, W, dt) {
  const rl = W.tr.rails; if (!rl) return;
  const tr = W.tr, N0 = tr.loopN || tr.N, P = R.player, racing = R.phase === 'racing', rnd = R.rnd;
  for (const T of R.trains) {
    T.ps = T.s;
    const L = T.L, sp = L.speed;
    if (T.active) {
      T.s += T.dir * sp * dt;
      if (T.dir > 0 ? T.s - T.len > L.len + 40 : T.s + T.len < -40) { T.active = false; T.idleT = 15 + rnd() * 10; }
      continue;
    }
    if (!racing) continue;
    T.idleT -= dt;
    // dispatch assist: player 5-8 s from one of this line's crossings
    const psp = Math.max(12, Math.hypot(P.vx, P.vz));
    for (const C of L.crossings) {
      const ds = ((C.i - P.pr.i % N0) % N0 + N0) % N0, eta = ds / psp;
      if (ds > 400) { C.assist = -1; continue; }
      if (C.assist === -1 && eta > 5 && eta < 8) {
        C.assist = rnd() < 0.65 ? 1 : 0;
        if (C.assist === 1) {
          const dir = rnd() < 0.5 ? 1 : -1, arrive = eta - 3 + rnd() * 4;
          let s0 = C.s - dir * sp * arrive;
          s0 = dir > 0 ? Math.max(s0, -30) : Math.min(s0, L.len + 30);           // can't start further back than the line's end
          dispatchTrain(T, dir, s0);
          break;
        }
      }
    }
    if (!T.active && T.idleT <= 0) { const dir = rnd() < 0.5 ? 1 : -1; dispatchTrain(T, dir, dir > 0 ? -30 : L.len + 30); }
  }
  for (const C of rl.crossings) {
    const T = R.trains.find(t => t.L === C.line);
    if (!T || !T.active) { C.closed = false; continue; }
    const ahead = (C.s - T.s) * T.dir;
    C.closed = ahead < T.L.speed * TRAIN_WARN && ahead > -(T.len + 8);
  }
  // collisions: a train always wins
  const cars = R.cars.concat(R.traffic, R.parked);
  for (const T of R.trains) {
    if (!T.active) continue;
    const boxes = trainBoxes(T), vx0 = Math.sin(boxes[0].yaw) * T.dir * T.L.speed, vz0 = Math.cos(boxes[0].yaw) * T.dir * T.L.speed;
    for (const c of cars) {
      if (c.ghost > 0 || c.finished) continue;
      for (const b of boxes) {
        if ((c.x - b.x) ** 2 + (c.z - b.z) ** 2 > (b.hl + 4) ** 2 || Math.abs(c.y - b.h) > 3) continue;
        const h = carSAT(b, c); if (!h) continue;
        c.x += h.nx * (h.depth + 0.05); c.z += h.nz * (h.depth + 0.05);
        const vn = (c.vx - vx0) * h.nx + (c.vz - vz0) * h.nz;
        if (vn < 6) {
          c.vx = vx0 * 1.05 + h.nx * 9; c.vz = vz0 * 1.05 + h.nz * 9; c.vy = Math.max(c.vy, 4); c.onGround = false;
          c.spin = (Math.random() < 0.5 ? -1 : 1) * 3.5;
          if (c.wreckT <= 0) { c.events.push({ t: 'trainhit', x: c.x - h.nx, z: c.z - h.nz, y: c.y }); damageCar(c, c.x - h.nx * 1.2, c.z - h.nz * 1.2, 60, 1.5, h.nx, h.nz); }
        }
        break;
      }
    }
  }
}
// distance ahead (in road samples) to the next closed crossing, or Infinity
export function closedCrossingAhead(W, i) {
  const rl = W.tr.rails; if (!rl) return Infinity;
  const N0 = W.tr.loopN || W.tr.N; let best = Infinity;
  for (const C of rl.crossings) if (C.closed) { const ds = ((C.i - i % N0) % N0 + N0) % N0; if (ds < best) best = ds; }
  return best;
}

/** Railways: one train per line, level-crossing barriers, collisions. Active when the stage has `rails`. */
export const feature = {
  name: 'trains',
  init(R, W) { R.trains = makeTrains(W, R.rnd); },
  after: trainStep
};
