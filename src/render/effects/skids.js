import * as THREE from 'three';
import { scene } from '../renderer.js';
import { carVis } from '../vehicles.js';

export const SKMAX = 1600;
export let skMesh, skPos, skHead = 0, skCount = 0;
export function initSkids() {
  skPos = new Float32Array(SKMAX * 18);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(skPos, 3)); g.attributes.position.setUsage(THREE.DynamicDrawUsage);
  skMesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x1A1A1A, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  skMesh.frustumCulled = false; g.setDrawRange(0, 0); scene.add(skMesh);
}
export function clearSkids() { if (!skMesh) return; skHead = 0; skCount = 0; skMesh.geometry.setDrawRange(0, 0); carVis.forEach(v => v.skPrev = [null, null]); }
export function addSkid(a, b) {
  const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, wx = -dz / L * 0.19, wz = dx / L * 0.19;
  const o = skHead * 18, P = [a[0] - wx, a[1], a[2] - wz, a[0] + wx, a[1], a[2] + wz, b[0] - wx, b[1], b[2] - wz, b[0] + wx, b[1], b[2] + wz];
  const order = [0, 1, 2, 2, 1, 3];
  for (let k = 0; k < 6; k++) { const q = order[k] * 3; skPos[o + k * 3] = P[q]; skPos[o + k * 3 + 1] = P[q + 1]; skPos[o + k * 3 + 2] = P[q + 2]; }
  skHead = (skHead + 1) % SKMAX; skCount = Math.min(SKMAX, skCount + 1);
  skMesh.geometry.setDrawRange(0, skCount * 6); skMesh.geometry.attributes.position.needsUpdate = true;
}
