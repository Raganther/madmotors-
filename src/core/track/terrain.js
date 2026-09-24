import { HALF } from '../constants.js';
import { clamp, lerp, smoothstep } from '../math.js';
import { railAt, railProject } from './rails.js';

export function riverDist(rv, x, z) {
  let best = 1e9; const P = rv.pts;
  for (let k = 0; k < P.length - 1; k++) {
    const ax = P[k][0], az = P[k][1], dx = P[k + 1][0] - ax, dz = P[k + 1][1] - az, t = clamp(((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz), 0, 1);
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}
// river channel: 3 m below the water across its width, banks rising steeply either side
export function riverBed(rv, x, z) { const d = riverDist(rv, x, z); return rv.level - 3 + Math.max(0, d - rv.width / 2) * 1.1; }
export function buildTerrain(tr, stage) {
  const S = tr.gridS || 3, M = tr.margin || 95, x0 = Math.floor(Math.min(-200, tr.minX - M)), x1 = Math.ceil(Math.max(200, tr.maxX + M)), z0 = Math.floor(tr.minZ - Math.max(90, M)), z1 = Math.ceil(tr.maxZ + Math.max(120, M));
  const cols = Math.floor((x1 - x0) / S) + 1, rows = Math.floor((z1 - z0) / S) + 1;
  const h = new Float32Array(cols * rows), dist = new Float32Array(cols * rows);
  const noise = tr.noise, amp = stage.hillAmp;
  for (let r = 0; r < rows; r++) {
    const z = z0 + r * S;
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * S;
      const q = tr.nearestT(x, z); const d = q ? q.d : 1e9;
      const hills = amp * noise.fbm(x * 0.018 + 7.3, z * 0.018 + 2.1, 4) + 1.2 * noise.fbm(x * 0.06 + 1.3, z * 0.06, 2);
      let v = tr.base(x, z) + hills * smoothstep(HALF + 3, HALF + 30, d);
      if (tr.carve) v -= tr.carve * smoothstep(HALF + 8, HALF + 40, d) * (tr.carveW ? tr.carveW(x, z) : 1);
      if (d < (tr.edge || HALF + 15)) {
        let mn = 1e9;
        if (tr.loopN) { for (let d = -3; d <= 3; d++) mn = Math.min(mn, tr.H[tr.nb0(q.i, d)]); }
        else for (let kk = Math.max(0, q.i - 3); kk <= Math.min(tr.N - 1, q.i + 3); kk++) mn = Math.min(mn, tr.H[kk]);
        v = lerp(mn - 0.35, v, smoothstep(HALF + 1, tr.edge || HALF + 15, d));
      }
      // a gap or ferry crossing: ground ahead of the lip / behind the landing falls straight away (no flattening into the void)
      let dd = d;
      if (tr.voidMask && q) {
        const b = tr.bi(q.i), i = q.i, along = (x - tr.xs[i]) * tr.tx[i] + (z - tr.zs[i]) * tr.tz[i];
        const V = tr.voidMask, lip = V[tr.nb(b, 1)] && !V[b], land = V[tr.nb(b, -1)] && !V[b];
        if ((lip && along > 0.5) || (land && along < -0.5)) { v = Math.min(v, tr.H[i] - 38); dd = 99; }
      }
      if (tr.river) v = Math.min(v, riverBed(tr.river, x, z));
      if (tr.rails) for (const L of tr.rails.lines) {           // embankments and cuttings under the tracks
        const pj = railProject(L, x, z); if (pj.d > 12 || pj.s < L.visA - 2 || pj.s > L.visB + 2) continue;
        v = lerp(railAt(L, pj.s).h - 0.1, v, smoothstep(4, 12, pj.d));
      }
      const qt = tr.nearestTun(x, z);
      if (qt && qt.d < HALF + 18) { const roof = tr.H[qt.i] + 11; v = Math.max(v, lerp(roof, tr.H[qt.i] - 1, smoothstep(HALF + 9, HALF + 18, qt.d))); }
      h[r * cols + c] = v; dist[r * cols + c] = dd;
    }
  }
  function at(x, z) {
    let fx = (x - x0) / S, fz = (z - z0) / S;
    if (fx < 0) fx = 0; if (fz < 0) fz = 0; if (fx > cols - 1.001) fx = cols - 1.001; if (fz > rows - 1.001) fz = rows - 1.001;
    const c = fx | 0, r = fz | 0, u = fx - c, v = fz - r, i = r * cols + c;
    return (h[i] * (1 - u) + h[i + 1] * u) * (1 - v) + (h[i + cols] * (1 - u) + h[i + cols + 1] * u) * v;
  }
  return { x0, z0, S, cols, rows, h, dist, at };
}
