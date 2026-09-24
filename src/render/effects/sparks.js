import * as THREE from 'three';
import { _c, _m, _p, _q, _s } from '../geometry.js';
import { scene } from '../renderer.js';

// ---------- spark streaks ----------
// Bright, unlit slivers stretched along their velocity (longer when fast), falling under gravity, bouncing once off
// the height they were thrown from and cooling from white-yellow to orange as they die.
export const SMAX = 600;
let sMesh, sIdx = 0, sDirty = false;
const sData = [], _dir = new THREE.Vector3(), _up = new THREE.Vector3(0, 0, 1);
const HOT = new THREE.Color(0xFFF6C0), COOL = new THREE.Color(0xFF6A1E);
export function initSparks() {
  sMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.07, 0.07, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), SMAX);
  sMesh.frustumCulled = false; sMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  _m.makeScale(0, 0, 0);
  for (let i = 0; i < SMAX; i++) { sData.push({ age: 1, life: 0 }); sMesh.setMatrixAt(i, _m); sMesh.setColorAt(i, HOT); }
  scene.add(sMesh);
}
/** One spark at (x,y,z) with velocity (vx,vy,vz). */
export function spark(x, y, z, vx, vy, vz, life = 0.35 + Math.random() * 0.3) {
  if (!sMesh) return;
  const i = sIdx; sIdx = (sIdx + 1) % SMAX;
  Object.assign(sData[i], { age: 0, life, x, y, z, vx, vy, vz, floor: y - 0.6, heat: 0.6 + Math.random() * 0.4 });
}
/** A burst of n sparks, sprayed mostly along (dx,dz) when given, otherwise all round. */
export function sparkBurst(x, y, z, n, dx = 0, dz = 0, speed = 14) {
  for (let k = 0; k < n; k++) {
    const a = Math.random() * Math.PI * 2, r = Math.random() * speed * (dx || dz ? 0.5 : 1), s = speed * (0.4 + Math.random() * 0.8);
    spark(x, y, z, dx * s + Math.cos(a) * r, 2 + Math.random() * 7, dz * s + Math.sin(a) * r);
  }
}
export function updateSparks(dt) {
  if (!sMesh) return;
  for (let i = 0; i < SMAX; i++) {
    const p = sData[i]; if (p.age >= p.life) continue;
    p.age += dt;
    if (p.age >= p.life) { _m.makeScale(0, 0, 0); sMesh.setMatrixAt(i, _m); continue; }
    p.vy -= 22 * dt; const dr = Math.exp(-dt * 1.5); p.vx *= dr; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    if (p.y < p.floor && p.vy < 0) { p.y = p.floor; p.vy *= -0.35; p.vx *= 0.7; p.vz *= 0.7; }
    const sp = Math.hypot(p.vx, p.vy, p.vz), t = p.age / p.life, len = Math.min(1.6, 0.15 + sp * 0.06) * (1 - t * 0.6);
    _dir.set(p.vx, p.vy, p.vz).normalize(); _q.setFromUnitVectors(_up, _dir);
    _p.set(p.x, p.y, p.z); _s.set(1 - t * 0.5, 1 - t * 0.5, len); _m.compose(_p, _q, _s); sMesh.setMatrixAt(i, _m);
    _c.copy(HOT).lerp(COOL, Math.min(1, t * 1.3 * (2 - p.heat))); sMesh.setColorAt(i, _c); sDirty = true;
  }
  sMesh.instanceMatrix.needsUpdate = true; if (sDirty) { sMesh.instanceColor.needsUpdate = true; sDirty = false; }
}
export function clearSparks() { if (!sMesh) return; _m.makeScale(0, 0, 0); for (let i = 0; i < SMAX; i++) { sData[i].age = 1; sData[i].life = 0; sMesh.setMatrixAt(i, _m); } sMesh.instanceMatrix.needsUpdate = true; }
