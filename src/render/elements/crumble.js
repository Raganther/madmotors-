import * as THREE from 'three';
import { G } from '../../game.js';
import { HALF, WALL } from '../../core/constants.js';
import { CRUMBLE } from '../../core/elements/crumble.js';
import { flat } from '../geometry.js';
import { waterMaterial, waterPool } from '../water.js';
import { spawnProp } from '../effects/props.js';
import { emit } from '../effects/particles.js';

// Crumbling bridges (core/elements/crumble.js, core/features/crumble.js): an old timber trestle over the water. The
// deck's planks (one instance each, a metre along by a lane across) darken and sag as they wear and drop into the water
// when they go, leaving the stringers under them showing; pilings, cross-bracing and a rickety railing stay. The planks
// follow W.crumbles.
const PLANK = 0x9A7148, WORN = 0x4E3A26;
let vis = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _a = new THREE.Color(PLANK), _b = new THREE.Color(WORN), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const L = c => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, m, x, y, z, parent, rx = 0) => { const b = new THREE.Mesh(flat(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.rotation.x = rx; b.castShadow = true; b.receiveShadow = true; parent.add(b); return b; };
export function addCrumbles(group, tr, terr) {
  vis = [];
  const beam = L(0x5E4630), post = L(0x4A3826), rail = L(0x8A6A48);
  const water = waterMaterial({ color: 0x3E6E8E });
  for (const d of tr.crumbles || []) {
    const len = d.b - d.a, i = d.a, root = new THREE.Group(), slope = (d.h1 - d.h0) / len;
    root.position.set(tr.xs[i], d.h0, tr.zs[i]); root.rotation.y = tr.th[i]; group.add(root);   // local z runs along the span from its start, x across
    waterPool(root, terr, [-120, 120, -10, len + 10], -6.5, water);   // the water below: level, filling the cut, its banks the shore
    const along = new THREE.Group(); along.rotation.x = -Math.atan(slope); root.add(along);
    // stringers under the deck (they stay when the planks go), pilings every 6 m with cross-bracing, a railing each side
    for (const x of [-HALF, -HALF / 3, HALF / 3, HALF]) box(0.3, 0.45, len, beam, x, -0.4, len / 2, along);
    for (let z = 0; z <= len + 0.01; z += len / Math.max(1, Math.round(len / 6))) {
      for (const x of [-HALF - 0.2, 0, HALF + 0.2]) box(0.45, 8, 0.45, post, x, -4.5, z, along);
      box(2 * HALF + 1, 0.4, 0.4, beam, 0, -0.75, z, along);
      box(0.2, 0.2, 2 * HALF * 1.1, beam, 0, -3.2, z, along).rotation.set(0, Math.PI / 2, 0.55);
    }
    for (const s of [-1, 1]) {
      box(0.16, 0.16, len, rail, s * (WALL - 1.6), 1.0, len / 2, along);
      for (let z = 0; z <= len + 0.01; z += 2) box(0.16, 1.1, 0.16, post, s * (WALL - 1.6), 0.45, z, along);
    }
    // the planks
    const n = len * CRUMBLE.LANES, pl = new THREE.InstancedMesh(flat(new THREE.BoxGeometry(CRUMBLE.LANE_W - 0.08, 0.16, 0.9)), L(0xffffff), n);
    pl.castShadow = true; pl.receiveShadow = true;
    const at = [];
    for (let u = 0; u < len; u++) for (let l = 0; l < CRUMBLE.LANES; l++) { const k = u * CRUMBLE.LANES + l; at.push([(l - (CRUMBLE.LANES - 1) / 2) * CRUMBLE.LANE_W, u + 0.5, ((u * 7 + l * 3) % 5) * 0.03]); pl.setColorAt(k, _c.copy(_a).multiplyScalar(0.92 + at[k][2])); }
    along.add(pl);
    vis.push({ d, pl, at, along, len, shown: new Float32Array(n).fill(-1) });
  }
}
export function newCrumbleRace() { for (const v of vis) v.shown.fill(-1); }
export function updateCrumbles() {
  const W = G.world && G.world.W; if (!vis.length || !W || !W.crumbles) return;
  vis.forEach((v, j) => {
    const d = W.crumbles[j]; if (!d) return; let dirty = false;
    for (let k = 0; k < d.hp.length; k++) {
      const hp = d.hp[k]; if (hp === v.shown[k]) continue; dirty = true;
      const [x, z, tint] = v.at[k], w = 1 - hp / d.max;
      if (hp <= 0) {
        if (v.shown[k] > 0) {                                                                // it drops into the water
          v.pl.updateMatrixWorld(); _p.set(x, -0.1, z).applyMatrix4(v.along.matrixWorld); _q.setFromEuler(_e.set(0.3, v.along.parent.rotation.y, 0.2));
          spawnProp('box', _p, _q, [CRUMBLE.LANE_W - 0.1, 0.16, 0.9], WORN, 0, -1, 0, 3, 'wood');
          for (let n = 0; n < 6; n++) emit(_p.x, _p.y, _p.z, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0.6, 0.4, 0x7A5A3A, -9, 'solid');
        }
        v.pl.setMatrixAt(k, ZERO);
      } else {
        const sag = CRUMBLE.SAG * w * Math.sin(Math.PI * z / v.len);
        _q.setFromEuler(_e.set(0, 0, ((k * 13) % 7 - 3) * 0.02 * w)); _p.set(x, -0.08 - sag, z); _s.set(1, 1, 1); _m.compose(_p, _q, _s); v.pl.setMatrixAt(k, _m);
        v.pl.setColorAt(k, _c.copy(_a).lerp(_b, Math.min(1, w * 1.3)).multiplyScalar(0.92 + tint));
      }
      v.shown[k] = hp;
    }
    if (dirty) { v.pl.instanceMatrix.needsUpdate = true; v.pl.instanceColor.needsUpdate = true; }
  });
}
