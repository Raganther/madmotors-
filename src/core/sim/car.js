import { CAR_HL, CAR_HW, HALF, PHYS, SURF, WALL } from '../constants.js';
import { clamp, wrapAngle } from '../math.js';
import { hitBarrier, wallAt, wallPos } from './barriers.js';
import { carWear, damageCar } from './damage.js';
import { BOOST_PAD } from '../elements/boost.js';
import { rutSurf } from '../features/mud.js';
import { groundAt, project, roadH } from '../track/query.js';

export function computeGrad(c, W) {
  const tr = W.tr, pr = c.pr, i = pr.i, e = 0.8;
  const gxp = groundAt(W, pr.s + e * tr.tx[i], pr.lat + e * tr.rx[i], c.x + e, c.z);
  const gxm = groundAt(W, pr.s - e * tr.tx[i], pr.lat - e * tr.rx[i], c.x - e, c.z);
  const gzp = groundAt(W, pr.s + e * tr.tz[i], pr.lat + e * tr.rz[i], c.x, c.z + e);
  const gzm = groundAt(W, pr.s - e * tr.tz[i], pr.lat - e * tr.rz[i], c.x, c.z - e);
  c.gx = (gxp - gxm) / (2 * e); c.gz = (gzp - gzm) / (2 * e);
  const gm = Math.hypot(c.gx, c.gz); if (gm > 0.5) { c.gx *= 0.5 / gm; c.gz *= 0.5 / gm; }
}
export function makeCar(W, idx, lat, def) {
  const tr = W.tr;
  const c = {
    x: tr.xs[idx] + tr.rx[idx] * lat, z: tr.zs[idx] + tr.rz[idx] * lat, y: tr.H[idx], vx: 0, vy: 0, vz: 0, yaw: tr.th[idx],
    onGround: true, airT: 0, boost: 0, driftT: 0, lastGood: idx, progress: idx, finished: false, finishTime: 0, place: 0,
    offT: 0, ghost: 0, stuckT: 0, wrongT: 0, lap: 0, spin: 0, mod: 1, vf: 0, vr: 0, gx: 0, gz: 0, squash: 0, surface: tr.surface, respawns: 0,
    inp: { throttle: 0, brake: 0, steer: 0, handbrake: 0 }, events: [], dmg: { f: 0, b: 0, l: 0, r: 0 }, wreckT: 0, wrecks: 0,
    hw: def.hw || CAR_HW, hl: def.hl || CAR_HL, im: def.im || 1, traffic: !!def.traffic,
    isPlayer: !!def.player, name: def.name, def,
    ai: { lane: lat, cur: lat, skill: def.player ? 0.85 : def.skill, wT: 1 + Math.random() * 2, flick: def.player ? 0 : (def.flick || 0), driftK: def.driftK || 1 / 45, drift: { until: -1, t: 0, cool: 0, dir: 0 } }
  };
  c.pr = project(tr, c.x, c.z, idx, 4, 4);
  c.y = groundAt(W, c.pr.s, c.pr.lat, c.x, c.z);
  computeGrad(c, W);
  return c;
}
export function respawn(c, W) {
  if (c.traffic) { c.dead = true; return; }
  const tr = W.tr; const i = tr.nx ? Math.max(4, tr.adv(c.lastGood, -10)) : clamp(c.lastGood - 10, 4, tr.N - 10);
  const lat = c.isPlayer ? 0 : clamp(c.ai.lane, -3, 3);
  c.x = tr.xs[i] + tr.rx[i] * lat; c.z = tr.zs[i] + tr.rz[i] * lat; c.y = tr.H[i]; c.yaw = tr.th[i]; c.strandT = 0;
  c.vx = tr.tx[i] * 8; c.vz = tr.tz[i] * 8; c.vy = 0; c.onGround = true; c.airT = 0; c.boost = 0; c.offT = 0; c.stuckT = 0; c.wrongT = 0;
  c.ghost = 2; c.driftT = 0; c.spin = 0; c.lastGood = i; c.pr = project(tr, c.x, c.z, i, 2, 2); c.ai.cur = lat;
  computeGrad(c, W); c.events.push({ t: 'respawn' }); c.respawns++;
}
/** Where a branch runs alongside the main road (fork and merge), move the car onto whichever route it's clearly
 *  nearer (a little hysteresis so it doesn't flicker between the two). */
function pickRoute(tr, c, pr) {
  const t = tr.twin[tr.bi(pr.i)]; if (t < 0) return pr;
  const q = project(tr, c.x, c.z, tr.lapU(t, tr.lapOf(pr.i)), 3, 3);
  return q.dist < pr.dist - 0.3 && Math.abs(tr.H[q.i] - c.y) < 4 ? q : pr;
}
/** Integrate one car for one step: engine, grip, gravity, ground, barriers. @param {import('../types.js').Car} c @param {number} dt @param {import('../types.js').World} W @param {boolean} racing */
export function stepCar(c, dt, W, racing) {
  const tr = W.tr, inp = c.inp;
  if (c.ghost > 0) c.ghost -= dt;
  if (c.oilT > 0) c.oilT -= dt;
  if (c.wreckT > 0) {
    c.wreckT -= dt; inp.throttle = 0; inp.brake = 0; inp.handbrake = 0; inp.steer = 0;
    const f = Math.exp(-2.5 * dt); c.vx *= f; c.vz *= f;
    if (c.wreckT <= 0) { c.wreckT = 0; respawn(c, W); c.dmg = { f: 0, b: 0, l: 0, r: 0 }; c.events.push({ t: 'repair' }); return; }
  }
  let pr = c.pr;
  const al0 = Math.abs(pr.lat), side0 = pr.lat >= 0 ? 1 : -1, wallSide0 = wallAt(W, pr.i, side0);
  c.surface = (al0 < HALF + 0.4 || (wallSide0 && al0 < wallPos(W, pr.i, side0) + 1.2)) ? W.surf : 'grass';
  if (tr.mud && al0 < HALF + 1.5) { const m = tr.mud[tr.bi(pr.i)]; if (m) c.surface = m === 2 ? 'ford' : 'mud'; }   // a bog or a water splash
  const S = c.surface === 'mud' && c.rut > 0 ? rutSurf(c) : SURF[c.surface];   // a bog: firmer where it's rutted
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = -fz, rz = fx;
  let vf = c.vx * fx + c.vz * fz, vr = c.vx * rx + c.vz * rz;
  if (c.onGround) {
    let a = 0; const mod = c.mod, wear = carWear(c);
    if (inp.throttle > 0) a += inp.throttle * PHYS.ENGINE * S.engine * mod * (1 - 0.3 * wear);
    if (inp.brake > 0) { if (vf > 0.5) a -= inp.brake * PHYS.BRAKE; else if (vf > -12) a -= inp.brake * PHYS.REVERSE; }
    if (c.boost > 0) a += PHYS.BOOST;
    if (c.draft > 0) a += c.draft * PHYS.DRAFT;                        // slipstream: tucked in behind another racer
    a -= PHYS.DRAG * vf * Math.abs(vf) + S.drag * vf;
    vf += a * dt;
    if (inp.throttle <= 0 && inp.brake <= 0 && Math.abs(vf) < 1) vf *= Math.max(0, 1 - 3 * dt);
    const hb = inp.handbrake > 0 && Math.abs(vf) > 6;
    const slick = c.oilT > 0 ? 0.22 : 1;                                    // on an oil slick the tyres barely hold
    const latMax = (hb ? PHYS.HB_LAT : S.latMax) * (0.8 + 0.2 * mod) * slick;
    const grip = (hb ? 1.4 : S.grip) * slick;
    let dvr = -vr * (1 - Math.exp(-grip * dt)); const lim = latMax * dt; dvr = clamp(dvr, -lim, lim); vr += dvr;
    const loss = (Math.abs(vr) * 0.35 + (hb ? 5 : 0)) * dt;
    if (Math.abs(vf) > loss) vf -= Math.sign(vf) * loss; else vf = 0;
    const sp = Math.abs(vf);
    const rate = PHYS.STEER * clamp(sp / 5, 0, 1) / (1 + sp / 55) * (hb ? 1.6 : 1);
    const pull = (c.dmg.r - c.dmg.l) * 0.12 * clamp(sp / 20, 0, 1);   // a bent corner drags the car toward it
    c.yaw -= (inp.steer + pull) * rate * (vf >= 0 ? 1 : -1) * dt;
    c.vx = fx * vf + rx * vr; c.vz = fz * vf + rz * vr;
    computeGrad(c, W);
    c.vx -= PHYS.GS * c.gx * dt; c.vz -= PHYS.GS * c.gz * dt;
    c.acc = a;
  } else {
    c.airT += dt; c.yaw -= inp.steer * 0.7 * dt; c.vy -= PHYS.G * dt;
    c.vx *= 1 - 0.05 * dt; c.vz *= 1 - 0.05 * dt; c.acc = 0;
  }
  c.vf = vf; c.vr = vr;
  if (c.spin) { c.yaw += c.spin * dt; c.spin *= Math.exp(-(c.onGround ? 4.5 : 0.8) * dt); if (Math.abs(c.spin) < 0.02) c.spin = 0; }
  if (c.boost > 0) c.boost -= dt;
  c.x += c.vx * dt; c.z += c.vz * dt;
  pr = project(tr, c.x, c.z, pr.i, 6, 10);
  if (tr.twin) pr = pickRoute(tr, c, pr);
  if (pr.dist > HALF + 12) {
    // off the road (e.g. through a broken barrier): pick the road back up further along if it's closer
    const q = tr.nearest(c.x, c.z);
    if (q && q.d < pr.dist - 3) {
      if (tr.nx) {
        const cand = tr.ahead(tr.bi(q.i), c.progress);
        if (cand >= 0 && tr.progOf(cand) - c.progress < 700 && Math.abs(tr.H[cand] - c.y) < 10) pr = project(tr, c.x, c.z, cand, 6, 10);
      } else {
        const cand = tr.loopN ? pr.i + ((q.i - pr.i % tr.loopN) % tr.loopN + tr.loopN) % tr.loopN : q.i;
        if (cand > pr.i && cand - pr.i < 700 && cand < tr.N - 3 && Math.abs(tr.H[cand] - c.y) < 10) pr = project(tr, c.x, c.z, cand, 6, 10);
      }
    }
  }
  c.pr = pr;
  const g = groundAt(W, pr.s, pr.lat, c.x, c.z);
  if (c.onGround) {
    const want = Math.min(14, (g - c.y) / dt);
    if (want < c.vy - PHYS.G * dt * 2.5 && c.vy - want > 3) {
      c.onGround = false; c.airT = 0; c.vy -= PHYS.G * dt; c.y += c.vy * dt;
      if (c.y <= g) { c.y = g; c.onGround = true; c.vy = want; }
    } else { c.vy = clamp(want, -40, 14); c.y = g; }
  } else {
    c.y += c.vy * dt;
    if (c.y <= g) {
      const air = c.airT, imp = -c.vy; c.y = g; c.onGround = true; c.vy = 0;
      c.squash = clamp(imp / 25, 0.15, 1);
      c.events.push({ t: 'land', air, imp });
      if (air > 0.45 && Math.abs(pr.lat) < HALF) {
        const along = c.vx * Math.sin(c.yaw) + c.vz * Math.cos(c.yaw), sp2 = Math.hypot(c.vx, c.vz);
        if (along > sp2 * 0.85) { c.boost = Math.max(c.boost, 0.7); c.events.push({ t: 'bigair' }); }
      }
    }
  }
  // barriers
  c.wallContact = false; c.scrape = null; c.grind = null;
  const lat = pr.lat, al = Math.abs(lat), side = lat >= 0 ? 1 : -1;
  const w = wallAt(W, pr.i, side), WL = wallPos(W, pr.i, side);
  if (w && c.y < roadH(tr, pr.s) + 1.4) {
    const nx = tr.rx[pr.i] * side, nz = tr.rz[pr.i] * side;
    const cf = Math.sin(c.yaw), cz = Math.cos(c.yaw);
    const ext = c.hw * Math.abs(-cz * nx + cf * nz) + c.hl * Math.abs(cf * nx + cz * nz);   // half-size of the car along the wall normal
    let push = 0, dir = 0;
    if (al <= WL && al > WL - ext) { push = al - (WL - ext); dir = -1; }
    else if (al > WL && al < WL + ext) { push = WL + ext - al; dir = 1; }
    const vn0 = dir ? (c.vx * nx + c.vz * nz) * (-dir) : 0;
    if (dir && vn0 > 3 && hitBarrier(W, pr.i, side, vn0, Math.sign(c.vx * tr.tx[pr.i] + c.vz * tr.tz[pr.i]) || 1, c)) {
      // smashed through: no bounce, just lose some speed
      const kk = w === 1 ? 0.82 : w === 3 ? 0.9 : W.bar.armco ? 0.72 : 0.87;
      c.vx *= kk; c.vz *= kk; c.spin += (Math.random() - 0.5) * Math.min(vn0, 20) * 0.03;
      c.events.push({ t: 'smash', v: vn0, w, x: c.x - nx * dir * ext, z: c.z - nz * dir * ext, y: c.y, nx: -nx * dir, nz: -nz * dir });
      damageCar(c, c.x - nx * dir * ext, c.z - nz * dir * ext, vn0, w === 3 ? 0.3 : w === 1 ? 0.5 : W.bar.armco ? 1 : 0.6, nx * dir, nz * dir);
    } else if (dir) {
      c.x += nx * push * dir; c.z += nz * push * dir; c.wallContact = true;
      const vn = (c.vx * nx + c.vz * nz) * (-dir);
      if (vn > 0) {
        const spBefore = Math.hypot(c.vx, c.vz);
        c.vx += nx * vn * 1.15 * dir; c.vz += nz * vn * 1.15 * dir;           // remove the into-wall part, small bounce
        const headOn = clamp(vn / Math.max(spBefore, 1), 0, 1);                 // 0 = glancing scrape, 1 = straight in
        const kk = 1 - 0.45 * headOn * headOn; c.vx *= kk; c.vz *= kk;
        { const along0 = c.vx * tr.tx[pr.i] + c.vz * tr.tz[pr.i]; c.spin += clamp(vn * 0.04, 0, 1.2) * Math.sign(along0 || 1) * (-side) * Math.sign(cf * tr.tx[pr.i] + cz * tr.tz[pr.i] || 1) * 0.5; }           // glancing hits barely cost anything, head-on hits do
        const wdx = nx * (-dir), wdz = nz * (-dir);
        if (vn > 3) { c.events.push({ t: 'hit', v: vn, w, x: c.x + wdx * ext, z: c.z + wdz * ext, y: c.y, nx: wdx, nz: wdz }); damageCar(c, c.x + wdx * ext, c.z + wdz * ext, vn, w === 3 ? 0.4 : w === 1 ? 0.7 : 1, -wdx, -wdz); }
      }
      { const sp = Math.hypot(c.vx, c.vz); if (sp > 6) c.scrape = { x: c.x + nx * (-dir) * ext, z: c.z + nz * (-dir) * ext, y: c.y, w, sp, vx: c.vx, vz: c.vz }; }
      { const sp = Math.hypot(c.vx, c.vz); if (sp > 0.1) { const f = Math.max(0, 1 - 7 * dt / sp); c.vx *= f; c.vz *= f; } } // light rubbing friction while in contact
      // swing the nose to run along the wall in the direction of travel
      const ttx = tr.tx[pr.i], ttz = tr.tz[pr.i], fx2 = Math.sin(c.yaw), fz2 = Math.cos(c.yaw);
      const along = c.vx * ttx + c.vz * ttz, fwdDot = fx2 * ttx + fz2 * ttz;
      const sgn = Math.abs(along) > 1.5 ? Math.sign(along) : (fwdDot >= 0 ? 1 : -1);
      const noseIn = (fx2 * nx + fz2 * nz) * (-dir);
      if (noseIn > 0.03) {
        const target = Math.atan2(ttx * sgn, ttz * sgn);
        c.yaw += wrapAngle(target - c.yaw) * Math.min(1, dt * 10);
        const vt = c.vx * nx + c.vz * nz; // keep lateral velocity from turning back into the wall
        if (vt * (-dir) > 0) { c.vx -= nx * vt; c.vz -= nz * vt; }
      }
    }
  }
  c.progress = tr.progOf(pr.s);
  if (c.onGround && al < HALF - 0.5) c.lastGood = pr.i;
  const spd = Math.hypot(c.vx, c.vz);
  if (pr.dist > 24) c.offT += dt * (spd > 8 && pr.dist < 70 ? 0.3 : 1); else c.offT = 0;   // a moving car gets time to cut across to the next bit of road
  if (racing && !c.finished && spd < 1.2) c.stuckT += dt; else c.stuckT = 0;
  if (c.isPlayer && racing && !c.finished) {
    const along = c.vx * tr.tx[pr.i] + c.vz * tr.tz[pr.i];
    if (along < -4) c.wrongT += dt; else c.wrongT = 0;
  }
  if (c.wallContact && spd < 3 && (c.inp.throttle > 0 || c.inp.brake > 0)) c.wallStuck = (c.wallStuck || 0) + dt; else c.wallStuck = 0;
  if (c.wallStuck > 0.6) {
    const i = pr.i, side2 = pr.lat >= 0 ? 1 : -1, fwd = (Math.sin(c.yaw) * tr.tx[i] + Math.cos(c.yaw) * tr.tz[i]) >= -0.2 ? 1 : -1;
    c.x -= tr.rx[i] * side2 * 1.0; c.z -= tr.rz[i] * side2 * 1.0;
    c.yaw = Math.atan2(tr.tx[i] * fwd, tr.tz[i] * fwd); c.vx = tr.tx[i] * fwd * 6; c.vz = tr.tz[i] * fwd * 6; c.wallStuck = 0;
  }
  // a gap: well below the road here means you fell in; come back on the far side
  if (tr.gap && c.y < tr.H[pr.i] - 9 && !c.destroyed) {
    const b = tr.bi(pr.i), land = tr.gapLand[b];
    if (land >= 0) { c.lastGood = pr.i - b + land + (land < b ? tr.loopN : 0) + 10; c.events.push({ t: 'fell' }); }
    respawn(c, W); return;
  }
  // boost pads
  if (tr.boostPad && c.onGround && al < HALF && tr.boostPad[tr.bi(pr.i)]) { if (!(c.boost > 0.3)) c.events.push({ t: 'boostpad' }); c.boost = Math.max(c.boost, BOOST_PAD); }
  if (c.offT > 0.6 && !c.destroyed) respawn(c, W);   // a smashed road car stays where it lands
  else if (!c.isPlayer && !c.traffic && c.stuckT > 2.5) respawn(c, W);
  else if (!c.isPlayer && racing && (c.strandT = al > WALL + 1.5 ? (c.strandT || 0) + dt : 0) > 2.5) respawn(c, W);   // AI stranded off-road
  if (pr.i >= tr.NM - 6 && pr.i < tr.NM) { c.vx *= 1 - 4 * dt; c.vz *= 1 - 4 * dt; }
}
