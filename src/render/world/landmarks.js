import * as THREE from 'three';
import { HALF, WALL } from '../../core/constants.js';
import { addInstanced, flat } from '../geometry.js';
import { bannerTex, chevronTex, withCutaway } from '../materials.js';

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
