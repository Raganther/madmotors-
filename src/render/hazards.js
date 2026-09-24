import * as THREE from 'three';
import { G } from '../game.js';
import { CAM_DIR, WALL } from '../core/constants.js';
import { canvasTex, flat } from './geometry.js';
import { scene } from './renderer.js';
import { race } from '../ui/flow.js';

// Leader hazards (core/features/hazards.js): cows, oil slicks and the flashing warning signs before them.
let cows = [], slicks = [], signs = [];
const L = c => new THREE.MeshLambertMaterial({ color: c });
function makeCow() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const box = (w, h, d, m, x, y, z, parent = body) => { const b = new THREE.Mesh(flat(new THREE.BoxGeometry(w, h, d)), m); b.position.set(x, y, z); b.castShadow = true; parent.add(b); return b; };
  const white = L(0xF4F1EA), black = L(0x22201E), pink = L(0xE7A7A0), horn = L(0xE8DDC0);
  box(1.0, 0.9, 1.9, white, 0, 1.25, 0); box(1.02, 0.5, 0.6, black, 0, 1.4, 0.35); box(1.02, 0.45, 0.5, black, 0, 1.2, -0.55);
  const head = new THREE.Group(); head.position.set(0, 1.55, 1.1); body.add(head);
  box(0.55, 0.55, 0.62, white, 0, 0, 0.1, head); box(0.5, 0.28, 0.2, pink, 0, -0.14, 0.45, head); box(0.12, 0.12, 0.2, black, -0.3, 0.12, 0.1, head); box(0.12, 0.12, 0.2, black, 0.3, 0.12, 0.1, head);
  for (const s of [-1, 1]) { const h = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.22, 5), horn); h.position.set(s * 0.2, 0.36, 0); h.rotation.z = -s * 0.5; head.add(h); }
  const legs = [];
  for (const [x, z] of [[-0.33, 0.7], [0.33, 0.7], [-0.33, -0.7], [0.33, -0.7]]) { const p = new THREE.Group(); p.position.set(x, 0.85, z); body.add(p); box(0.22, 0.85, 0.22, white, 0, -0.42, 0, p); box(0.24, 0.12, 0.24, black, 0, -0.82, 0, p); legs.push(p); }
  box(0.08, 0.6, 0.08, white, 0, 1.2, -0.98);
  root.visible = false; scene.add(root);
  return { root, body, head, legs, key: null };
}
function makeSlick() {
  const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0x100E14, transparent: true, opacity: 0.88, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const sheen = new THREE.MeshBasicMaterial({ color: 0x5A4F7A, transparent: true, opacity: 0.35, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 });
  for (const [x, z, r] of [[0, 0, 1], [0.5, 0.35, 0.7], [-0.55, -0.2, 0.62], [0.2, -0.6, 0.5], [-0.3, 0.55, 0.45]]) { const c = new THREE.Mesh(new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2), m); c.position.set(x, 0, z); g.add(c); }
  const s = new THREE.Mesh(new THREE.CircleGeometry(0.35, 14).rotateX(-Math.PI / 2), sheen); s.position.set(0.15, 0.01, 0.1); s.scale.set(1.6, 1, 0.7); g.add(s);
  g.visible = false; scene.add(g); return { g, key: null };
}
const signTex = {};
function makeSign() {
  const g = new THREE.Group(), post = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.0, 6), L(0x6E737B)); post.position.y = 1.5; g.add(post);
  const face = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6), new THREE.MeshBasicMaterial({ transparent: true, side: THREE.DoubleSide })); face.position.y = 3.0; face.rotation.x = -Math.asin(CAM_DIR[1]); g.add(face);   // tilted back so the high camera reads it face-on
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), new THREE.MeshBasicMaterial({ color: 0xFFB020 })); lamp.position.y = 4.2; lamp.scale.setScalar(1.6); g.add(lamp);
  g.visible = false; scene.add(g); return { g, face, lamp, key: null };
}
function tex(kind) {
  if (signTex[kind]) return signTex[kind];
  return (signTex[kind] = canvasTex(128, 128, (c, w, h) => {
    c.fillStyle = '#1C2340'; c.beginPath(); c.moveTo(w / 2, 4); c.lineTo(w - 4, h - 10); c.lineTo(4, h - 10); c.closePath(); c.fill();
    c.fillStyle = '#FFC72C'; c.beginPath(); c.moveTo(w / 2, 16); c.lineTo(w - 16, h - 18); c.lineTo(16, h - 18); c.closePath(); c.fill();
    c.fillStyle = '#1C2340'; c.textAlign = 'center';
    if (kind === 'cows') { c.fillRect(38, 64, 44, 20); c.fillRect(80, 58, 14, 14); c.fillRect(40, 84, 6, 14); c.fillRect(74, 84, 6, 14); c.font = 'bold 15px sans-serif'; c.fillText('COWS', w / 2, 58); }
    else { c.beginPath(); c.arc(w / 2, 82, 13, 0, Math.PI * 2); c.fill(); c.beginPath(); c.moveTo(w / 2 - 12, 77); c.lineTo(w / 2, 52); c.lineTo(w / 2 + 12, 77); c.fill(); c.font = 'bold 15px sans-serif'; c.fillText('OIL', w / 2, 108); }
  }));
}
export function initHazardVis() {
  for (let k = 0; k < 9; k++) cows.push(makeCow());
  for (let k = 0; k < 3; k++) slicks.push(makeSlick());
  for (let k = 0; k < 6; k++) signs.push(makeSign());
}
export function updateHazardVis(dt, now) {
  const hz = race && race.hazards && G.world ? race.hazards : [], tr = G.world && G.world.tr;
  let ci = 0, si = 0, gi = 0;
  for (const h of hz) {
    // warning signs either side, flashing
    for (const side of [-1, 1]) {
      const s = signs[gi++]; if (!s) break; const i = ((h.warnI % tr.N) + tr.N) % tr.N, lat = side * (WALL + 1.6);
      s.g.visible = true; s.g.position.set(tr.xs[i] + tr.rx[i] * lat, tr.H[i], tr.zs[i] + tr.rz[i] * lat); s.g.rotation.y = Math.atan2(...(G.camDir ? [G.camDir[0], G.camDir[2]] : [CAM_DIR[0], CAM_DIR[2]]));   // turned to face the camera, like a billboard
      if (s.key !== h.kind) { s.key = h.kind; s.face.material.map = tex(h.kind); s.face.material.needsUpdate = true; }
      s.lamp.visible = Math.floor(now * 3) % 2 === 0;
    }
    if (h.kind === 'oil') {
      const o = slicks[si++]; if (!o) continue;
      o.g.visible = true; o.g.position.set(h.x, h.y + 0.05, h.z); o.g.scale.setScalar(h.r); o.g.rotation.y = h.id;
      continue;
    }
    for (const c of h.cows) {
      const v = cows[ci++]; if (!v) break;
      v.root.visible = true; v.root.position.set(c.x, c.y, c.z);
      const i = c.i, fx = tr.rx[i] * c.dir, fz = tr.rz[i] * c.dir;              // facing the way it walks
      v.root.rotation.set(0, Math.atan2(fx, fz), 0);
      if (c.hit) { v.body.rotation.z = c.rot; v.body.position.y = Math.abs(Math.sin(c.rot)) * 0.6; v.legs.forEach(l => l.rotation.x = 0.9); }
      else { v.body.rotation.z = 0; v.body.position.y = 0; v.legs.forEach((l, k) => l.rotation.x = Math.sin(c.gait * 5 + (k % 2 ^ k >> 1) * Math.PI) * 0.35); v.head.rotation.x = Math.sin(c.gait * 1.3) * 0.12 + 0.1; }
    }
  }
  for (; ci < cows.length; ci++) cows[ci].root.visible = false;
  for (; si < slicks.length; si++) slicks[si].g.visible = false;
  for (; gi < signs.length; gi++) signs[gi].g.visible = false;
}
