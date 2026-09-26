import * as THREE from 'three';
import { G } from '../../game.js';
import { WALL } from '../../core/constants.js';
import { HAMMER, hammerLat } from '../../core/elements/hammer.js';
import { canvasTex, flat } from '../geometry.js';
import { race } from '../../ui/flow.js';

// Wrecking balls (core/elements/hammer.js): a yellow steel gantry over the road, a chain and an iron ball with a
// hazard band, swinging across on the race clock (the same clock the core judges hits by).
const PIVOT = 10.5, CHAIN = PIVOT - 1.1;
let vis = [];
export function addHammers(group, tr) {
  vis = []; if (!tr.hammers) return;
  const steel = new THREE.MeshLambertMaterial({ color: 0xE3B52A }), dark = new THREE.MeshLambertMaterial({ color: 0x2A2C30 }), chainM = new THREE.MeshLambertMaterial({ color: 0x6B6F76 });
  const band = new THREE.MeshLambertMaterial({ map: canvasTex(64, 16, (g, w, h) => { for (let x = 0; x < w; x += 8) { g.fillStyle = (x / 8) % 2 ? '#111' : '#FFC72C'; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + 8, 0); g.lineTo(x + 4, h); g.lineTo(x - 4, h); g.fill(); } }) });
  for (const h of tr.hammers) {
    const i = h.i, root = new THREE.Group(); root.position.set(tr.xs[i], tr.H[i], tr.zs[i]); root.rotation.y = tr.th[i]; group.add(root);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(flat(new THREE.BoxGeometry(0.6, PIVOT + 0.6, 0.6)), steel); p.position.set(s * (WALL + 0.6), (PIVOT + 0.6) / 2 - 0.3, 0); p.castShadow = true; root.add(p); }
    const beam = new THREE.Mesh(flat(new THREE.BoxGeometry(2 * WALL + 1.8, 0.7, 0.8)), steel); beam.position.y = PIVOT + 0.3; beam.castShadow = true; root.add(beam);
    const arm = new THREE.Group(); arm.position.y = PIVOT; root.add(arm);
    const chain = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, CHAIN, 6), chainM); chain.position.y = -CHAIN / 2; arm.add(chain);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(HAMMER.R, 16, 12), dark); ball.position.y = -CHAIN - 0.2; ball.castShadow = true; arm.add(ball);
    const b2 = new THREE.Mesh(new THREE.CylinderGeometry(HAMMER.R * 1.02, HAMMER.R * 1.02, 0.5, 16, 1, true), band); b2.position.y = -CHAIN - 0.2; arm.add(b2);
    vis.push({ h, arm });
  }
}
export function updateHammers() {
  if (!vis.length) return;
  const t = race && G.state !== 'menu' ? race.time : performance.now() / 1000;
  for (const v of vis) { const { lat } = hammerLat(v.h, t); v.arm.rotation.z = -Math.asin(Math.max(-1, Math.min(1, lat / CHAIN))); }   // the ball over lat (+ = the road's right, the group's -x)
}
