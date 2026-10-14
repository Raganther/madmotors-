import * as THREE from 'three';
import { G } from '../../game.js';
import { MATERIALS, STRUCT } from '../../data/structures.js';
import { inFootprint } from '../../core/elements/structures.js';
import { flat } from '../geometry.js';
import { spawnProp } from '../effects/props.js';
import { emit } from '../effects/particles.js';
import { shockwave } from '../effects/rings.js';
import { smoke } from '../weapons.js';
import { race } from '../../ui/flow.js';

// Destructible buildings, drawn (core/elements/structures.js places them, core/features/structures.js breaks them).
// Every wall panel is one instance of a box (coloured per building, a shade darker as it cracks), with its windows
// and the door as instances too, so a whole street is a handful of draw calls; a broken panel's instances shrink to
// nothing and it bursts into bricks and dust. The roof is a mesh per building: it goes see-through while you're
// inside (the camera looks down) and drops onto the heap when the building falls in. Rubble: a strip of bits where a
// panel stood, a mound and a spread of bits over a collapsed footprint, and the core's thrown lumps (R.st.lumps).
const WIN = 0x2E3A46, SILL = 0xF1EEE6, DOORS = [0x5B3A29, 0x2E4A6B, 0x7A2E2E, 0x2F5D3A], FLOORC = 0x6E5640;
const BITS = 1600;
let blds = [], walls = null, wins = null, bits = null, lumps = null, bitN = 0, terrRef = null, groupRef = null, mounds = [];
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), ZERO = new THREE.Matrix4().makeScale(0, 0, 0);
const setI = (mesh, j, x, y, z, ry, sx, sy, sz, rx = 0, rz = 0) => { _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz); _m.compose(_p, _q, _s); mesh.setMatrixAt(j, _m); };
function gableGeo(steep) {
  const P = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0, 1, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0.5]], f = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4], [0, 1, 4], [0, 4, 3]];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(f.flatMap(t => t.flatMap(k => P[k])), 3)); g.userData = { steep }; return flat(g);
}
// the same panels the core builds (core/features/structures.js panelsOf), with the look of each
function panelList(o, y) {
  const nx = Math.sin(o.f), nz = Math.cos(o.f), tx = Math.cos(o.f), tz = -Math.sin(o.f), h = o.floors * STRUCT.FLOOR + 0.4, out = [];
  const run = (wall, ax, az, bx, bz) => { const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / STRUCT.PANEL)), yaw = Math.atan2(bx - ax, bz - az); for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; out.push({ wall, k, n, x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw, len: len / n, y, h }); } };
  const P = (u, v) => [o.x + nx * u + tx * v, o.z + nz * u + tz * v], hd = o.d / 2 - STRUCT.THICK / 2, hw = o.w / 2 - STRUCT.THICK / 2;
  if (!o.open) run(0, ...P(hd, -hw), ...P(hd, hw));
  run(1, ...P(hd, hw), ...P(-hd, hw)); run(2, ...P(-hd, hw), ...P(-hd, -hw)); run(3, ...P(-hd, -hw), ...P(hd, -hw));
  return out;
}
export function addStructures(group, tr, terr) {
  blds = []; mounds = []; bitN = 0; terrRef = terr; groupRef = group; walls = wins = bits = lumps = null;
  const S = tr.structures; if (!S) return;
  const W = [], N = [];   // wall and window instances
  for (const o of S) {
    const y = Math.min(...[[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, b]) => terr.at(o.x + Math.sin(o.f) * a * o.d / 2 + Math.cos(o.f) * b * o.w / 2, o.z + Math.cos(o.f) * a * o.d / 2 - Math.sin(o.f) * b * o.w / 2)));
    const B = { o, y, panels: [], roof: null, mat: null, fade: 1, fall: -1, cracks: [] }, ps = panelList(o, y), base = new THREE.Color(o.wall);
    ps.forEach((p, k) => {
      const shade = 0.94 + ((k * 7 + o.id * 3) % 5) * 0.025, col = base.clone().multiplyScalar(shade).getHex();
      const wj = W.length; W.push({ x: p.x, y: y - 1, z: p.z, ry: p.yaw, sx: STRUCT.THICK, sy: p.h + 1, sz: p.len + 0.04, color: col });
      // windows on the outside face, floor by floor (a door in the middle of the front, a shop window across a shop's ground floor)
      const out = Math.sign((p.x - o.x) * Math.cos(p.yaw) - (p.z - o.z) * Math.sin(p.yaw)) || 1, ox = Math.cos(p.yaw) * out * (STRUCT.THICK / 2 + 0.03), oz = -Math.sin(p.yaw) * out * (STRUCT.THICK / 2 + 0.03);
      const wl = [];
      for (let f = 0; f < o.floors; f++) {
        if (p.len < 1.6) break;
        const door = f === 0 && p.wall === 0 && p.k === p.n >> 1, shopW = f === 0 && o.shop && p.wall === 0;
        if (door) { wl.push(N.length); N.push({ x: p.x + ox, y: y + 1.05, z: p.z + oz, ry: p.yaw, sx: 0.1, sy: 2.1, sz: 1.1, color: DOORS[o.id % DOORS.length] }); continue; }
        if (o.type === 'barn' && f === 0 && p.wall === 0) continue;
        const ww = shopW ? p.len * 0.8 : Math.min(1.1, p.len * 0.45), wh = shopW ? 1.9 : 1.2, wy = shopW ? 1.3 : 1.7 + f * STRUCT.FLOOR;
        if ((p.k + f + o.id) % 4 === 3 && !shopW) continue;                    // the odd blank bit of wall
        wl.push(N.length); N.push({ x: p.x + ox, y: y + wy, z: p.z + oz, ry: p.yaw, sx: 0.08, sy: wh, sz: ww, color: shopW ? 0x6F94A8 : WIN });
        wl.push(N.length); N.push({ x: p.x + ox * 1.6, y: y + wy - wh / 2 - 0.05, z: p.z + oz * 1.6, ry: p.yaw, sx: 0.12, sy: 0.1, sz: ww + 0.2, color: SILL });
      }
      B.panels.push({ wj, wl, col, dmg0: 0 });
    });
    // the roof: gable or steep (a ridge along the front), or flat with a parapet; a chimney on a house
    const h = o.floors * STRUCT.FLOOR + 0.4, ry = Math.atan2(Math.cos(o.f), -Math.sin(o.f)), mat = new THREE.MeshLambertMaterial({ color: o.roofC, transparent: true, opacity: 1 });
    const roof = new THREE.Group(); roof.position.set(o.x, y + h, o.z); roof.rotation.y = ry;
    if (o.roof === 'flat') { const m = new THREE.Mesh(flat(new THREE.BoxGeometry(o.d + 0.3, 0.35, o.w + 0.3)), mat); m.position.y = 0.17; roof.add(m); }
    else { const rh = o.roof === 'steep' ? o.d * 0.8 : o.d * 0.42, m = new THREE.Mesh(gableGeo(), mat); m.scale.set(o.d * 1.12, rh, o.w * 1.06); roof.add(m);
      if (o.type !== 'barn' && o.type !== 'chapel') { const ch = new THREE.Mesh(flat(new THREE.BoxGeometry(0.7, rh * 0.9 + 0.8, 0.7)), new THREE.MeshLambertMaterial({ color: 0x8C5A48, transparent: true })); ch.position.set(-o.d * 0.18, rh * 0.45, o.w * 0.3); roof.add(ch); } }
    if (o.type === 'stall') { mat.color.set(0xF4F1EA); const aw = new THREE.Mesh(flat(new THREE.BoxGeometry(1.4, 0.08, o.w + 0.2)), new THREE.MeshLambertMaterial({ color: o.wall, transparent: true })); aw.position.set(o.d / 2 + 0.6, -0.4, 0); aw.rotation.z = -0.3; roof.add(aw); }
    roof.traverse(m => { if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
    group.add(roof); B.roof = roof; B.roofY = y + h;
    // the floor inside (you see it through a hole, or with the roof faded)
    const fl = new THREE.Mesh(flat(new THREE.BoxGeometry(o.d - 0.6, 0.12, o.w - 0.6)), new THREE.MeshLambertMaterial({ color: FLOORC })); fl.position.set(o.x, y + 0.04, o.z); fl.rotation.y = ry; fl.receiveShadow = true; group.add(fl);
    blds.push(B);
  }
  const box = flat(new THREE.BoxGeometry(1, 1, 1).translate(0, 0.5, 0));
  const mk = (geo, list, cast) => { const m = new THREE.InstancedMesh(geo, new THREE.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, list.length)); list.forEach((it, j) => { setI(m, j, it.x, it.y, it.z, it.ry, it.sx, it.sy, it.sz); _c.set(it.color); m.setColorAt(j, _c); }); m.userData.list = list; m.castShadow = cast; m.receiveShadow = true; m.frustumCulled = false; group.add(m); return m; };
  walls = mk(box, W, true); wins = mk(flat(new THREE.BoxGeometry(1, 1, 1)), N, false);
  bits = new THREE.InstancedMesh(flat(new THREE.DodecahedronGeometry(0.5, 0)), new THREE.MeshLambertMaterial({ color: 0xffffff }), BITS); bits.frustumCulled = false; bits.receiveShadow = true; bits.castShadow = true;
  for (let j = 0; j < BITS; j++) { bits.setMatrixAt(j, ZERO); bits.setColorAt(j, _c.set(0x888888)); } group.add(bits);
  lumps = new THREE.InstancedMesh(flat(new THREE.DodecahedronGeometry(1, 0)), new THREE.MeshLambertMaterial({ color: 0xffffff }), STRUCT.LUMP.MAX); lumps.frustumCulled = false; lumps.castShadow = true;
  for (let j = 0; j < STRUCT.LUMP.MAX; j++) { lumps.setMatrixAt(j, ZERO); lumps.setColorAt(j, _c.set(0x888888)); } group.add(lumps);
}
export function newStructuresRace() {
  if (!walls) return;
  for (const B of blds) {
    for (const P of B.panels) { showPanel(P, true); P.dmg0 = 0; P.broken = false; walls.setColorAt(P.wj, _c.set(P.col)); }
    B.roof.visible = true; B.roof.position.y = B.roofY; B.roof.rotation.x = B.roof.rotation.z = 0; B.fall = -1; B.down = false;
  }
  for (const m of mounds) { groupRef.remove(m); m.geometry.dispose(); } mounds = [];
  for (let j = 0; j < BITS; j++) bits.setMatrixAt(j, ZERO); bitN = 0; bits.instanceMatrix.needsUpdate = true;
  walls.instanceMatrix.needsUpdate = wins.instanceMatrix.needsUpdate = true; walls.instanceColor.needsUpdate = true;
}
function showPanel(P, on) {
  const it = walls.userData.list[P.wj]; if (on) setI(walls, P.wj, it.x, it.y, it.z, it.ry, it.sx, it.sy, it.sz); else walls.setMatrixAt(P.wj, ZERO);
  for (const j of P.wl) { const w = wins.userData.list[j]; if (on) setI(wins, j, w.x, w.y, w.z, w.ry, w.sx, w.sy, w.sz); else wins.setMatrixAt(j, ZERO); }
  walls.instanceMatrix.needsUpdate = wins.instanceMatrix.needsUpdate = true;
}
// rubble bits scattered over a rectangle (x, z, yaw; half-sizes a along yaw, b across), n of them, up to `tall` high
function scatter(x, z, yaw, a, b, n, color, tall) {
  const ca = Math.sin(yaw), sa = Math.cos(yaw), base = new THREE.Color(color);
  for (let k = 0; k < n; k++) {
    const u = (Math.random() * 2 - 1) * a, v = (Math.random() * 2 - 1) * b, px = x + ca * u + sa * v, pz = z + sa * u - ca * v, s = 0.25 + Math.random() * 0.55 * tall;
    const j = bitN++ % BITS; setI(bits, j, px, terrRef.at(px, pz) + s * 0.25, pz, Math.random() * 6, s * (1 + Math.random()), s * 0.7, s * (0.8 + Math.random()), Math.random(), Math.random());
    bits.setColorAt(j, _c.copy(base).multiplyScalar(0.75 + Math.random() * 0.4));
  }
  bits.instanceMatrix.needsUpdate = true; bits.instanceColor.needsUpdate = true;
}
// a heap over a collapsed building: a low jagged mound in the rubble colour (and the wall colour mixed in)
function mound(B, M) {
  const o = B.o, g = new THREE.PlaneGeometry(o.d + 1.5, o.w + 1.5, 8, 8).rotateX(-Math.PI / 2), pos = g.attributes.position, top = 0.5 + o.floors * 0.35;
  for (let i = 0; i < pos.count; i++) { const u = pos.getX(i) / ((o.d + 1.5) / 2), v = pos.getZ(i) / ((o.w + 1.5) / 2), e = Math.max(Math.abs(u), Math.abs(v)); pos.setY(i, Math.max(0, 1 - e * e) * top * (0.6 + Math.random() * 0.6)); }
  const m = new THREE.Mesh(flat(g), new THREE.MeshLambertMaterial({ color: new THREE.Color(M.rubble).lerp(new THREE.Color(o.wall), 0.3) }));
  m.position.set(o.x, B.y + 0.02, o.z); m.rotation.y = Math.atan2(Math.cos(o.f), -Math.sin(o.f)); m.castShadow = m.receiveShadow = true; groupRef.add(m); mounds.push(m);
}
/** Bricks, dust and splinters bursting out of panel p of building B the way (dx, dz). */
function burst(B, it, dx, dz, sp, near) {
  const M = MATERIALS[B.o.mat], col = new THREE.Color(B.o.wall), n = near ? 9 : 4;
  for (let k = 0; k < n; k++) {
    const s = 0.25 + Math.random() * 0.35, v = sp * (0.3 + Math.random() * 0.5), side = (Math.random() - 0.5) * 6;
    _p.set(it.x + (Math.random() - 0.5) * it.sz * Math.sin(it.ry), it.y + 1 + Math.random() * (it.sy - 1), it.z + (Math.random() - 0.5) * it.sz * Math.cos(it.ry)); _q.setFromEuler(_e.set(Math.random(), Math.random() * 6, 0));
    spawnProp('box', _p, _q, B.o.mat === 'timber' ? [s * 3, s * 0.3, s * 0.6] : [s * 1.4, s * 0.7, s], k % 3 ? col.getHex() : M.rubble, dx * v + dz * side * 0.3, 2 + Math.random() * 5, dz * v - dx * side * 0.3, 4 + Math.random() * 8, M.sound);
  }
  for (let k = 0; k < (near ? 3 : 1); k++) smoke(it.x + dx * k * 1.2, it.y + 1.2 + k * 0.6, it.z + dz * k * 1.2, 3 + k, new THREE.Color(M.rubble).lerp(new THREE.Color(0xD8D2C8), 0.5).getHex(), 1.6, 1.2);
  for (let k = 0; k < 10; k++) emit(it.x, it.y + 1 + Math.random() * 2, it.z, dx * 4 + (Math.random() - 0.5) * 5, 1 + Math.random() * 2, dz * 4 + (Math.random() - 0.5) * 5, 0.9, 1.3, 0xC8C0B4, 0.5);
}
export function updateStructures(dt) {
  if (!walls || !race || !race.st) return;
  const S = race.st, P = race.player, near = (x, z) => Math.hypot(x - P.x, z - P.z) < 60;
  blds.forEach((B, b) => {
    const o = S.blds[b]; if (!o) return;
    B.panels.forEach((Pn, k) => {
      const p = S.panels[o.panels[k]]; if (!p) return;
      if (p.broken && !Pn.broken) {
        Pn.broken = true; showPanel(Pn, false); const it = walls.userData.list[Pn.wj];
        const c = race.cars[p.by] || null, sp = c ? Math.hypot(c.vx, c.vz) : 6, dx = c ? c.vx / (sp || 1) : Math.sin(p.yaw + Math.PI / 2), dz = c ? c.vz / (sp || 1) : Math.cos(p.yaw + Math.PI / 2);
        if (!o.collapsed || B.fall < 0) burst(B, it, dx, dz, Math.max(6, sp), near(it.x, it.z));
        scatter(p.x, p.z, p.yaw, p.hl, STRUCT.STRIP * 0.7, 8, MATERIALS[o.mat].rubble, 1);
      } else if (!p.broken && p.dmg !== Pn.dmg0) {                                       // cracks: the wall darkens as it weakens
        Pn.dmg0 = p.dmg; walls.setColorAt(Pn.wj, _c.set(Pn.col).multiplyScalar(1 - 0.45 * p.dmg / p.hp)); walls.instanceColor.needsUpdate = true;
        const it = walls.userData.list[Pn.wj]; for (let j = 0; j < 6; j++) emit(it.x, it.y + 1.5 + Math.random() * 1.5, it.z, (Math.random() - 0.5) * 3, Math.random() * 2, (Math.random() - 0.5) * 3, 0.7, 0.8, 0xD0C8BC, 1);
      }
    });
    if (o.collapsed && B.fall < 0) {                                                        // it comes down: the roof drops, a cloud of dust, a heap
      B.fall = 0; B.t0 = race.time; B.tilt = (Math.random() - 0.5) * 0.5; B.tiltZ = (Math.random() - 0.5) * 0.3;
      const M = MATERIALS[o.mat], dust = new THREE.Color(M.rubble).lerp(new THREE.Color(0xE0DAD0), 0.55).getHex();
      mound(B, M); scatter(o.x, o.z, Math.atan2(Math.cos(o.f), -Math.sin(o.f)), o.w / 2 + 1.5, o.d / 2 + 1.5, 30 + o.floors * 12, M.rubble, 1.4);
      for (let k = 0; k < 6 + o.floors * 2; k++) { const a = k * 2.4; smoke(o.x + Math.sin(a) * o.d * 0.4, B.y + 1 + k * 0.5, o.z + Math.cos(a) * o.w * 0.4, 5 + o.floors * 1.5, dust, 2.6, 1.4); }
      shockwave(o.x, B.y + 0.3, o.z, Math.max(o.w, o.d) * 0.9, 0xE8E0D2);
      for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283; emit(o.x, B.y + 0.6, o.z, Math.cos(a) * (6 + Math.random() * 8), 1 + Math.random() * 2, Math.sin(a) * (6 + Math.random() * 8), 1.4, 1.8, dust, 0.6); }
      if (near(o.x, o.z)) G.shake = Math.min(1.6, G.shake + 0.8 + o.floors * 0.15);
    }
    if (B.fall >= 0 && B.fall < 1) {                                                        // the roof falls in over half a second
      B.fall = Math.min(1, Math.max(0.01, (race.time - B.t0) / 0.45)); const e = B.fall * B.fall;   // on the race clock (slow motion, stepped shots)
      B.roof.position.y = B.roofY + (B.y + 0.4 + o.floors * 0.3 - B.roofY) * e; B.roof.rotation.x = B.tiltZ * e; B.roof.rotation.z = B.tilt * e;
    }
    // the roof fades while the player (or whoever the camera follows) is inside or right beside it
    const inside = !o.collapsed && inFootprint(o, P.x, P.z, 0.6), want = inside ? 0.18 : 1;
    if (Math.abs(B.fade - want) > 0.01) { B.fade += (want - B.fade) * Math.min(1, dt * 8); B.roof.traverse(m => { if (m.isMesh) { m.material.opacity = B.fade; m.material.depthWrite = B.fade > 0.9; } }); }
  });
  // the thrown lumps
  const L = S.lumps;
  for (let j = 0; j < STRUCT.LUMP.MAX; j++) {
    const q = L[j]; if (!q) { lumps.setMatrixAt(j, ZERO); continue; }
    setI(lumps, j, q.x, q.y, q.z, q.a, q.r * 1.2, q.r * 0.8, q.r * 1.05, q.a * 0.7, 0); lumps.setColorAt(j, _c.set(q.color));
  }
  lumps.instanceMatrix.needsUpdate = true; lumps.instanceColor.needsUpdate = true;
}
