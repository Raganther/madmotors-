import * as THREE from 'three';
import { WALL } from '../../core/constants.js';
import { addInstanced, flat } from '../geometry.js';
import { withCutaway } from '../materials.js';

// natural rock arch ('arch' section tag): two rough pillars beside the road and a span of boulders over it.
// Scenery only (nothing collides; the pillars stand outside the barriers); cutaway so it never hides a car.
export function addArches(group, tr, terr, stage) {
  if (!tr.arches || !tr.arches.length) return;
  const C = stage.colors, parts = []; let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const put = (i, lat, y, s, sy) => { const x = tr.xs[i] + tr.rx[i] * lat, z = tr.zs[i] + tr.rz[i] * lat; parts.push({ x, y, z, sx: s * (0.9 + rnd() * 0.3), sy, sz: s * (0.9 + rnd() * 0.3), ry: rnd() * 6.28, rx: rnd() * 0.3, color: rnd() < 0.5 ? C.rock : (C.rock2 || C.rock) }); };
  for (const i of tr.arches) {
    const H = tr.H[i], span = WALL + 3.4, top = H + 10.5;
    for (const side of [-1, 1]) for (let k = 0; k < 4; k++) {
      const lat = side * (span + rnd() * 0.8), x = tr.xs[i] + tr.rx[i] * lat, z = tr.zs[i] + tr.rz[i] * lat, g = Math.min(terr.at(x, z), H);
      put(i, lat, g + (top - g) * (k + 0.5) / 4, 2.6, (top - g) / 4 * 0.85);
    }
    for (let k = 0; k <= 6; k++) { const lat = -span + 2 * span * k / 6; put(i, lat, top + 0.6 + Math.sin(Math.PI * k / 6) * 0.9, 2.6, 1.8); }
  }
  addInstanced(group, flat(new THREE.DodecahedronGeometry(1, 0)), withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff }), false, { cloud: true }), parts, { cast: true, receive: true });
}
