import * as THREE from 'three';
import { lerp } from '../../core/math.js';
import { waterGrid, waterMaterial } from '../water.js';

let logs = [];
// The river (or the sea, a lake, a park pond: stage.river): a water sheet at its level along the polyline and on past
// both ends, its width plus room for the banks, every 2.5 m. The ground carved under it (core terrain.js riverBed)
// makes the shoreline: render/water.js fades the sheet out where the land rises through it, so the water ends round
// the shape of the bed instead of in a straight edge.
export function addRiver(group, tr, terr) {
  logs = []; const rv = tr.river; if (!rv) return;
  const P = rv.pts, hw = rv.width / 2 + 8, STEP = 2.5, line = [];
  const dirAt = k => { const [ax, az] = P[k], [bx, bz] = P[k + 1], L = Math.hypot(bx - ax, bz - az); return [(bx - ax) / L, (bz - az) / L]; };
  const d0 = dirAt(0), d1 = dirAt(P.length - 2);
  for (let e = hw; e > 0; e -= STEP) line.push([P[0][0] - d0[0] * e, P[0][1] - d0[1] * e, ...d0]);   // on past the first point
  for (let k = 0; k < P.length - 1; k++) {
    const [ax, az] = P[k], [bx, bz] = P[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / STEP), d = dirAt(k);
    for (let q = 0; q < n; q++) line.push([lerp(ax, bx, q / n), lerp(az, bz, q / n), ...d]);
  }
  for (let e = 0; e <= hw; e += STEP) line.push([P[P.length - 1][0] + d1[0] * e, P[P.length - 1][1] + d1[1] * e, ...d1]);   // and past the last
  const C = Math.ceil(2 * hw / STEP) + 1, y = rv.level;
  const mat = rv.frozen ? waterMaterial({ color: 0xA9C8E0, frozen: true }) : waterMaterial({ color: rv.color || 0x3E7DAE, alpha: 0.94 });
  const m = waterGrid(line.length, C, (r, c) => { const [x, z, dx, dz] = line[r], o = -hw + c * 2 * hw / (C - 1), wx = x - dz * o, wz = z + dx * o; return [wx, y, wz, terr.at(wx, wz)]; }, mat);
  if (m) group.add(m);
}
// logs drifting downstream (river.logs of them): along the polyline from its first point, bobbing, wrapping at the end
export function addRiverLogs(group, tr) {
  const rv = tr.river; if (!rv || !rv.logs) return;
  const seg = [], P = rv.pts; let total = 0;
  for (let k = 0; k < P.length - 1; k++) { const l = Math.hypot(P[k + 1][0] - P[k][0], P[k + 1][1] - P[k][1]); seg.push({ a: P[k], b: P[k + 1], s0: total, l }); total += l; }
  const geo = new THREE.CylinderGeometry(0.34, 0.34, 1, 8).rotateZ(Math.PI / 2), mat = new THREE.MeshLambertMaterial({ color: 0x6B4428 });
  for (let n = 0; n < rv.logs; n++) {
    const m = new THREE.Mesh(geo, mat); m.scale.x = 4 + (n * 37 % 5); m.castShadow = true; group.add(m);
    logs.push({ m, s: total * n / rv.logs, off: ((n * 53) % 11 / 10 - 0.5) * rv.width * 0.6, v: 3 + (n % 3), spin: n * 1.7, seg, total, y: rv.level });
  }
}
export function updateRiverLogs(dt, now) {
  for (const g of logs) {
    g.s = (g.s + g.v * dt) % g.total;
    const S = g.seg.find(q => g.s < q.s0 + q.l) || g.seg[g.seg.length - 1], t = (g.s - S.s0) / S.l, dx = (S.b[0] - S.a[0]) / S.l, dz = (S.b[1] - S.a[1]) / S.l;
    g.m.position.set(S.a[0] + dx * S.l * t - dz * g.off, g.y + 0.12 + Math.sin(now * 1.7 + g.spin) * 0.08, S.a[1] + dz * S.l * t + dx * g.off);
    g.m.rotation.set(0, Math.atan2(-dz, dx) + 0.4 * Math.sin(now * 0.3 + g.spin), 0);
  }
}
