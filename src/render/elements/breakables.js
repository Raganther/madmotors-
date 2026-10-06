import * as THREE from 'three';
import { BREAKABLES } from '../../data/breakables.js';
import { flat } from '../geometry.js';
import { spawnProp } from '../effects/props.js';
import { race } from '../../ui/flow.js';

// Breakables (core/elements/breakables.js places them, core/features/breakables.js breaks them): crates, hay bales, a
// wooden fence, a farm gate, a row of concrete blocks, each built from a few boxes in its group (local z runs across
// the road, x along it). Broken, the group goes and its pieces fly off as props in the direction of the hit; concrete's
// blocks stay on the road as the core's chunks (R.chunks), drawn here from the race state.
const BLOCK = [1.9, 0.8, 0.75];
let vis = [], chunkMeshes = [], chunkGroup = null;
const mats = new Map(), matOf = c => { if (!mats.has(c)) mats.set(c, new THREE.MeshLambertMaterial({ color: c })); return mats.get(c); };
function box(g, w, h, d, c, x, y, z, ry = 0, rz = 0) {
  const m = new THREE.Mesh(flat(new THREE.BoxGeometry(w, h, d)), matOf(c)); m.position.set(x, y, z); m.rotation.set(0, ry, rz); m.castShadow = true; m.receiveShadow = true;
  m.userData.dims = [w, h, d]; m.userData.color = c; g.add(m); return m;
}
// the jersey block's profile: wide foot, sloping sides, narrow top
function jersey() {
  const g = new THREE.BoxGeometry(BLOCK[2], BLOCK[1], BLOCK[0], 1, 2, 1), p = g.attributes.position;
  for (let k = 0; k < p.count; k++) { const y = p.getY(k); if (y > 0) p.setX(k, p.getX(k) * 0.4); else if (y > -0.1) p.setX(k, p.getX(k) * 0.75); }
  return flat(g);
}
const SHAPES = {
  crates(g, K) { for (let k = 0; k < 3; k++) box(g, 1.0, 1.0, 1.0, K.color, 0, 0.5, (k - 1) * 1.08, k * 0.2); for (let k = 0; k < 2; k++) box(g, 0.9, 0.9, 0.9, 0xC29A64, 0.05, 1.45, (k - 0.5) * 1.05, 0.4 - k * 0.5); },
  hay(g, K) { for (let k = 0; k < 4; k++) box(g, 1.2, 0.75, 1.05, K.color, 0, 0.38, (k - 1.5) * 1.1); for (let k = 0; k < 3; k++) box(g, 1.2, 0.75, 1.05, 0xD7B657, 0, 1.12, (k - 1) * 1.1); },
  fence(g, K) {
    const n = 5; for (let k = 0; k < n; k++) box(g, 0.16, 1.3, 0.16, 0x7A5634, 0, 0.65, (k / (n - 1) - 0.5) * K.w);
    for (const y of [0.35, 0.72, 1.08]) for (let k = 0; k < n - 1; k++) box(g, 0.06, 0.16, K.w / (n - 1) + 0.1, K.color, 0.09, y, ((k + 0.5) / (n - 1) - 0.5) * K.w);
  },
  gate(g, K) {
    for (const s of [-1, 1]) box(g, 0.24, 1.6, 0.24, 0x6B6F76, 0, 0.8, s * K.w / 2);
    const L = K.w - 0.3; for (const y of [0.25, 0.6, 0.95, 1.3]) box(g, 0.07, 0.07, L, K.color, 0, y, 0);
    for (const s of [-1, 1]) box(g, 0.07, 1.1, 0.07, K.color, 0, 0.78, s * L / 2);
    box(g, 0.06, 0.08, Math.hypot(L / 2, 1.05), K.color, 0.02, 0.78, -L / 4, 0, 0).rotation.x = Math.atan2(1.05, L / 2);
  },
  concrete(g, K) {
    for (let k = 0; k < 3; k++) { const m = new THREE.Mesh(jersey(), matOf(K.color)); m.position.set(0, BLOCK[1] / 2, (k - 1) * (BLOCK[0] + 0.05)); m.castShadow = m.receiveShadow = true; m.userData.dims = [BLOCK[2], BLOCK[1], BLOCK[0]]; m.userData.color = K.color; g.add(m);
      for (const s of [-1, 1]) box(g, 0.02, 0.18, 0.6, 0xD7261E, s * 0.2, 0.62, (k - 1) * (BLOCK[0] + 0.05)); }
  }
};
export function addBreakables(group, tr) {
  vis = []; chunkMeshes = []; if (!tr.breakables) return;
  for (const b of tr.breakables) {
    const K = BREAKABLES[b.kind], g = new THREE.Group(); g.position.set(b.x, tr.H[tr.u0(b.b)], b.z); g.rotation.y = b.yaw; group.add(g);
    SHAPES[b.kind](g, K); vis.push({ b, g, shown: true });
  }
  chunkGroup = new THREE.Group(); group.add(chunkGroup);
  for (let k = 0; k < 12; k++) { const m = new THREE.Mesh(jersey(), matOf(BREAKABLES.concrete.color)); m.castShadow = true; m.visible = false; chunkGroup.add(m); chunkMeshes.push(m); }
}
export function newBreakablesRace() { for (const v of vis) { v.g.visible = true; v.shown = true; } }
const _p = new THREE.Vector3(), _q = new THREE.Quaternion(), SND = { crates: 'wood', hay: 'hay', fence: 'wood', gate: 'metal', concrete: 'metal' };
export function updateBreakables() {
  if (!race || !race.brk) return;
  for (const v of vis) {
    const o = race.brk[v.b.id]; if (!o || !o.broken || !v.shown) continue;
    v.shown = false; v.g.visible = false;
    const c = race.cars[o.by] || race.player, sp = Math.hypot(c.vx, c.vz) || 1, K = BREAKABLES[o.kind];
    if (K.chunks) continue;                                                            // concrete: its blocks are the core's chunks
    v.g.updateMatrixWorld(true);
    for (const m of v.g.children) {
      m.getWorldPosition(_p); m.getWorldQuaternion(_q);
      const kick = 0.6 + Math.random() * 0.5, side = (Math.random() - 0.5) * 6;
      spawnProp('box', _p, _q, m.userData.dims, m.userData.color, c.vx * kick + c.vz / sp * side, 2 + Math.random() * 4, c.vz * kick - c.vx / sp * side, 6 + Math.random() * 8, SND[o.kind]);
    }
  }
  const ch = race.chunks || [];
  chunkMeshes.forEach((m, k) => { const q = ch[k]; m.visible = !!q; if (q) { m.position.set(q.x, q.y - BLOCK[1] * 0.1, q.z); m.rotation.set(0, q.a, 0); } });
}
