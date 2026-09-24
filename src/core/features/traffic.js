import { HALF } from '../constants.js';
import { closedCrossingAhead } from './trains.js';
import { clamp, wrapAngle } from '../math.js';
import { makeCar, stepCar } from '../sim/car.js';
import { TRAFFIC_COLORS, TRAFFIC_KINDS } from '../../data/cars.js';

export const LANE = 2.9;
export function trafficControl(c, W, cars, dt) {
  const tr = W.tr, N = tr.N, i = c.pr.i, dir = c.tdir, sp = Math.hypot(c.vx, c.vz), fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  let lane = dir * LANE, target = Math.min(c.cruise, tr.vmax[i] * 0.55);
  if (c.hornT > 0) c.hornT -= dt;
  const ca = (c.vx * tr.tx[i] + c.vz * tr.tz[i]) * dir;
  for (const o of cars) {
    if (o === c || o.ghost > 0) continue;
    const ahead = (o.pr.s - c.pr.s) * dir; if (ahead <= 0 || ahead > 70) continue;
    if (Math.abs((o.y - tr.H[o.pr.i]) - (c.y - tr.H[i])) > 3) continue;
    const oa = (o.vx * tr.tx[o.pr.i] + o.vz * tr.tz[o.pr.i]) * dir, closing = ca - oa, dl = o.pr.lat - c.pr.lat;
    if (Math.hypot(o.vx, o.vz) < 3) {                      // stopped or wrecked: steer round it
      if (ahead < 28 && Math.abs(dl) < 3.2) { lane = clamp(o.pr.lat + (o.pr.lat * dir > 0 ? -3.6 : 3.6) * dir, -HALF + 1.4, HALF - 1.4); target = Math.min(target, 7); }
    } else if (oa > 0) { if (ahead < 14 + sp * 0.6 && Math.abs(dl) < 2.8) target = Math.min(target, Math.max(0, oa - 2)); }
    else if (ahead < 16 + closing * 1.3) {                 // something coming at us: tuck in to the edge and slow down
      lane = dir * (HALF - 1.3); target = Math.min(target, 7);
      if (!o.traffic && closing > 18 && ahead < 40 && !(c.hornT > 0)) { c.hornT = 3; c.events.push({ t: 'horn' }); }
    }
  }
  c.laneCur += (lane - c.laneCur) * Math.min(1, dt * (Math.abs(lane) > LANE + 0.5 ? 3.5 : 1.5));
  const L = clamp(i + dir * Math.round(6 + sp * 0.35), 0, N - 1);
  const tx = tr.xs[L] + tr.rx[L] * c.laneCur, tz = tr.zs[L] + tr.rz[L] * c.laneCur;
  const dx = tx - c.x, dz = tz - c.z, lx = -dx * fz + dz * fx, lz = dx * fx + dz * fz;
  if (dir > 0) { const dsx = closedCrossingAhead(W, i); if (dsx > 6 && dsx < 90) target = Math.min(target, Math.max(0, (dsx - 18) * 0.6)); }
  c.inp.steer = clamp(Math.atan2(lx, lz) * 2.4, -1, 1); c.inp.handbrake = 0;
  const vf = c.vx * fx + c.vz * fz;
  if (vf > target + 1) { c.inp.throttle = 0; c.inp.brake = clamp((vf - target) / 6, 0.2, 1); }
  else { c.inp.brake = 0; c.inp.throttle = vf < target - 1 ? 0.8 : 0.3; }
}
export function spawnTraffic(R, W, idx, dir, rnd) {
  const tr = W.tr; let tot = 0; for (const k of TRAFFIC_KINDS) tot += k.w;
  let pick = rnd() * tot, K = TRAFFIC_KINDS[0]; for (const k of TRAFFIC_KINDS) { pick -= k.w; if (pick <= 0) { K = k; break; } }
  if (dir > 0 && K.kind === 'truck') K = TRAFFIC_KINDS[1];      // same-way traffic is cars and vans, trucks come the other way
  const def = { name: K.kind, traffic: true, kind: K.kind, accent: 0x8E939B, hw: K.hw, hl: K.hl, im: K.im, color: TRAFFIC_COLORS[(rnd() * TRAFFIC_COLORS.length) | 0], skill: 0.5 };
  const c = makeCar(W, idx, dir * LANE, def);
  if (dir < 0) c.yaw = wrapAngle(c.yaw + Math.PI);
  c.tdir = dir; c.cruise = dir < 0 ? 15 + rnd() * 5 : 10 + rnd() * 4; c.laneCur = dir * LANE; c.hornT = 0;
  const sp = Math.min(c.cruise, tr.vmax[idx] * 0.55); c.vx = Math.sin(c.yaw) * sp; c.vz = Math.cos(c.yaw) * sp;
  R.traffic.push(c);
}
export function updateTraffic(R, W, dt) {
  const cfg = W.traffic, tr = W.tr, P = R.player;
  if (!cfg || R.phase !== 'racing') return;
  const pi = P.pr.i;
  for (const c of R.traffic) if (c.pr.i < pi - 110 || c.pr.i > pi + 480) c.dead = true;
  R.traffic = R.traffic.filter(c => !c.dead);
  R.trafT -= dt; if (R.trafT > 0) return; R.trafT = 0.5;
  const rnd = R.rnd, lastI = tr.finishIdx - 30;
  for (const dir of [-1, 1]) {
    const want = dir < 0 ? cfg.on : cfg.with; if (!want) continue;
    if (R.traffic.filter(c => c.tdir === dir).length >= want) continue;
    const idx = Math.round(pi + (dir < 0 ? 200 + rnd() * 160 : 130 + rnd() * 160));
    if (idx > lastI || idx < tr.startIdx + 40) continue;
    let ok = !tr.jump[idx] && !tr.tunnel[idx] && !tr.bridge[idx];
    for (const o of R.traffic) if (Math.abs(o.pr.i - idx) < 60) ok = false;
    for (const o of R.cars) if (Math.abs(o.pr.i - idx) < 50) ok = false;
    if (ok) spawnTraffic(R, W, idx, dir, rnd);
  }
}

/** Civilian traffic: spawned ahead of the player, removed once well behind. */
export const feature = {
  name: 'traffic',
  init(R) { R.traffic = []; R.trafT = 1.5; },
  vehicles: R => R.traffic,
  move(R, W, dt, all, racing) { for (const c of R.traffic) { if (c.wreckT <= 0) trafficControl(c, W, all, dt); stepCar(c, dt, W, racing); } },
  spawn: updateTraffic
};
