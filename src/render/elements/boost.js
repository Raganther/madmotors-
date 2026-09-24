import * as THREE from 'three';
import { HALF } from '../../core/constants.js';

// boost pads: glowing chevrons across the road, pointing the way, pulsing (see update)
let mats = [];
export function addBoostPads(group, tr) {
  mats = []; if (!tr.boostPad) return;
  const shape = new THREE.Shape();
  shape.moveTo(-1.1, -0.9); shape.lineTo(0, 0.5); shape.lineTo(1.1, -0.9); shape.lineTo(1.1, -0.2); shape.lineTo(0, 1.2); shape.lineTo(-1.1, -0.2); shape.closePath();
  const geo = new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2);
  for (let k = 0; k < tr.all0.length; k += 4) {
    const i = tr.all0[k]; if (!tr.boostPad[tr.bi(i)]) continue;
    const m = new THREE.MeshBasicMaterial({ color: 0x3CF2FF, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }); m.userData.i = i; mats.push(m);
    for (const lat of [-HALF * 0.55, 0, HALF * 0.55]) {
      const a = new THREE.Mesh(geo, m); a.position.set(tr.xs[i] + tr.rx[i] * lat, tr.H[i] + 0.09, tr.zs[i] + tr.rz[i] * lat); a.rotation.y = tr.th[i] + Math.PI; a.scale.setScalar(1.3); group.add(a);
    }
  }
}
// a wave of brightness running forward along the pads
export function updateBoostPads(now) { for (const m of mats) m.opacity = 0.45 + 0.45 * Math.max(0, Math.sin(now * 9 - m.userData.i * 0.35)); }
