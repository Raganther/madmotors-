import * as THREE from 'three';
import { G } from '../../game.js';
import { FURNITURE, MATERIALS, STRUCT } from '../../data/structures.js';
import { buildingsOf, inFootprint } from '../../core/elements/structures.js';
import { CELL, layoutBuilding } from '../../core/kit/building.js';
import { flat, mergeAll } from '../geometry.js';
import { withCutaway } from '../materials.js';
import { quality } from '../renderer.js';
import { spawnProp } from '../effects/props.js';
import { debris } from '../effects/debris.js';
import { emit } from '../effects/particles.js';
import { shockwave } from '../effects/rings.js';
import { smoke } from '../weapons.js';
import { race } from '../../ui/flow.js';

// Destructible buildings, drawn (core/kit/building.js lays them out, core/features/structures.js breaks them).
//   - Walls are drawn from their cells: the standing cells of a wall merged into as few boxes as will do (rows of the
//     same kind, then stacked), in one instanced mesh whose shader draws the bricks (planks, stone blocks, concrete
//     panels, plaster inside) in metres along the wall, so a hole's edge cuts through the courses. A cracked cell is
//     drawn darker. A changed wall is rebuilt; the rest stay as they were.
//   - Every cell knocked out throws bricks (loose props: they tumble out of the hole the way the car went, land, and
//     get batted about) and dust; glass shatters out of windows.
//   - Inside: the floors of the rooms, the upper floors bay by bay, and the furniture (the core moves it).
//   - Roofs are bay by bay; a bay that falls drops in, tips, and breaks into slabs of roof on the heap.
//   - The roofs, upper floors and the walls above the car turn see-through round the player (materials.js cutaway,
//     switched on by render/camera.js through structureCover) instead of lifting away.
// The towns' houses and barns (the world kit) are drawn here too (buildingsOf), not by render/elements/kit.js.
const WIN = 0x34485A, DOORS = [0x5B3A29, 0x2E4A6B, 0x7A2E2E, 0x2F5D3A], ROOM_FLOOR = { living: 0x8A6440, kitchen: 0xD8D2C4, bedroom: 0x9A8A9E, shop: 0xC8C2B4, shed: 0x7A6A58, stall: 0x8A7A64, barn: 0xB89A5A, warehouse: 0x9A978F, chapel: 0xA8A090 };
const MATC = { brick: 0, timber: 1, stone: 2, concrete: 3 }, CAP = { walls: 16000, open: 6000, bits: 1600 };
let blds = [], wallVis = [], mesh = {}, bitN = 0, terrRef = null, groupRef = null, mounds = [], dirtyAll = true;
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const setI = (m, j, x, y, z, ry, sx, sy, sz, rx = 0, rz = 0) => { _e.set(rx, ry, rz, 'YXZ'); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz); _m.compose(_p, _q, _s); m.setMatrixAt(j, _m); };
const hash = (a, b) => { const h = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return h - Math.floor(h); };
function gableGeo() {
  const P = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0, 1, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0.5]], f = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4], [0, 1, 4], [0, 4, 3]];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(f.flatMap(t => t.flatMap(k => P[k])), 3)); return flat(g);
}
// the walls' shader: bricks, planks, stone or concrete drawn in metres along the wall (aOff: where the box starts
// along it and up it, and the material), so the pattern runs on across boxes and a hole cuts through the courses
function wallMaterial() {
  const mat = new THREE.MeshLambertMaterial({ color: 0xffffff }); withCutaway(mat, false);
  const cut = mat.onBeforeCompile;
  mat.onBeforeCompile = sh => {
    cut(sh);
    sh.vertexShader = 'attribute vec3 aOff;\nvarying vec3 vBrick;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      vBrick = vec3(aOff.x + (position.z + 0.5) * length(instanceMatrix[2].xyz), aOff.y + position.y * length(instanceMatrix[1].xyz), aOff.z);`);
    sh.fragmentShader = 'varying vec3 vBrick;\nfloat bh(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }\n' + sh.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      {
        float u = vBrick.x, v = vBrick.y, k = vBrick.z, m = 1.0, t = 0.0;
        if (k < 0.5) { float row = floor(v / 0.25); float uu = u + mod(row, 2.0) * 0.25; vec2 id = vec2(floor(uu / 0.5), row);
          vec2 f = vec2(fract(uu / 0.5) * 0.5, fract(v / 0.25) * 0.25); t = bh(id);
          m = (f.x < 0.025 || f.y < 0.025) ? 0.0 : 1.0; }
        else if (k < 1.5) { float row = floor(v / 0.22); t = bh(vec2(row, floor(u / 3.1 + row * 0.37))); m = fract(v / 0.22) < 0.08 ? 0.0 : 1.0; }
        else if (k < 2.5) { float row = floor(v / 0.36); float uu = u + bh(vec2(row, 1.0)) * 0.6; vec2 id = vec2(floor(uu / 0.62), row);
          t = bh(id); m = (fract(uu / 0.62) < 0.05 || fract(v / 0.36) < 0.07) ? 0.0 : 1.0; }
        else if (k < 3.5) { vec2 id = floor(vec2(u / 1.5, v / 1.0)); t = bh(id) * 0.5; m = (fract(u / 1.5) < 0.012 || fract(v / 1.0) < 0.015) ? 0.0 : 1.0; }
        else { t = bh(floor(vec2(u, v) * 4.0)) * 0.3; }
        diffuseColor.rgb = mix(diffuseColor.rgb * 0.62 + vec3(0.2), diffuseColor.rgb * (0.88 + 0.22 * t), m);
      }`);
  };
  return mat;
}
export function addStructures(group, tr, terr) {
  blds = []; wallVis = []; mounds = []; bitN = 0; terrRef = terr; groupRef = group; mesh = {}; dirtyAll = true;
  const S = buildingsOf(tr, terr); if (!S) return;
  const RF = { gable: [], flat: [], chimney: [], slab: [], floor: [] }, FU = [];
  for (const o of S) {
    const y = Math.min(...[[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, b]) => terr.at(o.x + Math.sin(o.f) * a * o.d / 2 + Math.cos(o.f) * b * o.w / 2, o.z + Math.cos(o.f) * a * o.d / 2 - Math.sin(o.f) * b * o.w / 2)));
    const Lo = layoutBuilding({ ...o, y }), B = { o, y, walls: [], bays: [], furn: [] }, base = new THREE.Color(o.wall), ry = Math.atan2(Math.cos(o.f), -Math.sin(o.f));
    for (const w of Lo.walls) {
      const outer = w.kind === 'outer', col = outer ? base.getHex() : 0xE8E2D6, k = outer ? MATC[o.mat] : 4;
      const out = Math.sign(((w.ax + w.bx) / 2 - o.x) * Math.cos(w.yaw) - ((w.az + w.bz) / 2 - o.z) * Math.sin(w.yaw)) || 1;   // which face is the outside
      wallVis.push({ w, y, col, k, out, B, shown: null, rects: [], ver: -1, mat: o.mat }); B.walls.push(wallVis.length - 1);
    }
    // floors of the rooms; upper floors and the roof bay by bay; a chimney on a house
    for (const rm of Lo.rooms) { const [x, z] = Lo.P((rm.u0 + rm.u1) / 2, (rm.v0 + rm.v1) / 2); RF.floor.push({ x, y: y + 0.03, z, ry, sx: rm.u1 - rm.u0 - 0.2, sy: 0.1, sz: rm.v1 - rm.v0 - 0.2, color: ROOM_FLOOR[rm.kind] || 0x8A6440 }); }
    const h = o.floors * STRUCT.FLOOR + 0.4, rk = o.roof === 'flat' ? 'flat' : 'gable', rh = o.roof === 'steep' ? o.d * 0.8 : o.d * 0.42;
    for (const b of Lo.bays) {
      const [x, z] = Lo.P(0, (b.v0 + b.v1) / 2), bw = b.v1 - b.v0, V = { b, parts: [] };
      const add = (kind, it) => { V.parts.push([kind, RF[kind].length, it]); RF[kind].push(it); };
      if (rk === 'flat') add('flat', { x, y: y + h + 0.17, z, ry, sx: o.d + 0.3, sy: 0.35, sz: bw + 0.02, color: o.type === 'stall' ? 0xF4F1EA : o.roofC });
      else add('gable', { x, y: y + h, z, ry, sx: o.d * 1.12, sy: rh, sz: bw + 0.02, color: o.roofC });
      for (let f = 1; f < o.floors; f++) add('slab', { x, y: y + f * STRUCT.FLOOR - 0.1, z, ry, sx: o.d - 0.5, sy: 0.22, sz: bw - 0.02, color: 0xB8AE9E });
      if (rk !== 'flat' && o.type !== 'barn' && o.type !== 'chapel' && b.k === Lo.bays.length - 1) { const [cx, cz] = Lo.P(-o.d * 0.18, (b.v0 + b.v1) / 2); add('chimney', { x: cx, y: y + h + rh * 0.45, z: cz, ry, sx: 0.7, sy: rh * 0.9 + 0.8, sz: 0.7, color: 0x8C5A48 }); }
      B.bays.push(V);
    }
    // furniture: a few boxes each, in the item's own frame (x across it, z along it)
    for (const f of Lo.furn) {
      const K = FURNITURE.KINDS[f.kind], c0 = K.c[Math.floor(hash(f.x, f.z) * K.c.length)], dark = new THREE.Color(c0).multiplyScalar(0.7).getHex(), parts = PARTS[f.kind] ? PARTS[f.kind](K, c0, dark) : [[0, K.h / 2, 0, K.hw * 2, K.h, K.hl * 2, c0]];
      const V = { parts: parts.map(p => { FU.push({ p }); return FU.length - 1; }), last: '', f0: { ...f, y: terr.at(f.x, f.z) } }; B.furn.push(V);
    }
    blds.push(B);
  }
  const ibox = flat(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), cbox = flat(new THREE.BoxGeometry(1, 1, 1));
  const inst = (geo, mat, n, cast, cut) => { const m = new THREE.InstancedMesh(geo, mat, Math.max(1, n)); if (cut) withCutaway(m.material, false); m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; for (let j = 0; j < Math.max(1, n); j++) { m.setMatrixAt(j, ZERO); m.setColorAt(j, _c.set(0xffffff)); } group.add(m); return m; };
  const fill = (m, list) => { list.forEach((it, j) => { setI(m, j, it.x, it.y, it.z, it.ry, it.sx, it.sy, it.sz); m.setColorAt(j, _c.set(it.color)); }); m.userData.list = list; m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true; return m; };
  const L = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  mesh.walls = inst(ibox.clone(), wallMaterial(), CAP.walls, true, false);
  mesh.walls.geometry.setAttribute('aOff', new THREE.InstancedBufferAttribute(new Float32Array(CAP.walls * 3), 3));
  mesh.open = inst(ibox.clone(), L(), CAP.open, false, true);                                      // glass and doors
  mesh.floor = fill(inst(cbox.clone(), L(), RF.floor.length, false, false), RF.floor);
  mesh.gable = fill(inst(gableGeo(), L(), RF.gable.length, true, true), RF.gable);
  mesh.flat = fill(inst(cbox.clone(), L(), RF.flat.length, true, true), RF.flat);
  mesh.chimney = fill(inst(cbox.clone(), L(), RF.chimney.length, true, true), RF.chimney);
  mesh.slab = fill(inst(cbox.clone(), L(), RF.slab.length, true, true), RF.slab);
  mesh.furn = inst(cbox.clone(), L(), FU.length, true, false); mesh.furn.userData.list = FU;
  mesh.bits = inst(flat(new THREE.DodecahedronGeometry(0.5, 0)), L(), CAP.bits, true, false);
  mesh.lumps = inst(mergeAll([new THREE.BoxGeometry(1.3, 0.5, 0.8).translate(0, -0.1, 0), new THREE.BoxGeometry(0.7, 0.45, 0.6).rotateY(0.5).translate(0.25, 0.35, 0.1), new THREE.BoxGeometry(0.6, 0.35, 0.5).rotateZ(0.4).translate(-0.4, 0.3, -0.15)].map(flat)), L(), STRUCT.LUMP.MAX, true, false);   // a lump of brickwork: a few bricks still mortared together
  for (const B of blds) for (const V of B.bays) V.state = 'up';
  // drawn whole before any race: every wall as laid out, the furniture where it stands
  for (const V of wallVis) { const n = V.w.type.length, hp = new Float32Array(n), mx = new Float32Array(n).fill(1); for (let i = 0; i < n; i++) hp[i] = V.w.type[i] === CELL.VOID ? 0 : 1; Object.assign(V, wallRects(V, hp, mx)); }
  writeWalls();
  for (const B of blds) for (const V of B.furn) placeFurniture(V, V.f0);
}
function placeFurniture(V, f) {
  const m = mesh.furn, cs = Math.cos(f.yaw), sn = Math.sin(f.yaw), tilt = f.moving ? Math.min(0.5, Math.abs(f.vy) * 0.08) : 0;
  for (const j of V.parts) {
    const [px, py, pz, sx, sy, sz, col] = m.userData.list[j].p;
    if (f.buried) { m.setMatrixAt(j, ZERO); continue; }
    setI(m, j, f.x + px * cs + pz * sn, f.y + py, f.z - px * sn + pz * cs, f.yaw, sx, sy, sz, tilt, 0); m.setColorAt(j, _c.set(col));
  }
  m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
}
// furniture shapes: [x, y, z, sx, sy, sz, colour] in the item's frame (x across, y up from the floor, z along)
const PARTS = {
  sofa: (K, c, d) => [[0, 0.22, 0.1, K.hw * 2, 0.44, K.hl * 2, c], [-K.hw + 0.1, 0.5, 0, 0.2, 0.7, K.hl * 2, d], [0, 0.35, K.hl - 0.1, K.hw * 2, 0.5, 0.2, d], [0, 0.35, -K.hl + 0.1, K.hw * 2, 0.5, 0.2, d]],
  armchair: (K, c, d) => [[0, 0.22, 0, K.hw * 2, 0.44, K.hl * 2, c], [-K.hw + 0.1, 0.5, 0, 0.2, 0.7, K.hl * 2, d]],
  table: (K, c, d) => [[0, 0.72, 0, K.hw * 2, 0.06, K.hl * 2, c], [0, 0.35, 0, 0.12, 0.7, K.hl * 1.4, d]],
  chair: (K, c, d) => [[0, 0.45, 0, 0.42, 0.06, 0.42, c], [-0.19, 0.7, 0, 0.05, 0.5, 0.42, d], [0, 0.22, 0, 0.3, 0.44, 0.3, d]],
  bed: (K, c, d) => [[0, 0.25, 0, K.hw * 2, 0.5, K.hl * 2, c], [0, 0.55, K.hl - 0.3, K.hw * 1.6, 0.14, 0.4, 0xF6F4EE], [0, 0.5, K.hl, K.hw * 2, 1.0, 0.08, d]],
  units: (K, c, d) => [[0, 0.43, 0, K.hw * 2, 0.86, K.hl * 2, c], [0, 0.88, 0, K.hw * 2 + 0.04, 0.05, K.hl * 2 + 0.04, 0x4A4E54]],
  shelf: (K, c, d) => [[0, 0.9, 0, K.hw * 2, 1.8, K.hl * 2, c], ...[0.5, 1.0, 1.5].map((y, k) => [0.05, y, 0, K.hw * 1.4, 0.25, K.hl * 1.8, [0xD8261E, 0x2E6FB0, 0xE0B020][k]])],
  counter: (K, c, d) => [[0, 0.5, 0, K.hw * 2, 1.0, K.hl * 2, c], [0, 1.02, 0, K.hw * 2 + 0.1, 0.05, K.hl * 2 + 0.1, d]],
  bench: (K, c, d) => [[0, 0.45, 0, K.hw * 2, 0.08, K.hl * 2, c], [-K.hw + 0.05, 0.75, 0, 0.08, 0.5, K.hl * 2, d], [0, 0.22, 0, K.hw * 1.4, 0.44, K.hl * 1.6, d]],
  pew: (K, c, d) => [[0, 0.45, 0, K.hw * 2, 0.08, K.hl * 2, c], [-K.hw + 0.04, 0.7, 0, 0.08, 0.6, K.hl * 2, d]],
  pallet: (K, c, d) => [[0, 0.07, 0, K.hw * 2, 0.14, K.hl * 2, 0xB0834F], [0, 0.6, 0, K.hw * 1.8, 0.9, K.hl * 1.8, c]],
};
export function newStructuresRace() {
  if (!mesh.walls) return;
  for (const V of wallVis) { V.ver = -1; V.shown = null; }
  dirtyAll = true;
  for (const m of mounds) { groupRef.remove(m); m.geometry.dispose(); } mounds = [];
  for (let j = 0; j < CAP.bits; j++) mesh.bits.setMatrixAt(j, ZERO); bitN = 0; mesh.bits.instanceMatrix.needsUpdate = true;
  for (const B of blds) for (const V of B.bays) { if (V.state !== 'up') bayAt(V, 0, 0, 0, 1); V.state = 'up'; V.t0 = 0; }
  for (const B of blds) for (const V of B.furn) V.last = '';
}
// ---------- walls ----------
// the standing cells of a wall as boxes: runs along each row of the same kind (plain, plinth, cracked), stacked where
// the rows above are the same; windows and doors separately
function wallRects(V, hp, max) {
  const w = V.w, rects = [], opens = [], cls = (i, r) => { if (hp[i] <= 0) return -1; const t = w.type[i]; if (t === CELL.WINDOW) return 10; if (t === CELL.DOOR) return 11; const k = hp[i] / max[i]; return k < 0.35 ? 3 : k < 0.75 ? 2 : r === 0 ? 1 : 0; };
  let prev = [];
  for (let r = 0; r < w.rows; r++) {
    const row = []; let a = 0;
    for (let c = 1; c <= w.cols; c++) { const k0 = cls(r * w.cols + a, r), k1 = c < w.cols ? cls(r * w.cols + c, r) : -2; if (k1 === k0) continue; if (k0 >= 0) row.push({ c0: a, c1: c, r0: r, r1: r + 1, k: k0 }); a = c; }
    const next = [];
    for (const s of row) { const p = prev.find(q => q.c0 === s.c0 && q.c1 === s.c1 && q.k === s.k); if (p) { p.r1 = r + 1; next.push(p); } else { (s.k >= 10 ? opens : rects).push(s); next.push(s); } }
    prev = next;
  }
  return { rects, opens };
}
function writeWalls() {
  const W = mesh.walls, O = mesh.open, off = W.geometry.attributes.aOff; let n = 0, no = 0;
  const CH = STRUCT.CH;
  for (const V of wallVis) {
    const w = V.w, ux = (w.bx - w.ax) / w.L, uz = (w.bz - w.az) / w.L, base = new THREE.Color(V.col);
    for (const s of V.rects) {
      if (n >= CAP.walls) break;
      const u0 = s.c0 * w.cw, u1 = s.c1 * w.cw, um = (u0 + u1) / 2, y0 = s.r0 * CH - (s.r0 === 0 ? 1 : 0), y1 = s.r1 * CH;   // the bottom row runs into the ground
      setI(W, n, w.ax + ux * um, V.y + y0, w.az + uz * um, w.yaw, w.thick, y1 - y0, u1 - u0 + 0.002);
      W.setColorAt(n, _c.copy(base).multiplyScalar(s.k === 1 ? 0.72 : s.k === 2 ? 0.78 : s.k === 3 ? 0.58 : 1));
      off.setXYZ(n, u0, y0, V.k); n++;
    }
    for (const s of V.opens) {
      if (no >= CAP.open) break;
      const u0 = s.c0 * w.cw, u1 = s.c1 * w.cw, um = (u0 + u1) / 2, ox = Math.cos(w.yaw) * V.out * w.thick * 0.15, oz = -Math.sin(w.yaw) * V.out * w.thick * 0.15;
      setI(O, no, w.ax + ux * um + ox, V.y + s.r0 * CH, w.az + uz * um + oz, w.yaw, w.thick * (s.k === 10 ? 0.25 : 0.6), (s.r1 - s.r0) * CH, u1 - u0); O.setColorAt(no, _c.set(s.k === 10 ? WIN : DOORS[w.cols % DOORS.length])); no++;
    }
  }
  for (let j = n; j < (W.userData.n || CAP.walls); j++) W.setMatrixAt(j, ZERO);
  for (let j = no; j < (O.userData.n || CAP.open); j++) O.setMatrixAt(j, ZERO);
  W.userData.n = n; O.userData.n = no;
  W.instanceMatrix.needsUpdate = O.instanceMatrix.needsUpdate = true; W.instanceColor.needsUpdate = O.instanceColor.needsUpdate = true; off.needsUpdate = true;
}
// ---------- debris ----------
// one brick (a plank, a lump of stone or concrete) thrown out of cell (c, r) of wall V the way it was pushed
function throwBrick(V, c, r, dx, dz, v, near) {
  const w = V.w, t = (c + 0.5) / w.cols, x = w.ax + (w.bx - w.ax) * t, z = w.az + (w.bz - w.az) * t, y = V.y + (r + 0.5) * STRUCT.CH, M = MATERIALS[V.mat], col = new THREE.Color(V.col);
  const sp = v * (0.35 + Math.random() * 0.55), side = (Math.random() - 0.5) * 4, up = 1 + Math.random() * 3.5;
  if (near) {
    _q.setFromEuler(_e.set(Math.random() * 3, Math.random() * 6, Math.random() * 3));
    const dims = V.k === 1 ? [0.9, 0.06, 0.22] : V.k === 3 ? [0.45, 0.35, 0.4] : V.k === 2 ? [0.5, 0.3, 0.32] : V.k === 4 ? [0.4, 0.06, 0.3] : [0.42, 0.18, 0.2];
    spawnProp('box', _p.set(x + dx * 0.3, y, z + dz * 0.3), _q, dims, Math.random() < 0.25 ? M.rubble : col.multiplyScalar(0.85 + Math.random() * 0.2).getHex(), dx * sp + dz * side, up, dz * sp - dx * side, 4 + Math.random() * 8, M.sound);
  }
  debris(x, y, z, dx * sp * 0.8 + (Math.random() - 0.5) * 3, up + 1, dz * sp * 0.8 + (Math.random() - 0.5) * 3, M.rubble, 0.12, 0.08, 0.12, 1.2 + Math.random(), 0);
}
// rubble bits scattered over a rectangle (x, z, yaw; half-sizes a along yaw, b across), n of them, up to `tall` high
function scatter(x, z, yaw, a, b, n, color, tall) {
  const ca = Math.sin(yaw), sa = Math.cos(yaw), base = new THREE.Color(color), m = mesh.bits;
  for (let k = 0; k < n; k++) {
    const u = (Math.random() * 2 - 1) * a, v = (Math.random() * 2 - 1) * b, px = x + ca * u + sa * v, pz = z + sa * u - ca * v, s = 0.2 + Math.random() * 0.45 * tall;
    const j = bitN++ % CAP.bits; setI(m, j, px, terrRef.at(px, pz) + s * 0.25, pz, Math.random() * 6, s * (1 + Math.random()), s * 0.7, s * (0.8 + Math.random()), Math.random(), Math.random());
    m.setColorAt(j, _c.copy(base).multiplyScalar(0.75 + Math.random() * 0.4));
  }
  m.instanceMatrix.needsUpdate = true; m.instanceColor.needsUpdate = true;
}
// a heap where a bay (or the whole building) fell: a low jagged mound of rubble and bits of roof and wall
function mound(o, y, h) {
  const g = new THREE.PlaneGeometry(h.d, h.w, 8, 6).rotateX(-Math.PI / 2), pos = g.attributes.position, top = 0.4 + o.floors * 0.3;
  for (let i = 0; i < pos.count; i++) { const u = pos.getX(i) / (h.d / 2), v = pos.getZ(i) / (h.w / 2), e = Math.max(Math.abs(u), Math.abs(v)); pos.setY(i, Math.max(0, 1 - e * e) * top * (0.5 + Math.random() * 0.7)); }
  const m = new THREE.Mesh(flat(g), new THREE.MeshLambertMaterial({ color: new THREE.Color(MATERIALS[o.mat].rubble).lerp(new THREE.Color(o.wall), 0.3) }));
  m.position.set(h.x, y + 0.02, h.z); m.rotation.y = Math.atan2(Math.cos(o.f), -Math.sin(o.f)); m.castShadow = m.receiveShadow = true; groupRef.add(m); mounds.push(m);
  scatter(h.x, h.z, Math.atan2(Math.cos(o.f), -Math.sin(o.f)), h.w / 2, h.d / 2, 14 + o.floors * 6, MATERIALS[o.mat].rubble, 1.2);
}
// ---------- roofs and upper floors, bay by bay ----------
function bayAt(V, drop, tx, tz, sc) {
  for (const [kind, j, it] of V.parts) { const m = mesh[kind]; if (sc <= 0.001) m.setMatrixAt(j, ZERO); else setI(m, j, it.x, it.y - drop, it.z, it.ry, it.sx * sc, it.sy * sc, it.sz * sc, tx, tz); m.instanceMatrix.needsUpdate = true; }
}
// the bay is down: its roof lands as broken slabs, its floors as a heap, in a cloud of dust
function bayLanded(B, V, o) {
  bayAt(V, 0, 0, 0, 0);
  const near = race && Math.hypot(V.parts[0][2].x - race.player.x, V.parts[0][2].z - race.player.z) < 70;
  for (const [kind, , it] of V.parts) {
    if (kind === 'chimney' || !near) continue;
    for (let k = 0; k < (kind === 'slab' ? 2 : 4); k++) {
      _q.setFromEuler(_e.set((Math.random() - 0.5) * 1.2, it.ry + Math.random() * 0.4, (Math.random() - 0.5) * 1.2));
      spawnProp('box', _p.set(it.x + (Math.random() - 0.5) * it.sx * 0.6, B.y + 1.2 + k * 0.3, it.z + (Math.random() - 0.5) * it.sz * 0.6), _q, [it.sx * 0.35, 0.18, it.sz * 0.45], it.color, (Math.random() - 0.5) * 4, 2 + Math.random() * 2, (Math.random() - 0.5) * 4, 2 + Math.random() * 3, 'wood');
    }
  }
}
/** Should the see-through window open round the player: inside a standing building, or behind one from the camera? */
export function structureCover(P, dir) {
  if (!race || !race.st) return false;
  for (const o of race.st.blds) {
    if (o.collapsed || Math.abs(o.x - P.x) > 40 || Math.abs(o.z - P.z) > 40) continue;
    if (inFootprint(o, P.x, P.z, 0.8)) return true;
    const top = o.y + o.floors * STRUCT.FLOOR + 3;
    for (let t = 2; t < 40; t += 2) { const x = P.x + dir.x * t, y = P.y + 1 + dir.y * t, z = P.z + dir.z * t; if (y > top) break; if (inFootprint(o, x, z)) return true; }
  }
  return false;
}
export function updateStructures(dt) {
  if (!mesh.walls || !race || !race.st) return;
  const S = race.st, P = race.player, low = quality === 'low';
  // walls: rebuild the ones that changed, throw what came out of them
  let changed = dirtyAll, thrown = 0; const budget = low ? 25 : 70;
  wallVis.forEach((V, k) => {
    const w = S.walls[k]; if (!w || (w.ver === V.ver && !dirtyAll)) return;
    V.ver = w.ver; changed = true;
    const near = Math.hypot(w.x - P.x, w.z - P.z) < 70;
    if (V.shown && !dirtyAll) {
      const hit = w.hit || { dx: 0, dz: 0, v: 5 }, fresh = [];
      for (let i = 0; i < w.hp.length; i++) if (V.shown[i] && w.hp[i] <= 0) fresh.push(i);
      for (let j = 0; j < fresh.length; j++) {
        const i = fresh[j], c = i % w.cols, r = (i / w.cols) | 0;
        if (w.type[i] === CELL.WINDOW) { for (let g = 0; g < 3; g++) debris(w.ax + (w.bx - w.ax) * (c + 0.5) / w.cols, V.y + (r + 0.5) * STRUCT.CH, w.az + (w.bz - w.az) * (c + 0.5) / w.cols, hit.dx * 4 + (Math.random() - 0.5) * 4, 2 + Math.random() * 3, hit.dz * 4 + (Math.random() - 0.5) * 4, 0xBFE6F5, 0.12, 0.02, 0.1, 1, 0); continue; }
        if (thrown < budget && (fresh.length <= budget || Math.random() < budget / fresh.length)) { throwBrick(V, c, r, hit.dx, hit.dz, hit.v, near); thrown++; }
      }
      if (fresh.length && near) {
        const p = fresh[fresh.length >> 1], c = p % w.cols, r = (p / w.cols) | 0, x = w.ax + (w.bx - w.ax) * (c + 0.5) / w.cols, z = w.az + (w.bz - w.az) * (c + 0.5) / w.cols, dust = new THREE.Color(MATERIALS[V.mat].rubble).lerp(new THREE.Color(0xDDD6CA), 0.55).getHex();
        for (let j = 0; j < Math.min(4, 1 + fresh.length / 12); j++) smoke(x + hit.dx * j, V.y + 0.8 + r * STRUCT.CH * 0.5 + j * 0.3, z + hit.dz * j, 2.5 + j, dust, 1.5, 1);
        for (let j = 0; j < 8; j++) emit(x, V.y + 1 + Math.random() * 1.5, z, hit.dx * 3 + (Math.random() - 0.5) * 4, Math.random() * 2, hit.dz * 3 + (Math.random() - 0.5) * 4, 0.8, 1.1, dust, 0.6);
        scatter(x + hit.dx * 1.2, z + hit.dz * 1.2, w.yaw, Math.min(2.5, fresh.length * 0.06 + 0.6), 0.9, Math.min(10, 2 + fresh.length / 6), MATERIALS[V.mat].rubble, 0.8);
      }
    }
    V.shown = Uint8Array.from(w.hp, v => v > 0 ? 1 : 0);
    const { rects, opens } = wallRects(V, w.hp, w.max); V.rects = rects; V.opens = opens;
  });
  if (changed) writeWalls(); dirtyAll = false;
  // bays: falling in, then landed as a heap
  blds.forEach((B, b) => {
    const o = S.blds[b]; if (!o) return;
    B.bays.forEach((V, k) => {
      const cb = o.bays[k]; if (!cb) return;
      if (cb.fallen && V.state === 'up') {
        V.state = 'falling'; V.t0 = race.time; V.tx = (Math.random() - 0.5) * 0.7; V.tz = (Math.random() - 0.5) * 0.5;
        const h = S.heaps.find(q => q.bld === o.id && q.bay === k); if (h) mound(o, B.y, h);
        const near = Math.hypot(o.x - P.x, o.z - P.z) < 70, dust = new THREE.Color(MATERIALS[o.mat].rubble).lerp(new THREE.Color(0xE0DAD0), 0.55).getHex(), it = V.parts[0][2];
        for (let j = 0; j < 3 + o.floors; j++) smoke(it.x + (Math.random() - 0.5) * 3, B.y + 1 + j * 0.6, it.z + (Math.random() - 0.5) * 3, 4 + o.floors, dust, 2.2, 1.3);
        if (near) { shockwave(it.x, B.y + 0.3, it.z, Math.max(o.d, 4) * 0.8, 0xE8E0D2); G.shake = Math.min(1.6, G.shake + 0.4 + o.floors * 0.1); }
      }
      if (V.state === 'falling') {
        const e = Math.min(1, (race.time - V.t0) / 0.5), drop = (o.floors * STRUCT.FLOOR) * e * e;
        bayAt(V, drop, V.tx * e, V.tz * e, 1);
        if (e >= 1) { V.state = 'down'; bayLanded(B, V, o); }
      }
    });
    // furniture: where the core has it (only the ones that moved), gone when buried
    B.furn.forEach((V, k) => {
      const f = S.furn[o.furn[k]]; if (!f) return;
      const tag = f.buried ? 'x' : `${f.x.toFixed(2)},${f.z.toFixed(2)},${f.y.toFixed(2)},${f.yaw.toFixed(2)}`; if (tag === V.last) return; V.last = tag;
      placeFurniture(V, f);
    });
  });
  // the thrown lumps
  const Lm = S.lumps, lm = mesh.lumps;
  for (let j = 0; j < STRUCT.LUMP.MAX; j++) { const q = Lm[j]; if (!q) { lm.setMatrixAt(j, ZERO); continue; } setI(lm, j, q.x, q.y, q.z, q.a, q.r * 1.1, q.r * 1.1, q.r * 1.1, q.a * 0.3, 0); lm.setColorAt(j, _c.set(q.color)); }
  lm.instanceMatrix.needsUpdate = true; lm.instanceColor.needsUpdate = true;
}
