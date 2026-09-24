import * as THREE from 'three';
import { lerp } from '../../core/math.js';
import { chunkMesh } from '../geometry.js';
import { withCutaway } from '../materials.js';

let logs = [];
export function addRiver(group, tr) {
  logs = []; const rv = tr.river; if (!rv) return;
  const pos = [], hw = rv.width / 2 + 6, y = rv.level;
  for (let k = 0; k < rv.pts.length - 1; k++) {
    const [ax, az] = rv.pts[k], [bx, bz] = rv.pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 8), nx = -(bz - az) / L * hw, nz = (bx - ax) / L * hw;
    for (let q = 0; q < n; q++) {
      const t0 = q / n, t1 = (q + 1) / n, x0 = lerp(ax, bx, t0), z0 = lerp(az, bz, t0), x1 = lerp(ax, bx, t1), z1 = lerp(az, bz, t1);
      pos.push(x0 - nx, y, z0 - nz, x1 - nx, y, z1 - nz, x0 + nx, y, z0 + nz, x0 + nx, y, z0 + nz, x1 - nx, y, z1 - nz, x1 + nx, y, z1 + nz);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals();
  // wind the triangles upward if the polyline ran the other way
  if (g.attributes.normal.array[1] < 0) { g.attributes.normal.array.forEach((v, i, a) => a[i] = -v); }
  const mat = withCutaway(new THREE.MeshLambertMaterial({ color: 0x3E7DAE, side: THREE.DoubleSide }), false, { cut: false, cloud: true, water: true });   // opaque: nothing needs to show through
  group.add(chunkMesh(g, mat, 80, true));
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
