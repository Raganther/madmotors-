import * as THREE from 'three';
import { scene } from '../renderer.js';

export const rings = [];
export function initRings() {
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(new THREE.RingGeometry(0.75, 1, 28).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFF3C4, transparent: true, opacity: 0, depthWrite: false, depthTest: false, side: THREE.DoubleSide }));
    m.renderOrder = 10; m.visible = false; scene.add(m); rings.push({ m, t: 1, max: 1 });
  }
}
export let ringIdx = 0;
export function shockwave(x, y, z, size, color) { const r = rings[ringIdx]; ringIdx = (ringIdx + 1) % rings.length; r.m.position.set(x, y + 0.25, z); r.m.material.color.set(color || 0xFFF3C4); r.t = 0; r.max = size; r.m.visible = true; }
export function updateRings(dt) { for (const r of rings) { if (r.t >= 1) continue; r.t += dt / 0.38; const k = Math.min(1, r.t), e = 1 - Math.pow(1 - k, 3); r.m.scale.setScalar(0.6 + e * r.max); r.m.material.opacity = 0.85 * (1 - k); if (k >= 1) r.m.visible = false; } }
