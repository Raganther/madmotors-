import * as THREE from 'three';
import { HALF, WALL } from '../../core/constants.js';
import { railProject } from '../../core/track/rails.js';
import { addInstanced, flat } from '../geometry.js';

export function bridgeMat(opts) { return new THREE.MeshLambertMaterial(opts); }
export function addBridge(group, tr, terr, stage) {
  if (stage && stage.viaduct) return addViaduct(group, tr, terr);
  const N = tr.loopN || tr.N, deck = [], rails = [], stripes = [], pillars = [];
  for (let i = 0; i < N; i++) {
    if (!tr.bridge[i]) continue;
    const j = (i + 1) % N, len = Math.hypot(tr.xs[j] - tr.xs[i], tr.zs[j] - tr.zs[i]) + 0.1, pitch = -Math.atan2(tr.H[j] - tr.H[i], len);
    deck.push({ x: tr.xs[i], y: tr.H[i] - 0.5, z: tr.zs[i], ry: tr.th[i], rx: pitch, sx: 2 * WALL + 1.2, sy: 0.9, sz: len });
    for (const side of [-1, 1]) {
      const x = tr.xs[i] + tr.rx[i] * side * (WALL + 0.2), z = tr.zs[i] + tr.rz[i] * side * (WALL + 0.2);
      rails.push({ x, y: tr.H[i] + 0.45, z, ry: tr.th[i], rx: pitch, sx: 0.45, sy: 0.9, sz: len });
      if (i % 2 === 0) stripes.push({ x, y: tr.H[i] + 0.93, z, ry: tr.th[i], rx: pitch, sx: 0.5, sy: 0.12, sz: len, color: (i >> 1) % 2 ? 0xE0402F : 0xF4F4F0 });
    }
    if (i % 7 === 0) for (const side of [-1, 1]) {
      const x = tr.xs[i] + tr.rx[i] * side * (WALL - 1), z = tr.zs[i] + tr.rz[i] * side * (WALL - 1), q = tr.nearestT(x, z);
      if (q && q.d < HALF + 2.5) continue;
      const g = terr.at(x, z), top = tr.H[i] - 0.9, h = top - g + 0.6;
      if (h > 0.6) pillars.push({ x, y: g - 0.6 + h / 2, z, sx: 1.1, sy: h, sz: 1.1 });
    }
  }
  const box = () => flat(new THREE.BoxGeometry(1, 1, 1));
  addInstanced(group, box(), bridgeMat({ color: 0xA7AAB1 }), deck, { cast: true, receive: true });
  addInstanced(group, box(), bridgeMat({ color: 0xD5D8DE }), rails, { cast: true });
  addInstanced(group, box(), bridgeMat({ color: 0xffffff }), stripes, {});
  addInstanced(group, box(), bridgeMat({ color: 0x9A9DA5 }), pillars, { cast: true, receive: true });
}
// stone viaducts: deck, solid parapets, piers down to the valley floor and arches between them
export let archGeo = null;
export function addViaduct(group, tr, terr) {
  const N = tr.loopN || tr.N, deck = [], walls = [], piers = [], arches = [], SP = 12;
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
    const j = (i + 1) % N, len = Math.hypot(tr.xs[j] - tr.xs[i], tr.zs[j] - tr.zs[i]) + 0.1, pitch = -Math.atan2(tr.H[j] - tr.H[i], len);
    deck.push({ x: tr.xs[i], y: tr.H[i] - 0.75, z: tr.zs[i], ry: tr.th[i], rx: pitch, sx: 2 * WALL + 1.6, sy: 1.4, sz: len });
    for (const side of [-1, 1]) walls.push({ x: tr.xs[i] + tr.rx[i] * side * (WALL + 0.35), y: tr.H[i] + 0.5, z: tr.zs[i] + tr.rz[i] * side * (WALL + 0.35), ry: tr.th[i], rx: pitch, sx: 0.7, sy: 1.1, sz: len });
    if (run++ % SP === 0) {
      const x = tr.xs[i], z = tr.zs[i], q = tr.nearestT(x, z);
      const g = terr.at(x, z), top = tr.H[i] - 1.4, h = top - g + 1;
      const onRail = tr.rails && tr.rails.lines.some(L => railProject(L, x, z).d < 4);
      if (h > 1.5 && !onRail && !(q && q.d < HALF + 3 && Math.abs(tr.H[q.i] - top) < 12)) {
        piers.push({ x, y: g - 1 + h / 2, z, ry: tr.th[i], sx: 2 * WALL - 1, sy: h, sz: 2.8, color: 0x8F887C });
        // arch spanning to the next pier, if the bridge continues that far and there is room underneath
        const k2 = (i + SP) % N;
        if (tr.bridge[k2] && h > SP / 2 + 1.5) {
          const m = (i + SP / 2) % N, R = SP / 2 - 1.4;
          arches.push({ x: tr.xs[m], y: tr.H[m] - 1.4 - R, z: tr.zs[m], ry: tr.th[m], sx: 2 * WALL - 1, sy: R, sz: R, color: 0x9A9387 });
        }
      }
    }
  }
  addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1)), bridgeMat({ color: 0xA39C8F }), deck, { cast: true, receive: true });
  addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1)), bridgeMat({ color: 0xBDB4A4 }), walls, { cast: true });
  addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1)), bridgeMat({ color: 0xffffff }), piers, { cast: true, receive: true });
  addInstanced(group, archGeo.clone(), bridgeMat({ color: 0xffffff, side: THREE.DoubleSide }), arches, { cast: true });
}
