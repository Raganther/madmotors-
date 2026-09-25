import * as THREE from 'three';
import { radialTex } from '../geometry.js';
import { camT } from '../camera.js';
import { quality } from '../renderer.js';

// Falling snow (stage option `snowfall: 0..1`, how heavy): flakes drifting down through a box that follows the camera
// target, wrapping round so there are always some in view. Looks only; off on Graphics: Low.
const BOX = { x: 110, y: 40, z: 110 }, MAX = 1600;
let pts = null, off = null, amt = 0;
export function addSnowfall(group, stage) {
  pts = null; amt = stage.snowfall || 0; if (!amt) return;
  const n = Math.round(MAX * Math.min(1, amt)), p = new Float32Array(n * 3); off = new Float32Array(n * 4);
  let s = 41; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < n; k++) { off[k * 4] = r() * BOX.x; off[k * 4 + 1] = r() * BOX.y; off[k * 4 + 2] = r() * BOX.z; off[k * 4 + 3] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  const mat = new THREE.PointsMaterial({ map: radialTex([[0, 'rgba(255,255,255,1)'], [0.45, 'rgba(255,255,255,0.8)'], [1, 'rgba(255,255,255,0)']]), size: 5, sizeAttenuation: false, transparent: true, depthWrite: false, opacity: 0.9 });
  pts = new THREE.Points(g, mat); pts.frustumCulled = false; pts.renderOrder = 3; group.add(pts);
}
const wrap = (v, m) => ((v % m) + m) % m;
export function updateSnowfall(dt, now) {
  if (!pts) return;
  pts.visible = quality !== 'low'; if (!pts.visible) return;
  const p = pts.geometry.attributes.position.array, n = p.length / 3;
  for (let k = 0; k < n; k++) {
    const ph = off[k * 4 + 3], fall = now * (1.6 + ph * 1.4);                        // each flake its own speed and sway
    const x = off[k * 4] + Math.sin(now * 0.7 + ph * 20) * 1.5 + now * 1.2, y = off[k * 4 + 1] - fall, z = off[k * 4 + 2] + Math.cos(now * 0.5 + ph * 13) * 1.5;
    p[k * 3] = camT.x - BOX.x / 2 + wrap(x - camT.x, BOX.x); p[k * 3 + 1] = camT.y - 6 + wrap(y - camT.y, BOX.y); p[k * 3 + 2] = camT.z - BOX.z / 2 + wrap(z - camT.z, BOX.z);
  }
  pts.geometry.attributes.position.needsUpdate = true;
}
