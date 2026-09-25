import * as THREE from 'three';
import { G } from '../../game.js';
import { RUT, mudRuns } from '../../core/elements/mud.js';
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
// The bogs: a surface of RUT.COLS x length cells over the road, redrawn from the race's rut grid (W.ruts) a few times
// a second: fresh mud mottled and lighter, churned ruts dark, wet and sunk in, the ridges between them catching the light.
const FRESH = [new THREE.Color(0x6E4E32), new THREE.Color(0x8C6A44)], RUTC = new THREE.Color(0x1A0F08), RIDGE = new THREE.Color(0xA07C52);
let bogs = [], redraw = 0;
function bogMesh(group, tr, a, b) {
  const len = b - a, C = RUT.COLS + 1, pos = new Float32Array((len + 1) * C * 3), col = new Float32Array(pos.length), fresh = [], idx = [], rows = [];
  for (let u = 0; u <= len; u++) {
    const i = tr.u0(tr.nb(a, u)); rows.push(i);
    for (let k = 0; k < C; k++) { const o = (k - RUT.COLS / 2) * RUT.CELL; fresh.push(FRESH[0].clone().lerp(FRESH[1], 0.5 + 0.5 * tr.noise.n2(u * 0.23 + k * 0.2, 4.4))); pos.set([tr.xs[i] + tr.rx[i] * o, tr.H[i] + 0.07, tr.zs[i] + tr.rz[i] * o], (u * C + k) * 3); }
  }
  for (let u = 0; u < len; u++) for (let k = 0; k < C - 1; k++) { const q = u * C + k; idx.push(q, q + C, q + 1, q + 1, q + C, q + C + 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setIndex(idx);
  const m = new THREE.Mesh(g, withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -1 }), false, { cut: false, cloud: true }));
  m.receiveShadow = true; group.add(m);
  const bog = { tr, len, rows, fresh, g, pos, col };
  paintBog(bog, null); return bog;
}
function paintBog(B, grid) {
  const C = RUT.COLS + 1, cell = (u, k) => grid && u >= 0 && u < B.len && k >= 0 && k < RUT.COLS ? grid[u * RUT.COLS + k] : 0, c = new THREE.Color();
  for (let u = 0; u <= B.len; u++) {
    const i = B.rows[u], H = B.tr.H[i];
    for (let k = 0; k < C; k++) {
      const v = (cell(u - 1, k - 1) + cell(u - 1, k) + cell(u, k - 1) + cell(u, k)) / 4, ridge = Math.max(0, Math.max(cell(u, k - 2), cell(u, k + 1)) - v) * (1 - v) * 1.5;
      c.copy(B.fresh[u * C + k]).lerp(RUTC, Math.min(1, v * 1.2)).lerp(RIDGE, Math.min(0.6, ridge));
      B.col.set([c.r, c.g, c.b], (u * C + k) * 3); B.pos[(u * C + k) * 3 + 1] = H + 0.14 - 0.07 * v + 0.05 * ridge;   // sunk into ruts, but always above the road under it
    }
  }
  B.g.attributes.position.needsUpdate = true; B.g.attributes.color.needsUpdate = true; B.g.computeVertexNormals();
}
export function updateMud(dt) {
  if (ripple) ripple.offset.x -= dt * 0.12;
  const W = G.world && G.world.W; if (!bogs.length || !W || !W.ruts || (redraw -= dt) > 0) return;
  redraw = 0.15;
  W.ruts.forEach((r, n) => { if (r.dirty && bogs[n]) { r.dirty = false; paintBog(bogs[n], r.g); } });
}
/** A new race: fresh, unrutted bogs. */
export function newMudRace() { bogs.forEach(b => paintBog(b, null)); }
export function addMud(group, tr, terr) {
  bogs = []; if (!tr.mud) return;
  const P = (i, o, y) => [tr.xs[i] + tr.rx[i] * o, y, tr.zs[i] + tr.rz[i] * o];
  let seed = 3; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const puddles = [], fords = [];
  for (const i of tr.all0) {
    const m = tr.mud[tr.bi(i)]; if (!m) continue;
    if (m === 2) { if (tr.mud[tr.bi(tr.nb0(i, 1))] === 2) fords.push(i); continue; }
    if (rnd() < 0.1) puddles.push({ i, lat: (rnd() - 0.5) * 2 * (HALF - 1.5), r: 1 + rnd() * 1.6 });
  }
  bogs = mudRuns(tr).map(([a, b]) => bogMesh(group, tr, a, b));
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
