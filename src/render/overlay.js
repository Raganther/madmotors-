import * as THREE from 'three';
import { G } from '../game.js';
import { WALL } from '../core/constants.js';
import { trackMarkers } from '../core/elements/index.js';
import { canvasTex } from './geometry.js';
import { scene } from './renderer.js';
import { race } from '../ui/flow.js';

// Debug overlay (toggle with the backquote key ` or ?debug): the road's centre line coloured by element, barrier types
// as coloured ticks, every element's marker labelled in the world, and a live readout of the player's car.
const CH_COL = [['tunnel', 0x111111], ['bridge', 0xFFFFFF], ['jump', 0xFFD34A], ['town', 0xB06CFF], ['gallery', 0x8A8F99], ['rockfall', 0xFF8A2E]];
export const WALL_NAMES = { 0: 'none', 1: 'tyres', 2: 'fence/armco', 3: 'hay', 4: 'bridge rail', 5: 'tunnel/gallery', 6: 'rock face', 7: 'bollards' };
const WALL_COL = { 1: 0x222222, 2: 0xC4935E, 3: 0xE2C265, 4: 0xD5D8DE, 5: 0x5F5C57, 6: 0x9A958A, 7: 0xB06CFF };
let group = null, builtFor = null, panel = null;
export let overlayOn = false;
export function toggleOverlay(on = !overlayOn) {
  overlayOn = on;
  if (!panel) { panel = document.createElement('pre'); panel.id = 'dbg-panel'; document.body.appendChild(panel); }
  panel.hidden = !on; if (group) group.visible = on;
}
function label(text) {
  const tex = canvasTex(256, 48, (g, w, h) => { g.fillStyle = 'rgba(16,20,40,.85)'; g.fillRect(0, 0, w, h); g.fillStyle = '#FFD34A'; g.font = 'bold 26px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 1); });
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })); s.scale.set(12, 2.25, 1); s.renderOrder = 10; return s;
}
function build(tr) {
  if (group) { scene.remove(group); group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose(); } }); }
  group = new THREE.Group(); group.visible = overlayOn; scene.add(group);
  const N = tr.loopN || tr.N, pos = [], col = [], c = new THREE.Color();
  for (const i of tr.all0) {
    const [name] = CH_COL.find(([k]) => tr[k] && tr[k][i]) || []; c.setHex(name ? CH_COL.find(([k]) => k === name)[1] : 0x2FE0FF);
    pos.push(tr.xs[i], tr.H[i] + 0.35, tr.zs[i]); col.push(c.r, c.g, c.b);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  group.add(new THREE.Points(g, new THREE.PointsMaterial({ size: 4, sizeAttenuation: false, vertexColors: true, depthTest: false })));
  const wp = [], wc = [];
  for (let k = 0; k < tr.all0.length; k += 2) for (const [arr, s] of [[tr.wallL, -1], [tr.wallR, 1]]) {
    const i = tr.all0[k];
    const t = arr[i]; if (!t) continue; c.setHex(WALL_COL[t] || 0xff00ff);
    for (const lat of [s * (WALL - 0.4), s * (WALL + 0.8)]) { wp.push(tr.xs[i] + tr.rx[i] * lat, tr.H[i] + 1, tr.zs[i] + tr.rz[i] * lat); wc.push(c.r, c.g, c.b); }
  }
  const wg = new THREE.BufferGeometry(); wg.setAttribute('position', new THREE.Float32BufferAttribute(wp, 3)); wg.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
  group.add(new THREE.LineSegments(wg, new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false })));
  for (const m of trackMarkers(tr)) { const i = m.i < tr.NM ? m.i % N : m.i, s = label(`${m.element}: ${m.label}`); s.position.set(tr.xs[i], tr.H[i] + 6, tr.zs[i]); group.add(s); }
  builtFor = tr;
}
const f1 = v => (Math.round(v * 10) / 10).toFixed(1);
export function updateOverlay() {
  if (!overlayOn || !G.world || !race) return;
  const tr = G.world.tr; if (builtFor !== tr) build(tr);
  const P = race.player, N = tr.loopN || tr.N, i = tr.bi(P.pr.i), u = P.pr.i, marks = trackMarkers(tr);
  const next = marks.map(m => ({ m, d: ((tr.bi(m.i) - i) % N + N) % N })).sort((a, b) => a.d - b.d)[0];
  const on = CH_COL.map(([k]) => k).filter(k => tr[k] && tr[k][k === 'tunnel' || k === 'bridge' || k === 'jump' ? u : i]);
  const alt = u >= tr.NM ? tr.alts.find(a => i >= a.o && i < a.o + a.n) : null;
  panel.textContent = [
    `${G.world.stage.name}   sample ${i}/${N}${alt ? ` (${alt.name})` : ''}   progress ${f1(P.progress)}   lat ${f1(P.pr.lat)} m   h ${f1(P.y)} m`,
    `speed ${Math.round(Math.hypot(P.vx, P.vz) * 3.6)} km/h   surface ${P.surface}   ${P.onGround ? 'ground' : `air ${f1(P.airT)} s`}   draft ${f1(P.draft || 0)}   oil ${f1(Math.max(0, P.oilT || 0))}`,
    `walls L ${WALL_NAMES[tr.wallL[u]]}  R ${WALL_NAMES[tr.wallR[u]]}   here: ${on.join(', ') || 'open road'}   dmg ${Object.values(P.dmg).map(v => v.toFixed(2)).join('/')}`,
    next ? `next: ${next.m.element} (${next.m.label}) in ${next.d} m` : 'no elements',
    `hazards ${(race.hazards || []).length}   traffic ${(race.traffic || []).length}   ${race.sd ? `crown holder ${race.sd.holder}` : ''}`
  ].join('\n');
}
