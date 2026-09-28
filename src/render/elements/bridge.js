import * as THREE from 'three';
import { HALF, WALL } from '../../core/constants.js';
import { railProject } from '../../core/track/rails.js';
import { addInstanced, flat } from '../geometry.js';

export function bridgeMat(opts) { return new THREE.MeshLambertMaterial(opts); }
/**
 * Can a support stand here? Not if its footprint (a box `hw` across and `hl` along, turned to `ry`) overlaps any road
 * that passes underneath (lower than `top`): a pier on the road below is never right, however far below it runs. Every
 * road sample is checked, not just the nearest (near a bridge's ends the nearest is the bridge's own approach). Shared
 * by both bridge styles; tests/scenery.test.js checks every stage.
 */
export function supportClear(tr, x, z, ry, hw, hl, top) {
  const c = Math.cos(ry), s = Math.sin(ry), mu = hw + HALF - 0.5, mv = hl + HALF - 0.5, R = Math.hypot(mu, mv);
  for (let j = 0; j < tr.N; j++) {
    if (tr.bridge[j] || tr.H[j] >= top - 1) continue;
    const dx = tr.xs[j] - x, dz = tr.zs[j] - z; if (Math.abs(dx) > R || Math.abs(dz) > R) continue;
    if (Math.abs(dx * c - dz * s) < mu && Math.abs(dx * s + dz * c) < mv) return false;
  }
  return true;
}
// Decks and parapets are swept along the road as one continuous shape per run of bridge (a box per sample would
// saw-tooth on every curve and slope: each box's corners stick out past the next). `prof` is a closed cross-section,
// [lateral offset, height above the road] pairs; the ends are capped.
function bridgeRuns(tr, N) {
  const runs = []; let a = -1;
  for (let i = 0; i < N; i++) { if (tr.bridge[i] && a < 0) a = i; if (!tr.bridge[i] && a >= 0) { runs.push([a, i - 1]); a = -1; } }
  if (a >= 0) runs.push([a, N - 1]);
  if (tr.loopN && runs.length > 1 && runs[0][0] === 0 && runs[runs.length - 1][1] === N - 1) { const last = runs.pop(); runs[0] = [last[0], runs[0][1] + N]; }   // a run across the start line
  return runs;
}
function sweep(tr, N, runs, profs) {
  const pos = [], P = (i, [o, dy]) => { const k = i % N; return [tr.xs[k] + tr.rx[k] * o, tr.H[k] + dy, tr.zs[k] + tr.rz[k] * o]; };
  for (const [a, b] of runs) for (const prof of profs) {
    for (let i = a; i <= b; i++) for (let m = 0; m < prof.length; m++) {
      const p = prof[m], q = prof[(m + 1) % prof.length], A = P(i, p), B = P(i, q), C = P(i + 1, p), D = P(i + 1, q);
      pos.push(...A, ...C, ...B, ...B, ...C, ...D);
    }
    for (const [i, flip] of [[a, false], [b + 1, true]]) for (let m = 1; m < prof.length - 1; m++) {   // end caps
      const A = P(i, prof[0]), B = P(i, prof[m]), C = P(i, prof[m + 1]); if (flip) pos.push(...A, ...C, ...B); else pos.push(...A, ...B, ...C);
    }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.computeVertexNormals(); return g;
}
const tagSupports = chunks => chunks.forEach(c => { c.mesh.userData.supports = c.list; });   // for tests/scenery.test.js
const box = (o0, o1, y0, y1) => [[o0, y1], [o1, y1], [o1, y0], [o0, y0]];
function addSwept(group, tr, N, profs, mat) { const runs = bridgeRuns(tr, N); if (!runs.length) return; const m = new THREE.Mesh(sweep(tr, N, runs, profs), mat); m.castShadow = m.receiveShadow = true; group.add(m); }
export function addBridge(group, tr, terr, stage) {
  if (stage && stage.viaduct) return addViaduct(group, tr, terr);
  const N = tr.loopN || tr.N, stripes = [], pillars = [];
  for (let i = 0; i < N; i++) {
    if (!tr.bridge[i]) continue;
    const j = (i + 1) % N, len = Math.hypot(tr.xs[j] - tr.xs[i], tr.zs[j] - tr.zs[i]) + 0.1, pitch = -Math.atan2(tr.H[j] - tr.H[i], len);
    for (const side of [-1, 1]) {
      const x = tr.xs[i] + tr.rx[i] * side * (WALL + 0.2), z = tr.zs[i] + tr.rz[i] * side * (WALL + 0.2);
      if (i % 2 === 0) stripes.push({ x, y: tr.H[i] + 0.93, z, ry: tr.th[i], rx: pitch, sx: 0.5, sy: 0.12, sz: len, color: (i >> 1) % 2 ? 0xE0402F : 0xF4F4F0 });
    }
    if (i % 7 === 0) for (const side of [-1, 1]) {
      const x = tr.xs[i] + tr.rx[i] * side * (WALL - 1), z = tr.zs[i] + tr.rz[i] * side * (WALL - 1), top = tr.H[i] - 0.9;
      if (!supportClear(tr, x, z, 0, 0.55, 0.55, top)) continue;
      const g = terr.at(x, z), h = top - g + 0.6;
      if (h > 0.6) pillars.push({ x, y: g - 0.6 + h / 2, z, sx: 1.1, sy: h, sz: 1.1 });
    }
  }
  const cube = () => flat(new THREE.BoxGeometry(1, 1, 1)), W = WALL;
  addSwept(group, tr, N, [box(-W - 0.6, W + 0.6, -0.95, -0.05)], bridgeMat({ color: 0xA7AAB1, side: THREE.DoubleSide }));
  addSwept(group, tr, N, [box(-W - 0.425, -W + 0.025, 0, 0.9), box(W - 0.025, W + 0.425, 0, 0.9)], bridgeMat({ color: 0xD5D8DE, side: THREE.DoubleSide }));
  addInstanced(group, cube(), bridgeMat({ color: 0xffffff }), stripes, {});
  tagSupports(addInstanced(group, cube(), bridgeMat({ color: 0x9A9DA5 }), pillars, { cast: true, receive: true }));
}
// stone viaducts: deck, solid parapets, piers down to the valley floor and arches between them
export let archGeo = null;
export function addViaduct(group, tr, terr) {
  const N = tr.loopN || tr.N, piers = [], arches = [], SP = 12;
  if (!archGeo) {
    const pts = [], SEG = 10; for (let k = 0; k <= SEG; k++) { const t = Math.PI * k / SEG; pts.push([Math.cos(t), Math.sin(t)]); }
    const pos = [], q = (a, b, c, d) => pos.push(...a, ...b, ...c, ...c, ...b, ...d);
    for (let k = 0; k < SEG; k++) {
      const [c0, s0] = pts[k], [c1, s1] = pts[k + 1], r = 0.78;
      for (const x of [-0.5, 0.5]) q([x, s0 * r, c0 * r], [x, s0, c0], [x, s1 * r, c1 * r], [x, s1, c1]);           // arch faces
      q([-0.5, s0 * r, c0 * r], [0.5, s0 * r, c0 * r], [-0.5, s1 * r, c1 * r], [0.5, s1 * r, c1 * r]);              // soffit
    }
    archGeo = new THREE.BufferGeometry(); archGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); archGeo = flat(archGeo);
  }
  let run = 0;
  for (let i = 0; i < N; i++) {
    if (!tr.bridge[i]) { run = 0; continue; }
    if (run++ % SP === 0) {
      const x = tr.xs[i], z = tr.zs[i], g = terr.at(x, z), top = tr.H[i] - 1.4, h = top - g + 1;
      const onRail = tr.rails && tr.rails.lines.some(L => railProject(L, x, z).d < 4);
      // the arch to the next pier needs that pier to stand too
      const k2 = (i + SP) % N, clear2 = supportClear(tr, tr.xs[k2], tr.zs[k2], tr.th[k2], WALL - 0.5, 1.4, tr.H[k2] - 1.4);
      if (h > 1.5 && !onRail && supportClear(tr, x, z, tr.th[i], WALL - 0.5, 1.4, top)) {
        piers.push({ x, y: g - 1 + h / 2, z, ry: tr.th[i], sx: 2 * WALL - 1, sy: h, sz: 2.8, color: 0x8F887C });
        // arch spanning to the next pier, if the bridge continues that far and there is room underneath
        if (tr.bridge[k2] && clear2 && h > SP / 2 + 1.5) {
          const m = (i + SP / 2) % N, R = SP / 2 - 1.4;
          arches.push({ x: tr.xs[m], y: tr.H[m] - 1.4 - R, z: tr.zs[m], ry: tr.th[m], sx: 2 * WALL - 1, sy: R, sz: R, color: 0x9A9387 });
        }
      }
    }
  }
  addSwept(group, tr, N, [box(-WALL - 0.8, WALL + 0.8, -1.45, -0.05)], bridgeMat({ color: 0xA39C8F, side: THREE.DoubleSide }));
  addSwept(group, tr, N, [box(-WALL - 0.7, -WALL, -0.05, 1.05), box(WALL, WALL + 0.7, -0.05, 1.05)], bridgeMat({ color: 0xBDB4A4, side: THREE.DoubleSide }));
  tagSupports(addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1)), bridgeMat({ color: 0xffffff }), piers, { cast: true, receive: true }));
  addInstanced(group, archGeo.clone(), bridgeMat({ color: 0xffffff, side: THREE.DoubleSide }), arches, { cast: true });
}
