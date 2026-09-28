import * as THREE from 'three';
import { G } from '../../game.js';
import { mudRuns } from '../../core/elements/mud.js';
import { WEAR } from '../../core/features/wear.js';
import { HALF } from '../../core/constants.js';
import { canvasTex, flat } from '../geometry.js';
import { withCutaway } from '../materials.js';
import { race } from '../../ui/flow.js';

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
// Ripples: a car in the water (a splash or a puddle) leaves rings spreading out from its wheels, fading as they grow.
// A small pool of flat rings, recycled; spawned from each car's wheels every few metres it travels in the water.
const RIP = 28, RIP_LIFE = 1.3;
let rips = [], ripK = 0, pools = [], wet = new Map(), wtr = null;
function makeRipples(group) {
  const mat = () => new THREE.MeshBasicMaterial({ color: 0xE8F4FF, transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
  rips = Array.from({ length: RIP }, () => { const m = new THREE.Mesh(new THREE.RingGeometry(0.82, 1, 32).rotateX(-Math.PI / 2), mat()); m.visible = false; m.renderOrder = 2; group.add(m); return { m, t: RIP_LIFE, size: 1 }; });
}
function addRipple(x, y, z, size) { const r = rips[ripK]; ripK = (ripK + 1) % RIP; r.m.position.set(x, y, z); r.t = 0; r.size = size; r.m.visible = true; }
/** The water surface under (x, z), or null: a water splash on the road, or a puddle. */
function waterAt(c) {
  if (c.surface === 'ford') return wtr.H[c.pr.i] + 0.42;
  for (const p of pools) if (Math.abs(c.x - p.x) < p.r && Math.abs(c.z - p.z) < p.r && Math.hypot(c.x - p.x, c.z - p.z) < p.r) return p.y + 0.02;
  return null;
}
export function updateMud(dt) {
  if (ripple) ripple.offset.x -= dt * 0.12;
  for (const r of rips) { if (r.t >= RIP_LIFE) continue; r.t += dt; const k = Math.min(1, r.t / RIP_LIFE), e = 1 - Math.pow(1 - k, 2.2); r.m.scale.setScalar(0.3 + e * r.size); r.m.material.opacity = 0.45 * (1 - k) * (1 - k); if (k >= 1) r.m.visible = false; }
  if (rips.length && race && wtr) for (const c of race.cars.concat(race.traffic || [])) {
    const sp = Math.hypot(c.vx, c.vz); if (!c.onGround || sp < 1.5) continue;
    const y = waterAt(c); if (y === null) { wet.delete(c); continue; }
    const acc = (wet.get(c) || 0) + sp * dt; if (acc < 2.2) { wet.set(c, acc); continue; }
    wet.set(c, 0);
    const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), size = 2 + Math.min(3.5, sp * 0.12);
    for (const s of [-1, 1]) addRipple(c.x - fx * 0.9 - fz * 0.95 * s, y, c.z - fz * 0.9 + fx * 0.95 * s, size);
  }
  const W = G.world && G.world.W; if (!bogs.length || !W || !W.wear || (redraw -= dt) > 0) return;
  redraw = 0.15; if (W.wear.ver === seen) return;
  seen = W.wear.ver; for (const b of bogs) paintBog(b, W.wear.g);
}
/** A new race: fresh, unrutted bogs. */
export function newMudRace() { seen = -1; bogs.forEach(b => paintBog(b, null)); }
export function addMud(group, tr, terr, stage) {
  bogs = []; pools = []; rips = []; wtr = null; if (!tr.mud) return;
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
  // puddles: ragged pools lying on the road (each point at the road's height there, so none sinks half under a slope)
  // in the same moving water as the splashes, darker where it's deeper in the middle
  pools = []; wet = new Map(); wtr = tr; makeRipples(group);
  const ppos = [], puv = [], pcol = [], deep = new THREE.Color(0x2A4254), rim = new THREE.Color(0x56707E), K = 14;
  for (const p of puddles) {
    const [cx, , cz] = P(p.i, p.lat, 0), yc = tr.H[p.i] + 0.2, pt = k => {   // over the bog's churned surface (up to 0.19 m up)
      const a = k / K * Math.PI * 2, r = p.r * (0.72 + 0.4 * tr.noise.n2(p.i * 0.7 + Math.cos(a), p.lat + Math.sin(a) * 1.3)), al = Math.cos(a) * r * 1.6, lt = Math.sin(a) * r;
      const j = tr.nb0(p.i, Math.round(al)); return [cx + tr.tx[p.i] * al + tr.rx[p.i] * lt, tr.H[j] + 0.2, cz + tr.tz[p.i] * al + tr.rz[p.i] * lt];
    };
    for (let k = 0; k < K; k++) {
      const a = pt(k), b = pt(k + 1);
      ppos.push(cx, yc, cz, ...b, ...a); puv.push(cx / 8, cz / 8, b[0] / 8, b[2] / 8, a[0] / 8, a[2] / 8);
      pcol.push(deep.r, deep.g, deep.b, rim.r, rim.g, rim.b, rim.r, rim.g, rim.b);
    }
    pools.push({ x: cx, z: cz, y: yc, r: p.r * 1.35 });
  }
  if (ppos.length) {
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(ppos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(puv, 2)); g.setAttribute('color', new THREE.Float32BufferAttribute(pcol, 3)); g.computeVertexNormals();
    const m = new THREE.Mesh(g, withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true, map: rippleTex(), emissive: 0x0E1A24, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 }), false, { cut: false, cloud: true, water: true }));
    m.renderOrder = 1; group.add(m);
  }
  // water splashes: a sheet of water per run that follows the road 0.4 m above it (wheels in the water, the road bed
  // showing through), running wide over the low ground either side. Its edges aren't drawn: the sheet slips under the
  // ground and the road wherever they rise, so the banks make the shoreline, and past the ends of the splash it sinks
  // below the road along a wavy line rather than stopping square.
  const water = withCutaway(new THREE.MeshLambertMaterial({ color: 0x4F8DBA, map: rippleTex(), transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide }), false, { cut: false, cloud: true, water: true });
  const wob = (u, v) => Math.sin(u * 0.37 + v * 0.21) * 0.6 + Math.sin(u * 0.13 - v * 0.47 + 1.7) * 0.4;
  for (let k = 0; k < fords.length;) {
    let e = k; while (e + 1 < fords.length && fords[e + 1] === tr.nb0(fords[e], 1)) e++;
    const a = fords[k], n = e - k + 1, mid = fords[(k + e) >> 1], EXT = 9, OFF = [];
    for (let o = -22; o <= 22.01; o += 2.75) OFF.push(o);
    const pos = [], uv = [], idx = [], rowsN = n + 2 * EXT;
    for (let t = 0; t < rowsN; t++) {
      const i = tr.nb0(a, t - EXT), out = t < EXT ? EXT - t : t >= EXT + n ? t - EXT - n + 1 : 0;   // samples past the splash's ends
      OFF.forEach((o, c) => {
        const along = out ? Math.max(0, (out + 2.5 * wob(o, t)) / 5) : 0, side = Math.max(0, (Math.abs(o) - HALF - 5 - 5 * (wob(t, o) + 1)) / 4);
        const [x, , z] = P(i, o, 0); pos.push(x, tr.H[i] + 0.4 - 1.4 * Math.min(1, along + side), z); uv.push(o / 8, t / 8);
        if (t && c) { const q = t * OFF.length + c, p = q - OFF.length; idx.push(p - 1, q - 1, p, p, q - 1, q); }
      });
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, water); m.renderOrder = 1; group.add(m);
    const h = tr.H[mid] + 0.4;
    for (const s of [-1, 1]) for (let q = 0; q < 3; q++) {                          // stepping stones on the banks
      const [x, , z] = P(mid, s * (HALF + 3 + q * 2.4), 0), r = new THREE.Mesh(flat(new THREE.DodecahedronGeometry(0.7 + q * 0.2, 0)), new THREE.MeshLambertMaterial({ color: 0x8C877C }));
      r.position.set(x + (q - 1) * 1.3, Math.max(h - 0.2, terr.at(x, z)), z); r.castShadow = true; group.add(r);
    }
    k = e + 1;
  }
}
