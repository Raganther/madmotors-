import * as THREE from 'three';
import { WALL } from '../../core/constants.js';
import { addInstanced, flat } from '../geometry.js';
import { withCutaway } from '../materials.js';

// rock gallery: a roof over the ledge road carried on pillars along the valley side
export function addGallery(group, tr) {
  if (!tr.gallery) return;
  const N0 = tr.loopN, roof = [], pillars = [], parapet = [];
  for (let i = 0; i < N0; i++) {
    if (!tr.gallery[i]) continue;
    const nearSide = (-Math.cos(tr.th[i]) * -Math.SQRT1_2 + Math.sin(tr.th[i]) * -Math.SQRT1_2) > 0 ? -1 : 1, H = tr.H[i];
    const at = o => [tr.xs[i] + tr.rx[i] * nearSide * o, tr.zs[i] + tr.rz[i] * nearSide * o];
    if (i % 2 === 0) { const [x, z] = at(-1.2); roof.push({ x, y: H + 7.6, z, ry: tr.th[i], sx: 2 * WALL + 6, sy: 1.1, sz: 2.1, color: 0x8F887C }); }
    const [px, pz] = at(WALL + 0.9);
    if (i % 8 === 0) pillars.push({ x: px, y: H + 3.6, z: pz, ry: tr.th[i], sx: 1.4, sy: 7.6, sz: 1.6, color: 0xA39C8F });
    parapet.push({ x: px, y: H + 0.55, z: pz, ry: tr.th[i], sx: 0.9, sy: 1.1, sz: 1.05, color: 0xB5AC9C });
  }
  const box = () => flat(new THREE.BoxGeometry(1, 1, 1)), Lm = () => withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  addInstanced(group, box(), Lm(), roof, { cast: true, receive: true });
  addInstanced(group, box(), Lm(), pillars, { cast: true, receive: true });
  addInstanced(group, box(), Lm(), parapet, { cast: true });
}
