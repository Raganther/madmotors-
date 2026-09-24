// Shaded relief map of a stage's generated terrain with the road drawn on (white = bridge), river in blue.
//   node tools/terrain.mjs [stage]           -> tools/out/terrain-<stage>.png
import fs from 'node:fs';
import { STAGES, buildTrack, buildTerrain } from '../src/core/index.js';
import { stageFromArg } from './stage-arg.js';
import { encodePNG } from './png.js';

const si = stageFromArg(process.argv[2]), st = STAGES[si];
let t0 = Date.now(); const tr = buildTrack(st), t1 = Date.now(), terr = buildTerrain(tr, st), t2 = Date.now();
const { cols: W, rows: H, h } = terr; let mn = Infinity, mx = -Infinity; for (const v of h) { mn = Math.min(mn, v); mx = Math.max(mx, v); }
console.log(`${st.name}: track ${t1 - t0} ms, terrain ${t2 - t1} ms, grid ${W}x${H}, height ${mn.toFixed(0)}..${mx.toFixed(0)} m`);
const rgb = new Uint8Array(W * H * 3);
for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
  const i = r * W + c, v = h[i], dx = h[r * W + Math.min(W - 1, c + 1)] - h[r * W + Math.max(0, c - 1)], dz = h[Math.min(H - 1, r + 1) * W + c] - h[Math.max(0, r - 1) * W + c];
  const shade = Math.max(0.15, Math.min(1, 0.7 - (dx + dz) * 0.06)), t = (v - mn) / (mx - mn || 1), water = st.river && v < st.river.level + 0.5;
  rgb[i * 3] = (water ? 60 : 60 + 180 * t) * shade; rgb[i * 3 + 1] = (water ? 120 : 120 + 110 * t) * shade; rgb[i * 3 + 2] = (water ? 200 : 70 + 60 * t) * shade;
}
for (let i = 0; i < (tr.loopN || tr.N); i++) {
  const c = Math.round((tr.xs[i] - terr.x0) / terr.S), r = Math.round((tr.zs[i] - terr.z0) / terr.S); if (c < 0 || r < 0 || c >= W || r >= H) continue;
  const k = (r * W + c) * 3, v = tr.bridge[i] ? 255 : 25; rgb[k] = rgb[k + 1] = rgb[k + 2] = v;
}
fs.mkdirSync('tools/out', { recursive: true });
const out = `tools/out/terrain-${si + 1}.png`; fs.writeFileSync(out, encodePNG(rgb, W, H, 3)); console.log('wrote', out);
