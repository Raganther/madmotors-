import { HALF } from '../constants.js';
import { closedCrossingAhead } from '../features/trains.js';
import { clamp } from '../math.js';

export function aiControl(c, W, cars, dt, hazards) {
  const tr = W.tr, pr = c.pr, i = pr.i, N = tr.N, ai = c.ai;
  const sp = Math.hypot(c.vx, c.vz);
  ai.wT -= dt; if (ai.wT <= 0) { ai.wT = 2 + Math.random() * 3; ai.lane = (Math.random() * 2 - 1) * 2.2; }
  const ka = tr.ks[Math.min(N - 1, i + Math.round(8 + sp * 0.45))];
  let lane = ai.lane * 0.6 - clamp(ka * 95, -1, 1) * 3.3;
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); let minLane = -HALF;
  for (const o of cars) {
    if (o === c || o.ghost > 0) continue;
    const oa = o.vx * tr.tx[o.pr.i] + o.vz * tr.tz[o.pr.i];
    if (oa < -2) {                                        // oncoming: measured along the road so it's seen round corners and down the hill
      const ds = o.pr.s - pr.s, closing = sp - oa;
      if (ds > -2 && ds < 14 + closing * 1.2 && Math.abs((o.y - tr.H[o.pr.i]) - (c.y - tr.H[i])) < 3) minLane = Math.max(minLane, o.pr.lat + 3.9);
      continue;
    }
    if (Math.abs(o.y - c.y) > 3) continue;
    const dx = o.x - c.x, dz = o.z - c.z, ahead = dx * fx + dz * fz;
    if (ahead > 0 && ahead < 11 + Math.max(0, (c.vx - o.vx) * fx + (c.vz - o.vz) * fz) * 0.9) { const dl = o.pr.lat - pr.lat; if (Math.abs(dl) < 2.8) lane += (dl >= 0 ? -1 : 1) * 3.2; }
  }
  // leader hazards: steer for the clear side of an oil slick, or between the cows; better drivers see them sooner
  let hzSlow = 99;
  if (hazards) for (const h of hazards) {
    const ahead = h.i - i; if (ahead < 2 || ahead > 22 + ai.skill * 26) continue;
    if (h.kind === 'oil') { if (Math.abs(h.lat - lane) < h.r + 1.3) lane = h.lat > 0 ? h.lat - h.r - 1.5 : h.lat + h.r + 1.5; continue; }
    hzSlow = Math.min(hzSlow, 20 + ahead * 0.4);
    for (const cow of h.cows) {
      if (cow.hit) continue;
      const cl = (cow.x - tr.xs[cow.i]) * tr.rx[cow.i] + (cow.z - tr.zs[cow.i]) * tr.rz[cow.i] + cow.dir * 1.2;   // where it will be
      if (Math.abs(cl - lane) < 2.3) lane += (lane >= cl ? 1 : -1) * (2.4 - Math.abs(cl - lane));
    }
  }
  lane = clamp(Math.max(lane, minLane), -HALF + 1.7, HALF - 1.2);
  ai.cur += (lane - ai.cur) * Math.min(1, dt * (minLane > -HALF ? 3 : 1.8));
  const L = Math.min(N - 1, i + Math.round(7 + sp * 0.38));
  const tx = tr.xs[L] + tr.rx[L] * ai.cur, tz = tr.zs[L] + tr.rz[L] * ai.cur;
  const dx = tx - c.x, dz = tz - c.z; const lx = -dx * fz + dz * fx, lz = dx * fx + dz * fz;
  c.inp.steer = clamp(Math.atan2(lx, lz) * 2.6, -1, 1);
  const skill = ai.skill * (0.9 + 0.1 * c.mod);
  let target = 99; const look = Math.min(N - 2, i + Math.round(sp * 1.7 + 18));
  for (let j = i; j <= look; j++) { const vm = tr.vmax[j] * skill; const v = Math.sqrt(vm * vm + 56 * (j - i)); if (v < target) target = v; }
  if (Math.abs(pr.lat) > HALF + 0.5) target = Math.min(target, 16);
  target = Math.min(target, hzSlow);
  { const dsx = closedCrossingAhead(W, i); if (dsx > 6 && dsx < 120) target = Math.min(target, Math.max(0, (dsx - 16) * 0.7)); }   // wait at lowered barriers
  if (sp > target + 1.2) { c.inp.throttle = 0; c.inp.brake = clamp((sp - target) / 5, 0.25, 1); }
  else { c.inp.brake = 0; c.inp.throttle = sp < target - 1.5 ? 1 : 0.35; }
  c.inp.handbrake = 0;
  const dr = ai.drift;
  if (minLane > -HALF) { dr.until = -1; if (Math.abs(tr.ks[i]) > 1 / 60) { c.inp.throttle = Math.min(c.inp.throttle, 0.3); } return; }   // no drifting into oncoming traffic
  if (!ai.flick) return;
  dr.cool -= dt;
  if (dr.until < 0 && dr.cool <= 0 && sp > 15 && c.onGround && c.surface !== 'grass' && Math.abs(pr.lat) < HALF - 1) {
    const near = i + Math.round(4 + sp * 0.25), far = Math.min(N - 2, i + Math.round(10 + sp * 0.6));
    let kmax = 0, kj = -1; for (let j = near; j <= far; j++) { const a = Math.abs(tr.ks[j]); if (a > kmax) { kmax = a; kj = j; } }
    if (kj > 0 && kmax > ai.driftK) { dr.until = kj + 10; dr.t = 0; dr.dir = Math.sign(tr.ks[kj]); }
  }
  if (dr.until >= 0) {
    dr.t += dt;
    const done = i > dr.until || Math.abs(pr.lat) > HALF - 0.3 || sp < 8 || !c.onGround;
    if (done) { dr.until = -1; dr.cool = 1.0; return; }
    const turnIn = 0.1, flickEnd = turnIn + ai.flick;
    if (dr.t < flickEnd) {
      if (dr.t > turnIn) c.inp.handbrake = 1;
      c.inp.steer = clamp(c.inp.steer - dr.dir * 0.45, -1, 1);   // left corner (dir>0) wants negative steer
      c.inp.brake = 0; c.inp.throttle = 0.45;
    } else {
      c.inp.brake = sp > target + 6 ? 0.5 : 0;
      c.inp.throttle = c.inp.brake ? 0 : 0.85;                    // power through the slide
    }
  }
}
