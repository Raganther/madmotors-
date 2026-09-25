import * as THREE from 'three';
import { G } from '../../game.js';
import { mudRuns } from '../../core/elements/mud.js';
import { WEAR } from '../../core/features/wear.js';
import { HALF } from '../../core/constants.js';
import { canvasTex, flat } from '../geometry.js';
import { withCutaway } from '../materials.js';

// Mud visuals ('mud' element): bogs get a churned brown layer over the road with glossy puddles; a water splash gets
// a shallow stream running across the road (wheels in the water). The spray from the wheels is in effects/carfx.js.
// light streaks on the stream, scrolled across the road so it flows (updateMud)
let ripple = null;
function rippleTex() {
  if (ripple) return ripple;
  ripple = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#FFFFFF'; g.fillRect(0, 0, w, h);
    let s = 5; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let k = 0; k < 70; k++) { g.fillStyle = `rgba(200,225,240,${(0.3 + r() * 0.5).toFixed(2)})`; g.fillRect(r() * w, r() * h, 10 + r() * 30, 1 + r() * 2); }
  });
  ripple.wrapS = ripple.wrapT = THREE.RepeatWrapping; ripple.repeat.set(3, 1);
  return ripple;
}
// The bogs: a surface over the road redrawn from the race's wear grid (W.wear, core/features/wear.js) a few times a
// second: fresh mud mottled and lighter, churned ruts dark, wet and sunk in, the ridges between them catching the
// light. It reaches FADE m past each end of the bog and melts into the road there along a ragged edge, so the mud
// doesn't stop on a straight line.
const FRESH = [new THREE.Color(0x6E4E32), new THREE.Color(0x8C6A44)], RUTC = new THREE.Color(0x1A0F08), RIDGE = new THREE.Color(0xA07C52), FADE = 8, EDGE = 6.3;
let bogs = [], redraw = 0, seen = -1;
function bogMesh(group, tr, a, b, road) {
  const len = b - a, K0 = Math.ceil(WEAR.COLS / 2 - EDGE / WEAR.CELL), K1 = WEAR.COLS - K0, C = K1 - K0 + 1, R = len + 2 * FADE + 1;
  const pos = new Float32Array(R * C * 3), col = new Float32Array(pos.length), fresh = [], mix = [], idx = [], rows = [], base = [];
  for (let n = 0; n < R; n++) {
    const u = n - FADE, bb = tr.nb(a, u), i = tr.u0(bb); rows.push(i); base.push(bb);
    for (let k = K0; k <= K1; k++) {
      const o = (k - WEAR.COLS / 2) * WEAR.CELL, ns = tr.noise.n2(u * 0.23 + k * 0.2, 4.4), rag = tr.noise.n2(k * 0.35, u * 0.05 + 9.7);
      const ends = Math.min(u, len - u) + FADE * 0.55 + rag * 3, side = EDGE - Math.abs(o) + rag * 0.6;   // ragged: in from the ends and the edges
      mix.push(Math.min(1, Math.max(0, ends / (FADE * 0.7))) * Math.min(1, Math.max(0, side / 1.2)));
      fresh.push(FRESH[0].clone().lerp(FRESH[1], 0.5 + 0.5 * ns)); pos.set([tr.xs[i] + tr.rx[i] * o, tr.H[i] + 0.07, tr.zs[i] + tr.rz[i] * o], (n * C + k - K0) * 3);
    }
  }
  for (let n = 0; n < R - 1; n++) for (let k = 0; k < C - 1; k++) { const q = n * C + k; idx.push(q, q + C, q + 1, q + 1, q + C, q + C + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }), false, { cut: false, cloud: true }));
  m.receiveShadow = true; group.add(m);
  const bog = { tr, R, C, K0, rows, base, fresh, mix, road, g, pos, col };
  paintBog(bog, null); return bog;
}
function paintBog(B, grid) {
  const cell = (n, k) => grid && n >= 0 && n < B.R && k >= 0 && k < WEAR.COLS ? grid[B.base[n] * WEAR.COLS + k] : 0, c = new THREE.Color();
  for (let n = 0; n < B.R; n++) {
    const H = B.tr.H[B.rows[n]];
    for (let q = 0; q < B.C; q++) {
      const k = q + B.K0, v = (cell(n - 1, k - 1) + cell(n - 1, k) + cell(n, k - 1) + cell(n, k)) / 4, ridge = Math.max(0, Math.max(cell(n, k - 2), cell(n, k + 1)) - v) * (1 - v) * 1.5;
      const f = B.mix[n * B.C + q], p = n * B.C + q;
      c.copy(B.fresh[p]).lerp(RUTC, Math.min(1, v * 1.2)).lerp(RIDGE, Math.min(0.6, ridge)).lerp(B.road, 1 - f);
      B.col.set([c.r, c.g, c.b], p * 3); B.pos[p * 3 + 1] = H + 0.06 + f * (0.08 - 0.07 * v + 0.05 * ridge);   // sunk into ruts, always above the road; flush at the edges
    }
  }
  B.g.attributes.position.needsUpdate = true; B.g.attributes.color.needsUpdate = true; B.g.computeVertexNormals();
}
export function updateMud(dt) {
  if (ripple) ripple.offset.x -= dt * 0.12;
  const W = G.world && G.world.W; if (!bogs.length || !W || !W.wear || (redraw -= dt) > 0) return;
  redraw = 0.15; if (W.wear.ver === seen) return;
  seen = W.wear.ver; for (const b of bogs) paintBog(b, W.wear.g);
}
/** A new race: fresh, unrutted bogs. */
export function newMudRace() { seen = -1; bogs.forEach(b => paintBog(b, null)); }
export function addMud(group, tr, terr, stage) {
  bogs = []; if (!tr.mud) return;
  const P = (i, o, y) => [tr.xs[i] + tr.rx[i] * o, y, tr.zs[i] + tr.rz[i] * o];
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const puddles = [], fords = [];
  for (const i of tr.all0) {
    const m = tr.mud[tr.bi(i)]; if (!m) continue;
    if (m === 2) { if (tr.mud[tr.bi(tr.nb0(i, 1))] === 2) fords.push(i); continue; }
    if (rnd() < 0.1) puddles.push({ i, lat: (rnd() - 0.5) * 2 * (HALF - 1.5), r: 1 + rnd() * 1.6 });
  }
  const road = new THREE.Color(stage.colors.road);
  bogs = mudRuns(tr).map(([a, b]) => bogMesh(group, tr, a, b, road));
  const pm = new THREE.MeshLambertMaterial({ color: 0x33373A, emissive: 0x1C2630, polygonOffset: true, polygonOffsetFactor: -2 });   // dark water reflecting the sky
  for (const p of puddles) {
    const m = new THREE.Mesh(new THREE.CircleGeometry(p.r, 12).rotateX(-Math.PI / 2), pm), [x, y, z] = P(p.i, p.lat, tr.H[p.i] + 0.1);
    m.position.set(x, y, z); m.scale.set(1.6, 1, 1); m.rotation.y = tr.th[p.i] + Math.PI / 2; m.receiveShadow = true; group.add(m);
  }
  // water splashes: one sheet of water per run, crossing the road and out over the low ground either side
  const water = withCutaway(new THREE.MeshLambertMaterial({ color: 0x4F8DBA, map: rippleTex(), transparent: true, opacity: 0.88, depthWrite: false }), false, { cut: false, cloud: true, water: true });
  for (let k = 0; k < fords.length;) {
    let e = k; while (e + 1 < fords.length && fords[e + 1] === tr.nb0(fords[e], 1)) e++;
    const a = fords[k], b = fords[e], mid = fords[(k + e) >> 1], len = e - k + 8, h = Math.min(tr.H[a], tr.H[b], tr.H[mid]) + 0.35;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(30, len, 6, 4).rotateX(-Math.PI / 2), water);
    m.position.set(tr.xs[mid], h, tr.zs[mid]); m.rotation.y = tr.th[mid]; m.renderOrder = 1; group.add(m);
    for (const s of [-1, 1]) for (let q = 0; q < 3; q++) {                          // stepping stones on the banks
      const [x, , z] = P(mid, s * (HALF + 3 + q * 2.4), 0), r = new THREE.Mesh(flat(new THREE.DodecahedronGeometry(0.7 + q * 0.2, 0)), new THREE.MeshLambertMaterial({ color: 0x8C877C }));
      r.position.set(x + (q - 1) * 1.3, Math.max(h - 0.2, terr.at(x, z)), z); r.castShadow = true; group.add(r);
    }
    k = e + 1;
  }
}
