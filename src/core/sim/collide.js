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
        const cA = rAz * h.nx - rAx * h.nz, cB = rBz * h.nx - rBx * h.nz, e = 0.25;
        const j = -(1 + e) * vrel / (A.im + B.im + cA * cA * A.im / CAR_I + cB * cB * B.im / CAR_I);
        A.vx -= j * h.nx * A.im; A.vz -= j * h.nz * A.im; B.vx += j * h.nx * B.im; B.vz += j * h.nz * B.im;
        A.spin = clamp(A.spin - j * cA * A.im / CAR_I, -4, 4); B.spin = clamp(B.spin + j * cB * B.im / CAR_I, -4, 4);
        // a little rubbing friction along the contact so cars don't skate past each other
        const tx = -h.nz, tz = h.nx, vt = (vBx - vAx) * tx + (vBz - vAz) * tz, f = clamp(vt, -j * 0.3, j * 0.3) * 0.5;
        A.vx += tx * f * A.im; A.vz += tz * f * A.im; B.vx -= tx * f * B.im; B.vz -= tz * f * B.im;
        if (-vrel > 4) { A.events.push({ t: 'bump', v: -vrel, x: px, z: pz, y: (A.y + B.y) / 2, a: A, b: B, nx: h.nx, nz: h.nz }); damageCar(A, px, pz, -vrel, 1.6 / (1 + Math.sqrt(B.im)), -h.nx, -h.nz); damageCar(B, px, pz, -vrel, 1.6 / (1 + Math.sqrt(A.im)), h.nx, h.nz); }
      }
      impulseDone = true;
    }
  }
}
