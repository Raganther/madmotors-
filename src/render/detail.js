import * as THREE from 'three';
import { mulberry32 } from '../core/math.js';

// Close-up surface detail (materials.js withCutaway `detail`): tileable grey textures made here in code, one per kind of
// surface, that the ground and road shaders lay over their colours in world space. Mid-grey on average, so they only
// shade the colour up and down (and the mipmaps fade them to nothing far off: the overhead view stays clean), and read
// as a height too, so the lit-per-pixel surfaces catch the light on the grains. Nothing to download.
//   asphalt  fine aggregate: light and dark grains, a hint of larger mottle, the odd hairline crack
//   gravel   loose stones, each lit from the top
//   grass    short blades and soil specks
//   snow     soft drifts with the odd glint
//   sand     wind ripples, wavering
const N = 256, cache = new Map();
function canvas(draw) {
  const cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d');
  g.fillStyle = '#808080'; g.fillRect(0, 0, N, N);
  // everything drawn 9 times, offset by the tile, so it wraps without a seam
  const wrap = f => { for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) { g.save(); g.translate(ox, oy); f(g); g.restore(); } };
  draw(g, wrap);
  const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; return t;
}
const grey = (v, a = 1) => `rgba(${v | 0},${v | 0},${v | 0},${a})`;
const KINDS = {
  asphalt: (g, wrap, r) => {
    for (let k = 0; k < 40; k++) { const x = r() * N, y = r() * N, s = 20 + r() * 40, v = 120 + r() * 18; wrap(c => { const gr = c.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, grey(v, 0.35)); gr.addColorStop(1, grey(v, 0)); c.fillStyle = gr; c.fillRect(x - s, y - s, 2 * s, 2 * s); }); }
    for (let k = 0; k < 2600; k++) { const x = r() * N, y = r() * N, s = 0.6 + r() * 1.8, v = r() < 0.5 ? 70 + r() * 30 : 160 + r() * 60; wrap(c => { c.fillStyle = grey(v, 0.8); c.fillRect(x, y, s, s); }); }
    for (let k = 0; k < 3; k++) { let x = r() * N, y = r() * N, a = r() * 6.3; const pts = []; for (let q = 0; q < 14; q++) { a += (r() - 0.5) * 0.9; x += Math.cos(a) * 5; y += Math.sin(a) * 5; pts.push([x, y]); } wrap(c => { c.strokeStyle = grey(55, 0.5); c.lineWidth = 0.8; c.beginPath(); c.moveTo(pts[0][0], pts[0][1]); for (const p of pts) c.lineTo(p[0], p[1]); c.stroke(); }); }
  },
  gravel: (g, wrap, r) => {
    for (let k = 0; k < 900; k++) {
      const x = r() * N, y = r() * N, w = 2 + r() * 5, h = w * (0.6 + r() * 0.5), a = r() * 3.2, v = 105 + r() * 70;
      wrap(c => { c.save(); c.translate(x, y); c.rotate(a); c.fillStyle = grey(v * 0.55, 0.9); c.beginPath(); c.ellipse(0.6, 0.8, w, h, 0, 0, 6.3); c.fill(); c.fillStyle = grey(v); c.beginPath(); c.ellipse(0, 0, w, h, 0, 0, 6.3); c.fill(); c.fillStyle = grey(Math.min(255, v + 45), 0.8); c.beginPath(); c.ellipse(-w * 0.3, -h * 0.35, w * 0.45, h * 0.35, 0, 0, 6.3); c.fill(); c.restore(); });
    }
  },
  grass: (g, wrap, r) => {
    for (let k = 0; k < 220; k++) { const x = r() * N, y = r() * N, s = 1 + r() * 2, v = 95 + r() * 20; wrap(c => { c.fillStyle = grey(v, 0.6); c.fillRect(x, y, s, s); }); }
    for (let k = 0; k < 3200; k++) {
      const x = r() * N, y = r() * N, l = 3 + r() * 6, a = -1.57 + (r() - 0.5) * 1.4, v = r() < 0.6 ? 145 + r() * 55 : 95 + r() * 25, lw = 0.7 + r() * 0.6;
      wrap(c => { c.strokeStyle = grey(v, 0.75); c.lineWidth = lw; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); });
    }
  },
  snow: (g, wrap, r) => {
    for (let k = 0; k < 60; k++) { const x = r() * N, y = r() * N, s = 15 + r() * 35, v = 110 + r() * 40; wrap(c => { const gr = c.createRadialGradient(x, y, 0, x, y, s); gr.addColorStop(0, grey(v, 0.45)); gr.addColorStop(1, grey(v, 0)); c.fillStyle = gr; c.fillRect(x - s, y - s, 2 * s, 2 * s); }); }
    for (let k = 0; k < 400; k++) { const x = r() * N, y = r() * N; wrap(c => { c.fillStyle = grey(235, 0.9); c.fillRect(x, y, 1, 1); }); }
  },
  sand: (g, wrap, r) => {
    const img = g.getImageData(0, 0, N, N), d = img.data, ph = [r() * 6.3, r() * 6.3];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const u = x / N * 6.283, v = y / N * 6.283, w = Math.sin(v * 2 + Math.sin(u * 3 + ph[0]) * 0.9) * 0.6 + Math.sin(u + v * 3 + ph[1]) * 0.25;
      const val = 128 + 38 * Math.sin(v * 9 + u * 2 + w * 2.4) + (r() - 0.5) * 30, i = (y * N + x) * 4; d[i] = d[i + 1] = d[i + 2] = val;
    }
    g.putImageData(img, 0, 0);
  },
};
/** The detail texture of a kind (made once). */
export function detailTex(kind) {
  if (!cache.has(kind)) { const r = mulberry32(kind.length * 7919 + 13); cache.set(kind, canvas((g, wrap) => KINDS[kind](g, wrap, r))); }
  return cache.get(kind);
}
/** Metres one tile covers, per kind. */
export const DETAIL_SCALE = { asphalt: 2.2, gravel: 2.6, grass: 2.0, snow: 4.0, sand: 3.0 };
/** Which detail a stage's ground (off the road) wears. */
export function groundDetail(stage) {
  if (stage.surface === 'snow' || stage.alpineSnow) return 'snow';
  const c = new THREE.Color(stage.colors.grassA);
  return c.r > c.g && c.g > c.b && c.r - c.b > 0.25 && c.g < c.r * 0.86 ? 'sand' : 'grass';
}
/** Which detail a stage's road wears. */
export const roadDetail = stage => stage.surface === 'tarmac' ? 'asphalt' : stage.surface === 'snow' ? 'snow' : 'gravel';
