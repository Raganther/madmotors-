import * as THREE from 'three';
import { HALF, WALL } from '../../core/constants.js';
import { bannerTex, chevronTex } from '../materials.js';

export function addGantry(group, tr, terr, i, text) {
  const g = new THREE.Group(); const span = WALL + 0.8;
  const x = tr.xs[i], z = tr.zs[i], y = tr.H[i];
  g.position.set(x, y, z); g.rotation.y = tr.th[i];
  const postM = new THREE.MeshLambertMaterial({ color: 0x1C2340 });
  for (const s of [-1, 1]) {
    const py = terr.at(x + tr.rx[i] * s * span, z + tr.rz[i] * s * span) - y;
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.6, 8 - py, 0.6), postM); post.position.set(-s * span, py + (8 - py) / 2, 0); post.castShadow = true; g.add(post);
  }
  const tex = bannerTex(text), side = new THREE.MeshLambertMaterial({ color: 0x1C2340 }), face = new THREE.MeshLambertMaterial({ map: tex });
  const beam = new THREE.Mesh(new THREE.BoxGeometry(span * 2 + 0.6, 1.8, 0.5), [side, side, side, side, face, face]);
  beam.position.y = 7.4; beam.castShadow = true; g.add(beam); group.add(g);
}
export function addSigns(group, tr, terr) {
  const texR = chevronTex(true), texL = chevronTex(false);
  const matR = new THREE.MeshLambertMaterial({ map: texR, side: THREE.DoubleSide }), matL = new THREE.MeshLambertMaterial({ map: texL, side: THREE.DoubleSide });
  const postM = new THREE.MeshLambertMaterial({ color: 0x3A4468 });
  const board = new THREE.PlaneGeometry(3.4, 1.4), postG = new THREE.BoxGeometry(0.18, 2.2, 0.18);
  for (const hp of tr.hairpins) {
    const i = hp.a - 16; if (i < 50) continue;
    const e = Math.min(tr.N - 1, hp.b); const scr = tr.tx[e] - tr.tz[e]; // exit direction along screen-right
    const lat = hp.side * (WALL + 1.6), x = tr.xs[i] + tr.rx[i] * lat, z = tr.zs[i] + tr.rz[i] * lat; const q = tr.nearest(x, z);
    if (q && q.d < HALF + 1.5) continue;
    const y = terr.at(x, z);
    const b = new THREE.Mesh(board, scr > 0 ? matR : matL); b.position.set(x, y + 2.4, z); b.rotation.y = Math.PI / 4; b.castShadow = true; group.add(b);
    const p = new THREE.Mesh(postG, postM); p.position.set(x, y + 1.1, z); group.add(p);
  }
}
