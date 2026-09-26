import * as THREE from 'three';
import { HALF } from '../../core/constants.js';
import { clamp, lerp } from '../../core/math.js';
import { chunkMesh } from '../geometry.js';
import { withCutaway } from '../materials.js';
import { bridgeMat } from '../elements/bridge.js';

export const ROAD_STRIPS = [-HALF + 1.1, -3.7, -2.3, -1.2, 1.2, 2.3, 3.7, HALF - 1.1];
export function makeRoadMesh(tr, stage) {
  const C = stage.colors, N = tr.loopN || tr.N, loop = !!tr.loopN;
  const mainPos = [], mainCol = [], brPos = [], brCol = [];
  let pos = mainPos, col = mainCol;
  const road = new THREE.Color(C.road), dirt = new THREE.Color(C.dirt).multiplyScalar(0.85), skirt = new THREE.Color(C.dirt).multiplyScalar(0.68);
  const dirtRoad = new THREE.Color(C.dirtRoad || C.dirt).multiplyScalar(0.95), isDirt = i => tr.dirt && tr.dirt[tr.bi(i)];
  const concrete = new THREE.Color(0xB9BBC0), red = new THREE.Color(0xD8352A), white = new THREE.Color(0xF4F4F0), yel = new THREE.Color(0xFFC72C), blk = new THREE.Color(0x262626), tmp = new THREE.Color();
  const mnL = new Float32Array(N);
  for (let i = 0; i < N; i++) { let m = 1e9; for (let j = i - 3; j <= i + 3; j++) { const jj = loop ? (j + N) % N : clamp(j, 0, N - 1); m = Math.min(m, tr.H[jj]); } mnL[i] = m; }
  const O = [-HALF - 3, -HALF - 2, -HALF, -HALF + 1.1, HALF - 1.1, HALF, HALF + 2, HALF + 3];
  const quad = (ax, ay, az, bx, by, bz, cx, cy, cz, dx, dy, dz, c) => {
    pos.push(ax, ay, az, cx, cy, cz, bx, by, bz, bx, by, bz, cx, cy, cz, dx, dy, dz);
    for (let q = 0; q < 6; q++) col.push(c.r, c.g, c.b);
  };
  let up = 0;                                                                             // branches sit a hair higher where they overlap the main road
  const P = (i, o, y) => [tr.xs[i] + tr.rx[i] * o, y + up, tr.zs[i] + tr.rz[i] * o];
  const minH = i => { if (i < N) return mnL[i]; let m = 1e9; for (let d = -3; d <= 3; d++) m = Math.min(m, tr.H[tr.nb0(i, d)]); return m; };
  // one stretch of road from sample i to sample j
  const seg = (i, j) => {
    const onBridge = tr.bridge[i] || tr.bridge[j];
    if (tr.voidMask && (tr.voidMask[tr.bi(i)] || tr.voidMask[tr.bi(j)])) return;          // a gap or ferry crossing: no road at all
    pos = onBridge ? brPos : mainPos; col = onBridge ? brCol : mainCol;
    for (let s = 0; s < 7; s++) {
      const oa = O[s], ob = O[s + 1];
      const yf = (ii, k) => {
        const H = tr.H[ii];
        if (tr.bridge[ii]) { if (k === 0 || k === 7) return H - 0.9; if (k === 1 || k === 6) return H - 0.02; }
        if (k === 0 || k === 7) return Math.min(H - 1.6, minH(ii) - 1.2);
        if (k === 1 || k === 6) return H - 0.4;
        if (s === 2 || s === 4) return H + 0.1;
        return H + 0.05;
      };
      let c;
      if ((s === 0 || s === 6) && tr.bridge[i]) c = concrete; else if ((s === 1 || s === 5) && tr.bridge[i]) c = concrete;
      else if (s === 0 || s === 6) c = skirt; else if (s === 1 || s === 5) c = dirt;
      else if (s === 2 || s === 4) { const kerb = s === 2 ? tr.kerbL[i] : tr.kerbR[i]; c = kerb ? (((i >> 1) & 1) ? red : white) : road; }
      else if (tr.jump[i] === 1) c = ((i >> 1) & 1) ? yel : blk;                           // painted kickers (natural crests stay dirt)
      else {
        // the driving surface in strips: darker worn wheel tracks in each lane plus the odd repair patch
        const dirtHere = isDirt(i), surf = dirtHere ? dirtRoad : road;                  // dirt shortcuts: a rutted dirt track
        const base = 1 + tr.noise.n2(i * 0.15, 3.3) * (dirtHere ? 0.16 : 0.08);
        for (let q = 0; q < ROAD_STRIPS.length - 1; q++) {
          const pa = ROAD_STRIPS[q], pb = ROAD_STRIPS[q + 1];
          let k = base * (q === 1 || q === 5 ? (dirtHere ? 0.82 : 0.9) : q === 3 ? (dirtHere ? 1.08 : 1.02) : 1);
          const pn = tr.noise.n2(i * 0.045 + q * 0.7, 9.1 + q * 0.3); if (pn > 0.62) k *= tr.surface === 'tarmac' ? 0.86 : 1.08;
          tmp.copy(surf).multiplyScalar(k);
          const qa = P(i, pa, tr.H[i] + 0.05), qb = P(i, pb, tr.H[i] + 0.05), qc = P(j, pa, tr.H[j] + 0.05), qd = P(j, pb, tr.H[j] + 0.05);
          quad(...qa, ...qb, ...qc, ...qd, tmp);
        }
        continue;
      }
      // quad corners: a=(i,oa) b=(i,ob) c=(j,oa) d=(j,ob) ; orient so normal faces up
      const a = P(i, oa, yf(i, s)), b = P(i, ob, yf(i, s + 1)), cc = P(j, oa, yf(j, s)), d = P(j, ob, yf(j, s + 1));
      quad(...a, ...b, ...cc, ...d, c);
    }
    if (tr.surface === 'tarmac' && !isDirt(i) && !tr.jump[i] && i % 6 < 3 && i > 40 && (loop || i < tr.finishIdx - 4)) {
      const a = P(i, -0.18, tr.H[i] + 0.07), b = P(i, 0.18, tr.H[i] + 0.07), cc = P(j, -0.18, tr.H[j] + 0.07), d = P(j, 0.18, tr.H[j] + 0.07);
      quad(...a, ...b, ...cc, ...d, white);
    }
  };
  for (let i = 0; i < (loop ? N : N - 1); i++) seg(i, loop ? (i + 1) % N : i + 1);
  // from the fork, along the branch, to the merge (not where it lies right on top of the main road)
  const onMain = i => { const t = tr.twin && tr.twin[tr.bi(i)], u = t >= 0 ? tr.u0(t) : -1; return u >= 0 && Math.hypot(tr.xs[u] - tr.xs[i], tr.zs[u] - tr.zs[i]) < 0.6; };
  up = 0.03; for (const a of tr.alts) for (let q = 0; q <= a.n; q++) if (!(onMain(a.u + q) && onMain(a.u + q + 1))) seg(a.u + q, a.u + q + 1);
  up = 0;
  // checkered start and finish lines
  pos = mainPos; col = mainCol;
  for (const li of (loop ? [tr.startIdx] : [tr.startIdx, tr.finishIdx])) {
    for (let row = 0; row < 2; row++) for (let q = 0; q < 12; q++) {
      const o0 = -HALF + q * (2 * HALF / 12), o1 = o0 + 2 * HALF / 12, s0 = li + row * 0.8, s1 = s0 + 0.8;
      const i0 = Math.floor(s0), f0 = s0 - i0, i1 = Math.floor(s1), f1 = s1 - i1;
      const pt = (ii, f, o) => { const x = lerp(tr.xs[ii], tr.xs[ii + 1], f) + tr.rx[ii] * o, z = lerp(tr.zs[ii], tr.zs[ii + 1], f) + tr.rz[ii] * o; return [x, lerp(tr.H[ii], tr.H[ii + 1], f) + 0.08, z]; };
      quad(...pt(i0, f0, o0), ...pt(i0, f0, o1), ...pt(i1, f1, o0), ...pt(i1, f1, o1), (q + row) % 2 ? white : blk);
    }
  }
  const mk = (P, C, mat) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.computeVertexNormals(); const m = new THREE.Mesh(g, mat); m.receiveShadow = true; return m; };
  const mainM = mk(mainPos, mainCol, withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), false, { cut: false, cloud: true, grain: tr.surface === 'tarmac' ? 0.07 : 0.12 })), main = chunkMesh(mainM.geometry, mainM.material, 60, true);
  const bridge = brPos.length ? mk(brPos, brCol, bridgeMat({ vertexColors: true, side: THREE.DoubleSide })) : null;
  if (bridge) bridge.castShadow = true;
  return { main, bridge };
}
