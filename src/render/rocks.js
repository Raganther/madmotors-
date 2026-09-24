import * as THREE from 'three';
import { G } from '../game.js';
import { AudioSys } from '../audio/audio.js';
import { debris } from './effects/debris.js';
import { dustRing } from './effects/impacts.js';
import { flat } from './geometry.js';
import { scene } from './renderer.js';
import { race } from '../ui/flow.js';

// boulders from the rockfall
export let rockVis = [];
export function initRockVis() {
  rockVis = [];
  const geo = flat(new THREE.DodecahedronGeometry(1, 0)), mat = new THREE.MeshLambertMaterial({ color: 0x8A857B });
  for (let k = 0; k < 5; k++) { const m = new THREE.Mesh(geo, mat); m.castShadow = true; m.visible = false; scene.add(m); rockVis.push({ m, id: -1 }); }
}
export function updateRocks(dt) {
  if (!race || !race.rocks) { rockVis.forEach(v => v.m.visible = false); return; }
  const P = race.player, used = new Set();
  for (const o of race.rocks) {
    let v = rockVis.find(v => v.id === o.id) || rockVis.find(v => v.id === -1 || !race.rocks.some(r => r.id === v.id)); if (!v) continue;
    if (v.id !== o.id) { v.id = o.id; v.m.rotation.set(Math.random() * 6, Math.random() * 6, 0); }
    used.add(v);
    v.m.visible = true; v.m.position.set(o.x, o.y, o.z); v.m.scale.setScalar(o.r);
    v.m.rotation.x += Math.hypot(o.vx, o.vz) * dt / o.r; v.m.rotation.z += o.vx * dt * 0.2;
    const near = Math.hypot(o.x - P.x, o.z - P.z) < 70;
    if (o.fresh) { o.fresh = false; if (near) { AudioSys.burst(0.35, 'lowpass', 160, 1.1); for (let k = 0; k < 10; k++) debris(o.x, o.y, o.z, (Math.random() - 0.5) * 6, 2 + Math.random() * 3, (Math.random() - 0.5) * 6, 0x8A857B, 0.3, 0.3, 0.3, 2.5, P.pr.i); } }
    if (o.landed && !o.fxDone) { o.fxDone = true; if (near) { dustRing({ x: o.x, y: o.y - o.r, z: o.z }, 14, 0xB8B0A2); AudioSys.thud(0.8); if (Math.hypot(o.x - P.x, o.z - P.z) < 35) G.shake = Math.min(1.2, G.shake + 0.5); } }
  }
  rockVis.forEach(v => { if (!used.has(v)) { v.m.visible = false; v.id = -1; } });
}
