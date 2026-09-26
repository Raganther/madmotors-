import * as THREE from 'three';
import { _c, _e, _m, _p, _q, _s } from '../geometry.js';
import { scene } from '../renderer.js';
import { G } from '../../game.js';

// ---------- particles & skids ----------
export const PMAX = 500;
export let pMesh, pIdx = 0;
export const pData = [];
export let pColorDirty = false;
export function initParticles() {
  pMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), PMAX);
  pMesh.frustumCulled = false; pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  _m.makeScale(0, 0, 0);
  for (let i = 0; i < PMAX; i++) { pData.push({ age: 1, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, g: 0 }); pMesh.setMatrixAt(i, _m); _c.set(0xffffff); pMesh.setColorAt(i, _c); }
  scene.add(pMesh);
}
export function emit(x, y, z, vx, vy, vz, life, size, color, grav) {
  const i = pIdx; pIdx = (pIdx + 1) % PMAX; const p = pData[i];
  Object.assign(p, { age: 0, life, x, y, z, vx, vy, vz, s: size, g: grav }); _c.set(color); pMesh.setColorAt(i, _c); pColorDirty = true;
}
export function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = pData[i]; if (p.age >= p.life) continue;
    p.age += dt;
    if (p.age >= p.life) { _m.makeScale(0, 0, 0); pMesh.setMatrixAt(i, _m); continue; }
    p.vy -= p.g * dt; const dr = Math.exp(-dt * 2.2); p.vx *= dr; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const t = p.age / p.life, s = p.s * Math.min(1, t * 8) * (1 - t) * (G.persp ? 0.6 : 1.4);   // sized for the high camera; up close they'd fill the screen
    _e.set(p.age * 3, p.age * 2, 0); _q.setFromEuler(_e); _p.set(p.x, p.y, p.z); _s.set(s, s, s); _m.compose(_p, _q, _s); pMesh.setMatrixAt(i, _m);
  }
  pMesh.instanceMatrix.needsUpdate = true; if (pColorDirty) { pMesh.instanceColor.needsUpdate = true; pColorDirty = false; }
}
