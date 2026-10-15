import * as THREE from 'three';
import { scene } from '../renderer.js';

// Tyre trails: what a car carries on its tyres after driving through something (render/effects/carfx.js lays them):
// black oily marks out of an oil slick, grey ones out of wet cement, dark wet ones out of water. Like skid marks
// (skids.js) but laid whether or not the car slides, each streak in its own colour, fading as the tyres wipe clean
// (the colour is mixed toward the road's as the car's trail runs out). One ring of streaks, one draw.
export const TRAIL = { MAX: 1400, W: 0.16,
  oil: { col: 0x0B0B0E, t: 2.4 }, cement: { col: 0x8E8B84, t: 2.6 }, wet: { col: 0x262A30, t: 1.3 } };
let mesh = null, pos, colr, head = 0, count = 0;
const _c = new THREE.Color(), _road = new THREE.Color(0x4F535B);
export function initTrails() {
  pos = new Float32Array(TRAIL.MAX * 18); colr = new Float32Array(TRAIL.MAX * 18);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3).setUsage(THREE.DynamicDrawUsage)); g.setAttribute('color', new THREE.BufferAttribute(colr, 3).setUsage(THREE.DynamicDrawUsage));
  mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2.5 }));
  mesh.frustumCulled = false; mesh.renderOrder = 1; g.setDrawRange(0, 0); scene.add(mesh);
}
export function clearTrails() { if (!mesh) return; head = 0; count = 0; mesh.geometry.setDrawRange(0, 0); }
/** A streak of `kind` from a to b ([x, y, z]); `k` (0..1) how much is left on the tyres (fainter toward the road's colour). */
export function addTrail(a, b, kind, k) {
  if (!mesh) return;
  const dx = b[0] - a[0], dz = b[2] - a[2], L = Math.hypot(dx, dz) || 1, wx = -dz / L * TRAIL.W, wz = dx / L * TRAIL.W;
  const P = [a[0] - wx, a[1], a[2] - wz, a[0] + wx, a[1], a[2] + wz, b[0] - wx, b[1], b[2] - wz, b[0] + wx, b[1], b[2] + wz], order = [0, 1, 2, 2, 1, 3], o = head * 18;
  _c.setHex(TRAIL[kind].col).lerp(_road, 1 - Math.max(0, Math.min(1, k)));
  for (let q = 0; q < 6; q++) { const v = order[q] * 3; pos[o + q * 3] = P[v]; pos[o + q * 3 + 1] = P[v + 1]; pos[o + q * 3 + 2] = P[v + 2]; colr[o + q * 3] = _c.r; colr[o + q * 3 + 1] = _c.g; colr[o + q * 3 + 2] = _c.b; }
  head = (head + 1) % TRAIL.MAX; count = Math.min(TRAIL.MAX, count + 1);
  const g = mesh.geometry; g.setDrawRange(0, count * 6); g.attributes.position.needsUpdate = true; g.attributes.color.needsUpdate = true;
}
