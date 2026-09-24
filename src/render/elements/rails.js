import * as THREE from 'three';
import { HALF } from '../../core/constants.js';
import { railAt } from '../../core/track/rails.js';
import { addInstanced, chunkMesh, flat } from '../geometry.js';
import { withCutaway } from '../materials.js';

// ---------- railway visuals ----------
export function railNearRoad(tr, x, z, h) { const q = tr.nearest(x, z); return q && q.d < HALF + 1.6 && Math.abs(tr.H[q.i] - h) < 3; }
export function addRails(group, tr) {
  const rl = tr.rails; if (!rl) return;
  const sleepers = [], rails = [], panels = [], ballast = [], portals = [];
  for (const L of rl.lines) {
    for (let s = L.visA; s < L.visB; s += 1.5) {
      const p = railAt(L, s), road = railNearRoad(tr, p.x, p.z, p.h), rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      if (road) { const q = tr.nearest(p.x, p.z); panels.push({ x: p.x, y: tr.H[q.i] + 0.03, z: p.z, ry: p.yaw, sx: 3.4, sy: 0.12, sz: 1.52, color: 0x9A9A96 }); }
      else sleepers.push({ x: p.x, y: p.h + 0.12, z: p.z, ry: p.yaw, sx: 2.6, sy: 0.16, sz: 0.34, color: 0x5B4636 });
      if ((s - L.visA) % 3 < 1.5) {
        const p2 = railAt(L, Math.min(L.visB, s + 3)), y = road ? tr.H[tr.nearest(p.x, p.z).i] + 0.12 : p.h + 0.28;
        for (const side of [-0.72, 0.72]) rails.push({ x: (p.x + p2.x) / 2 + rx * side, y, z: (p.z + p2.z) / 2 + rz * side, ry: p.yaw, sx: 0.12, sy: 0.14, sz: Math.hypot(p2.x - p.x, p2.z - p.z) + 0.05, color: 0xB9BCC2 });
      }
      if (!road) {   // ballast bed as a ribbon
        const p2 = railAt(L, Math.min(L.visB, s + 1.5)), w = 2.1;
        const q = [p.x + rx * w, p.h + 0.05, p.z + rz * w], r = [p.x - rx * w, p.h + 0.05, p.z - rz * w], q2 = [p2.x + rx * w, p2.h + 0.05, p2.z + rz * w], r2 = [p2.x - rx * w, p2.h + 0.05, p2.z - rz * w];
        ballast.push(...q, ...r, ...q2, ...q2, ...r, ...r2);
      }
    }
    if (L.def.portals) for (const [s, into] of [[L.visA, -1], [L.visB, 1]]) {
      const p = railAt(L, s), f = [Math.sin(p.yaw) * into, Math.cos(p.yaw) * into], rx = Math.cos(p.yaw), rz = -Math.sin(p.yaw);
      portals.push({ x: p.x + f[0] * 1.2, y: p.h + 5, z: p.z + f[1] * 1.2, ry: p.yaw, sx: 16, sy: 12, sz: 2.2, color: 0x8F887C });                  // stone headwall
      portals.push({ x: p.x - f[0] * 0.05, y: p.h + 2.9, z: p.z - f[1] * 0.05, ry: p.yaw, sx: 5.4, sy: 5.8, sz: 0.4, color: 0x14161C });               // dark mouth
      for (const side of [-1, 1]) portals.push({ x: p.x + rx * side * 3.1 - f[0] * 0.3, y: p.h + 3, z: p.z + rz * side * 3.1 - f[1] * 0.3, ry: p.yaw, sx: 0.8, sy: 6, sz: 0.9, color: 0xB5AC9C });
      portals.push({ x: p.x - f[0] * 0.3, y: p.h + 6.2, z: p.z - f[1] * 0.3, ry: p.yaw, sx: 7, sy: 0.9, sz: 0.9, color: 0xB5AC9C });
    }
  }
  const box = () => flat(new THREE.BoxGeometry(1, 1, 1)), L = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  addInstanced(group, box(), L(), sleepers, { receive: true });
  addInstanced(group, box(), L(), rails, {});
  addInstanced(group, box(), L(), panels, { receive: true });
  addInstanced(group, box(), L(), portals, { cast: true, receive: true });
  if (ballast.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ballast, 3)); g.computeVertexNormals();
    group.add(chunkMesh(g, withCutaway(new THREE.MeshLambertMaterial({ color: 0x8C8378, side: THREE.DoubleSide }), false, { cut: false, cloud: true }), 60, true));
  }
}
