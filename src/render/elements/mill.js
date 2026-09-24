import * as THREE from 'three';
import { WALL } from '../../core/constants.js';
import { addInstanced, flat } from '../geometry.js';

// Sawmill scenery ('mill' / 'logs' section tags): a timber shed with a pitched roof and a big saw blade over the door,
// stacks of logs beside it, and log piles along the road. Logs are instanced cylinders; nothing collides.
const L = c => new THREE.MeshLambertMaterial({ color: c });
export function addMill(group, tr, terr) {
  const logs = [], wood = 0x8A5A34, bark = [0x6B4428, 0x7A5030, 0x5E3B22];
  let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const far = i => (-Math.cos(tr.th[i]) * -Math.SQRT1_2 + Math.sin(tr.th[i]) * -Math.SQRT1_2) > 0 ? 1 : -1;
  const at = (i, lat, along = 0) => [tr.xs[i] + tr.rx[i] * lat + tr.tx[i] * along, tr.zs[i] + tr.rz[i] * lat + tr.tz[i] * along];
  // a pyramid of logs lying along the road: rows of n, n-1, ...
  const pile = (i, lat, along, n, len) => {
    const [x0, z0] = at(i, lat, along), y0 = terr.at(x0, z0);
    for (let r = 0; r < n; r++) for (let k = 0; k < n - r; k++) {
      const off = (k - (n - r - 1) / 2) * 0.62, [x, z] = at(i, lat + off, along);
      logs.push({ x, y: y0 + 0.3 + r * 0.54, z, ry: tr.th[i] + Math.PI / 2, rz: Math.PI / 2, sx: 1, sy: len * (0.9 + rnd() * 0.2), sz: 1, color: bark[(r + k) % 3] });
    }
  };
  for (const i of tr.mills || []) {
    const s = far(i), [x, z] = at(i, s * (WALL + 11)), y = terr.at(x, z), shed = new THREE.Group();
    shed.position.set(x, y, z); shed.rotation.y = tr.th[i]; group.add(shed);
    const part = (w, h, d, c, px, py, pz, rz = 0) => { const m = new THREE.Mesh(flat(new THREE.BoxGeometry(w, h, d)), L(c)); m.position.set(px, py, pz); m.rotation.z = rz; m.castShadow = true; m.receiveShadow = true; shed.add(m); return m; };
    part(10, 4.6, 16, wood, 0, 2.1, 0);                                               // timber walls
    for (const k of [-1, 1]) part(6.4, 0.3, 16.8, 0x5E6670, k * 2.6, 5.8, 0, -k * 0.62);   // pitched tin roof
    part(0.4, 3.4, 4.2, 0x2B2F3A, -s * 5.05, 1.7, 0);                                 // big door on the road side
    const blade = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.12, 16).rotateZ(Math.PI / 2), L(0xC9CCD4)); blade.position.set(-s * 5.15, 4.4, 0); shed.add(blade);
    part(1.2, 6, 1.2, 0x9A948A, s * 3, 5, 5.5);                                        // chimney
    for (const k of [-1, 1]) pile(i, s * (WALL + 3.5), k * 12, 4, 5.5);
  }
  for (const [a, b] of tr.logPiles || []) for (let i = a + 4; i < b - 3; i += 12) for (const side of [-1, 1]) if (rnd() < 0.7) pile(i, side * (WALL + 2.6 + rnd()), 0, 2 + Math.floor(rnd() * 2), 3.5 + rnd() * 2);
  if (logs.length) addInstanced(group, flat(new THREE.CylinderGeometry(0.3, 0.3, 1, 8)), L(0xffffff), logs, { cast: true, receive: true });
}
