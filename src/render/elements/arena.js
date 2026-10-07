import * as THREE from 'three';
import { BREAKABLES } from '../../data/breakables.js';
import { flat, mergeAll } from '../geometry.js';

// A derby arena's wall ring (core/elements/arena.js places it; core/features/breakables.js bounces cars off it):
// dozens of pieces end to end, so it is drawn as one merged mesh per material, not a group per piece (the props
// inside are ordinary breakables, render/elements/breakables.js). Tyres: stacks of tyres, the odd stack painted;
// barrier: a concrete wall with a row of sponsor boards and floodlights round it; bales: hay bales two high.
const RING = {
  tyres: (put, k) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) put(new THREE.CylinderGeometry(0.55, 0.55, 0.36, 10).translate(0, 0.2 + j * 0.37, (i - 1.5) * 1.2), (k * 4 + i) % 9 === 0 ? 0xE8E8E8 : (k * 4 + i) % 9 === 4 ? 0xC8352A : 0x1E1F23); },
  barrier: (put, k) => { put(new THREE.BoxGeometry(0.9, 1.3, 5).translate(0, 0.65, 0), 0xC9C6BE); put(new THREE.BoxGeometry(0.1, 0.6, 4.9).translate(-0.5, 1.0, 0), [0xD7261E, 0xFFC72C, 0x2F7DE0, 0xF4F4F0][k % 4]); },
  bales: (put, k) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) put(new THREE.BoxGeometry(1.4, 0.75, 1.15).translate(0, 0.38 + j * 0.76, (i - 1.5) * 1.22 + (j ? 0.3 : 0)), (k + i + j) % 3 ? 0xD9B85C : 0xC9A64A); },
};
export function addArena(group, tr) {
  const A = tr.arena; if (!A) return;
  const geos = new Map(), m4 = new THREE.Matrix4();
  (tr.breakables || []).filter(b => b.arena && BREAKABLES[b.kind].arena).forEach((b, k) => {
    m4.makeRotationY(b.yaw).setPosition(b.x, b.y ?? A.floor, b.z);
    RING[A.ring]((g, c) => { if (!geos.has(c)) geos.set(c, []); geos.get(c).push(flat(g).applyMatrix4(m4)); }, k);
  });
  for (const [c, list] of geos) { const m = new THREE.Mesh(mergeAll(list), new THREE.MeshLambertMaterial({ color: c })); m.castShadow = true; m.receiveShadow = true; group.add(m); }
  if (A.ring === 'barrier') {   // floodlights round the stadium
    const pole = new THREE.MeshLambertMaterial({ color: 0x8A8F98 }), lamp = new THREE.MeshBasicMaterial({ color: 0xFFF6D8 });
    for (let k = 0; k < 4; k++) {
      const a = (k + 0.5) / 4 * Math.PI * 2, x = A.x + Math.sin(a) * (A.r + 7), z = A.z + Math.cos(a) * (A.r + 7);
      const p = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.35, 16, 8), pole); p.position.set(x, A.floor + 8, z); p.castShadow = true; group.add(p);
      const h = new THREE.Mesh(new THREE.BoxGeometry(3.2, 1.2, 0.5), lamp); h.position.set(x, A.floor + 16.3, z); h.rotation.y = a; h.lookAt(A.x, A.floor, A.z); group.add(h);
    }
  }
}
