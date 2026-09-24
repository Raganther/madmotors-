import * as THREE from 'three';
import { WALL } from '../../core/constants.js';
import { addInstanced } from '../geometry.js';
import { withCutaway } from '../materials.js';

// bored tunnel: the bore (cut away on the camera side), lamps, a rock curtain and floor behind, concrete portals
export function addTunnel(group, tr, terr) {
  const N = tr.loopN || tr.N; if (!tr.tunnel.some(v => v)) return;
  const RT = WALL + 0.7, HT = 7.2, SEG = 14, pos = [], posFar = [], lamps = [], rock = [];
  const ring = i => { const pts = []; for (let k = 0; k <= SEG; k++) { const a = Math.PI * k / SEG, lat = Math.cos(a) * RT, y = tr.H[i] - 0.3 + Math.sin(a) * HT; pts.push([tr.xs[i] + tr.rx[i] * lat, y, tr.zs[i] + tr.rz[i] * lat]); } return pts; };
  let first = -1, last = -1;
  for (let i = 0; i < N; i++) {
    const j = (i + 1) % N; if (!tr.tunnel[i] || !tr.tunnel[j]) continue;
    if (first < 0) first = i; last = j;
    const A = ring(i), B = ring(j);
    const camSide = Math.sign(tr.rx[i] + tr.rz[i]) || 1;
    for (let k = 0; k < SEG; k++) { const near = Math.cos(Math.PI * (k + 0.5) / SEG) * camSide > 0; (near ? pos : posFar).push(...A[k], ...B[k], ...A[k + 1], ...A[k + 1], ...B[k], ...B[k + 1]); }
    { // rock curtain behind the far wall and a floor slab under the road, so the cut window never shows sky
      const cs = camSide, P = (ii, lat, dy) => [tr.xs[ii] + tr.rx[ii] * lat, tr.H[ii] + dy, tr.zs[ii] + tr.rz[ii] * lat];
      const top = (ii, lat) => { const p = P(ii, lat, 0); p[1] = Math.max(tr.H[ii] + HT, Math.min(tr.H[ii] + 20, terr.at(p[0], p[2]) - 1.2)); return p; };
      const a0 = P(i, -cs * RT, -0.3), b0 = P(j, -cs * RT, -0.3), a1 = top(i, -cs * (RT + 3)), b1 = top(j, -cs * (RT + 3));
      rock.push(...a0, ...b0, ...a1, ...a1, ...b0, ...b1);
      const f0 = P(i, -RT - 8, -0.45), f1 = P(i, RT + 8, -0.45), g0 = P(j, -RT - 8, -0.45), g1 = P(j, RT + 8, -0.45);
      rock.push(...f0, ...g0, ...f1, ...f1, ...g0, ...g1);
    }
    if (i % 7 === 0) lamps.push({ x: tr.xs[i], y: tr.H[i] - 0.3 + HT - 0.25, z: tr.zs[i], ry: tr.th[i] });
  }
  for (const [arr, cut] of [[pos, true], [posFar, false]]) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); g.computeVertexNormals();
    const m = new THREE.MeshLambertMaterial({ color: 0x5F5C57, side: THREE.DoubleSide });
    const bore = new THREE.Mesh(g, cut ? withCutaway(m) : m); bore.castShadow = true; bore.receiveShadow = true; group.add(bore);
  }
  addInstanced(group, new THREE.BoxGeometry(0.5, 0.18, 2.2), withCutaway(new THREE.MeshBasicMaterial({ color: 0xFFE7A8 })), lamps, {});
  { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(rock, 3)); g.computeVertexNormals();
    group.add(new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0x3A3632, side: THREE.DoubleSide }))); }
  // portal faces: a thick concrete arch with hazard banding at both mouths
  const portalMat = withCutaway(new THREE.MeshLambertMaterial({ color: 0xC9C6BE, side: THREE.DoubleSide })), bandMat = withCutaway(new THREE.MeshLambertMaterial({ color: 0xFFC72C, side: THREE.DoubleSide }));
  for (const i of [first, last]) {
    const face = [], band = [];
    for (let k = 0; k < SEG; k++) {
      const a0 = Math.PI * k / SEG, a1 = Math.PI * (k + 1) / SEG;
      const P = (a, r1, r2) => { const lat = Math.cos(a) * r1, y = tr.H[i] - 0.3 + Math.sin(a) * r2; return [tr.xs[i] + tr.rx[i] * lat, y, tr.zs[i] + tr.rz[i] * lat]; };
      const inA = P(a0, RT, HT), inB = P(a1, RT, HT), outA = P(a0, RT + 3, HT + 3), outB = P(a1, RT + 3, HT + 3);
      const tgt = (k % 2 === 0) ? band : face;
      const midA = P(a0, RT + 0.8, HT + 0.8), midB = P(a1, RT + 0.8, HT + 0.8);
      tgt.push(...inA, ...midA, ...inB, ...inB, ...midA, ...midB);
      face.push(...midA, ...outA, ...midB, ...midB, ...outA, ...outB);
    }
    for (const [arr, m] of [[face, portalMat], [band, bandMat]]) {
      const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.Float32BufferAttribute(arr, 3)); pg.computeVertexNormals();
      const mesh = new THREE.Mesh(pg, m); mesh.castShadow = true; group.add(mesh);
    }
  }
}
