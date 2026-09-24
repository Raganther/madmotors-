import * as THREE from 'three';
import { G } from '../../game.js';
import { HALF, WALL } from '../../core/constants.js';
import { FERRY } from '../../core/elements/ferry.js';
import { flat } from '../geometry.js';
import { emit } from '../effects/particles.js';

// Ferry visuals: concrete quays and cable posts at both docks, a gate boom and traffic light at dock A (build), and
// the barge itself: hull, plank deck, side rails, a wheelhouse and hinged ramps at each end (newRace / update).
const L = c => new THREE.MeshLambertMaterial({ color: c });
const box = (w, h, d, m, x, y, z, parent) => { const b = new THREE.Mesh(flat(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = true; b.receiveShadow = true; parent.add(b); return b; };
const at = (tr, s, lat) => { const i = Math.max(0, Math.min(tr.N - 2, Math.floor(s))), t = s - i; return [tr.xs[i] + (tr.xs[i + 1] - tr.xs[i]) * t + tr.rx[i] * lat, tr.zs[i] + (tr.zs[i + 1] - tr.zs[i]) * t + tr.rz[i] * lat]; };
let docks = [];
export function addFerryDocks(group, tr) {
  docks = [];
  for (const f of tr.ferries || []) {
    const concrete = L(0xA7A49C), dark = L(0x3A3F47), yel = L(0xFFC72C);
    const quay = (s0, s1) => {                                                    // a quay block under the road end, down to the water
      const g = new THREE.Group(); const [x, z] = at(tr, (s0 + s1) / 2, 0); g.position.set(x, f.h, z); g.rotation.y = tr.th[f.a]; group.add(g);
      box(2 * HALF + 5, 8, Math.abs(s1 - s0), concrete, 0, -4.2, 0, g);
      for (const s of [-1, 1]) for (const k of [-1, 1]) box(0.6, 0.8, 0.6, dark, s * (HALF + 1.8), 0.3, k * Math.abs(s1 - s0) * 0.3, g);   // bollards
    };
    quay(f.a - 6, f.a); quay(f.b, f.b + 6);
    // cable posts at both docks and the cables the barge runs on
    const cable = new THREE.LineBasicMaterial({ color: 0x2A2A2A }), pts = [];
    for (const side of [-1, 1]) {
      for (const s of [f.a - 3, f.b + 3]) { const [x, z] = at(tr, s, side * (HALF + 2.6)); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 6, 8), dark); p.position.set(x, f.h + 3, z); p.castShadow = true; group.add(p); }
      const [x0, z0] = at(tr, f.a - 3, side * (HALF + 2.6)), [x1, z1] = at(tr, f.b + 3, side * (HALF + 2.6));
      pts.push(new THREE.Vector3(x0, f.h + 5.6, z0), new THREE.Vector3(x1, f.h + 5.6, z1));
    }
    group.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), cable));
    // gate boom and traffic light at dock A
    const gate = new THREE.Group(), [gx, gz] = at(tr, f.a - 1.5, -(WALL - 0.3)); gate.position.set(gx, f.h, gz); gate.rotation.y = tr.th[f.a]; group.add(gate);
    box(0.4, 1.4, 0.4, dark, 0, 0.7, 0, gate);
    const arm = new THREE.Group(); arm.position.set(0, 1.25, 0); gate.add(arm);
    for (let k = 0; k < 6; k++) box(2 * WALL / 6, 0.22, 0.18, k % 2 ? yel : L(0xE0402F), (k + 0.5) * 2 * WALL / 6, 0, 0, arm);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 10, 8), new THREE.MeshBasicMaterial({ color: 0xE0402F })); lamp.position.set(0, 2.9, 0); gate.add(lamp);
    box(0.5, 1.2, 0.5, dark, 0, 2.6, -0.1, gate);
    docks.push({ f, arm, lamp, armA: 0 });
  }
}
let barges = [];
export function newFerryRace(r) {
  for (const b of barges) { b.root.parent && b.root.parent.remove(b.root); }
  barges = [];
  for (const f of r.ferries || []) {
    const root = new THREE.Group(); G.world.group.add(root);
    const hull = L(0x8C2F24), wood = L(0x9C7A52), rail = L(0xFFC72C), white = L(0xF2F2EE), dark = L(0x2B2F3A);
    const W2 = FERRY.HALF, len = FERRY.LEN;
    box(2 * W2 + 1.4, 2.4, len, hull, 0, -1.5, 0, root);
    box(2 * W2, 0.3, len - 0.4, wood, 0, -0.14, 0, root);
    for (const s of [-1, 1]) box(0.3, 0.9, len, rail, s * (W2 + 0.35), 0.45, 0, root);
    const cab = new THREE.Group(); cab.position.set(-(W2 + 1.9), 0, len * 0.2); root.add(cab);         // wheelhouse on an outboard sponson
    box(3, 0.4, 5, hull, 0, -0.2, 0, cab); box(2.4, 2.2, 3, white, 0, 1.1, 0, cab); box(2.6, 0.3, 3.4, dark, 0, 2.3, 0, cab);
    const ramp = z => { const p = new THREE.Group(); p.position.set(0, 0, z); root.add(p); box(2 * W2 - 0.4, 0.25, 4, rail, 0, 0, Math.sign(z) * 2, p); return p; };
    barges.push({ f, root, rear: ramp(-len / 2), front: ramp(len / 2), rA: 0, fA: 0, wake: 0 });
  }
}
export function updateFerryVis(dt, now) {
  const tr = G.world && G.world.tr; if (!tr) return;
  for (const b of barges) {
    const f = b.f, mid = f.s + FERRY.LEN / 2, [x, z] = at(tr, mid, 0), moving = f.phase === 'toA' || f.phase === 'toB';
    b.root.position.set(x, f.h + Math.sin(now * 1.3) * 0.05, z); b.root.rotation.set(Math.sin(now * 0.9) * 0.008, tr.th[f.a], Math.sin(now * 1.1) * 0.012);
    // ramps: down (flat onto the quay) when that end is open, up when closed
    const rearT = f.phase === 'A' ? 0.12 : -1.35, frontT = f.phase === 'B' ? -0.12 : 1.35, k = Math.min(1, dt * 4);
    b.rA += (rearT - b.rA) * k; b.fA += (frontT - b.fA) * k; b.rear.rotation.x = b.rA; b.front.rotation.x = b.fA;
    if (moving) { b.wake += dt * 14; while (b.wake > 1) { b.wake -= 1; const dir = f.phase === 'toB' ? -1 : 1, s = Math.random() < 0.5 ? -1 : 1, [wx, wz] = at(tr, mid + dir * FERRY.LEN * 0.5, s * (FERRY.HALF + 0.8)); emit(wx, f.h - 1.3, wz, (Math.random() - 0.5) * 2, 0.8 + Math.random(), (Math.random() - 0.5) * 2, 0.9, 0.7, 0xF4F8FF, 2); } }
  }
  for (const d of docks) {
    const open = d.f.phase === 'A' && d.f.tBoard < FERRY.WAIT - 1.5;
    d.armA += ((open ? 1.35 : 0) - d.armA) * Math.min(1, dt * 3); d.arm.rotation.z = d.armA;
    d.lamp.material.color.setHex(open ? 0x3CD06A : (Math.floor(now * 2.5) % 2 ? 0xE0402F : 0x6A1A12));
  }
}
