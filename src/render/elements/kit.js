import * as THREE from 'three';
import { WALL } from '../../core/constants.js';
import { KIT } from '../../core/kit/layout.js';
import { BREAKABLES } from '../../data/breakables.js';
import { addInstanced, canvasTex, chunkMesh, flat } from '../geometry.js';
import { kitPack, vcMat } from '../assets/scenery.js';
import { spawnProp } from '../effects/props.js';
import { SHAPES } from './breakables.js';
import { race } from '../../ui/flow.js';

// The world kit, drawn (core/kit/layout.js lays the towns out as pieces; this turns each piece into a few parts).
// Nearly every part is a coloured box in one instanced batch (walls, windows, doors, pickets, rails, hedges, slats,
// bins...), with gable and hipped roofs, tree canopies and the ground (pavements, gardens, drives, lanes) as their own
// batches, so a whole town is a handful of draw calls. A piece that breaks (core/features/breakables.js) has its parts
// hidden and thrown as props; side-road ends reuse the stand-alone breakables' shapes (render/elements/breakables.js).
const SM = { small: true }, WIN = 0x33414F, DOOR = [0x5B3A29, 0x2E4A6B, 0x7A2E2E, 0x2F5D3A], WOOD = 0x8A5E3B;
let byPiece = new Map(), groups = [], shown = new Set();
// a picket fence's face: slats with pointed tops and two rails, the gaps see-through (repeated ~14 times along a panel)
let picketT = null;
function picketTex() {
  if (picketT) return picketT;
  picketT = canvasTex(64, 64, (g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; for (let x = 4; x < w; x += 16) { g.beginPath(); g.moveTo(x, h); g.lineTo(x, 10); g.lineTo(x + 4, 2); g.lineTo(x + 8, 10); g.lineTo(x + 8, h); g.fill(); } g.fillRect(0, 22, w, 6); g.fillRect(0, 48, w, 6); });
  picketT.wrapS = THREE.RepeatWrapping; picketT.repeat.set(4, 1); return picketT;
}
function gableGeo() {
  const P = [[-0.5, 0, -0.5], [0.5, 0, -0.5], [0, 1, -0.5], [-0.5, 0, 0.5], [0.5, 0, 0.5], [0, 1, 0.5]], f = [[0, 2, 1], [3, 4, 5], [0, 3, 5], [0, 5, 2], [1, 2, 5], [1, 5, 4], [0, 1, 4], [0, 4, 3]];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(f.flatMap(t => t.flatMap(k => P[k])), 3)); return flat(g);
}
export function addKit(group, tr, terr, stage) {
  byPiece = new Map(); groups = []; shown = new Set();
  const K = terr.kit; if (!K) return;
  const boxes = [], gables = [], hips = [], canopies = [], trunks = [], lamps = [];
  K.solid.forEach((o, n) => {
    const pid = (tr.breakables || []).length + n, cs = Math.cos(o.yaw), sn = Math.sin(o.yaw);
    // a part in the piece's own frame: lx across it (its depth), ly up from its foot, lz along its face
    const at = (lx, lz) => [o.x + lx * cs + lz * sn, o.z - lx * sn + lz * cs];
    const bx = (lx, ly, lz, sx, sy, sz, color, extra = {}) => { const [x, z] = at(lx, lz); boxes.push({ pid, x, y: o.y + ly, z, ry: o.yaw, sx, sy, sz, color, ...extra }); };
    const k = o.kind, L = o.w, D = o.d, H = o.h;
    if (k === 'house' || k === 'barn') {
      const front = (o.sd || 1) * D / 2, wall = o.wall, sink = 2;            // the walls go down into the ground: no gap on a slope
      bx(0, (H - sink) / 2, 0, D, H + sink, L, wall);
      const roofY = o.y + H, roofT = o.roof === 'flat' || k === 'barn' && o.style === 'industrial' ? 'flat' : k === 'barn' ? 'gable' : o.roof;
      if (roofT === 'flat') { bx(0, H + 0.2, 0, D + 0.3, 0.4, L + 0.3, new THREE.Color(wall).multiplyScalar(0.8).getHex()); }
      else { const [x, z] = at(0, 0), rh = roofT === 'steep' ? D * 0.75 : D * 0.42, r = { pid, x, y: roofY, z, ry: o.yaw, sx: D * 1.14, sy: rh, sz: L * 1.1, color: o.roofC }; (roofT === 'hip' ? hips : gables).push(r); if (k === 'house') bx(-front * 0.3, H + rh * 0.55, L * 0.25, 0.7, rh * 0.9 + 0.7, 0.7, 0x8C5A48); }
      if (k === 'barn') { bx(front + Math.sign(front) * 0.02, 1.6, 0, 0.1, 3.2, Math.min(4, L * 0.5), o.style === 'farm' ? 0xF4F1EA : 0x5B5F66); return; }
      // windows floor by floor on the front and the ends, a door on the ground floor facing the road
      const nW = Math.max(1, Math.floor((L - 1.2) / 2.4)), s = Math.sign(front);
      for (let f = 0; f < (o.floors || 1); f++) for (let w = 0; w < nW; w++) {
        const v = (w - (nW - 1) / 2) * ((L - 1.2) / nW);
        if (f === 0 && w === nW >> 1) { bx(front + s * 0.04, 1.05, v, 0.1, 2.1, 1.1, DOOR[(o.floors + nW) % DOOR.length], SM); continue; }
        bx(front + s * 0.04, 1.6 + f * 3, v, 0.1, 1.2, 1.0, WIN, SM); bx(front + s * 0.1, 0.94 + f * 3, v, 0.2, 0.1, 1.2, 0xF4F1EA, SM);
      }
      for (const e of [-1, 1]) bx(0, 1.6, e * (L / 2 + 0.04), 1.0, 1.2, 0.1, WIN, SM);
      return;
    }
    if (k === 'picket') { bx(0, H / 2, 0, 0.06, H, L, 0xF6F4EE, { picket: true }); return; }   // one panel, its pickets cut out of a texture
    if (k === 'wall') { const c = o.style === 'desert' ? 0xC98E5F : 0x9C968A; bx(0, H / 2 - 0.3, 0, D, H + 0.6, L, c); bx(0, H + 0.04, 0, D + 0.1, 0.12, L + 0.05, new THREE.Color(c).multiplyScalar(0.85).getHex()); return; }
    if (k === 'hedge') { bx(0, H / 2 - 0.1, 0, D, H + 0.2, L, 0x3F6B33); return; }
    if (k === 'railing') { for (let v = -L / 2; v <= L / 2 + 0.01; v += L / Math.ceil(L / 1.5)) bx(0, H / 2, v, 0.07, H, 0.07, 0xF4F4F0, SM); for (const y of [0.45, H]) bx(0, y, 0, 0.05, 0.06, L, 0xF4F4F0, SM); return; }
    if (k === 'chain') { for (let v = -L / 2; v <= L / 2 + 0.01; v += L / Math.ceil(L / 2.5)) bx(0, H / 2, v, 0.08, H, 0.08, 0x8D939C, SM); bx(0, H / 2, 0, 0.02, H - 0.1, L, 0xA7ABB1, { glass: true }); bx(0, H, 0, 0.05, 0.05, L, 0x8D939C); return; }
    if (k === 'yardgate') { for (const e of [-1, 1]) bx(0, 0.65, e * (L / 2 - 0.1), 0.16, 1.3, 0.16, WOOD); for (const y of [0.3, 0.65, 1.0]) bx(0, y, 0, 0.05, 0.1, L - 0.3, 0xF4F1EA); bx(0, 0.65, 0, 0.05, 0.1, L * 0.9, 0xF4F1EA, { rx: Math.atan2(0.7, L) }); return; }
    if (k === 'post') { const [x, z] = at(0, 0); lamps.push({ pid, x, y: o.y, z, ry: o.yaw + Math.PI / 2 * (o.sd || 1) }); return; }
    if (k === 'bin') { bx(0, 0.5, 0, 0.55, 1.0, 0.55, 0x2F5D3A); bx(0, 1.02, 0, 0.6, 0.06, 0.6, 0x24442C); return; }
    if (k === 'bench') { bx(0, 0.45, 0, 0.45, 0.06, 1.6, WOOD); bx(-0.2, 0.75, 0, 0.06, 0.4, 1.6, WOOD); for (const e of [-1, 1]) bx(0, 0.22, e * 0.7, 0.4, 0.44, 0.06, 0x2B2F3A); return; }
    if (k === 'postbox') { bx(0, 0.7, 0, 0.5, 1.4, 0.5, 0xD7261E); bx(0, 1.43, 0, 0.56, 0.08, 0.56, 0x2B2F3A); return; }
    if (SHAPES[k]) {                                                               // a side road's end: a stand-alone breakable's shape
      const g = new THREE.Group(); g.position.set(o.x, o.y, o.z); g.rotation.y = o.yaw; SHAPES[k](g, { ...BREAKABLES[k], w: L }); group.add(g);
      byPiece.set(pid, [{ group: g }]);
    }
  });
  for (const d of K.decor) if (d.kind === 'tree') { trunks.push({ x: d.x, y: d.y + 1.1 * d.s, z: d.z, sx: 0.35 * d.s, sy: 2.2 * d.s, sz: 0.35 * d.s, color: 0x6B4A32 }); canopies.push({ x: d.x, y: d.y + 3.4 * d.s, z: d.z, sx: 2.3 * d.s, sy: 2.0 * d.s, sz: 2.3 * d.s, color: stage.colors.round[0] }); }
  // the batches; every instance of a breakable piece is remembered, so it can be hidden when it goes
  const remember = res => { for (const { mesh, list } of res) list.forEach((it, j) => { if (it.pid === undefined) return; let l = byPiece.get(it.pid); if (!l) byPiece.set(it.pid, l = []); l.push({ mesh, j, it }); }); groups.push(...res); };
  const M = () => new THREE.MeshLambertMaterial({ color: 0xffffff });
  // the big parts (walls, hedges, posts) cast shadows; the small ones (pickets, rails, windows, doors) don't: there are thousands
  remember(addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1)), M(), boxes.filter(b => !b.glass && !b.small && !b.picket), { cast: true, receive: true }));
  remember(addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1)), new THREE.MeshLambertMaterial({ color: 0xffffff, map: picketTex(), alphaTest: 0.5, side: THREE.DoubleSide }), boxes.filter(b => b.picket), { cast: true }));
  remember(addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1)), M(), boxes.filter(b => !b.glass && b.small), { receive: true }));
  remember(addInstanced(group, flat(new THREE.BoxGeometry(1, 1, 1)), new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 }), boxes.filter(b => b.glass), {}));
  remember(addInstanced(group, gableGeo(), M(), gables, { cast: true }));
  remember(addInstanced(group, flat(new THREE.ConeGeometry(0.7071, 1, 4).rotateY(Math.PI / 4).translate(0, 0.5, 0)), M(), hips, { cast: true }));
  addInstanced(group, flat(new THREE.CylinderGeometry(0.5, 0.6, 1, 6)), M(), trunks, { cast: true });
  addInstanced(group, flat(new THREE.IcosahedronGeometry(0.5, 1)), M(), canopies, { cast: true });
  const LK = kitPack('lamp');
  if (LK) { remember(addInstanced(group, LK.geo('post'), vcMat(), lamps, { cast: true })); remember(addInstanced(group, LK.geo('glow'), new THREE.MeshBasicMaterial({ color: 0xffffff, vertexColors: true }), lamps, {})); }
  else remember(addInstanced(group, flat(new THREE.CylinderGeometry(0.09, 0.12, 4.6, 5).translate(0, 2.3, 0)), M(), lamps.map(l => ({ ...l, color: 0x2B2F3A })), { cast: true }));
  addGround(group, tr, terr, K, stage);
}
// the ground: pavements along the road, then each plot's garden, its drive and the side-road lanes, draped on the
// terrain a few centimetres up (a grid of ~2 m cells), one mesh in vertex colours
function addGround(group, tr, terr, K, stage) {
  // a garden is the stage's own grass, mown a shade greener towards the style's lawn (a lawn of another colour reads as a carpet)
  const lawn = g => new THREE.Color(stage.colors.grassA).lerp(new THREE.Color(g.color), 0.3).getHex();
  const pos = [], col = [], c = new THREE.Color(), L0 = WALL + KIT.PAVE;
  const quad = (p, colr) => { c.set(colr); for (const k of [0, 1, 2, 0, 2, 3]) { pos.push(...p[k]); col.push(c.r, c.g, c.b); } };
  const yAt = (x, z, up) => terr.at(x, z) + up;
  for (const P of K.pave) {
    const N0 = tr.loopN || tr.N; let i = P.a, guard = 0;
    while (i !== P.b && guard++ < 400) {
      const j = (i + 1) % N0, pt = (k, o, y) => [tr.xs[k] + tr.rx[k] * P.sd * o, y, tr.zs[k] + tr.rz[k] * P.sd * o];
      const yi = Math.max(tr.H[i] + 0.15, yAt(tr.xs[i] + tr.rx[i] * P.sd * L0, tr.zs[i] + tr.rz[i] * P.sd * L0, 0.08)), yj = Math.max(tr.H[j] + 0.15, yAt(tr.xs[j] + tr.rx[j] * P.sd * L0, tr.zs[j] + tr.rz[j] * P.sd * L0, 0.08));
      const q = [pt(i, WALL - 1, tr.H[i] + 0.15), pt(i, L0, yi), pt(j, L0, yj), pt(j, WALL - 1, tr.H[j] + 0.15)];   // a verge between the road and the pavement
      quad(P.sd > 0 ? q : [q[0], q[3], q[2], q[1]], 0xB9B6AE); i = j;
    }
  }
  for (const g of K.ground) {
    const cs = Math.cos(g.yaw), sn = Math.sin(g.yaw), nu = Math.max(1, Math.round(g.d / 2)), nv = Math.max(1, Math.round(g.w / 2));
    const up = g.kind === 'garden' ? 0.07 : 0.12, colr = g.kind === 'lane' ? 0x55585E : g.kind === 'garden' ? lawn(g) : g.color;
    // lanes: in the frame where w runs along the lane; gardens and drives the same (w along their yaw)
    const P = (a, b) => { const lx = (a - 0.5) * g.d, lz = (b - 0.5) * g.w, x = g.x + lx * cs + lz * sn, z = g.z - lx * sn + lz * cs; return [x, yAt(x, z, up), z]; };
    for (let a = 0; a < nu; a++) for (let b = 0; b < nv; b++) quad([P(a / nu, b / nv), P(a / nu, (b + 1) / nv), P((a + 1) / nu, (b + 1) / nv), P((a + 1) / nu, b / nv)], colr);
  }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); geo.computeVertexNormals();
  group.add(chunkMesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), 60, true));
}
export function newKitRace() {
  for (const pid of shown) for (const p of byPiece.get(pid) || []) { if (p.group) p.group.visible = true; else { setInst(p, true); } }
  shown = new Set();
}
const _m = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _e = new THREE.Euler();
function setInst(p, on) {
  const it = p.it; _e.set(it.rx || 0, it.ry || 0, it.rz || 0); _q.setFromEuler(_e); _p.set(it.x, it.y, it.z);
  if (on) _s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1); else _s.set(0, 0, 0);
  _m.compose(_p, _q, _s); p.mesh.setMatrixAt(p.j, _m); p.mesh.instanceMatrix.needsUpdate = true;
}
const SND = { picket: 'wood', yardgate: 'wood', bench: 'wood', hedge: 'hay', wall: 'metal', railing: 'metal', chain: 'metal', post: 'metal', bin: 'metal', postbox: 'metal' };
/** Hide the kit pieces that broke this race and throw their parts the way the car was going. */
export function updateKit() {
  if (!race || !race.brk || !byPiece.size) return;
  for (const [pid, parts] of byPiece) {
    const o = race.brk[pid]; if (!o || !o.broken || shown.has(pid)) continue;
    shown.add(pid); const c = race.cars[o.by] || race.player, sp = Math.hypot(c.vx, c.vz) || 1;
    for (const p of parts) {
      if (p.group) { p.group.visible = false; continue; }                           // a side road's end: its pieces fly as the stand-alone ones do
      setInst(p, false);
      const it = p.it, side = (Math.random() - 0.5) * 5, kick = 0.5 + Math.random() * 0.5;
      _e.set(it.rx || 0, it.ry || 0, it.rz || 0); _q.setFromEuler(_e);
      if ((it.sx ?? 1) * (it.sy ?? 1) * (it.sz ?? 1) < 8) spawnProp('box', _p.set(it.x, it.y, it.z), _q, [it.sx ?? 0.3, it.sy ?? 0.3, it.sz ?? 0.3], it.color ?? 0x888888, c.vx * kick + c.vz / sp * side, 2 + Math.random() * 3, c.vz * kick - c.vx / sp * side, 5 + Math.random() * 8, SND[o.kind] || 'wood');
    }
  }
}
