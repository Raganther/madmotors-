import * as THREE from 'three';
import { G } from '../game.js';
import { CP } from '../core/modes/showdown.js';
import { canvasTex } from './geometry.js';
import { scene } from './renderer.js';
import { race } from '../ui/flow.js';

// The checkpoint gate (Deuce / Tiebreak, core/modes/showdown.js): two striped posts CP.HW either side of the gate's
// line, a chequered banner between them and a chequered strip across the road, bobbing and pulsing so it reads from
// far off. It moves up the road as each one is taken.
let gate = null, shown = -1, flashT = 0;
export function initGateVis() {
  const chk = canvasTex(64, 16, (g, w, h) => { for (let x = 0; x < w; x += 8) for (let y = 0; y < h; y += 8) { g.fillStyle = ((x + y) / 8) % 2 ? '#111' : '#fff'; g.fillRect(x, y, 8, 8); } });
  chk.wrapS = THREE.RepeatWrapping; chk.repeat.set(3, 1);
  const post = new THREE.MeshLambertMaterial({ color: 0xFFC72C }), dark = new THREE.MeshLambertMaterial({ color: 0x1C2340 });
  const root = new THREE.Group(), W = CP.HW * 2;
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 4.4, 10), post); p.position.set(s * CP.HW, 2.2, 0); p.castShadow = true; root.add(p);
    for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.235, 0.235, 0.35, 10), dark); b.position.set(s * CP.HW, 0.9 + k * 1.2, 0); root.add(b); }
  }
  const banner = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.9), new THREE.MeshBasicMaterial({ map: chk, side: THREE.DoubleSide })); banner.position.y = 4.0; root.add(banner);
  const strip = new THREE.Mesh(new THREE.PlaneGeometry(W, 0.8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: chk, transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 }));
  strip.position.y = 0.12; strip.renderOrder = 2; root.add(strip);
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W + 1.2, 6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFC72C, transparent: true, opacity: 0.18, depthWrite: false }));
  glow.position.y = 0.1; glow.renderOrder = 1; root.add(glow);
  root.visible = false; scene.add(root);
  gate = { root, banner, glow };
}
export function updateGateVis(dt, now) {
  if (!gate) return;
  const S = race && race.sd, g = S && S.gate, tr = G.world && G.world.tr;
  if (!g || !tr || G.state === 'menu' || !isFinite(g.s)) { gate.root.visible = false; return; }
  if (g.n !== shown) { shown = g.n; flashT = 0; }
  if (!g.open) flashT += dt;                                                      // taken: it pops, then the next one appears
  gate.root.visible = g.open || flashT < 0.35;
  const i = Math.min(tr.xs.length - 1, Math.max(0, Math.round(g.s)));
  gate.root.position.set(tr.xs[i] + tr.rx[i] * g.lat, tr.H[i], tr.zs[i] + tr.rz[i] * g.lat); gate.root.rotation.y = tr.th[i];
  const k = g.open ? 1 : 1 + flashT * 3; gate.root.scale.set(k, k, k);
  gate.banner.position.y = 4.0 + Math.sin(now * 3) * 0.12; gate.glow.material.opacity = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(now * 5));
}
