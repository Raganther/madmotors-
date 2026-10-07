import * as THREE from 'three';
import { HALF, WALL } from '../../core/constants.js';
import { TAU, mulberry32 } from '../../core/math.js';
import { arenaOut } from '../../core/elements/arena.js';
import { _c, addInstanced, flat, mergeAll } from '../geometry.js';
import { withCutaway } from '../materials.js';
import { quality } from '../renderer.js';

// Dressing (looks only): the small stuff that stops the land looking like flat planes and the roadside looking bare.
//   cover      grass tufts, flowers and pebbles scattered over the ground either side of the road (dry tufts on dirt and
//              desert stages, stones and nothing green on snow and salt), in the stage's own colours
//   furniture  what a race circuit has beyond the run-off: advertising boards, marshal posts with a flag, tyre stacks,
//              cones and oil drums (hay bales and drums on dirt), spaced along both sides, facing the road
// Placed from the stage's seed, never seen by the simulation (cars don't hit any of it, so it stays behind the barriers
// and off open country), all instanced: a handful of draw calls. Graphics: Low places a third as much cover.
const COVER = { BAND: 48, STEP: 1.6, PER: 3 }, FURN = { EVERY: 30, JIT: 12 };
const BOARD = [0xE0402F, 0x2F7DE0, 0xFFC72C, 0x2FB36B, 0xF4F4F0, 0x1C2340, 0xF28C28, 0x7A3FD1];
// a tuft: three crossed blades, darker at the root (vertex colours), so it reads as a clump from above
function tuftGeo() {
  const blade = a => { const g = new THREE.PlaneGeometry(0.5, 0.55, 1, 1).translate(0, 0.27, 0); g.rotateX(-0.5); g.rotateY(a);   /* splayed out, so they show from the camera above */ const p = g.attributes.position, c = []; for (let k = 0; k < p.count; k++) { const t = 0.82 + 0.3 * Math.min(1, p.getY(k) / 0.5); c.push(t, t, t); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; };
  const g = mergeAll([blade(0), blade(TAU / 3), blade(2 * TAU / 3)]), n = g.attributes.normal;
  for (let k = 0; k < n.count; k++) n.setXYZ(k, 0, 1, 0);   // lit like the ground they grow from, not like walls facing away from the sun
  return g;
}
const shade = (g, lo = 0.6) => { g.computeBoundingBox(); const b = g.boundingBox, p = g.attributes.position, c = []; for (let k = 0; k < p.count; k++) { const t = lo + (1 - lo) * (p.getY(k) - b.min.y) / Math.max(0.01, b.max.y - b.min.y); c.push(t, t, t); } g.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return g; };
export function addDressing(group, tr, terr, stage) {
  const rnd = mulberry32(stage.seed * 13 + 5), C = stage.colors, low = quality === 'low', N = tr.loopN || tr.N;
  const dry = stage.surface === 'gravel' && !/(Farm|Park|Green|Bogwood)/.test(stage.name), snow = stage.surface === 'snow', pale = (C.grassA >> 16 & 255) > 205 && (C.grassA >> 8 & 255) > 200;   // salt, sand
  const river = tr.river, wet = (x, z) => river && terr.at(x, z) < river.level + 0.25;
  const free = (x, z, d) => { const q = tr.nearest(x, z); return !q || q.d > d; };
  const openAt = i => tr.open && tr.open[tr.bi ? tr.bi(i) : i];
  const tufts = [], flowers = [], pebbles = [];
  const g0 = new THREE.Color(C.grassA), g1 = new THREE.Color(C.grassB);
  for (let i = 0; i < N; i += COVER.STEP) for (const side of [-1, 1]) for (let k = 0; k < (low ? 1 : COVER.PER); k++) {
    if (rnd() < 0.35) continue;
    const j = Math.floor(i), lat = side * (HALF + 2.5 + Math.pow(rnd(), 1.4) * COVER.BAND), along = (rnd() - 0.5) * 4;
    const x = tr.xs[j] + tr.rx[j] * lat + tr.tx[j] * along, z = tr.zs[j] + tr.rz[j] * lat + tr.tz[j] * along;
    if (!free(x, z, HALF + 1.8) || wet(x, z) || (tr.arena && arenaOut(tr.arena, x, z) < 1)) continue;
    const y = terr.at(x, z), r = rnd();
    if (snow || pale) { if (r < 0.35) pebbles.push({ x, y, z, ry: rnd() * TAU, sx: 0.5 + rnd() * 0.7, sy: 0.4 + rnd() * 0.5, sz: 0.5 + rnd() * 0.7, color: _c.set(C.rock).offsetHSL(0, 0, (rnd() - 0.5) * 0.12).getHex() }); continue; }
    if (r < 0.72) { _c.copy(g0).lerp(g1, rnd()).offsetHSL((rnd() - 0.5) * 0.04, dry ? -0.15 : 0.06, dry ? -0.02 + rnd() * 0.06 : -0.03 + rnd() * 0.1); if (dry) _c.lerp(new THREE.Color(0xA89060), 0.5); tufts.push({ x, y, z, ry: rnd() * TAU, sx: 1.1 + rnd() * 1.2, sy: 0.7 + rnd() * 0.9, sz: 1.1 + rnd() * 1.2, color: _c.getHex() }); }
    else if (r < 0.86 && !dry) flowers.push({ x, y: y + 0.05, z, ry: rnd() * TAU, sx: 1, sy: 1, sz: 1, color: [0xFFFFFF, 0xFFE14A, 0xF28CB8, 0xB58CF2, 0xFF7A4A][Math.floor(rnd() * 5)] });
    else pebbles.push({ x, y, z, ry: rnd() * TAU, sx: 0.3 + rnd() * 0.5, sy: 0.25 + rnd() * 0.35, sz: 0.3 + rnd() * 0.5, color: _c.set(C.rock).offsetHSL(0, 0, (rnd() - 0.5) * 0.15).getHex() });
  }
  // furniture, every ~46 m a side, behind the barrier (not on open country, not inside an arena, not where a town is)
  const boards = [], stripes = [], posts = [], huts = [], flags = [], tyres = [], cones = [], drums = [], bales = [];
  const towns = (tr.towns || []).map(t => { const a = tr.startIdx + Math.round(t.at); return [a - 20, a + t.len + 20]; }), lap = i => tr.loopN ? (i - tr.startIdx + tr.loopN * 4) % tr.loopN + tr.startIdx : i;
  const townAt = i => (tr.town && tr.town[i]) || towns.some(([a, b]) => lap(i) >= a && lap(i) <= b);
  for (let i0 = 20; i0 < N - 10; i0 += FURN.EVERY) for (const side of [-1, 1]) {
    const i = Math.min(N - 2, Math.max(0, Math.floor(i0 + (rnd() - 0.5) * FURN.JIT)));
    if (openAt(i) || townAt(i) || tr.tunnel[i] || tr.bridge[i] || rnd() < 0.25) continue;
    const lat = side * (WALL + 3.5 + rnd() * 3), x = tr.xs[i] + tr.rx[i] * lat, z = tr.zs[i] + tr.rz[i] * lat;
    if (!free(x, z, WALL + 1.5) || wet(x, z) || (tr.arena && arenaOut(tr.arena, x, z) < 4)) continue;
    const y = terr.at(x, z), face = Math.atan2(tr.xs[i] - x, tr.zs[i] - z), r = rnd(), tx = Math.cos(face), tz = -Math.sin(face);   // (tx, tz): along the road
    if (dry || stage.surface === 'gravel') {
      if (r < 0.5) for (let k = -1; k <= 1; k++) bales.push({ x: x + tx * k * 1.5, y: y + 0.45, z: z + tz * k * 1.5, ry: face, sx: 1.4, sy: 0.9, sz: 0.9, color: 0xE2C265 });
      else for (let k = 0; k < 3; k++) drums.push({ x: x + tx * (k - 1) * 0.9, y: y + 0.45, z: z + tz * (k - 1) * 0.9 + (k === 1 ? 0.5 : 0), ry: 0, color: [0xD7261E, 0x2F7DE0, 0x3E8E41][Math.floor(rnd() * 3)] });
    } else if (r < 0.5) {   // an advertising board on two posts
      const col = BOARD[Math.floor(rnd() * BOARD.length)];
      boards.push({ x, y: y + 1.3, z, ry: face, sx: 4.2, sy: 1.1, sz: 0.12, color: col });
      stripes.push({ x: x + Math.sin(face) * 0.07, y: y + 1.3, z: z + Math.cos(face) * 0.07, ry: face, sx: 2.6, sy: 0.32, sz: 0.04, color: col === 0xF4F4F0 ? 0x1C2340 : 0xF4F4F0 });
      for (const s of [-1, 1]) posts.push({ x: x + tx * s * 1.7, y: y + 0.6, z: z + tz * s * 1.7, ry: face, sx: 0.1, sy: 1.25, sz: 0.1, color: 0x3A3F4A });
    } else if (r < 0.7) {   // a marshal post: a little hut, a flag on a pole
      huts.push({ x, y: y + 0.9, z, ry: face, sx: 1.4, sy: 1.8, sz: 1.2, color: 0xF4F4F0 });
      posts.push({ x: x + tx * 1.0, y: y + 1.4, z: z + tz * 1.0, ry: face, sx: 0.06, sy: 2.8, sz: 0.06, color: 0x8D939C });
      flags.push({ x: x + tx * 1.35, y: y + 2.5, z: z + tz * 1.35, ry: face + Math.PI / 2, sx: 1, sy: 1, sz: 1, color: [0xFFC72C, 0x2FB36B, 0x2F7DE0][Math.floor(rnd() * 3)] });
    } else if (r < 0.88) for (let k = 0; k < 4; k++) for (let h = 0; h < 3; h++) tyres.push({ x: x + tx * (k - 1.5) * 0.85, y: y + 0.13 + h * 0.26, z: z + tz * (k - 1.5) * 0.85, ry: 0, color: h === 2 && k % 2 ? 0xF4F4F0 : 0x1E1E22 });
    else for (let k = 0; k < 5; k++) cones.push({ x: x + tx * (k - 2) * 1.6, y, z: z + tz * (k - 2) * 1.6, ry: 0, color: 0xF28C28 });
  }
  const LV = o => withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide }), false, Object.assign({ cloud: true }, o));
  const L = () => withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff }), false, { cloud: true });
  if (tufts.length) addInstanced(group, tuftGeo(), LV({ sway: 1.6 }), tufts, {});
  if (flowers.length) addInstanced(group, shade(new THREE.IcosahedronGeometry(0.11, 0), 0.8), LV(), flowers, {});
  if (pebbles.length) addInstanced(group, shade(flat(new THREE.DodecahedronGeometry(0.3, 0).scale(1, 0.55, 1))), LV(), pebbles, { receive: true });
  const box = () => flat(new THREE.BoxGeometry(1, 1, 1));
  if (boards.length) { addInstanced(group, box(), L(), boards, { cast: true }); addInstanced(group, box(), L(), stripes, {}); }
  if (posts.length) addInstanced(group, box(), L(), posts, { cast: true });
  if (huts.length) addInstanced(group, box(), L(), huts, { cast: true, receive: true });
  const pennant = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -0.5, 0), new THREE.Vector3(0.8, -0.25, 0)]); pennant.computeVertexNormals();
  if (flags.length) addInstanced(group, pennant, withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide }), false, { cloud: true, sway: 3 }), flags, {});
  if (tyres.length) addInstanced(group, flat(new THREE.CylinderGeometry(0.42, 0.42, 0.26, 12)), L(), tyres, { cast: true });
  if (cones.length) addInstanced(group, flat(new THREE.ConeGeometry(0.22, 0.6, 10).translate(0, 0.3, 0)), L(), cones, { cast: true });
  if (drums.length) addInstanced(group, flat(new THREE.CylinderGeometry(0.32, 0.32, 0.9, 12)), L(), drums, { cast: true });
  if (bales.length) addInstanced(group, box(), L(), bales, { cast: true, receive: true });
}
