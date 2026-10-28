import * as THREE from 'three';
import { G } from '../../game.js';
import { HALF, WALL } from '../../core/constants.js';
import { canvasTex } from '../geometry.js';
import { race } from '../../ui/flow.js';
import { BRAKE, TOP, speedProfile as profile } from '../../core/track/report.js';   // (the same speeds as the Track Viewer's report card)

// Racecraft aids, looks only, worked out from the same corner speeds the AI drives to (track tr.vmax, braking at BRAKE
// m/s² as in sim/ai.js): the speed you can carry at every metre of the lap (profile), braking boards before the big
// corners (150, 100 and 50 m to where you need to have slowed), and a racing line on the road: in to the apex of each
// corner, green where you can go flat out, amber where you lift and red where you have to brake, brighter red the
// harder; it lights up from your own speed, so it's red when you're arriving too fast. Line: G.lineGuide (menu and
// pause); the boards are always there on tarmac and gravel stages.
let line = null, lineCol = null, prof = null, trRef = null;
function boardTex(text) {
  return canvasTex(128, 96, (g, w, h) => {
    g.fillStyle = '#F4F4F0'; g.fillRect(0, 0, w, h); g.fillStyle = '#C8102E'; g.fillRect(0, 0, w, 10); g.fillRect(0, h - 10, w, 10);
    g.fillStyle = '#141416'; g.font = 'bold 56px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 2);
  });
}
/** Braking boards before every corner you have to brake for: 150, 100, 50 m, on the outside of the corner. */
function addBoards(group, tr, terr, p) {
  const mats = { 150: null, 100: null, 50: null }; for (const k of Object.keys(mats)) mats[k] = new THREE.MeshLambertMaterial({ map: boardTex(k), side: THREE.DoubleSide });
  const board = new THREE.PlaneGeometry(2.4, 1.8), post = new THREE.BoxGeometry(0.16, 2.2, 0.16), postM = new THREE.MeshLambertMaterial({ color: 0x3A3F4A });
  const N = tr.loopN || tr.N, start = tr.loopN ? 0 : tr.startIdx + 30, end = tr.loopN ? N : (tr.finishIdx || N) - 10;
  for (let i = start; i < end; i++) {
    // where braking starts: the profile drops below what you'd be doing flat out, by enough to matter (a real corner)
    const a = p[(i - 1 + N) % N], b = p[i]; if (!(a >= TOP - 0.5 && b < TOP - 0.5)) continue;
    let j = i; while (j < i + 260 && (tr.loopN || j < tr.N - 2) && p[j % N] > p[(j + 1) % N] - 0.01) j++;   // to the slowest point
    if (TOP - p[j % N] < 7) continue;                                          // a lift, not a corner
    const side = Math.sign(tr.ks[j % N]) || 1;                                  // on the outside (as the hairpin chevrons: world/landmarks.js)
    const turnIn = i + Math.round((j - i) * 0.35);                             // a third of the way into the braking: about where you turn in
    for (const d of [150, 100, 50]) {
      const s = ((turnIn - d) % N + N) % N;                                     // counting down to the turn-in
      if (!tr.loopN && (s < tr.startIdx + 10)) continue;
      if (tr.tunnel && tr.tunnel[s]) continue;
      const w = (side > 0 ? tr.wallR : tr.wallL)[s], lat = side * (w ? Math.min(WALL, HALF + w * 0.5) + 0.6 : HALF + 2.6), x = tr.xs[s] + tr.rx[s] * lat, z = tr.zs[s] + tr.rz[s] * lat, y = Math.max(terr.at(x, z), tr.H[s] - 0.5);
      const m = new THREE.Mesh(board, mats[d]); m.position.set(x, y + 2.3, z); m.rotation.y = tr.th[s] + Math.PI; m.castShadow = true; group.add(m);
      const pm = new THREE.Mesh(post, postM); pm.position.set(x, y + 1.1, z); group.add(pm);
    }
    i = j;
  }
}
/** The racing line: a ribbon on the road, in to each apex. */
function addLine(group, tr, p) {
  const N = tr.N, L = tr.loopN || N, loop = !!tr.loopN, lat = new Float32Array(N), W = HALF - 1.6;
  // the corner's inside, eased in and out: curvature smoothed over a window, the apex where it's tightest
  for (let i = 0; i < N; i++) { let s = 0, n = 0; for (let d = -14; d <= 14; d++) { const j = loop ? ((i + d) % L + L) % L : Math.max(0, Math.min(N - 1, i + d)); s += tr.ks[j] * (1 - Math.abs(d) / 15); n += 1 - Math.abs(d) / 15; } lat[i] = Math.max(-W, Math.min(W, -s / n * 900)); }
  const pos = [], col = [], idx = []; let v = 0;
  const end = loop ? N : Math.min(N - 1, (tr.finishIdx || N) + 4);
  for (let i = loop ? 0 : Math.max(0, tr.startIdx - 6); i <= end; i++) {
    const k = loop ? i % L : i, m = loop ? i % N : i;
    if ((tr.voidMask && tr.voidMask[tr.bi(k)]) || (tr.open && tr.open[tr.bi(k)])) { v = -1; continue; }
    for (const e of [-0.32, 0.32]) { const o = lat[m] + e; pos.push(tr.xs[m] + tr.rx[m] * o, tr.H[m] + 0.075, tr.zs[m] + tr.rz[m] * o); col.push(0, 1, 0); }
    const base = pos.length / 3 - 2; if (v >= 0 && base >= 2) idx.push(base - 2, base, base - 1, base - 1, base, base + 1); v = 0;
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); lineCol = new THREE.Float32BufferAttribute(col, 3); g.setAttribute('color', lineCol); g.setIndex(idx);
  line = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.6, depthWrite: false, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }));
  line.renderOrder = 3; line.visible = !!G.lineGuide; line.userData.i0 = loop ? 0 : Math.max(0, tr.startIdx - 6); group.add(line);
}
/** A new world: its boards and line (render/elements). */
export function addRacecraft(group, tr, terr, stage) {
  line = null; prof = null; trRef = tr;
  if (stage.arena || !tr.vmax) return;
  prof = profile(tr);
  if (stage.surface !== 'snow' && !/^Off-piste/.test(stage.blurb || '')) addBoards(group, tr, terr, prof);
  addLine(group, tr, prof);
}
const _c = new THREE.Color(), GREEN = new THREE.Color(0x3BE07A), AMBER = new THREE.Color(0xFFC72C), RED = new THREE.Color(0xFF3A2A);
let tick = 0;
/** The line's colours ahead of the player, from their speed, a few times a second. */
export function updateRacecraft(dt) {
  if (!line) return; line.visible = !!G.lineGuide && G.state !== 'menu'; if (!line.visible || !race) return;
  if ((tick -= dt) > 0) return; tick = 0.1;
  const tr = trRef, P = race.player, N = tr.N, L = tr.loopN || N, i0 = line.userData.i0, a = lineCol.array, n = a.length / 6;
  const v0 = Math.hypot(P.vx, P.vz), me = P.pr.i;
  for (let q = 0; q < n; q++) {
    const i = (i0 + q) % L, ahead = ((i - me) % L + L) % L, near = ahead < 260;
    // the speed you could be doing here if you braked from now on: above what the corner allows means brake
    const reach = near ? Math.sqrt(Math.max(0, v0 * v0 - 2 * BRAKE * ahead)) : 0, need = prof[i % N];
    const over = Math.max(0, (near ? Math.max(reach, need) : need) - need), lift = prof[i % N] < prof[(i - 1 + L) % L] - 0.01;
    if (over > 0.5 && near) _c.copy(RED).multiplyScalar(0.8 + Math.min(0.6, over / 10)); else if (lift) _c.copy(AMBER); else _c.copy(GREEN);
    a[q * 6] = a[q * 6 + 3] = _c.r; a[q * 6 + 1] = a[q * 6 + 4] = _c.g; a[q * 6 + 2] = a[q * 6 + 5] = _c.b;
  }
  lineCol.needsUpdate = true;
}
