import * as THREE from 'three';
import { HALF } from '../../core/constants.js';
import { flat } from '../geometry.js';
import { withCutaway } from '../materials.js';

// Mud visuals ('mud' element): bogs get a churned brown layer over the road with glossy puddles; a water splash gets
// a shallow stream running across the road (wheels in the water). The spray from the wheels is in effects/carfx.js.
export function addMud(group, tr, terr) {
  if (!tr.mud) return;
  const pos = [], col = [], c = new THREE.Color(), A = new THREE.Color(0x3F2B1C), B = new THREE.Color(0x6A4A30), W = HALF + 1.2;
  const P = (i, o, y) => [tr.xs[i] + tr.rx[i] * o, y, tr.zs[i] + tr.rz[i] * o];
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const puddles = [], fords = [];
  for (const i of tr.all0) {
    const b = tr.bi(i), m = tr.mud[b]; if (!m) continue;
    const j = tr.nb0(i, 1); if (tr.mud[tr.bi(j)] !== m) continue;
    if (m === 2) { fords.push(i); continue; }
    for (let q = 0; q < 6; q++) {                                                  // strips across the road, mottled
      const oa = -W + q * W / 3, ob = oa + W / 3, v = (o, k) => { c.copy(A).lerp(B, 0.5 + 0.5 * tr.noise.n2(k * 0.21 + o * 0.3, 4.4)); return [c.r, c.g, c.b]; };
      const a = P(i, oa, tr.H[i] + 0.07), bb = P(i, ob, tr.H[i] + 0.07), cc = P(j, oa, tr.H[j] + 0.07), d = P(j, ob, tr.H[j] + 0.07);
      pos.push(...a, ...cc, ...bb, ...bb, ...cc, ...d); col.push(...v(oa, i), ...v(oa, j), ...v(ob, i), ...v(ob, i), ...v(oa, j), ...v(ob, j));
    }
    if (rnd() < 0.12) puddles.push({ i, lat: (rnd() - 0.5) * 2 * (HALF - 1.5), r: 1 + rnd() * 1.6 });
  }
  if (pos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }), false, { cut: false, cloud: true })); m.receiveShadow = true; group.add(m);
  }
  const pm = new THREE.MeshLambertMaterial({ color: 0x33373A, emissive: 0x1C2630, polygonOffset: true, polygonOffsetFactor: -2 });   // dark water reflecting the sky
  for (const p of puddles) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 12).rotateX(-Math.PI / 2), pm), [x, y, z] = P(p.i, p.lat, tr.H[p.i] + 0.1);
    m.position.set(x, y, z); m.scale.set(1.6, 1, 1); m.rotation.y = tr.th[p.i] + Math.PI / 2; m.receiveShadow = true; group.add(m);
  }
  // water splashes: one sheet of water per run, crossing the road and out over the low ground either side
  const water = withCutaway(new THREE.MeshLambertMaterial({ color: 0x3E7DAE, transparent: true, opacity: 0.85, depthWrite: false }), false, { cut: false, cloud: true, water: true });
  for (let k = 0; k < fords.length;) {
    let e = k; while (e + 1 < fords.length && fords[e + 1] === tr.nb0(fords[e], 1)) e++;
    const a = fords[k], b = fords[e], mid = fords[(k + e) >> 1], len = e - k + 8, h = Math.min(tr.H[a], tr.H[b], tr.H[mid]) + 0.35;
    const m = new THREE.Mesh(flat(new THREE.PlaneGeometry(30, len, 6, 4).rotateX(-Math.PI / 2)), water);
    m.position.set(tr.xs[mid], h, tr.zs[mid]); m.rotation.y = tr.th[mid]; m.renderOrder = 1; group.add(m);
    for (const s of [-1, 1]) for (let q = 0; q < 3; q++) {                          // stepping stones on the banks
      const [x, , z] = P(mid, s * (HALF + 3 + q * 2.4), 0), r = new THREE.Mesh(flat(new THREE.DodecahedronGeometry(0.7 + q * 0.2, 0)), new THREE.MeshLambertMaterial({ color: 0x8C877C }));
      r.position.set(x + (q - 1) * 1.3, Math.max(h - 0.2, terr.at(x, z)), z); r.castShadow = true; group.add(r);
    }
    k = e + 1;
  }
}
