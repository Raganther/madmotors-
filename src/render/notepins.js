import * as THREE from 'three';
import { G } from '../game.js';
import { camera, pcamera, renderer, scene, renderFrame } from './renderer.js';
import { canvasTex } from './geometry.js';

// Notes on the track (ui/notes.js): where a tap on the screen lands on the ground, and a pin standing at every note
// on this stage (numbered; green once Claude has answered it). Pins only show while the notes view is open.
const _ray = new THREE.Raycaster(), _ndc = new THREE.Vector2(), _p = new THREE.Vector3();
let pins = null;
/** The ground point under screen position (cx, cy), with the nearest road sample: {x, y, z, i, lat}, or null. */
export function pickGround(cx, cy) {
  const W = G.world && G.world.W; if (!W) return null;
  const tr = W.tr, r = renderer.domElement.getBoundingClientRect();
  _ndc.set((cx - r.left) / r.width * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  _ray.setFromCamera(_ndc, G.persp ? pcamera : camera);
  const o = _ray.ray.origin, d = _ray.ray.direction; let hit = null;
  for (let t = 0; t < 2000; t += 0.5) {                                                // walk down the ray until it meets the ground
    _p.copy(o).addScaledVector(d, t);
    if (_p.y <= W.terr.at(_p.x, _p.z) + 0.2) { hit = _p.clone(); break; }
  }
  if (!hit) return null;
  const N0 = tr.loopN || tr.N; let bi = 0, bd = Infinity;
  for (let i = 0; i < N0; i++) { const dx = tr.xs[i] - hit.x, dz = tr.zs[i] - hit.z, dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; bi = i; } }
  const lat = (hit.x - tr.xs[bi]) * tr.rx[bi] + (hit.z - tr.zs[bi]) * tr.rz[bi];
  if (Math.abs(lat) < 9) hit.y = Math.max(hit.y, tr.H[bi]);                            // on (or by) the road: its height, a bridge deck included
  return { x: hit.x, y: hit.y, z: hit.z, i: bi, lat };
}
/** A snapshot of the current view (JPEG, at most 960 wide), for a note. */
export function snapView() {
  return new Promise(res => {
    try {
      renderFrame(); const src = renderer.domElement, k = Math.min(1, 960 / src.width), c = document.createElement('canvas');
      c.width = Math.round(src.width * k); c.height = Math.round(src.height * k); c.getContext('2d').drawImage(src, 0, 0, c.width, c.height);   // copied straight after drawing, before the frame is cleared
      c.toBlob(b => res(b), 'image/jpeg', 0.8);
    } catch (e) { res(null); }
  });
}
const texCache = new Map();
function pinTex(n, done) {
  const k = n + (done ? 'd' : ''); if (texCache.has(k)) return texCache.get(k);
  const t = canvasTex(64, 96, (g, w) => {
    g.fillStyle = done ? '#2FB36B' : '#FFC72C'; g.strokeStyle = '#1C2340'; g.lineWidth = 5;
    g.beginPath(); g.arc(w / 2, 30, 26, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(w / 2 - 9, 52); g.lineTo(w / 2, 92); g.lineTo(w / 2 + 9, 52); g.fill();
    g.fillStyle = '#1C2340'; g.font = 'bold 28px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), w / 2, 31);
  });
  texCache.set(k, t); return t;
}
/** Show these notes as pins: [{n, x, y, z, done}], or [] to clear. */
export function setPins(list) {
  if (!pins) { pins = new THREE.Group(); scene.add(pins); }
  for (const s of pins.children.slice()) { pins.remove(s); s.material.dispose(); }
  for (const p of list) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: pinTex(p.n, p.done), depthTest: false, transparent: true }));
    s.center.set(0.5, 0); s.scale.set(3.2, 4.8, 1); s.position.set(p.x, p.y + 0.3, p.z); s.renderOrder = 20; pins.add(s);
  }
}
