import * as THREE from 'three';
import { G } from '../game.js';
import { project, groundAt } from '../core/track/query.js';
import { dentAt, dentEdge, DENT } from '../core/features/dents.js';
import { HALF } from '../core/constants.js';
import { withCutaway } from './materials.js';
import { waterLevelAt } from './water.js';
import { scene } from './renderer.js';

// Craters (core/features/dents.js is their shape; features/weapons.js makes them): each one a bowl that follows the
// ground it's blown in, whatever its slope or camber (on a ramp too), a spray of thrown-out ground round it fading
// into the land, and chunks of whatever it was: broken tarmac, stones, sand, snow, mud, ice. What it looks like comes
// from where it is (kindAt): the stage's surface, a bog, a splash; sand where a loose road runs through sandy land;
// under water it's a darker hole you see through the water. The road and terrain meshes don't move, so the bowl is drawn
// pulled towards the camera along the line of sight by how far it sits below them: it lands on the same pixels and
// wins the depth test against the surface it's dug into, from any camera.
const C = (h) => new THREE.Color(h);
const sandy = h => { const c = C(h); return c.r > c.g && c.g > c.b && c.r - c.b > 0.25 && c.g < c.r * 0.86; };   // warm, orange-ish land: dunes, a desert
/** What crater k (or a blast at x, z near road sample i) is dug in: tarmac | gravel | sand | snow | mud | ice, and
 *  whether it's under water. */
export function kindAt(W, stage, x, z, i, surf) {
  const tr = W.tr, b = tr.bi(Math.max(0, Math.min(tr.N - 1, i)));
  let k = surf || ((tr.mud && tr.mud[b] === 1) ? 'mud' : tr.ice && tr.ice[b] ? 'ice' : tr.dirt && tr.dirt[b] ? 'gravel' : W.surf);
  if (k === 'splash') k = W.surf;
  if (k === 'gravel' && sandy(stage.colors.grassA)) k = 'sand';
  const lv = waterLevelAt(x, z), gy = tr.H[Math.max(0, Math.min(tr.N - 1, i))];
  return { kind: k, wet: lv !== null && lv > gy + 0.05, lv };
}
/** The road sample nearest (x, z): a search, for a blast that only knows where it is. */
export function nearestSample(tr, x, z) { let b = 0, bd = Infinity; for (let i = 0; i < tr.N; i += 2) { const d = (tr.xs[i] - x) ** 2 + (tr.zs[i] - z) ** 2; if (d < bd) { bd = d; b = i; } } return b; }
const surfaceY = (W, x, z, hint) => { const pr = project(W.tr, x, z, hint, 14, 14); return groundAt(W, pr.s, pr.lat, x, z); };
// the colours of each kind: floor (the bottom of the hole), wall, lip (thrown-out ground), chunks
function palette(kind, stage) {
  const col = stage.colors, dirt = C(col.dirt || 0x7A5A3A), road = C(col.road), land = C(col.grassA);
  const earth = dirt.clone().multiplyScalar(0.55);
  switch (kind) {
    case 'tarmac': return { floor: earth, wall: road.clone().multiplyScalar(0.75), lip: dirt.clone().lerp(road, 0.35).multiplyScalar(0.8), chunk: [road.clone().multiplyScalar(0.85), road.clone().multiplyScalar(0.6), dirt.clone().multiplyScalar(0.7)], slab: true };
    case 'sand': return { floor: land.clone().multiplyScalar(0.72), wall: land.clone().multiplyScalar(0.85), lip: land.clone().multiplyScalar(1.06), chunk: [land.clone().multiplyScalar(0.95)], fine: true };
    case 'snow': return { floor: earth.clone().lerp(C(0xD8E0EA), 0.25), wall: C(0xC8D2DE), lip: C(0xF4F8FF), chunk: [C(0xF4F8FF), C(0xDCE6F0)] };
    case 'ice': return { floor: C(0x6E8FA4), wall: C(0x9EC2D6), lip: C(0xE6F2FA), chunk: [C(0xD8ECF8), C(0xA8CCE0)], shard: true };
    case 'mud': return { floor: C(0x2E2014), wall: C(0x3E2C1A), lip: C(0x4A3622), chunk: [C(0x3A2A18), C(0x4E3A24)] };
    default: return { floor: earth, wall: road.clone().lerp(earth, 0.4), lip: road.clone().lerp(dirt, 0.4), chunk: [road.clone().multiplyScalar(0.8), C(0x8A8580), dirt.clone().multiplyScalar(0.7)] };   // gravel
  }
}
// the materials: the pull (see above) on top of the shared world effects; the bowl opaque, the spray see-through at its fringe
function pulled(mat, key) {
  const base = mat.onBeforeCompile, bk = mat.customProgramCacheKey;
  mat.onBeforeCompile = sh => {
    base(sh);
    sh.vertexShader = 'attribute float pull;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
      {
        vec3 toCam = isOrthographic ? vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]) : normalize(cameraPosition - (modelMatrix * vec4(transformed, 1.0)).xyz);
        transformed += toCam * pull / max(toCam.y, 0.3);   // up the line of sight to the surface it's dug in: same pixels, nearer
      }`);
  };
  mat.customProgramCacheKey = () => bk.call(mat) + key;
  return mat;
}
let mats = null, sprayTex = null;
function materials() {
  if (mats) return mats;
  sprayTex = (() => {   // the thrown-out ground: solid by the lip, streaks and specks out past it, nothing at the edge
    const N = 256, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), c = N / 2, r0 = 0.9 / 2.6;
    const gr = g.createRadialGradient(c, c, c * r0, c, c, c * 0.8); gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, N, N); g.strokeStyle = 'rgba(255,255,255,0.55)'; g.lineCap = 'round';
    for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2 + Math.sin(k * 5.3) * 0.2, l = c * (0.55 + 0.4 * Math.abs(Math.sin(k * 2.7))); g.lineWidth = 2 + 4 * Math.abs(Math.sin(k * 1.3)); g.beginPath(); g.moveTo(c + Math.cos(a) * c * r0, c + Math.sin(a) * c * r0); g.lineTo(c + Math.cos(a) * l, c + Math.sin(a) * l); g.stroke(); }
    for (let k = 0; k < 140; k++) { const a = Math.random() * Math.PI * 2, d = c * (r0 + Math.random() * 0.6), s = 1 + Math.random() * 3; g.fillStyle = `rgba(255,255,255,${0.4 + Math.random() * 0.5})`; g.fillRect(c + Math.cos(a) * d, c + Math.sin(a) * d, s, s); }
    const t = new THREE.CanvasTexture(cv); return t;
  })();
  const bowl = pulled(withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), false, { cut: false, cloud: true, grain: 0.12 }), 'crater');
  const spray = pulled(withCutaway(new THREE.MeshLambertMaterial({ vertexColors: true, map: sprayTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), false, { cut: false, cloud: true }), 'spray');
  const chunk = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  return (mats = { bowl, spray, chunk });
}
const vis = new Map();
let raceOf = null;
function geo(pos, col, pull, idx, uv) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  if (pull) g.setAttribute('pull', new THREE.Float32BufferAttribute(pull, 1)); if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); if (idx) g.setIndex(idx); g.computeVertexNormals(); return g;
}
// a polar grid over the crater from u0 to u1 (x its radius along its ragged edge): rings x segs vertices, y on the ground
function polar(W, k, hint, u0, u1, rings, segs, each) {
  const pos = [], col = [], pull = [], uv = [], idx = [], span = k.r * 2.6;
  for (let q = 0; q <= rings; q++) for (let j = 0; j < segs; j++) {
    const u = u0 + (u1 - u0) * q / rings, a = j / segs * Math.PI * 2, rr = k.r * dentEdge(k, a) * u, x = k.x + Math.cos(a) * rr, z = k.z + Math.sin(a) * rr;
    const y = surfaceY(W, x, z, hint), dn = dentAt(W.dents, x, z);
    pos.push(x, y, z); pull.push(Math.max(0, -dn) + 0.03); uv.push(0.5 + (x - k.x) / span / 2, 0.5 + (z - k.z) / span / 2);
    const c = each(u, a, x, z, y); col.push(c.r, c.g, c.b);
  }
  for (let q = 0; q < rings; q++) for (let j = 0; j < segs; j++) { const a = q * segs + j, b = q * segs + (j + 1) % segs; idx.push(a, b, a + segs, b, b + segs, a + segs); }
  return geo(pos, col, pull, idx, uv);
}
const _c = new THREE.Color(), SOOT = C(0x1E1A16), WATER = C(0x2A4656);
function build(W, stage, k) {
  const M = materials(), hint = Math.round(k.s), K = kindAt(W, stage, k.x, k.z, hint, k.surf), P = palette(K.kind, stage);
  let seed = k.id * 9301 + 49297; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const soot = K.wet || K.kind === 'mud' ? 0 : K.kind === 'snow' || K.kind === 'ice' ? 0.3 : 0.75;   // blackened by the blast (a little on snow), not under water
  const shade = (c, u, x, z, y) => {                                     // a little mottle, the soot, and darker under water
    c.multiplyScalar(0.88 + 0.24 * Math.abs(Math.sin(x * 3.1 + z * 2.3) * Math.sin(z * 1.7 - x * 0.9)));
    if (soot) c.lerp(SOOT, soot * Math.max(0, 1 - u / 1.25) ** 1.5);
    if (K.wet && K.lv !== null) c.lerp(WATER, Math.min(0.7, Math.max(0, (K.lv - y) * 0.6)));
    return c;
  };
  const bowl = polar(W, k, hint, 0, DENT.LIP_AT + DENT.LIP_W, 12, 40, (u, a, x, z, y) => {
    const c = u < 0.55 ? _c.copy(P.floor) : u < 0.95 ? _c.copy(P.floor).lerp(P.wall, (u - 0.55) / 0.4) : _c.copy(P.wall).lerp(P.lip, Math.min(1, (u - 0.95) / 0.2));
    return shade(c, u, x, z, y);
  });
  const spray = polar(W, k, hint, 0.9, 2.6, 8, 40, (u, a, x, z, y) => shade(_c.copy(P.lip), u * 0.9, x, z, y));
  const out = [new THREE.Mesh(bowl, M.bowl), new THREE.Mesh(spray, M.spray)];
  out[0].renderOrder = 2; out[0].receiveShadow = true; out[1].renderOrder = K.wet ? 0 : 3;   // under water the spray goes down before the water does
  // the chunks thrown out round it
  if (!P.fine || rnd() < 0.5) {
    const parts = [], n = P.fine ? 5 : 9 + Math.round(k.r * 2);
    for (let q = 0; q < n; q++) {
      const a = rnd() * Math.PI * 2, u = 1.0 + rnd() * (P.fine ? 0.4 : 1.1), rr = k.r * dentEdge(k, a) * u, x = k.x + Math.cos(a) * rr, z = k.z + Math.sin(a) * rr, s = (0.1 + rnd() * 0.22) * Math.min(1.4, k.r / 2.6);
      const g = P.slab && q % 3 ? new THREE.BoxGeometry(s * 2.2, s * 0.5, s * 1.6) : P.shard ? new THREE.TetrahedronGeometry(s * 1.2, 0) : new THREE.DodecahedronGeometry(s, 0);
      g.rotateY(rnd() * 6.3); g.rotateX((rnd() - 0.5) * 0.8); g.translate(x, surfaceY(W, x, z, hint) + s * 0.25, z);
      const c = P.chunk[q % P.chunk.length], cs = []; for (let v = 0; v < g.attributes.position.count; v++) cs.push(c.r, c.g, c.b);
      g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3)); parts.push(g.index ? g.toNonIndexed() : g);
    }
    const pos = [], col = []; for (const g of parts) { pos.push(...g.attributes.position.array); col.push(...g.attributes.color.array); g.dispose(); }
    const m = new THREE.Mesh(geo(pos, col), M.chunk); m.castShadow = true; m.receiveShadow = true; out.push(m);
  }
  for (const m of out) scene.add(m);
  return out;
}
function drop(id) { for (const m of vis.get(id)) { scene.remove(m); m.geometry.dispose(); } vis.delete(id); }
/** Keep the drawn craters in step with the race's (features/weapons.js R.wpn.craters). */
export function syncCraters(R) {
  const W = G.world && G.world.W, list = (R && R.wpn && R.wpn.craters) || [];
  if (R !== raceOf || !W) { for (const id of [...vis.keys()]) drop(id); raceOf = R; }
  if (!W || !W.dents) return;
  const live = new Set(list.map(k => k.id));
  for (const id of [...vis.keys()]) if (!live.has(id)) drop(id);
  for (const k of list) if (!vis.has(k.id)) vis.set(k.id, build(W, G.world.stage, k));
}
/** A crater's look for a blast at (x, y, z) (render/weapons.js mortarBlast): its kind, and whether it's in water. */
export function blastKind(x, z) {
  const W = G.world && G.world.W; if (!W) return { kind: 'gravel', wet: false };
  const i = nearestSample(W.tr, x, z), pr = project(W.tr, x, z, i, 6, 6);
  return Math.abs(pr.lat) < HALF + 2 ? kindAt(W, G.world.stage, x, z, i) : { ...kindAt(W, G.world.stage, x, z, i), kind: sandy(G.world.stage.colors.grassA) ? 'sand' : W.surf === 'snow' ? 'snow' : 'gravel' };
}
export { palette as craterPalette, surfaceY, pulled };
