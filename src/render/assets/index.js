import * as THREE from 'three';
import PACKS from '../../assets/gen/index.js';

// Assets: every visual thing can come from two providers, the Classic builders (code: render/carmodels.js,
// world/shapes.js, ...) and Blender (blender/ scripts, packed into src/assets/gen by `npm run assets`). The Models
// setting picks: Blender, Classic, or Auto (Blender unless Graphics is on Low). Code that builds a kind of asset asks
// blenderPack(id) and falls back to its Classic builder when it gets null. Behaviour (damage, animation, collisions)
// stays in code; a pack only brings shapes, named parts and anchors (its meta).
export const MODEL_MODES = ['auto', 'blender', 'classic'], MODEL_LABEL = { auto: 'Auto', blender: 'Blender', classic: 'Classic' };
export let modelMode = 'auto';
try { const m = localStorage.getItem('downhill-rush-models'); if (MODEL_MODES.includes(m)) modelMode = m; } catch (e) { }
export function setModelMode(m) { modelMode = m; try { localStorage.setItem('downhill-rush-models', m); } catch (e) { } }
// the Graphics setting, told us by render/renderer.js (this module stays free of the renderer, so the headless tests
// that build scenery can import it)
export let gfx = 'auto';
export function setGfx(q) { gfx = q; }
export const blenderOn = () => modelMode === 'blender' || (modelMode === 'auto' && gfx !== 'low');
/** The packed Blender asset `id` (e.g. 'car-coupe') if Blender assets are on and it exists, else null. force: ignore the setting. */
export const blenderPack = (id, force) => (force || blenderOn()) && PACKS[id] ? PACKS[id] : null;
export const packIds = () => Object.keys(PACKS);
export const packOf = id => PACKS[id] || null;

// ---- decoding: positions int16 (1/q m: pack.q, 8000 unless the pack says), normals int8, indices uint16, optional vertex colours uint8, base64 ----
const cache = new Map();
const bytes = s => Uint8Array.from(atob(s), c => c.charCodeAt(0)).buffer;
function geometry(p, q = 8000) {
  const P = new Int16Array(bytes(p.pos)), N = new Int8Array(bytes(p.nor)), I = new Uint16Array(bytes(p.idx));
  const pos = Float32Array.from(P, v => v / q), nor = Float32Array.from(N, v => v / 127), uv = new Float32Array(pos.length / 3 * 2);
  for (let k = 0; k < pos.length / 3; k++) { uv[k * 2] = pos[k * 3] * 0.4 + 0.5; uv[k * 2 + 1] = pos[k * 3 + 2] * 0.28 + 0.5; }   // planar, for the fine surface textures
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)); g.setIndex(new THREE.BufferAttribute(I, 1));
  if (p.col) g.setAttribute('color', new THREE.BufferAttribute(Float32Array.from(new Uint8Array(bytes(p.col)), v => v / 255), 3));
  return g;
}
/** A pack's geometries: { hi: { [part]: { [material]: geometry } }, lo: {...} (falls back to hi), at: { [part]: pivot } }.
 *  Each part's vertices are relative to its pivot. Decoded once. */
export function decodePack(pack) {
  if (cache.has(pack)) return cache.get(pack);
  const lvl = parts => { const o = {}; for (const p of parts || []) (o[p.name] = o[p.name] || {})[p.mat] = geometry(p, pack.q); return o; }, at = {};
  for (const p of pack.hi) at[p.name] = p.at || [0, 0, 0];
  const out = { hi: lvl(pack.hi), lo: pack.lo ? lvl(pack.lo) : null, at, meta: pack.meta || {} }; out.lo = out.lo || out.hi;
  cache.set(pack, out); return out;
}
/** Triangles in a pack level (for the Asset Lab). */
export const packTris = (pack, lvl = 'hi') => (pack[lvl] || []).reduce((a, p) => a + atob(p.idx).length / 6, 0);
