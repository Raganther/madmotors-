import * as THREE from 'three';
import { G } from '../game.js';
import { missilePos } from '../core/features/weapons.js';
import { emit } from './effects/particles.js';
import { debris } from './effects/debris.js';
import { shockwave } from './effects/rings.js';
import { scene } from './renderer.js';
import { race } from '../ui/flow.js';

// Weapons visuals (core/features/weapons.js): missiles in flight (a white body, red nose and fins, a flame and a smoke
// trail), the blast when one hits, a puff when one gives up; the swinging doors are on the cars (render/vehicles.js).
const POOL = 16;
let pool = [];
export function initWeaponVis() {
  const white = new THREE.MeshLambertMaterial({ color: 0xF2F2EE }), red = new THREE.MeshLambertMaterial({ color: 0xD8203A }), flame = new THREE.MeshBasicMaterial({ color: 0xFFB03A });
  pool = [];
  for (let k = 0; k < POOL; k++) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.3, 8).rotateX(Math.PI / 2), white); g.add(body);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.4, 8).rotateX(Math.PI / 2), red); nose.position.z = 0.85; g.add(nose);
    for (let f = 0; f < 4; f++) { const fin = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.34, 0.3), red); fin.position.set(0, 0, -0.55); fin.rotation.z = f * Math.PI / 2; fin.translateY(0.2); g.add(fin); }
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.14, 0.7, 8).rotateX(-Math.PI / 2), flame); fl.position.z = -1.0; g.add(fl);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.34, 8, 6), new THREE.MeshBasicMaterial({ color: 0xFFE7A8, transparent: true, opacity: 0.8 })); glow.position.z = -0.95; g.add(glow);
    g.scale.setScalar(1.8);                                                     // readable from the race camera
    g.visible = false; scene.add(g); pool.push({ g, fl, id: -1, last: null });
  }
}
export function updateWeaponVis(dt, now) {
  const tr = G.world && G.world.tr, ms = (race && race.missiles) || [];
  for (const p of pool) p.g.visible = false;
  if (!tr || G.state === 'menu') return;
  ms.forEach((m, k) => {
    const p = pool[k % POOL], pos = missilePos(tr, m);
    const dx = p.id === m.id && p.last ? pos.x - p.last.x : tr.tx[pos.i], dz = p.id === m.id && p.last ? pos.z - p.last.z : tr.tz[pos.i];
    p.g.visible = true; p.g.position.set(pos.x, pos.y, pos.z); p.g.rotation.set(0, Math.atan2(dx, dz), 0);
    p.fl.scale.set(1, 1, 0.8 + 0.4 * Math.sin(now * 60 + k));
    if (G.state === 'racing' && p.id === m.id && p.last) for (let q = 0; q < 3; q++) emit(pos.x - Math.sin(p.g.rotation.y) * 2.2, pos.y, pos.z - Math.cos(p.g.rotation.y) * 2.2, (Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5, 0.7 + Math.random() * 0.5, 0.7 + Math.random() * 0.5, q ? 0xC8C8C8 : 0xE6E6E6, -0.5);
    p.id = m.id; p.last = pos;
  });
}
/** A missile hitting a car: fireball, smoke, sparks and bits, a shock ring. */
export function missileBlast(e) {
  shockwave(e.x, e.y - 1, e.z, 7, 0xFF7A2E);
  for (let k = 0; k < 26; k++) { const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7; emit(e.x, e.y, e.z, Math.cos(a) * s, 2 + Math.random() * 6, Math.sin(a) * s, 0.4 + Math.random() * 0.4, 1.2 + Math.random(), Math.random() < 0.5 ? 0xFFB03A : 0xFF5A1E, -2); }
  for (let k = 0; k < 16; k++) emit(e.x + (Math.random() - 0.5) * 2, e.y + Math.random(), e.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, 1.2 + Math.random() * 0.8, 1.6 + Math.random(), Math.random() < 0.5 ? 0x4A4A4A : 0x6E6E6E, -1.2);
  for (let k = 0; k < 8; k++) debris(e.x, e.y, e.z, (Math.random() - 0.5) * 12, 4 + Math.random() * 6, (Math.random() - 0.5) * 12, 0x2A2A2A, 0.2, 0.08, 0.3, 1.4);
}
export function missilePuff(e) { for (let k = 0; k < 10; k++) emit(e.x, e.y, e.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.8, 1.2, 0x9A9A9A, -0.8); }
