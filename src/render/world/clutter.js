import * as THREE from 'three';
import { G } from '../../game.js';
import { HALF } from '../../core/constants.js';
import { withCutaway } from '../materials.js';
import { quality } from '../renderer.js';
import { camT } from '../camera.js';
import { groundColAt } from './terrain.js';
import { groundDetail } from '../detail.js';
import { waterLevelAt } from '../water.js';
import { paintAt, streetAt } from '../../core/track/edits.js';

// Ground clutter round the camera (looks only): grass tufts, the odd flower and pebbles, on the
// ground off the road within REACH m of where the camera looks, tinted from the ground under them (terrain.js
// groundColAt). Laid out per CELL m square from a hash of the cell, so the same patch always has the same tufts and
// nothing flickers as the camera moves; they shrink away towards the edge instead of popping. Only when it's close
// enough to see them (the close zooms, the cameras behind the car), never on Graphics: Low. Snow has no grass, sand
// a few dry tufts.
const CELL = 6, REACH = 40, MAX = { tuft: 5200, flower: 700, pebble: 1400 };
const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(), _c = new THREE.Color(), _g = new THREE.Color();
let meshes = null, last = null, kind = 'grass', terr = null, rock = new THREE.Color(), paint = null, streets = null;
const hash = (a, b, k) => { const v = Math.sin(a * 127.1 + b * 311.7 + k * 74.7) * 43758.5453; return v - Math.floor(v); };
function tuftGeo() {   // five blades in a fan, dark at the root, light at the tip
  const pos = [], col = [];
  for (let k = 0; k < 5; k++) {
    const a = k / 5 * Math.PI * 2 + 0.4, lean = 0.12 + (k % 2) * 0.08, h = 0.28 + (k % 3) * 0.07, w = 0.035;
    const bx = Math.cos(a) * 0.04, bz = Math.sin(a) * 0.04, tx = Math.cos(a) * lean, tz = Math.sin(a) * lean, px = -Math.sin(a) * w, pz = Math.cos(a) * w;
    pos.push(bx - px, 0, bz - pz, bx + px, 0, bz + pz, tx, h, tz); col.push(0.8, 0.8, 0.8, 0.8, 0.8, 0.8, 1.25, 1.25, 1.25);
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((v, i) => i % 3 === 1 ? 1 : 0), 3));   // lit like the ground under them
  return g;
}
function flowerGeo() {   // a stem and a little star of petals
  const pos = [0, 0, 0.012, 0, 0.22, 0, 0, 0, -0.012], col = [0.35, 0.6, 0.3, 0.35, 0.6, 0.3, 0.35, 0.6, 0.3];
  for (let k = 0; k < 5; k++) { const a = k / 5 * Math.PI * 2, b = a + 0.6; pos.push(0, 0.23, 0, Math.cos(a) * 0.07, 0.24, Math.sin(a) * 0.07, Math.cos(b) * 0.07, 0.24, Math.sin(b) * 0.07); col.push(1.2, 1.2, 0.6, 1, 1, 1, 1, 1, 1); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((v, i) => i % 3 === 1 ? 1 : 0), 3)); return g;
}
function make(group) {
  const inst = (geo, mat, n, sh) => { const m = new THREE.InstancedMesh(geo, mat, n); m.count = 0; m.frustumCulled = false; m.receiveShadow = true; m.castShadow = sh; group.add(m); return m; };
  // both sides of a blade lit as its front (a back face would be lit as if it faced the ground: black flecks)
  const soft = () => { const m = withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }), false, { cut: false, cloud: true }), base = m.onBeforeCompile;
    m.onBeforeCompile = sh => { base(sh); sh.fragmentShader = sh.fragmentShader.replace('( gl_FrontFacing ) ? vIndirectFront : vIndirectBack', 'vIndirectFront').replace('( gl_FrontFacing ) ? vLightFront : vLightBack', 'vLightFront'); }; const key = m.customProgramCacheKey; m.customProgramCacheKey = () => key() + 'front'; return m; };
  const peb = new THREE.DodecahedronGeometry(0.09, 0); peb.scale(1, 0.55, 1);
  meshes = { tuft: inst(tuftGeo(), soft(), MAX.tuft, false), flower: inst(flowerGeo(), soft(), MAX.flower, false), pebble: inst(peb, withCutaway(new THREE.MeshLambertMaterial({ color: 0xffffff }), false, { cut: false, cloud: true }), MAX.pebble, true) };
}
/** A new world: its clutter (render/elements build). */
export function addClutter(group, tr, t, stage) {
  meshes = null; last = null; cells.clear(); terr = t; kind = groundDetail(stage); rock.set(stage.colors.rock || 0x8E8C84); paint = (stage.edits && stage.edits.paint) || null; streets = tr.streets || null;
  make(group);
}
const roadDist = (x, z) => { const c = Math.round((x - terr.x0) / terr.S), r = Math.round((z - terr.z0) / terr.S); return c < 0 || r < 0 || c >= terr.cols || r >= terr.rows ? 1e9 : terr.dist[r * terr.cols + c]; };
function slopeAt(x, z) { const a = terr.at(x + 0.8, z) - terr.at(x - 0.8, z), b = terr.at(x, z + 0.8) - terr.at(x, z - 0.8); return Math.hypot(a, b) / 1.6; }
// what stands in one CELL m square: worked out once (the ground's height, slope, the road, water, its colour) and kept,
// so moving the camera only gathers cells already known: [what, x, y, z, h, r, g, b] per item
const cells = new Map(), PER = { grass: { tuft: 26, flower: 3, pebble: 4 }, sand: { tuft: 5, flower: 0, pebble: 6 }, snow: { tuft: 0, flower: 0, pebble: 4 } };
function cellOf(a, b) {
  const key = a * 100003 + b; let L = cells.get(key); if (L) return L; L = [];
  const per = PER[kind] || PER.grass;
  for (const what of ['tuft', 'flower', 'pebble']) for (let k = 0; k < per[what]; k++) {
    const x = (a + hash(a, b, k * 3 + what.length)) * CELL, z = (b + hash(b, a, k * 7 + what.length)) * CELL;
    if (roadDist(x, z) < HALF + 1.2 || slopeAt(x, z) > 0.9) continue;
    const y = terr.at(x, z), lv = waterLevelAt(x, z); if (lv !== null && lv > y - 0.02) continue;
    if (streets && streetAt(streets, x, z)) continue;   // nothing growing on the Studio's streets
    const pk = paint && what !== 'pebble' ? paintAt(paint, x, z) : null; if (pk && pk !== 'meadow' && pk !== 'forest' && !(pk === 'tundra' && hash(a, b, k + 5) < 0.3)) continue;   // no grass on painted snow, sand, rock or mud (core/track/edits.js)
    const h = hash(a + k, b - k, 9);
    if (what === 'flower') _c.setHSL([0.13, 0.0, 0.75, 0.95][(h * 4) | 0], 0.75, (h * 4 | 0) === 1 ? 0.95 : 0.65);
    else if (what === 'pebble') _c.copy(rock).multiplyScalar(0.75 + 0.5 * hash(a, k, b));
    else { if (!groundColAt(x, z, _g)) _g.set(0x6E9E4B); _c.copy(_g).multiplyScalar(kind === 'sand' ? 1.1 : 0.95 + 0.25 * h); }
    L.push([what, x, y, z, h, _c.r, _c.g, _c.b]);
  }
  if (cells.size > 4000) cells.clear();   // (a long stage: forget the far cells now and then)
  cells.set(key, L); return L;
}
/** Each frame: lay out the clutter round where the camera looks (only when it has moved a couple of metres). */
export function updateClutter() {
  if (!meshes) return;
  const close = G.persp || G.camZoom === 'close' || G.camZoom === 'near', on = quality !== 'low' && close && G.state !== 'menu' && !!terr;
  for (const m of Object.values(meshes)) m.visible = on; if (!on) { last = null; return; }
  let cx = camT.x, cz = camT.z;
  if (G.persp && G.camDir) { cx -= G.camDir[0] * 22; cz -= G.camDir[2] * 22; }       // behind the car: most of what's seen is up the road
  if (last && Math.hypot(cx - last.x, cz - last.z) < 2.5) return; last = { x: cx, z: cz };
  const n = { tuft: 0, flower: 0, pebble: 0 }, c0 = Math.floor((cx - REACH) / CELL), c1 = Math.floor((cx + REACH) / CELL), r0 = Math.floor((cz - REACH) / CELL), r1 = Math.floor((cz + REACH) / CELL);
  for (let a = c0; a <= c1; a++) for (let b = r0; b <= r1; b++) {
    for (const [what, x, y, z, h, cr, cg, cb] of cellOf(a, b)) {
      const d = Math.hypot(x - cx, z - cz); if (d > REACH || n[what] >= MAX[what]) continue;
      const sc = (0.7 + 0.6 * h) * Math.min(1, (REACH - d) / 10) * (what === 'pebble' ? 0.8 + h * 1.6 : 1); if (sc < 0.05) continue;   // shrinking away towards the edge
      _q.setFromEuler(_e.set(what === 'pebble' ? h * 0.5 : 0, h * 6.28, 0)); _m.compose(_p.set(x, y - (what === 'pebble' ? 0.02 : 0.01), z), _q, _s.set(sc, sc * (what === 'tuft' ? 0.8 + h * 0.6 : 1), sc));
      const m = meshes[what], j = n[what]++; m.setMatrixAt(j, _m); m.setColorAt(j, _c.setRGB(cr, cg, cb));
    }
  }
  for (const [what, m] of Object.entries(meshes)) { m.count = n[what]; m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true; }
}
