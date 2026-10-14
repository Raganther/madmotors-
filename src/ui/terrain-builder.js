import * as THREE from 'three';
import { G } from '../game.js';
import { STAGES } from '../data/stages/index.js';
import { buildTrack } from '../core/track/build.js';
import { closeLoop, fromStroke, sketch } from '../core/track/editing.js';
import { GROUND, blankGround, groundAt, groundFor, roadOnGround } from '../core/track/ground.js';
import { forgetTrack } from '../render/world/index.js';
import { $ } from './dom.js';
import { startRace } from './flow.js';

// The Terrain builder (menu: Terrain builder): shape a landscape, then paint a road across it. A piece of ground
// 800 m square seen in 3D; the brushes Raise, Lower, Smooth and Flatten push its heights about (core/track/ground.js
// keeps them as a grid every 8 m), Road drags out the track's line on it (core/track/editing.js fromStroke, as the
// Track editor's Draw), and the road's heights come from the ground under it, smoothed to a climb a car can take
// (roadOnGround); where the land does more than that the road cuts through or rides over it. Test drive races it,
// Send to Claude puts it in the artifact's database ("tracks", base "terrain": the stage carries `ground`) for Claude
// to turn into a real stage. Drafts are kept in this browser as you go.
// View: drag to turn round, right-drag (or two fingers) to move, wheel / pinch to zoom; with a brush, one finger paints
// and two fingers move the view.
const DRAFT = 'downhill-rush-terrain';
const HINT = { view: 'drag to turn the view, right-drag or two fingers to move it, wheel or pinch to zoom',
  raise: 'drag to raise the ground: hold for a mountain', lower: 'drag to dig valleys and basins', smooth: 'drag to smooth out lumps and ridges',
  flatten: 'drag to level the ground at the height where you started', road: 'drag out the road on the land: end near where you began for a lap, or start at its end to carry it on' };
let B = null, built = false, R = null, scene, cam, terr, roadMesh, roadGhost, ring, strokeLine, startMark, EDIT_IDX = -1, db = null, undo = [], raf = 0;
const view = { a: 0, b: 0, yaw: 0.5, pitch: 0.75, dist: 900 };
const ptrs = new Map(); let paint = null, stroke = null, gesture = null, lastT = 0, roadDirty = 0;
const clone = o => JSON.parse(JSON.stringify(o));

export function initTerrainBuilder() {
  $('terrain-btn').addEventListener('click', () => openTerrain());
  $('tb-exit').addEventListener('click', closeTerrain);
  $('tb-name').addEventListener('input', e => { B.name = e.target.value.slice(0, 40) || 'My landscape'; save(); });
  $('tb-laps').addEventListener('change', e => { B.laps = Math.max(1, Math.min(9, Math.round(+e.target.value || 3))); save(); });
  $('tb-surface').addEventListener('change', e => { B.surface = e.target.value; save(); });
  $('tb-size').addEventListener('input', e => { B.size = +e.target.value; status(); });
  $('tb-power').addEventListener('input', e => { B.power = +e.target.value; status(); });
  document.querySelectorAll('#tb [data-tool]').forEach(b => b.addEventListener('click', () => setTool(b.dataset.tool)));
  $('tb-undo').addEventListener('click', () => { const u = undo.pop(); if (!u) return; B.ground.h = u.h; B.road = u.road; groundChanged(true); roadChanged(); save(); status(); });
  $('tb-close').addEventListener('click', closeRoad);
  $('tb-clearroad').addEventListener('click', () => { if (!B.road) return; remember(); B.road = null; roadChanged(); save(); status('Road cleared: the landscape is kept.'); });
  $('tb-clearground').addEventListener('click', () => { if (!confirm('Flatten the whole landscape? (Undo brings it back.)')) return; remember(); B.ground.h.fill(0); groundChanged(true); roadChanged(); save(); status('The ground is flat again.'); });
  $('tb-drive').addEventListener('click', drive);
  $('tb-send').addEventListener('click', send);
  for (const [id, f] of [['tb-left', () => { view.yaw -= Math.PI / 8; }], ['tb-right', () => { view.yaw += Math.PI / 8; }], ['tb-top', () => { view.pitch = view.pitch > 1.4 ? 0.75 : 1.5; }],
    ['tb-zoomin', () => { view.dist = Math.max(80, view.dist / 1.3); }], ['tb-zoomout', () => { view.dist = Math.min(1600, view.dist * 1.3); }], ['tb-fit', fitView]]) $(id).addEventListener('click', f);
  const cv = $('tb-view');
  cv.addEventListener('pointerdown', down); cv.addEventListener('pointermove', move); cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
  cv.addEventListener('contextmenu', e => e.preventDefault());
  cv.addEventListener('wheel', e => { e.preventDefault(); view.dist = Math.max(80, Math.min(1600, view.dist * Math.exp(e.deltaY * 0.0012))); }, { passive: false });
  addEventListener('resize', () => { if (!$('tb').hidden) resize(); });
  if (window.claude && window.claude.use) window.claude.use('db').then(d => { db = d; });
}
export function openTerrain(back = false) {
  if (!B) { let d = null; try { d = JSON.parse(localStorage.getItem(DRAFT) || 'null'); } catch (e) { /* no draft */ } B = d && d.ground && d.ground.h ? d : fresh(); }
  if (!built) build3D();
  G.editDrive = false; $('menu').hidden = true; $('tb').hidden = false;
  $('tb-name').value = B.name; $('tb-laps').value = B.laps; $('tb-surface').value = B.surface; $('tb-size').value = B.size; $('tb-power').value = B.power;
  setTool(B.tool || 'raise', true); groundChanged(true); roadChanged(); resize(); if (!back) fitView(); status();
  cancelAnimationFrame(raf); lastT = performance.now(); raf = requestAnimationFrame(frame);
}
function closeTerrain() { $('tb').hidden = true; $('menu').hidden = false; cancelAnimationFrame(raf); save(); }
function fresh() { return { name: 'My landscape', laps: 3, surface: 'tarmac', size: 60, power: 5, tool: 'raise', ground: blankGround(), road: null }; }
function save() { try { localStorage.setItem(DRAFT, JSON.stringify({ ...B, ground: { ...B.ground, h: Array.from(B.ground.h, v => Math.round(v * 10) / 10) } })); } catch (e) { /* full: fine, it's a draft */ } }
function remember() { undo.push({ h: B.ground.h.slice(), road: B.road ? clone(B.road) : null }); if (undo.length > 25) undo.shift(); $('tb-undo').disabled = false; }
function setTool(t, quiet) {
  B.tool = t; document.querySelectorAll('#tb [data-tool]').forEach(b => b.classList.toggle('on', b.dataset.tool === t));
  $('tb-brush').hidden = t === 'view' || t === 'road'; $('tb-view').className = t; if (ring) ring.visible = false;
  if (!quiet) { save(); status(); }
}

// ---------- the 3D view ----------
// the ground's shader: coloured by height (grass low, rock high, snow on the tops), a contour every 5 m (stronger
// every 25 m) and a faint 50 m grid, so how high things are reads from any angle
const VS = `varying vec3 vP; varying vec3 vN; void main(){ vP = position; vN = normal; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const FS = `varying vec3 vP; varying vec3 vN; uniform float lo; uniform float hi;
  float line(float v, float w){ float fw = fwidth(v), f = abs(fract(v - 0.5) - 0.5) / max(fw, 1e-4); return (1.0 - clamp(f / w, 0.0, 1.0)) * step(1e-4, fw); }   // none on level ground
  void main(){
    float h = vP.y, t = clamp((h + 40.0) / 200.0, 0.0, 1.0);
    vec3 c = mix(vec3(0.20, 0.42, 0.62), vec3(0.36, 0.55, 0.28), smoothstep(-6.0, -1.0, h));
    c = mix(c, vec3(0.55, 0.60, 0.30), smoothstep(10.0, 40.0, h)); c = mix(c, vec3(0.52, 0.42, 0.33), smoothstep(40.0, 90.0, h));
    c = mix(c, vec3(0.62, 0.62, 0.64), smoothstep(90.0, 140.0, h)); c = mix(c, vec3(0.95, 0.96, 1.0), smoothstep(140.0, 170.0, h));
    vec3 n = normalize(vN); float d = 0.45 + 0.65 * max(0.0, dot(n, normalize(vec3(0.4, 0.8, 0.35))));
    c *= d; c *= 1.0 - (0.28 * line(h / 5.0, 1.0) + 0.3 * line(h / 25.0, 1.4)) * step(0.5, abs(h));   // not the 0 m line: it would trace every brush's edge c = mix(c, vec3(1.0), 0.12 * line(vP.x / 50.0, 1.0) + 0.12 * line(vP.z / 50.0, 1.0));
    gl_FragColor = vec4(c * (0.92 + 0.08 * t), 1.0);
  }`;
function build3D() {
  built = true; const cv = $('tb-view');
  R = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); R.setClearColor(0x9ec8e8);
  scene = new THREE.Scene(); scene.fog = new THREE.Fog(0x9ec8e8, 1400, 2600);
  cam = new THREE.PerspectiveCamera(45, 1, 2, 5000);
  const g = B.ground, geo = new THREE.BufferGeometry(), pos = new Float32Array(g.cols * g.rows * 3), idx = [];
  for (let r = 0; r < g.rows - 1; r++) for (let c = 0; c < g.cols - 1; c++) { const k = r * g.cols + c; idx.push(k, k + 1, k + g.cols, k + 1, k + g.cols + 1, k + g.cols); }   // wound to face up
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS, uniforms: { lo: { value: 0 }, hi: { value: 1 } }, extensions: { derivatives: true } });
  terr = new THREE.Mesh(geo, mat); scene.add(terr);
  ring = new THREE.LineLoop(new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(64 * 3), 3)), new THREE.LineBasicMaterial({ color: 0xffffff, depthTest: false, transparent: true }));
  ring.renderOrder = 3; ring.visible = false; scene.add(ring);
  strokeLine = new THREE.Line(new THREE.BufferGeometry(), new THREE.LineBasicMaterial({ color: 0xffc72c, depthTest: false })); strokeLine.renderOrder = 4; scene.add(strokeLine);
  startMark = new THREE.Mesh(new THREE.BoxGeometry(14, 1.2, 2.5), new THREE.MeshBasicMaterial({ color: 0xffffff })); startMark.visible = false; scene.add(startMark);
}
const P3 = (a, b, h) => new THREE.Vector3(a, h, -b);    // plan a (right), b (up-screen), height -> the view's x, y, z
function groundChanged(all) {
  const g = B.ground, pos = terr.geometry.attributes.position.array;
  if (all) for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) { const k = r * g.cols + c; pos[k * 3] = g.a0 + c * g.cell; pos[k * 3 + 2] = -(g.b0 + r * g.cell); }
  for (let k = 0; k < g.h.length; k++) pos[k * 3 + 1] = g.h[k];
  terr.geometry.attributes.position.needsUpdate = true; terr.geometry.computeVertexNormals(); terr.geometry.computeBoundingSphere(); terr.geometry.computeBoundingBox();
}
// the road as it'll be built: a 12 m ribbon on its heights, and a faint copy drawn through the ground so a cutting shows
function roadChanged() {
  for (const m of [roadMesh, roadGhost]) if (m) { scene.remove(m); m.geometry.dispose(); }
  roadMesh = roadGhost = null; startMark.visible = false;
  const rd = B.road; if (!rd || !rd.segs.length) return;
  const segs = roadOnGround(rd.segs, rd.heading, B.ground, rd.start), k = sketch(segs, rd.heading, 3), P = k.pts, pos = [], idx = [];
  P.forEach((p, i) => {
    const q = P[Math.min(P.length - 1, i + 1)], o = P[Math.max(0, i - 1)], dx = q.a - o.a, dy = q.b - o.b, L = Math.hypot(dx, dy) || 1, nx = -dy / L * 6, ny = dx / L * 6;
    const a = rd.start.a + p.a, b = rd.start.b + p.b; pos.push(...P3(a + nx, b + ny, p.h + 0.4).toArray(), ...P3(a - nx, b - ny, p.h + 0.4).toArray());
    if (i) idx.push(2 * i - 2, 2 * i - 1, 2 * i, 2 * i - 1, 2 * i + 1, 2 * i);
  });
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setIndex(idx);
  roadMesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0x3a3d45, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
  roadGhost = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffc72c, side: THREE.DoubleSide, transparent: true, opacity: 0.35, depthTest: false }));
  roadGhost.renderOrder = 2; scene.add(roadMesh, roadGhost);
  const h0 = P[0].h; startMark.position.copy(P3(rd.start.a, rd.start.b, h0 + 0.9)); startMark.rotation.y = rd.heading + Math.PI / 2; startMark.visible = true;
  rd.lo = Math.min(...P.map(p => p.h)); rd.hi = Math.max(...P.map(p => p.h)); rd.len = k.lens.reduce((a, b) => a + b, 0); rd.gap = k.gap;
}
function resize() {
  const cv = $('tb-view'), r = cv.getBoundingClientRect(); if (!r.width || !R) return;
  R.setSize(r.width, r.height, false); cam.aspect = r.width / r.height; cam.updateProjectionMatrix();
}
function fitView() {
  const rd = B.road; view.yaw = 0.5; view.pitch = 0.75;
  if (rd && rd.segs.length) { const k = sketch(rd.segs, rd.heading, 6); let a0 = 1e9, a1 = -1e9, b0 = 1e9, b1 = -1e9; for (const p of k.pts) { a0 = Math.min(a0, p.a); a1 = Math.max(a1, p.a); b0 = Math.min(b0, p.b); b1 = Math.max(b1, p.b); }
    view.a = rd.start.a + (a0 + a1) / 2; view.b = rd.start.b + (b0 + b1) / 2; view.dist = Math.max(300, Math.min(1500, 1.3 * Math.max(a1 - a0, b1 - b0))); }
  else { const g = B.ground; view.a = g.a0 + (g.cols - 1) * g.cell / 2; view.b = g.b0 + (g.rows - 1) * g.cell / 2; view.dist = 950; }
  if (cam && cam.aspect < 0.9) view.dist = Math.min(1600, view.dist * 0.9 / cam.aspect);   // a phone held upright: stand back to fit the width
}
function placeCam() {
  const h = groundAt(B.ground, view.a, view.b), cp = Math.cos(view.pitch);
  cam.position.set(view.a + Math.sin(view.yaw) * cp * view.dist, h + Math.sin(view.pitch) * view.dist, -view.b + Math.cos(view.yaw) * cp * view.dist);
  cam.lookAt(view.a, h, -view.b);
}
function frame(t) {
  raf = requestAnimationFrame(frame); const dt = Math.min(0.1, (t - lastT) / 1000); lastT = t;
  if (paint) brush(dt);
  if (roadDirty && t > roadDirty) { roadDirty = 0; roadChanged(); }
  placeCam(); R.render(scene, cam);
}

// ---------- pointer: paint, draw the road, move the view ----------
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function hit(e) {
  const r = $('tb-view').getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1);
  placeCam(); ray.setFromCamera(ndc, cam); const h = ray.intersectObject(terr)[0]; return h ? { a: h.point.x, b: -h.point.z } : null;
}
function down(e) {
  const cv = $('tb-view'); cv.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (ptrs.size >= 2) { endStroke(true); gesture = twoFinger(); return; }
  const orbit = B.tool === 'view' || e.button === 2 || e.button === 1 || e.shiftKey;
  if (orbit) { gesture = { kind: e.button === 2 || e.button === 1 || e.shiftKey ? 'pan' : 'orbit', x: e.clientX, y: e.clientY }; return; }
  const p = hit(e); if (!p) return;
  if (B.tool === 'road') { stroke = [p]; drawStroke(); return; }
  remember(); paint = { at: p, flat: groundAt(B.ground, p.a, p.b) };
}
function move(e) {
  const pt = ptrs.get(e.pointerId); if (pt) { pt.x = e.clientX; pt.y = e.clientY; }
  if (ptrs.size >= 2 && gesture && gesture.kind === 'two') { const g2 = twoFinger(), s = gesture;
    view.dist = Math.max(80, Math.min(1600, view.dist * s.d / Math.max(10, g2.d))); view.yaw += g2.ang - s.ang; panBy(g2.x - s.x, g2.y - s.y); gesture = g2; return; }
  if (gesture) { const dx = e.clientX - gesture.x, dy = e.clientY - gesture.y; gesture.x = e.clientX; gesture.y = e.clientY;
    if (gesture.kind === 'orbit') { view.yaw -= dx * 0.006; view.pitch = Math.max(0.25, Math.min(1.53, view.pitch + dy * 0.005)); } else panBy(dx, dy); return; }
  const p = hit(e);
  if (stroke) { if (p) { const q = stroke[stroke.length - 1]; if (Math.hypot(p.a - q.a, p.b - q.b) > 3) { stroke.push(p); drawStroke(); } } return; }
  if (paint) { if (p) paint.at = p; return; }
  showRing(p);
}
function up(e) {
  ptrs.delete(e.pointerId);
  if (gesture) { if (ptrs.size === 0) gesture = null; else if (gesture.kind === 'two') gesture = null; return; }
  if (stroke) { const s = stroke; stroke = null; drawStroke(); applyRoad(s); return; }
  if (paint) { paint = null; roadChanged(); save(); status(); }
}
function twoFinger() { const [p, q] = [...ptrs.values()]; return { kind: 'two', x: (p.x + q.x) / 2, y: (p.y + q.y) / 2, d: Math.hypot(q.x - p.x, q.y - p.y), ang: Math.atan2(q.y - p.y, q.x - p.x) }; }
function endStroke(drop) { if (stroke && drop) { stroke = null; drawStroke(); } paint = null; }
// move the view's centre with the drag, in the ground's plane as seen from the camera's side
function panBy(dx, dy) {
  const s = view.dist / ($('tb-view').getBoundingClientRect().height || 600) * 0.9, c = Math.cos(view.yaw), sn = Math.sin(view.yaw);
  view.a -= (dx * c - dy * sn / Math.max(0.35, Math.sin(view.pitch))) * s; view.b += (dx * sn + dy * c / Math.max(0.35, Math.sin(view.pitch))) * s;
}
function showRing(p) {
  if (!p || B.tool === 'view' || B.tool === 'road') { ring.visible = false; return; }
  const a = ring.geometry.attributes.position.array, n = a.length / 3;
  for (let k = 0; k < n; k++) { const t = k / n * Math.PI * 2, x = p.a + Math.cos(t) * B.size, y = p.b + Math.sin(t) * B.size; a[k * 3] = x; a[k * 3 + 1] = groundAt(B.ground, x, y) + 1; a[k * 3 + 2] = -y; }
  ring.geometry.attributes.position.needsUpdate = true; ring.visible = true;
}
// a brush stroke: every grid point inside the brush moves, most at the centre, by Raise/Lower `power` x 5 m a second
function brush(dt) {
  const g = B.ground, p = paint.at, r = B.size, rate = B.power * 5 * dt, c0 = Math.max(0, Math.floor((p.a - r - g.a0) / g.cell)), c1 = Math.min(g.cols - 1, Math.ceil((p.a + r - g.a0) / g.cell));
  const r0 = Math.max(0, Math.floor((p.b - r - g.b0) / g.cell)), r1 = Math.min(g.rows - 1, Math.ceil((p.b + r - g.b0) / g.cell)), h = g.h, old = B.tool === 'smooth' ? h.slice() : null;
  for (let row = r0; row <= r1; row++) for (let c = c0; c <= c1; c++) {
    const d = Math.hypot(g.a0 + c * g.cell - p.a, g.b0 + row * g.cell - p.b) / r; if (d >= 1) continue;
    const w = (1 - d * d) ** 2, k = row * g.cols + c;
    if (B.tool === 'raise') h[k] += w * rate;
    else if (B.tool === 'lower') h[k] -= w * rate;
    else if (B.tool === 'flatten') h[k] += (paint.flat - h[k]) * Math.min(1, w * B.power * dt * 1.2);
    else if (B.tool === 'smooth') { let s = 0, m = 0; for (let j = -2; j <= 2; j++) for (let i = -2; i <= 2; i++) { const rr = row + j, cc = c + i; if (rr >= 0 && rr < g.rows && cc >= 0 && cc < g.cols) { s += old[rr * g.cols + cc]; m++; } } h[k] += (s / m - h[k]) * Math.min(1, w * B.power * dt * 1.5); }
    h[k] = Math.max(GROUND.MIN, Math.min(GROUND.MAX, h[k]));
  }
  groundChanged(false); showRing(p); if (B.road) roadDirty = roadDirty || performance.now() + 150;
}
function drawStroke() {
  const pts = (stroke || []).map(p => P3(p.a, p.b, groundAt(B.ground, p.a, p.b) + 1.5));
  strokeLine.geometry.dispose(); strokeLine.geometry = new THREE.BufferGeometry().setFromPoints(pts); strokeLine.visible = pts.length > 1;
}
// a drawn road: sections from the stroke (relative to where the road starts); started at the open end of the road
// already there, it carries that on; ended near its start, it's a lap
function applyRoad(pts) {
  if (pts.length < 4) { status('That line was too short for a road: drag out a longer one.', true); return; }
  const rd = B.road, k = rd && rd.segs.length ? sketch(rd.segs, rd.heading, 2) : null, end = k ? { a: rd.start.a + k.end.a, b: rd.start.b + k.end.b } : null;
  const extend = k && k.gap > 0.6 && Math.hypot(pts[0].a - end.a, pts[0].b - end.b) < 30;
  const o = extend ? rd.start : { a: 0, b: 0 }, rel = pts.map(p => ({ a: p.a - o.a, b: p.b - o.b }));
  const r = fromStroke(rel, { tol: 4, closeDist: 40, from: extend ? { a: k.end.a, b: k.end.b, phi: k.end.phi, h: 0 } : null });
  if (!r || !r.segs.length) { status('Couldn\'t make a road from that line: try a smoother one.', true); return; }
  remember();
  if (extend) B.road = { ...rd, segs: rd.segs.concat(r.segs) };
  else B.road = { segs: r.segs, heading: r.heading, start: { a: r.start.a, b: r.start.b } };
  let msg = `${extend ? 'Carried the road on' : 'Laid a road'}: ${r.segs.length} sections.`;
  if (r.closed || (extend && Math.hypot(pts[pts.length - 1].a - rd.start.a, pts[pts.length - 1].b - rd.start.b) < 40)) {
    const c = closeLoop(B.road.segs, B.road.heading); if (c.ok) { B.road.segs = c.segs; msg += ' It closes: a lap. Test drive it!'; } else msg += ` Nearly a lap (${c.msg}).`;
  } else msg += ' End near the start (or press Close the loop) for a lap; drag from its end to carry on.';
  roadChanged(); save(); status(msg);
}
function closeRoad() {
  if (!B.road) { status('Draw a road first: pick Road and drag it out on the land.', true); return; }
  const c = closeLoop(B.road.segs, B.road.heading); if (c.ok) { remember(); B.road.segs = c.segs; roadChanged(); save(); } status(c.msg, !c.ok);
}

// ---------- status, driving, sending ----------
function status(msg, bad) {
  const el = $('tb-status'), rd = B.road, g = B.ground; let lo = Infinity, hi = -Infinity; for (const v of g.h) { lo = Math.min(lo, v); hi = Math.max(hi, v); }
  const land = `Ground ${Math.round(lo)} m to ${Math.round(hi)} m`;
  el.textContent = msg || (rd ? `${land} · road ${Math.round(rd.len || 0)} m, ${Math.round(rd.lo)} m to ${Math.round(rd.hi)} m high${rd.gap > 0.6 ? ` · open: its end is ${Math.round(rd.gap)} m from the start` : ' · a lap'}` : `${land} · shape the land, then pick Road and paint the track on it`);
  el.className = 'ed-status' + (bad || (!msg && rd && rd.gap > 0.6) ? ' bad' : '');
  $('tb-legend').textContent = `${HINT[B.tool]}${B.tool !== 'view' && B.tool !== 'road' ? ` · brush ${B.size} m, strength ${B.power}` : ''} · contours every 5 m`;
}
function stage() {
  const rd = B.road, look = STAGES[0];
  const st = { name: B.name, blurb: 'Made in the Terrain builder', type: 'gorge', laps: B.laps, seed: 1234, surface: B.surface, hillAmp: 0, armco: true,
    startHeading: rd.heading, segs: roadOnGround(rd.segs, rd.heading, B.ground, rd.start), ground: groundFor(B.ground, rd.start) };
  for (const k of ['light', 'colors', 'trees', 'rocks', 'bushes']) if (look[k]) st[k] = clone(look[k]);   // Summit Meadow's look for now
  return st;
}
function drive() {
  if (!B.road) { status('Paint a road first: pick Road and drag it out on the land.', true); return; }
  if (B.road.gap > 0.6) { status('The road has to make a lap before you can drive it: press Close the loop.', true); return; }
  const st = stage();
  try { buildTrack(st); } catch (err) { status(err.message, true); return; }
  if (EDIT_IDX < 0) { EDIT_IDX = STAGES.length; STAGES.push(st); } else STAGES[EDIT_IDX] = st;
  forgetTrack(EDIT_IDX); G.forceBuild = true; G.editDrive = true; G.onEditorBack = () => openTerrain(true);
  cancelAnimationFrame(raf); $('tb').hidden = true; startRace(EDIT_IDX);
}
async function send() {
  if (!B.road) { status('Paint a road first: pick Road and drag it out on the land.', true); return; }
  const msg = $('tb-msg').value.trim(), doc = { name: B.name, base: 'terrain', closes: B.road.gap < 0.6, stage: stage(), comments: [], notes: [], message: msg, at: new Date().toISOString(), status: 'sent' };
  if (!db) {
    const txt = JSON.stringify(doc);
    (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(() => status('Not connected to the shared database here: the track is copied, paste it to Claude.'), () => status('Not connected here: use the published game to send it.', true));
    return;
  }
  try { await db.collection('tracks').doc('t' + Date.now().toString(36)).set(doc); status(`Sent "${B.name}" to Claude${msg ? ' with your message' : ''}. Ask Claude to look at your track.`); $('tb-msg').value = ''; }
  catch (err) { status('Could not send it (' + (err.code || 'error') + '); try again in a moment.', true); }
}
