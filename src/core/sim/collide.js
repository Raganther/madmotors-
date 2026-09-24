import { CAR_I } from '../constants.js';
import { clamp } from '../math.js';
import { damageCar } from './damage.js';

export function carCorners(c) {
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = -fz, rz = fx, out = [];
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) out.push([c.x + fx * c.hl * a + rx * c.hw * b, c.z + fz * c.hl * a + rz * c.hw * b]);
  return out;
}
export function carSAT(A, B) {
  const af = [Math.sin(A.yaw), Math.cos(A.yaw)], bf = [Math.sin(B.yaw), Math.cos(B.yaw)];
  const ar = [-af[1], af[0]], br = [-bf[1], bf[0]], dx = B.x - A.x, dz = B.z - A.z;
  let best = Infinity, nx = 0, nz = 0;
  for (const n of [af, ar, bf, br]) {
    const ra = A.hw * Math.abs(ar[0] * n[0] + ar[1] * n[1]) + A.hl * Math.abs(af[0] * n[0] + af[1] * n[1]);
    const rb = B.hw * Math.abs(br[0] * n[0] + br[1] * n[1]) + B.hl * Math.abs(bf[0] * n[0] + bf[1] * n[1]);
    const d = dx * n[0] + dz * n[1], o = ra + rb - Math.abs(d);
    if (o <= 0) return null;
    if (o < best) { best = o; const s = d < 0 ? -1 : 1; nx = n[0] * s; nz = n[1] * s; }
  }
  return { depth: best, nx, nz };
}
// Arcade takedowns: a racer hitting a road car (traffic or parked) this hard destroys it outright. The wreck is
// thrown up and away, the racer ploughs through keeping most of its speed and takes only light damage.
export const SMASH_V = 11;
function takedown(T, racer, nx, nz, px, pz, v, keep) {
  T.destroyed = true; T.dmg = { f: 1, b: 1, l: 1, r: 1 }; T.wreckT = 1e9; T.wrecks++; T.boost = 0;
  const push = 0.55 * v, side = Math.sign((T.x - racer.x) * racer.vz - (T.z - racer.z) * racer.vx) || 1;
  T.vx = racer.vx * 0.55 + nx * push; T.vz = racer.vz * 0.55 + nz * push; T.vy = Math.min(13, 5 + v * 0.3); T.onGround = false; T.airT = 0;
  T.spin = clamp(side * (2 + v * 0.08), -4, 4);
  racer.vx = keep[0] * 0.82 + racer.vx * 0.18; racer.vz = keep[1] * 0.82 + racer.vz * 0.18; racer.spin *= 0.5;
  T.events.push({ t: 'destroyed', x: px, z: pz, y: T.y, v, by: racer, nx, nz });
  racer.boost = Math.max(racer.boost, 0.5);   // a little shove of boost for the takedown
  racer.events.push({ t: 'takedown', kind: T.def.kind, v });
}
export function collideCars(cars) {
  const n = cars.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
    const A = cars[a], B = cars[b];
    if (A.ghost > 0 || B.ghost > 0 || Math.abs(A.y - B.y) > 2) continue;
    if ((B.x - A.x) ** 2 + (B.z - A.z) ** 2 > (A.hl + B.hl + 1) ** 2) continue;                         // cheap distance reject
    let impulseDone = false;
    for (let it = 0; it < 3; it++) {
      const h = carSAT(A, B); if (!h) break;
      // push apart along the contact normal (split evenly)
      const push = h.depth + 0.01, sa = A.im / (A.im + B.im), sb = 1 - sa;   // heavier vehicles get shoved less
      A.x -= h.nx * push * sa; A.z -= h.nz * push * sa; B.x += h.nx * push * sb; B.z += h.nz * push * sb;
      if (impulseDone) continue;
      // contact point: deepest corner of each car into the other, averaged
      // contact point: average of the touching corners (a flat bumper-to-bumper hit uses the middle of the face)
      const cornA = carCorners(A), cornB = carCorners(B);
      const dA = cornA.map(p => (p[0] - A.x) * h.nx + (p[1] - A.z) * h.nz), dB = cornB.map(p => (p[0] - B.x) * h.nx + (p[1] - B.z) * h.nz);
      const mA = Math.max(...dA), mB = Math.min(...dB);
      let sx = 0, sz = 0, cnt = 0;
      cornA.forEach((p, k) => { if (dA[k] > mA - 0.15) { sx += p[0]; sz += p[1]; cnt++; } });
      cornB.forEach((p, k) => { if (dB[k] < mB + 0.15) { sx += p[0]; sz += p[1]; cnt++; } });
      // project onto the contact line between the cars so the lever arm is measured at the touching surface
      let px = sx / cnt, pz = sz / cnt;
      const rAx = px - A.x, rAz = pz - A.z, rBx = px - B.x, rBz = pz - B.z;
      // point velocities include spin: v + w * (rz, -rx)
      const vAx = A.vx + A.spin * rAz, vAz = A.vz - A.spin * rAx, vBx = B.vx + B.spin * rBz, vBz = B.vz - B.spin * rBx;
      const vrel = (vBx - vAx) * h.nx + (vBz - vAz) * h.nz;
      if (vrel < 0) {
        const keepA = [A.vx, A.vz], keepB = [B.vx, B.vz];
        const cA = rAz * h.nx - rAx * h.nz, cB = rBz * h.nx - rBx * h.nz, e = 0.25;
        const j = -(1 + e) * vrel / (A.im + B.im + cA * cA * A.im / CAR_I + cB * cB * B.im / CAR_I);
        A.vx -= j * h.nx * A.im; A.vz -= j * h.nz * A.im; B.vx += j * h.nx * B.im; B.vz += j * h.nz * B.im;
        A.spin = clamp(A.spin - j * cA * A.im / CAR_I, -4, 4); B.spin = clamp(B.spin + j * cB * B.im / CAR_I, -4, 4);
        // a little rubbing friction along the contact so cars don't skate past each other
        const tx = -h.nz, tz = h.nx, vt = (vBx - vAx) * tx + (vBz - vAz) * tz, f = clamp(vt, -j * 0.3, j * 0.3) * 0.5;
        A.vx += tx * f * A.im; A.vz += tz * f * A.im; B.vx -= tx * f * B.im; B.vz -= tz * f * B.im;
        // sustained side-by-side rubbing throws sparks (render-only marker, cleared every step)
        if (Math.abs(vt) > 5) { const g = { x: px, z: pz, y: (A.y + B.y) / 2, v: Math.abs(vt), tx, tz }; A.grind = g; B.grind = g; }
        const smashB = B.traffic && !A.traffic && !B.destroyed && -vrel > SMASH_V, smashA = A.traffic && !B.traffic && !A.destroyed && -vrel > SMASH_V;
        if (smashB) { takedown(B, A, h.nx, h.nz, px, pz, -vrel, keepA); damageCar(A, px, pz, -vrel, 0.4, -h.nx, -h.nz); }
        else if (smashA) { takedown(A, B, -h.nx, -h.nz, px, pz, -vrel, keepB); damageCar(B, px, pz, -vrel, 0.4, h.nx, h.nz); }
        else if (-vrel > 4) { A.events.push({ t: 'bump', v: -vrel, x: px, z: pz, y: (A.y + B.y) / 2, a: A, b: B, nx: h.nx, nz: h.nz }); damageCar(A, px, pz, -vrel, 1.6 / (1 + Math.sqrt(B.im)), -h.nx, -h.nz); damageCar(B, px, pz, -vrel, 1.6 / (1 + Math.sqrt(A.im)), h.nx, h.nz); }
      }
      impulseDone = true;
    }
  }
}
