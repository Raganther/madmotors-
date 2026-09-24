import * as THREE from 'three';
import { G } from '../../game.js';
import { groundAt, project } from '../../core/track/query.js';
import { _c, _e, _m, _p, _q, _s, flat } from '../geometry.js';
import { scene } from '../renderer.js';

export const DMAX = 360;
export let dMesh, dIdx = 0;
export const dData = [];
export function initDebris() {
  dMesh = new THREE.InstancedMesh(flat(new THREE.BoxGeometry(1, 1, 1)), new THREE.MeshLambertMaterial({ color: 0xffffff }), DMAX);
  dMesh.frustumCulled = false; dMesh.castShadow = true; dMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  _m.makeScale(0, 0, 0);
  for (let i = 0; i < DMAX; i++) { dData.push({ age: 1, life: 0 }); dMesh.setMatrixAt(i, _m); _c.set(0xffffff); dMesh.setColorAt(i, _c); }
  scene.add(dMesh);
}
export function debris(x, y, z, vx, vy, vz, color, sx, sy, sz, life, hint) {
  const i = dIdx; dIdx = (dIdx + 1) % DMAX; const d = dData[i];
  Object.assign(d, { age: 0, life, x, y, z, vx, vy, vz, sx, sy, sz, rx: Math.random() * 6, ry: Math.random() * 6, rz: Math.random() * 6,
    wx: (Math.random() - 0.5) * 18, wy: (Math.random() - 0.5) * 18, wz: (Math.random() - 0.5) * 18, hint: hint || 0, rest: false });
  _c.set(color); dMesh.setColorAt(i, _c); dMesh.instanceColor.needsUpdate = true;
}
export function updateDebris(dt) {
  if (!G.world) return;
  const W = G.world.W, tr = W.tr;
  for (let i = 0; i < DMAX; i++) {
    const d = dData[i]; if (d.age >= d.life) continue;
    d.age += dt;
    if (d.age >= d.life) { _m.makeScale(0, 0, 0); dMesh.setMatrixAt(i, _m); continue; }
    if (!d.rest) {
      d.vy -= 30 * dt; d.x += d.vx * dt; d.y += d.vy * dt; d.z += d.vz * dt;
      d.rx += d.wx * dt; d.ry += d.wy * dt; d.rz += d.wz * dt;
      const pr = project(tr, d.x, d.z, d.hint, 20, 20); d.hint = pr.i;
      const gy = groundAt(W, pr.s, pr.lat, d.x, d.z) + d.sy * 0.5;
      if (d.y < gy) {
        d.y = gy; d.vy = -d.vy * 0.32; d.vx *= 0.62; d.vz *= 0.62; d.wx *= 0.5; d.wy *= 0.5; d.wz *= 0.5;
        if (Math.abs(d.vy) < 1.2 && Math.hypot(d.vx, d.vz) < 1) { d.rest = true; d.rx = Math.round(d.rx / (Math.PI / 2)) * Math.PI / 2; d.rz = Math.round(d.rz / (Math.PI / 2)) * Math.PI / 2; }
      }
    }
    const fade = d.life - d.age < 0.6 ? (d.life - d.age) / 0.6 : 1;
    _e.set(d.rx, d.ry, d.rz); _q.setFromEuler(_e); _p.set(d.x, d.y, d.z); _s.set(d.sx * fade, d.sy * fade, d.sz * fade); _m.compose(_p, _q, _s); dMesh.setMatrixAt(i, _m);
  }
  dMesh.instanceMatrix.needsUpdate = true;
}
export function clearDebris() { if (!dMesh) return; _m.makeScale(0, 0, 0); for (let i = 0; i < DMAX; i++) { dData[i].age = 1; dData[i].life = 0; dMesh.setMatrixAt(i, _m); } dMesh.instanceMatrix.needsUpdate = true; }
