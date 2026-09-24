import * as THREE from 'three';
import { HALF, WALL } from '../../core/constants.js';
import { mulberry32 } from '../../core/math.js';
import { railProject } from '../../core/track/rails.js';
import { addInstanced, chunkMesh, flat } from '../geometry.js';
import { withCutaway } from '../materials.js';

// ---------- town: pavements, bollards, lamps and buildings along the town street ----------
export function addTown(group, tr, terr, stage) {
  if (!tr.town) return;
  const N0 = tr.loopN, rnd = mulberry32(stage.seed * 13 + 1), pave = [], bollards = [], lamps = [], lampHeads = [], walls = [], roofs = [], bands = [], awnings = [], spires = [];
  const onRoad = (x, z, m) => { const q = tr.nearest(x, z); return q && q.d < m; };
  const nearRail = (x, z, m) => tr.rails && tr.rails.lines.some(L => { const pj = railProject(L, x, z); return pj.d < m && pj.s > L.visA && pj.s < L.visB; });
  for (let i = 0; i < N0; i++) {
    if (!tr.town[i]) continue;
    const j = (i + 1) % N0, H = tr.H[i];
    for (const side of [-1, 1]) {
      // pavement strip from the road edge out past the bollards
      const P = (k, o) => [tr.xs[k] + tr.rx[k] * side * o, tr.H[k] + 0.14, tr.zs[k] + tr.rz[k] * side * o];
      if (!nearRail(tr.xs[i] + tr.rx[i] * side * 8, tr.zs[i] + tr.rz[i] * side * 8, 3)) {
        const a = P(i, HALF + 0.1), b = P(i, WALL + 2.2), c = P(j, HALF + 0.1), d = P(j, WALL + 2.2);
        pave.push(...a, ...c, ...b, ...b, ...c, ...d);
      }
      const bx = tr.xs[i] + tr.rx[i] * side * (WALL + 0.1), bz = tr.zs[i] + tr.rz[i] * side * (WALL + 0.1);
      if ((tr.wallL[i] === 7 || tr.wallR[i] === 7) && i % 3 === 0 && !nearRail(bx, bz, 4)) bollards.push({ x: bx, y: H + 0.55, z: bz, color: 0x2B2F3A });
      if (i % 16 === 8 && !nearRail(bx, bz, 5)) {
        const lx = tr.xs[i] + tr.rx[i] * side * (WALL + 1.1), lz = tr.zs[i] + tr.rz[i] * side * (WALL + 1.1);
        lamps.push({ x: lx, y: H + 2.3, z: lz, color: 0x2B2F3A }); lampHeads.push({ x: lx - tr.rx[i] * side * 0.5, y: H + 4.6, z: lz - tr.rz[i] * side * 0.5, color: 0xFFE7A8 });
      }
    }
  }
  // buildings: a row each side, fronts just behind the pavement; skipped where they would hit a road or the railway
  const placed = [];
  for (let i = 0; i < N0; i += 1) {
    if (!tr.town[i] || i % 10) continue;
    for (const side of [-1, 1]) {
      if (rnd() < 0.12) continue;
      const w = 7 + rnd() * 3, d = 7 + rnd() * 4, h = 4.5 + rnd() * 6, off = WALL + 2.6 + d / 2;
      const x = tr.xs[i] + tr.rx[i] * side * off, z = tr.zs[i] + tr.rz[i] * side * off, ry = tr.th[i];
      const cs = Math.cos(ry), sn = Math.sin(ry), corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => [x + cs * u * d / 2 + sn * v * w / 2, z - sn * u * d / 2 + cs * v * w / 2]);
      if (corners.some(([cx, cz]) => onRoad(cx, cz, WALL + 1.8)) || nearRail(x, z, d / 2 + w / 2 + 4) || placed.some(p => Math.hypot(p[0] - x, p[1] - z) < 8.5)) continue;
      placed.push([x, z]);
      const y = terr.at(x, z) - 0.3, church = !stage._church && side > 0 && rnd() < 0.2;
      const col = [0xF3EBDD, 0xE9D3B4, 0xDCE6EA, 0xF2D9C4, 0xE7E0CF, 0xD4C4A8][(rnd() * 6) | 0];
      if (church) {
        stage._church = true;
        walls.push({ x, y, z, ry, sx: d, sy: 7, sz: w + 3, color: 0xE8E2D4 }); roofs.push({ x, y: y + 7, z, ry, sx: d * 1.1, sy: 3.4, sz: (w + 3) * 1.08, color: 0x6B4A3A });
        const tx = x + tr.rx[i] * side * 0, tz = z;
        walls.push({ x: tx + Math.sin(ry) * (w / 2 + 2), y, z: tz + Math.cos(ry) * (w / 2 + 2), ry, sx: 3.6, sy: 14, sz: 3.6, color: 0xE8E2D4 });
        spires.push({ x: tx + Math.sin(ry) * (w / 2 + 2), y: y + 14, z: tz + Math.cos(ry) * (w / 2 + 2), ry, sx: 3.2, sy: 7, sz: 3.2, color: 0x4B5563 });
        continue;
      }
      walls.push({ x, y, z, ry, sx: d, sy: h, sz: w, color: col });
      bands.push({ x, y: y + Math.min(h - 1.4, 2.6), z, ry, sx: d + 0.08, sy: 0.9, sz: w - 1.2, color: 0x36414F });          // windows
      if (h > 7.5) bands.push({ x, y: y + h - 1.9, z, ry, sx: d + 0.08, sy: 0.8, sz: w - 1.2, color: 0x36414F });
      roofs.push({ x, y: y + h, z, ry, sx: d * 1.12, sy: 2.4 + rnd() * 1.4, sz: w * 1.1, color: [0xB5523B, 0xA3452F, 0x4B5563, 0x8C3B2E][(rnd() * 4) | 0] });
      if (rnd() < 0.45) {   // shop awning over the pavement
        const ax = x - tr.rx[i] * side * (d / 2 + 0.8), az = z - tr.rz[i] * side * (d / 2 + 0.8);
        awnings.push({ x: ax, y: y + 3.1, z: az, ry, rz: side * 0.35, sx: 1.8, sy: 0.12, sz: w * 0.8, color: [0xE0402F, 0x2F7DE0, 0x2FB36B, 0xFFC72C][(rnd() * 4) | 0] });
      }
    }
  }
  delete stage._church;
  const box = () => flat(new THREE.BoxGeometry(1, 1, 1)), Lm = () => withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff }), false, { cloud: true });
  addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), Lm(), walls, { cast: true, receive: true });
  addInstanced(group, box(), withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff })), bands, {});
  addInstanced(group, flat(new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)), Lm(), roofs, { cast: true });
  addInstanced(group, flat(new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)), Lm(), spires, { cast: true });
  addInstanced(group, box(), withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff })), awnings, { cast: true });
  addInstanced(group, flat(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 6)), new THREE.MeshLambertMaterial({ color: 0xffffff }), bollards, { cast: true });
  addInstanced(group, flat(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 5)), new THREE.MeshLambertMaterial({ color: 0xffffff }), lamps, { cast: true });
  addInstanced(group, new THREE.BoxGeometry(0.5, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }), lampHeads, {});
  if (pave.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pave, 3)); g.computeVertexNormals(); group.add(chunkMesh(g, withCutaway(new THREE.MeshLambertMaterial({ color: 0xB9B6AE, side: THREE.DoubleSide }), false, { cut: false, cloud: true }), 60, true)); }
}
