import * as THREE from 'three';
import { HALF, WALL } from '../../core/constants.js';
import { mulberry32 } from '../../core/math.js';
import { railProject } from '../../core/track/rails.js';
import { addInstanced, chunkMesh, flat } from '../geometry.js';
import { withCutaway } from '../materials.js';

// ---------- town: pavements, bollards, lamps and buildings along the town street ----------
// the buildings' footprints, for the see-through view (camera.js): centre, heading (c, s), half depth/width, base/top
export let houseBoxes = [];
// a gable roof: a triangular prism 1 wide (x, across the street), 1 high, 1 long (z, the ridge along the street)
let gable = null;
function gableGeo() {
  if (gable) return gable.clone();
  const P = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0, 1, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0.5]], f = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4], [0, 1, 4], [0, 4, 3]];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(f.flatMap(t => t.flatMap(k => P[k])), 3));
  gable = flat(g); return gable.clone();
}
export function addTown(group, tr, terr, stage) {
  houseBoxes = []; if (!tr.town) return;
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
  // buildings: a row each side, fronts just behind the pavement; skipped where they would hit a road or the railway.
  // Four kinds, so the street isn't one box repeated: cottages (one storey, gabled, a chimney), houses (two storeys,
  // gabled or hipped), tall narrow townhouses (flat roof behind a cornice) and shops (a big window and an awning at
  // street level). Each has its own windows (with sills) floor by floor on the street front and the ends, and a door.
  const placed = [], gables = [], windows = [], sills = [], doors = [], chimneys = [];
  houseBoxes = [];
  const WALLS = [0xF3EBDD, 0xE9D3B4, 0xDCE6EA, 0xF2D9C4, 0xE7E0CF, 0xD4C4A8, 0xA8553F, 0xBDB6A8, 0xE3C16F, 0xC9D8C5, 0xD8CCE0, 0xF6F4EE];
  const ROOFS = [0xB5523B, 0xA3452F, 0x4B5563, 0x8C3B2E, 0x5E6B5A, 0x3A3F47, 0x7A5A44];
  const pick = a => a[(rnd() * a.length) | 0];
  for (let i = 0; i < N0; i += 1) {
    if (!tr.town[i] || i % 10) continue;
    for (const side of [-1, 1]) {
      if (rnd() < 0.12) continue;
      const r = rnd(), kind = r < 0.3 ? 'cottage' : r < 0.6 ? 'house' : r < 0.8 ? 'town' : 'shop';
      const w = kind === 'town' ? 6 + rnd() * 1.5 : 7 + rnd() * 3, d = 7 + rnd() * 4, floors = kind === 'cottage' ? 1 : kind === 'town' ? 3 : 2;
      const h = floors * 3.2 + 0.4 + rnd() * 0.5, off = WALL + 2.6 + d / 2;
      const x = tr.xs[i] + tr.rx[i] * side * off, z = tr.zs[i] + tr.rz[i] * side * off, ry = tr.th[i];
      const cs = Math.cos(ry), sn = Math.sin(ry), corners = [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => [x + cs * u * d / 2 + sn * v * w / 2, z - sn * u * d / 2 + cs * v * w / 2]);
      if (corners.some(([cx, cz]) => onRoad(cx, cz, WALL + 1.8)) || nearRail(x, z, d / 2 + w / 2 + 4) || placed.some(p => Math.hypot(p[0] - x, p[1] - z) < 8.5)) continue;
      placed.push([x, z]);
      const y = terr.at(x, z) - 0.3, church = !stage._church && side > 0 && rnd() < 0.2;
      if (church) {
        stage._church = true;
        walls.push({ x, y, z, ry, sx: d, sy: 7, sz: w + 3, color: 0xE8E2D4 }); roofs.push({ x, y: y + 7, z, ry, sx: d * 1.1, sy: 3.4, sz: (w + 3) * 1.08, color: 0x6B4A3A });
        walls.push({ x: x + Math.sin(ry) * (w / 2 + 2), y, z: z + Math.cos(ry) * (w / 2 + 2), ry, sx: 3.6, sy: 14, sz: 3.6, color: 0xE8E2D4 });
        spires.push({ x: x + Math.sin(ry) * (w / 2 + 2), y: y + 14, z: z + Math.cos(ry) * (w / 2 + 2), ry, sx: 3.2, sy: 7, sz: 3.2, color: 0x4B5563 });
        houseBoxes.push({ x, z, c: cs, s: sn, hd: d / 2 + 1, hw: w / 2 + 4, y0: y, y1: y + 21 });
        continue;
      }
      // local frame: u across the street (+ toward the road), v along it
      const fx = -tr.rx[i] * side, fz = -tr.rz[i] * side, vx = tr.tx[i], vz = tr.tz[i], at = (u, v) => [x + fx * u + vx * v, z + fz * u + vz * v];
      const col = kind === 'shop' ? pick([0xF3EBDD, 0xDCE6EA, 0xE7E0CF, 0xF6F4EE]) : pick(WALLS), roofC = pick(ROOFS);
      walls.push({ x, y, z, ry, sx: d, sy: h, sz: w, color: col });
      let top = h;
      if (kind === 'town') {                                                                   // flat roof behind a cornice
        const c = new THREE.Color(col).multiplyScalar(0.78).getHex();
        bands.push({ x, y: y + h + 0.25, z, ry, sx: d + 0.35, sy: 0.5, sz: w + 0.35, color: c }, { x, y: y + h + 0.52, z, ry, sx: d - 0.3, sy: 0.08, sz: w - 0.3, color: 0x5B5F66 }); top = h + 0.5;
      } else {
        const rh = 2.2 + rnd() * 1.6;
        if (kind !== 'shop' && rnd() < 0.3) roofs.push({ x, y: y + h, z, ry, sx: d * 1.12, sy: rh, sz: w * 1.1, color: roofC });   // hipped
        else gables.push({ x, y: y + h, z, ry, sx: d * 1.14, sy: rh, sz: w * 1.08, color: roofC });                                  // ridge along the street
        top = h + rh;
        if (kind !== 'shop' && rnd() < 0.75) { const [cx, cz] = at(-d * 0.18, (rnd() - 0.5) * w * 0.6); chimneys.push({ x: cx, y: y + h + rh * 0.55, z: cz, ry, sx: 0.8, sy: rh * 0.9 + 0.8, sz: 0.8, color: 0x8C5A48 }); }
      }
      // windows floor by floor: on the street front (the door, or the shop window, on the ground floor) and both ends
      const nW = Math.max(1, Math.floor((w - 1.2) / 2.3)), glass = rnd() < 0.5 ? 0x33414F : 0x3C4A42;
      for (let f = 0; f < floors; f++) {
        const wy = y + 1.1 + f * 3.2 + 0.55;
        for (let k = 0; k < nW; k++) {
          const v = (k - (nW - 1) / 2) * ((w - 1.2) / nW);
          if (f === 0 && kind === 'shop') continue;
          if (f === 0 && k === (nW >> 1)) { const [dx, dz] = at(d / 2 + 0.03, v); doors.push({ x: dx, y: y + 1.05, z: dz, ry, sx: 0.12, sy: 2.1, sz: 1.1, color: pick([0x5B3A29, 0x2E4A6B, 0x7A2E2E, 0x2F5D3A]) }); continue; }
          const [wx, wz] = at(d / 2 + 0.03, v); windows.push({ x: wx, y: wy, z: wz, ry, sx: 0.12, sy: 1.2, sz: 1.0, color: glass });
          const [sx2, sz2] = at(d / 2 + 0.12, v); sills.push({ x: sx2, y: wy - 0.66, z: sz2, ry, sx: 0.22, sy: 0.12, sz: 1.2, color: 0xF4F1EA });
        }
        for (const e of [-1, 1]) for (const u of d > 9 ? [-d / 4, d / 4] : [0]) { const [wx, wz] = at(u, e * (w / 2 + 0.03)); windows.push({ x: wx, y: wy, z: wz, ry, sx: 1.0, sy: 1.2, sz: 0.12, color: glass }); }
      }
      if (kind === 'shop') {
        const [wx, wz] = at(d / 2 + 0.03, 0); windows.push({ x: wx, y: y + 1.45, z: wz, ry, sx: 0.12, sy: 2.1, sz: w - 2.2, color: 0x6F8FA6 });
        const [bx, bz] = at(d / 2 + 0.06, 0); bands.push({ x: bx, y: y + 2.95, z: bz, ry, sx: 0.12, sy: 0.55, sz: w - 1, color: pick([0x1F3A5F, 0x6B1F2A, 0x2F4F2F, 0x3A3A3A]) });   // the shop sign
      }
      if (kind === 'shop' || rnd() < 0.2) {   // awning over the pavement
        const ax = x - tr.rx[i] * side * (d / 2 + 0.8), az = z - tr.rz[i] * side * (d / 2 + 0.8);
        awnings.push({ x: ax, y: y + 3.1, z: az, ry, rz: side * 0.35, sx: 1.8, sy: 0.12, sz: w * 0.8, color: [0xE0402F, 0x2F7DE0, 0x2FB36B, 0xFFC72C][(rnd() * 4) | 0] });
      }
      houseBoxes.push({ x, z, c: cs, s: sn, hd: d / 2 + 0.6, hw: w / 2 + 0.6, y0: y, y1: y + top });
    }
  }
  delete stage._church;
  const box = () => flat(new THREE.BoxGeometry(1, 1, 1)), Lm = () => withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff }), false, { cloud: true });
  addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), Lm(), walls, { cast: true, receive: true });
  addInstanced(group, box(), withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff })), bands, {});
  addInstanced(group, flat(new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)), Lm(), roofs, { cast: true });
  addInstanced(group, gableGeo(), Lm(), gables, { cast: true });
  addInstanced(group, flat(new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)), Lm(), spires, { cast: true });
  addInstanced(group, box(), withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff })), awnings, { cast: true });
  addInstanced(group, box(), withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x0B0F14 })), windows, {});
  addInstanced(group, box(), withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff })), [...sills, ...doors], {});
  addInstanced(group, box(), Lm(), chimneys, { cast: true });
  addInstanced(group, flat(new THREE.CylinderGeometry(0.16, 0.2, 1.1, 6)), new THREE.MeshLambertMaterial({ color: 0xffffff }), bollards, { cast: true });
  addInstanced(group, flat(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 5)), new THREE.MeshLambertMaterial({ color: 0xffffff }), lamps, { cast: true });
  addInstanced(group, new THREE.BoxGeometry(0.5, 0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0xffffff }), lampHeads, {});
  if (pave.length) { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pave, 3)); g.computeVertexNormals(); group.add(chunkMesh(g, withCutaway(new THREE.MeshLambertMaterial({ color: 0xB9B6AE, side: THREE.DoubleSide }), false, { cut: false, cloud: true }), 60, true)); }
}
