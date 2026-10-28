import * as THREE from 'three';
import { G } from '../game.js';
import { STAGES } from '../data/stages/index.js';
import { STEP } from '../core/constants.js';
import { clamp, wrapAngle } from '../core/math.js';
import { raceStep } from '../core/sim/race.js';
import { KIND_NAME, TOP, trackReport } from '../core/track/report.js';
import { AudioSys } from '../audio/audio.js';
import { canvasTex } from '../render/geometry.js';
import { pickGround } from '../render/notepins.js';
import { pcamera, scene } from '../render/renderer.js';
import { applyBarrierChanges } from '../render/world/barriers.js';
import { $ } from './dom.js';
import { handleEvents, race, savePrev, selectStage, startRace, toMenu, viewRace } from './flow.js';
import { keys } from './input.js';
import { enterNotes, exitNotes, placeNote, refreshPins } from './notes.js';

// The Track Viewer (menu: Track viewer; ?viewer=<n>): a stage as it really is (its buildings, set pieces, water and
// scenery, the wrecking balls swinging) seen from a camera you fly about, to judge whether the track is any good.
//   - Getting about: drag to turn the view, right-drag / two fingers / Shift + drag to move, wheel or pinch to zoom,
//     double-click (double-tap) to fly there. Keys: WASD / arrows move, Q / E turn, R / F tilt, + / - zoom, T top view,
//     Space flies the lap, Esc leaves.
//   - Fly the lap: the camera rides the road at race speed (the AI's corner speeds: core/track/report.js), or with
//     Cars: racing, rides along with your car (the AI drives it).
//   - The report card (core/track/report.js trackReport): the lap's numbers, its moments (numbered on the map, the strip
//     and over the road), and the design pillars of docs/TRACK_DESIGN.md it meets or misses; tap any of them to go there.
//   - Note drops a note on the spot you tap (ui/notes.js: it goes to Claude, with a picture of the view); every note
//     on the stage stands as a pin while the viewer is open.
// The race underneath runs all the time (the hazards move), its cars parked on the grid until Cars: racing lets the AI
// drive them (the player's car too).
const V = { T: new THREE.Vector3(), yaw: 0.8, pitch: 0.55, dist: 120, goal: null, fly: false, s: 0, speed: 1, racing: false, labels: true, yawOff: 0, R: null, idx: 0, fog: null, far: 900, mapK: null, mapDirty: true };
const ptrs = new Map(); let gesture = null, lastTap = null, labels = null, hooks = null;
/** The viewer's state (camera target, angles), for the Track Studio (ui/studio.js). */
export const viewerState = V;
/** The Track Studio's hooks: { want(e), down(e), move(e), up(e), cancel(), hover(e), opened(), closed() }; a pointer the
 *  studio wants (a brush or a placement) goes to it, two fingers and the rest still move the view. */
export function setEditHooks(h) { hooks = h; }
const fmt = s => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, '0')}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const KIND_COL = { air: '#FF8A3A', smash: '#E0402F', moving: '#C86AE8', place: '#4AA8E8', surface: '#B08050', route: '#2FB36B' };

export function initViewer() {
  $('viewer-btn').addEventListener('click', () => openViewer(G.stageSel || 0));
  $('vw-exit').addEventListener('click', closeViewer);
  $('vw-stage').addEventListener('change', e => { const v = e.target.value; if (/^\d+$/.test(v)) openViewer(+v); else if (hooks && hooks.pick) hooks.pick(v); });   // (a draft: ui/studio.js)
  $('vw-fly').addEventListener('click', () => setFly(!V.fly));
  $('vw-speed').addEventListener('change', e => { V.speed = +e.target.value; });
  $('vw-race').addEventListener('click', () => setRacing(!V.racing));
  $('vw-restart').addEventListener('click', () => { viewRace(); setRacing(V.racing); });
  $('vw-line').addEventListener('click', () => { G.lineGuide = !G.lineGuide; buttons(); });
  $('vw-labels').addEventListener('click', () => { V.labels = !V.labels; if (labels) labels.visible = V.labels; buttons(); });
  $('vw-note').addEventListener('click', () => { if (G.noteMode) exitNotes(); else enterNotes(); buttons(); });
  $('vw-card-btn').addEventListener('click', () => { $('vw-card').classList.toggle('shut'); buttons(); });
  $('vw-drive').addEventListener('click', () => { const i = V.idx; cleanup(); startRace(i); });
  for (const [id, f] of [['vw-top', () => { V.pitch = V.pitch > 1.3 ? 0.55 : 1.45; }], ['vw-low', () => { V.pitch = 0.18; V.dist = Math.min(V.dist, 40); }],
    ['vw-in', () => { V.dist = Math.max(6, V.dist / 1.35); }], ['vw-out', () => { V.dist = Math.min(900, V.dist * 1.35); }], ['vw-fit', fit]]) $(id).addEventListener('click', f);
  const surf = $('vw-surf');
  surf.addEventListener('pointerdown', down); surf.addEventListener('pointermove', move); surf.addEventListener('pointerup', up); surf.addEventListener('pointercancel', up);
  surf.addEventListener('wheel', e => { e.preventDefault(); V.dist = clamp(V.dist * Math.exp(e.deltaY * (e.ctrlKey ? 0.01 : 0.0012)), 6, 900); }, { passive: false });
  surf.addEventListener('contextmenu', e => e.preventDefault());
  surf.addEventListener('dblclick', e => flyTo(e.clientX, e.clientY));
  $('vw-map').addEventListener('click', mapClick); $('vw-strip').addEventListener('click', stripClick);
  $('vw-card').addEventListener('click', e => { const b = e.target.closest('[data-go]'); if (b) goTo(+b.dataset.go); });
  addEventListener('keydown', e => {
    if ($('viewer').hidden || (e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName))) return;
    if (e.code === 'Escape' && !G.noteMode && $('notes').hidden) closeViewer();
    else if (e.code === 'Space') { e.preventDefault(); setFly(!V.fly); }
    else if (e.code === 'KeyT') V.pitch = V.pitch > 1.3 ? 0.55 : 1.45;
    else if (e.code === 'Home') fit();
  });
  addEventListener('resize', () => { V.mapDirty = true; V.mapK = null; place(); });
}
/** Open the viewer on stage idx (built first if it isn't the one on show). */
export function openViewer(idx, { keep = false } = {}) {   // keep: the camera stays where it was (a rebuild after an edit)
  idx = clamp(idx | 0, 0, STAGES.length - 1);
  if (G.noteMode) exitNotes();
  $('menu').hidden = true; $('editor').hidden = true; $('tb').hidden = true;
  selectStage(idx, () => {
    G.title = false; G.titleCam = null; V.idx = idx; V.racing = false; V.fly = false; V.yawOff = 0;
    viewRace(); setRacing(false); G.state = 'viewing'; G.accumulator = 0; AudioSys.update(null, 'off');
    for (const id of ['hud', 'results', 'pause', 'touch', 'countdown', 'menu', 'callout']) $(id).hidden = true;
    $('viewer').hidden = false;
    stageList(idx);
    if (!V.fog) { V.fog = { near: scene.fog.near, far: scene.fog.far }; V.far = pcamera.far; }
    pcamera.far = 4000; pcamera.updateProjectionMatrix();
    const st = STAGES[idx], tr = G.world.tr;
    try { V.R = trackReport(tr, st, G.world.terr); } catch (e) { console.error(e); V.R = null; }
    V.s = V.R ? V.R.i0 : tr.startIdx; V.mapK = null; V.mapDirty = true;
    makeLabels(); drawCard(); if (!keep) fit(); buttons(); refreshPins(); place();
    if (hooks && hooks.opened) hooks.opened(idx);
  });
}
// the stage picker: every stage (a test drive's is added at the end), then the Track Studio's drafts (hooks.options)
function stageList(idx) {
  const extra = hooks && hooks.options ? hooks.options(idx) : null, skip = extra ? extra.skip : -1;
  $('vw-stage').innerHTML = STAGES.map((s, i) => i === skip ? '' : `<option value="${i}">${i + 1}. ${esc(s.name)}</option>`).join('') + (extra ? extra.html : '');
  $('vw-stage').value = extra && extra.value ? extra.value : String(idx);
}
function cleanup() {
  if (G.noteMode) exitNotes();
  $('viewer').hidden = true; G.viewCam = null; V.fly = false; V.racing = false;
  if (V.fog) { scene.fog.near = V.fog.near; scene.fog.far = V.fog.far; V.fog = null; pcamera.far = V.far; pcamera.updateProjectionMatrix(); }
  if (labels) { labels.parent && labels.parent.remove(labels); labels = null; }
  refreshPins(); if (hooks && hooks.closed) hooks.closed();
}
export function closeViewer() { cleanup(); toMenu(); }
function setFly(on) {
  V.fly = on; V.yawOff = 0; V.goal = null; if (on) { V.dist = clamp(V.dist, 12, 36); V.pitch = Math.min(V.pitch, 0.42); }   // down to a chase view (zoom out from there if you like)
  if (on && !V.racing) { const tr = G.world.tr, q = tr.nearest ? tr.nearest(V.T.x, V.T.z) : null; if (q && q.i != null) V.s = tr.bi(q.i); } buttons(); }
// the race always runs (trains, ferries, drawbridges and wrecking balls keep moving); parked, every car holds still
function setRacing(on) {
  V.racing = on; const R = race; if (!R) return;
  R.autoPlayer = true; R.phase = 'racing'; for (const c of R.cars) c.hold = !on;
  buttons();
}
// the card (and the studio's panel) start under the bar, however many lines the bar wraps to (on a phone it sits at the bottom: index.html)
function place() { const t = !$('viewer').hidden && innerWidth > 760 ? $('vw-bar').offsetHeight + 8 + 'px' : ''; $('vw-card').style.top = t; $('st').style.top = t; }
function buttons() {
  $('vw-fly').textContent = V.fly ? '❚❚ Stop' : V.racing ? '▶ Ride along' : '▶ Fly the lap';
  $('vw-race').textContent = 'Cars: ' + (V.racing ? 'racing' : 'parked');
  $('vw-line').classList.toggle('on', !!G.lineGuide); $('vw-labels').classList.toggle('on', V.labels);
  $('vw-note').classList.toggle('on', !!G.noteMode); $('vw-note').textContent = G.noteMode ? 'Done' : 'Note';
  $('vw-card-btn').classList.toggle('on', !$('vw-card').classList.contains('shut'));
}
// ---------- the camera ----------
/** Each frame while the viewer is open (main.js): the race if the cars are racing, then where the camera is. */
export function viewerStep(dt) {
  if (race) {
    G.accumulator += dt; let n = 0;
    while (G.accumulator >= STEP && n < 12) { savePrev(); raceStep(race, STEP, G.world.W); G.accumulator -= STEP; n++; }
    if (n === 12) G.accumulator = 0;
    G.renderAlpha = G.accumulator / STEP; handleEvents(); applyBarrierChanges(); $('callout').hidden = true;
  }
  const tr = G.world.tr, terr = G.world.terr;
  // held keys move about (input.js keeps them)
  const k = (a, b) => (keys[a] || keys[b] ? 1 : 0), mv = V.dist * 0.9 * dt * (keys.ShiftLeft || keys.ShiftRight ? 3 : 1);
  const fwd = k('KeyW', 'ArrowUp') - k('KeyS', 'ArrowDown'), side = k('KeyD', 'ArrowRight') - k('KeyA', 'ArrowLeft');
  if (fwd || side) { V.goal = null; pan(side * mv, fwd * mv); if (V.fly) setFly(false); }
  V.yaw += (k('KeyE', 'KeyE') - k('KeyQ', 'KeyQ')) * dt * 1.6; V.pitch = clamp(V.pitch + (k('KeyR', 'KeyR') - k('KeyF', 'KeyF')) * dt * 0.9, 0.05, 1.52);
  if (keys.Equal || keys.NumpadAdd) V.dist = Math.max(6, V.dist * Math.exp(-dt * 1.5)); if (keys.Minus || keys.NumpadSubtract) V.dist = Math.min(900, V.dist * Math.exp(dt * 1.5));
  if (V.fly) {
    // riding the road: with the cars racing, along with yours; else at the speed a quick car would be doing here
    let i;
    if (V.racing && race) { const P = race.player; i = tr.bi(P.pr.i); V.T.lerp(new THREE.Vector3(P.x, P.y + 1, P.z), 1 - Math.exp(-dt * 8)); }
    else {
      const N = tr.loopN || tr.N, end = tr.loopN ? N : (tr.finishIdx || N) - 1, v = V.R ? Math.max(6, V.R.profile[Math.floor(V.s) % tr.N]) : 25;
      V.s += v * V.speed * dt; if (V.s >= end) V.s = tr.loopN ? V.s - N : tr.startIdx;
      i = Math.floor(V.s); const j = Math.min(tr.N - 1, i + 1), f = V.s - i;
      V.T.set(tr.xs[i] + (tr.xs[j] - tr.xs[i]) * f, tr.H[i] + (tr.H[j] - tr.H[i]) * f + 1, tr.zs[i] + (tr.zs[j] - tr.zs[i]) * f);
    }
    // behind, looking up the road (averaged over the next 30 m, so it doesn't twitch on every kink)
    let fx = 0, fz = 0; for (let d = 0; d <= 30; d += 5) { const q = tr.adv ? tr.adv(i, d) : Math.min(tr.N - 1, i + d); fx += tr.tx[q]; fz += tr.tz[q]; }
    const want = Math.atan2(-fx, -fz) + V.yawOff; V.yaw += wrapAngle(want - V.yaw) * (1 - Math.exp(-dt * 2.5));
    V.mapDirty = true;
  } else if (V.goal) {
    const e = 1 - Math.exp(-dt * 4); V.T.lerp(V.goal.T, e); if (V.goal.dist) V.dist += (V.goal.dist - V.dist) * e;
    if (V.T.distanceTo(V.goal.T) < 0.3) V.goal = null; V.mapDirty = true;
  }
  // where the camera stands, kept out of the ground (unless the road it looks at is in a tunnel)
  const cp = Math.cos(V.pitch), pos = new THREE.Vector3(V.T.x + Math.sin(V.yaw) * cp * V.dist, V.T.y + Math.sin(V.pitch) * V.dist, V.T.z + Math.cos(V.yaw) * cp * V.dist);
  const q = tr.nearest ? tr.nearest(V.T.x, V.T.z) : null, inTunnel = q && q.i != null && tr.tunnel[q.i] && V.dist < 30;
  if (!inTunnel) pos.y = Math.max(pos.y, terr.at(pos.x, pos.z) + 1.5);
  G.viewCam = { pos: [pos.x, pos.y, pos.z], look: [V.T.x, V.T.y, V.T.z], fov: 50, shadow: V.dist * 0.9 };
  // fog pushed back as the camera pulls out, so the whole track shows from up high
  if (V.fog) { scene.fog.near = Math.max(V.fog.near, V.dist * 1.4); scene.fog.far = Math.max(V.fog.far, scene.fog.near + 300 + V.dist); }
  if (V.mapDirty) { V.mapDirty = false; drawMap(); drawStrip(); }
}
function pan(dx, dz) {   // dx right, dz forward (into the view), in metres along the ground
  const sx = Math.cos(V.yaw), sz = -Math.sin(V.yaw), fx = -Math.sin(V.yaw), fz = -Math.cos(V.yaw);
  V.T.x += sx * dx + fx * dz; V.T.z += sz * dx + fz * dz; V.T.y = G.world.terr.at(V.T.x, V.T.z); V.mapDirty = true;
}
function fit() {
  const tr = G.world.tr, R = V.R, i0 = R ? R.i0 : 0, i1 = R ? R.i1 : tr.N;
  let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, h = 0;
  for (let i = i0; i < i1; i += 4) { const k = i % tr.N; x0 = Math.min(x0, tr.xs[k]); x1 = Math.max(x1, tr.xs[k]); z0 = Math.min(z0, tr.zs[k]); z1 = Math.max(z1, tr.zs[k]); h += tr.H[k]; }
  V.fly = false; V.goal = null; V.T.set((x0 + x1) / 2, h / Math.max(1, (i1 - i0) / 4), (z0 + z1) / 2);
  V.dist = clamp(Math.hypot(x1 - x0, z1 - z0) * 0.85, 60, 900); V.pitch = 0.75; V.yaw = Math.PI / 4; V.mapDirty = true; buttons();
}
/** Fly the camera to road sample i (the moments, the strip, the pillars). */
function goTo(i) {
  const tr = G.world.tr; i = clamp(i | 0, 0, tr.N - 1); V.fly = false; V.s = i;
  V.goal = { T: new THREE.Vector3(tr.xs[i], tr.H[i] + 1, tr.zs[i]), dist: Math.min(V.dist, 70) }; buttons();
}
function flyTo(cx, cy) { const p = pickGround(cx, cy); if (!p) return; V.fly = false; V.goal = { T: new THREE.Vector3(p.x, p.y, p.z), dist: Math.max(20, V.dist * 0.6) }; buttons(); }
// ---------- pointers ----------
function down(e) {
  e.preventDefault(); $('vw-surf').setPointerCapture(e.pointerId);
  const p = { x: e.clientX, y: e.clientY, x0: e.clientX, y0: e.clientY, t: performance.now(), b: e.button, sh: e.shiftKey };
  if (!ptrs.size && hooks && hooks.want(e)) { p.edit = true; hooks.down(e); } else if (ptrs.size) for (const q of ptrs.values()) if (q.edit) { q.edit = false; hooks.cancel(); }   // a second finger: it's the view that moves
  ptrs.set(e.pointerId, p); gesture = null;
}
function move(e) {
  const p = ptrs.get(e.pointerId); if (!p) { if (hooks && hooks.hover) hooks.hover(e); return; }
  if (p.edit) { p.x = e.clientX; p.y = e.clientY; hooks.move(e); return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y;
  if (ptrs.size >= 2) {
    // two fingers: move with their middle, pinch to zoom
    const [a, b] = [...ptrs.values()], d0 = Math.hypot(a.x - b.x, a.y - b.y); p.x = e.clientX; p.y = e.clientY;
    const d1 = Math.hypot(a.x - b.x, a.y - b.y); if (d0 > 0 && d1 > 0) V.dist = clamp(V.dist * d0 / d1, 6, 900);
    panPx(dx / 2, dy / 2); gesture = 'two'; return;
  }
  p.x = e.clientX; p.y = e.clientY;
  if (!gesture && Math.hypot(p.x - p.x0, p.y - p.y0) < 5) return;
  gesture = gesture || 'drag';
  if (p.b === 2 || p.sh) panPx(dx, dy);
  else if (V.fly) V.yawOff -= dx * 0.005;
  else { V.yaw -= dx * 0.005; V.pitch = clamp(V.pitch + dy * 0.004, 0.05, 1.52); }
}
function panPx(dx, dy) { const m = V.dist * 0.0018; V.goal = null; if (V.fly) setFly(false); pan(-dx * m, dy * m / Math.max(0.35, Math.sin(V.pitch))); }
function up(e) {
  const p = ptrs.get(e.pointerId); ptrs.delete(e.pointerId); if (!p) return;
  if (p.edit) { hooks.up(e); return; }
  if (gesture || ptrs.size) return;
  const now = performance.now(); if (now - p.t > 400) return;
  if (G.noteMode) { placeNote(e.clientX, e.clientY); return; }   // a tap while noting: a note there
  if (lastTap && now - lastTap.t < 320 && Math.hypot(e.clientX - lastTap.x, e.clientY - lastTap.y) < 30) { flyTo(e.clientX, e.clientY); lastTap = null; return; }
  lastTap = { t: now, x: e.clientX, y: e.clientY };
}
// ---------- the map and the strip ----------
const SA = (x, z) => (x - z) / Math.SQRT2, SB = (x, z) => -(x + z) / Math.SQRT2;   // screen axes, as the race camera sees it
function sizeCanvas(cv) { const r = cv.getBoundingClientRect(), d = devicePixelRatio || 1; if (cv.width !== Math.round(r.width * d) || cv.height !== Math.round(r.height * d)) { cv.width = Math.round(r.width * d); cv.height = Math.round(r.height * d); } return { w: cv.width, h: cv.height, d }; }
function speedCol(v) { const t = clamp((v - 17) / (TOP - 17), 0, 1); return `hsl(${Math.round(t * 120)},75%,52%)`; }
function drawMap() {
  const cv = $('vw-map'); if (!cv || $('vw-card').classList.contains('shut')) return;
  const { w, h, d } = sizeCanvas(cv), g = cv.getContext('2d'), tr = G.world.tr, R = V.R; if (!w || !h) return;
  const i0 = R ? R.i0 : 0, i1 = R ? R.i1 : tr.N;
  if (!V.mapK) {
    let a0 = Infinity, a1 = -Infinity, b0 = Infinity, b1 = -Infinity;
    for (let i = i0; i < i1; i += 3) { const k = i % tr.N, a = SA(tr.xs[k], tr.zs[k]), b = SB(tr.xs[k], tr.zs[k]); a0 = Math.min(a0, a); a1 = Math.max(a1, a); b0 = Math.min(b0, b); b1 = Math.max(b1, b); }
    const s = Math.min((w - 24 * d) / Math.max(1, a1 - a0), (h - 24 * d) / Math.max(1, b1 - b0));
    V.mapK = { s, ox: w / 2 - (a0 + a1) / 2 * s, oy: h / 2 + (b0 + b1) / 2 * s };
  }
  const M = V.mapK, px = (x, z) => [M.ox + SA(x, z) * M.s, M.oy - SB(x, z) * M.s];
  g.clearRect(0, 0, w, h); g.lineCap = 'round';
  g.lineWidth = 7 * d; g.strokeStyle = 'rgba(0,0,0,.45)'; g.beginPath();
  for (let i = i0; i <= i1; i += 3) { const k = i % tr.N, [x, y] = px(tr.xs[k], tr.zs[k]); i === i0 ? g.moveTo(x, y) : g.lineTo(x, y); } g.stroke();
  g.lineWidth = 4 * d;
  for (let i = i0; i < i1; i += 3) {
    const k = i % tr.N, k2 = Math.min(i + 3, i1) % tr.N, [x, y] = px(tr.xs[k], tr.zs[k]), [x2, y2] = px(tr.xs[k2], tr.zs[k2]);
    g.strokeStyle = tr.bridge[k] ? '#fff' : tr.tunnel[k] ? '#222' : R ? speedCol(R.profile[k]) : '#ccc'; g.beginPath(); g.moveTo(x, y); g.lineTo(x2, y2); g.stroke();
  }
  { const k = tr.startIdx % tr.N, [x, y] = px(tr.xs[k], tr.zs[k]); g.fillStyle = '#fff'; g.fillRect(x - 3 * d, y - 3 * d, 6 * d, 6 * d); }
  if (R) R.moments.forEach((m, n) => {
    const k = m.i % tr.N, [x, y] = px(tr.xs[k], tr.zs[k]); g.fillStyle = KIND_COL[m.kinds[0]] || '#fff'; g.globalAlpha = m.big ? 1 : 0.6;
    g.beginPath(); g.arc(x, y, (m.big ? 8 : 6) * d, 0, 7); g.fill(); g.globalAlpha = 1; g.fillStyle = '#fff'; g.font = `bold ${9 * d}px sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n + 1), x, y + 0.5);
  });
  // the camera: where it looks, and which way
  const [cx, cy] = px(V.T.x, V.T.z), dir = px(V.T.x - Math.sin(V.yaw) * 30, V.T.z - Math.cos(V.yaw) * 30);
  g.strokeStyle = '#FFC72C'; g.lineWidth = 2 * d; g.beginPath(); g.moveTo(cx, cy); g.lineTo(dir[0], dir[1]); g.stroke();
  g.fillStyle = '#FFC72C'; g.strokeStyle = '#1C2340'; g.beginPath(); g.arc(cx, cy, 5 * d, 0, 7); g.fill(); g.stroke();
}
function mapClick(e) {
  const M = V.mapK; if (!M) return; const r = e.target.getBoundingClientRect(), d = devicePixelRatio || 1, mx = (e.clientX - r.left) * d, my = (e.clientY - r.top) * d;
  const a = (mx - M.ox) / M.s, b = (M.oy - my) / M.s, x = (a - b) / Math.SQRT2, z = (-a - b) / Math.SQRT2;
  const tr = G.world.tr; let bi = 0, bd = Infinity; for (let i = 0; i < (tr.loopN || tr.N); i += 2) { const dd = (tr.xs[i] - x) ** 2 + (tr.zs[i] - z) ** 2; if (dd < bd) { bd = dd; bi = i; } }
  goTo(bi);
}
function drawStrip() {
  const cv = $('vw-strip'), R = V.R; if (!cv || !R || $('vw-card').classList.contains('shut')) return;
  const { w, h, d } = sizeCanvas(cv), g = cv.getContext('2d'), tr = G.world.tr; if (!w || !h) return;
  const n = R.i1 - R.i0, X = i => (i - R.i0) / n * w, hs = (h - 14 * d) / Math.max(4, R.hMax - R.hMin), Y = H => h - 4 * d - (H - R.hMin) * hs;
  g.clearRect(0, 0, w, h);
  // the height profile, coloured by speed
  for (let i = R.i0; i < R.i1; i += 2) { const k = i % tr.N; g.fillStyle = speedCol(R.profile[k]); g.globalAlpha = 0.85; g.fillRect(X(i), Y(tr.H[k]), Math.max(1, 2 / n * w + 0.5), h - Y(tr.H[k])); }
  g.globalAlpha = 1;
  R.moments.forEach((m, k) => { const x = X(m.i < R.i0 ? m.i + (tr.loopN || 0) : m.i); g.fillStyle = KIND_COL[m.kinds[0]] || '#fff'; g.fillRect(x - d, 0, 2 * d, h); g.font = `bold ${9 * d}px sans-serif`; g.fillText(String(k + 1), x + 2 * d, 9 * d); });
  const s = V.fly && V.racing && race ? tr.bi(race.player.pr.i) : V.s; g.fillStyle = '#FFC72C'; g.fillRect(X(s) - 1.5 * d, 0, 3 * d, h);
}
function stripClick(e) { const R = V.R; if (!R) return; const r = e.target.getBoundingClientRect(); goTo(R.i0 + (e.clientX - r.left) / r.width * (R.i1 - R.i0)); }
// ---------- the report card ----------
function drawCard() {
  const R = V.R, st = STAGES[V.idx];
  if (!R) { $('vw-sum').innerHTML = `<b>${esc(st.name)}</b><p>No report for this stage.</p>`; $('vw-pillars').innerHTML = $('vw-moments').innerHTML = ''; return; }
  $('vw-sum').innerHTML = `<div class="vw-score s${Math.round(R.score / R.of * 4)}">${R.score}<small>/${R.of}</small></div><div><b>${esc(st.name)}</b><br>`
    + `${(R.len / 1000).toFixed(1)} km ${R.type}${R.type === 'circuit' ? `, ${R.laps} laps` : ''} · about ${fmt(R.time)} a lap<br>${Math.round(R.flat * 100)}% flat out · climbs ${R.climb.toFixed(0)} m · ${R.big} moments (${R.perMin.toFixed(1)} a minute)</div>`;
  $('vw-pillars').innerHTML = R.pillars.map(q => `<li class="${q.ok ? 'ok' : 'miss'}"${q.id === 'rhythm' && !q.ok ? ` data-go="${R.deadAt}"` : ''}><b>${q.ok ? '✓' : '✗'} ${esc(q.name)}</b> <span>${esc(q.val)}</span>${q.ok ? '' : `<small>${esc(q.tip)}</small>`}</li>`).join('');
  $('vw-moments').innerHTML = R.moments.length ? R.moments.map((m, k) => `<li data-go="${m.i}" class="${m.big ? '' : 'minor'}"><i style="background:${KIND_COL[m.kinds[0]]}">${k + 1}</i><span><b>${fmt(m.t)}</b> ${esc(m.label)}<small>${m.kinds.map(x => KIND_NAME[x]).join(', ')}</small></span></li>`).join('')
    : '<li class="minor">Nothing along the road yet: no jumps, set pieces or landmarks.</li>';
}
// numbered flags over the road at each moment (looks only)
function makeLabels() {
  if (labels) { labels.parent && labels.parent.remove(labels); labels = null; }
  const R = V.R; if (!R) return; const tr = G.world.tr;
  labels = new THREE.Group(); labels.visible = V.labels; G.world.group.add(labels);
  R.moments.forEach((m, n) => {
    const t = canvasTex(64, 64, (g, w) => { g.fillStyle = KIND_COL[m.kinds[0]] || '#fff'; g.globalAlpha = m.big ? 1 : 0.7; g.beginPath(); g.arc(w / 2, w / 2, 28, 0, 7); g.fill(); g.globalAlpha = 1; g.lineWidth = 4; g.strokeStyle = '#fff'; g.stroke(); g.fillStyle = '#fff'; g.font = 'bold 30px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n + 1), w / 2, w / 2 + 1); });
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, sizeAttenuation: false }));
    const k = m.i % tr.N; s.position.set(tr.xs[k], tr.H[k] + 7, tr.zs[k]); s.scale.set(0.045, 0.045, 1); s.renderOrder = 19; labels.add(s);
  });
}
