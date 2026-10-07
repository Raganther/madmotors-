import { HALF, WALL } from '../constants.js';

export const BORE_H = 7.2;   // a tunnel bore's height over the road (render/elements/tunnel.js draws it)
import { clamp, lerp, smoothstep } from '../math.js';
import { railAt, railProject } from './rails.js';
import { placeObstacles } from './obstacles.js';
import { layoutTowns } from '../kit/layout.js';
import { arenaOut, arenaRamps } from '../elements/arena.js';
import { OPEN } from '../elements/open.js';

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
// Beyond a tunnel's mouth the hill over it stops dead, so the road runs up to a steep rock face with the portal in it
// rather than into a mound that slopes down over the arch.
function pastMouth(tr, i, x, z) {
  const N = tr.loopN || tr.N, nb = d => tr.loopN ? tr.nb0(i, d) : clamp(i + d, 0, N - 1), along = (x - tr.xs[i]) * tr.tx[i] + (z - tr.zs[i]) * tr.tz[i];
  return (along < -0.5 && !tr.tunnel[nb(-1)]) || (along > 0.5 && !tr.tunnel[nb(1)]);
}
export function buildTerrain(tr, stage) {
  const S = tr.gridS || 3, M = tr.margin || 95, x0 = Math.floor(Math.min(-200, tr.minX - M)), x1 = Math.ceil(Math.max(200, tr.maxX + M)), z0 = Math.floor(tr.minZ - Math.max(90, M)), z1 = Math.ceil(tr.maxZ + Math.max(120, M));
  const cols = Math.floor((x1 - x0) / S) + 1, rows = Math.floor((z1 - z0) / S) + 1;
  const h = new Float32Array(cols * rows), dist = new Float32Array(cols * rows), nearI = new Int32Array(cols * rows);
  const noise = tr.noise, amp = stage.hillAmp;
  for (let r = 0; r < rows; r++) {
    const z = z0 + r * S;
    for (let c = 0; c < cols; c++) {
      const x = x0 + c * S;
      const q = tr.nearestT(x, z); const d = q ? q.d : 1e9;
      // open country (elements/open.js): the ground rolls right across the route instead of flattening for a road
      const ow = q && tr.openW ? tr.openW[tr.bi(q.i)] : 0;
      const hills = amp * noise.fbm(x * 0.018 + 7.3, z * 0.018 + 2.1, 4) + 1.2 * noise.fbm(x * 0.06 + 1.3, z * 0.06, 2);
      let v = tr.base(x, z) + hills * lerp(smoothstep(HALF + 3, HALF + 30, d), 1, ow);
      if (tr.carve) v -= tr.carve * smoothstep(HALF + 8, HALF + 40, d) * (tr.carveW ? tr.carveW(x, z) : 1);
      if (d < (tr.edge || HALF + 15) && ow < 1) {
        let mn = 1e9;
        if (tr.loopN) { for (let d = -3; d <= 3; d++) mn = Math.min(mn, tr.H[tr.nb0(q.i, d)]); }
        else for (let kk = Math.max(0, q.i - 3); kk <= Math.min(tr.N - 1, q.i + 3); kk++) mn = Math.min(mn, tr.H[kk]);
        v = lerp(lerp(mn - 0.35, v, smoothstep(HALF + 1, tr.edge || HALF + 15, d)), v, ow);
      }
      // a gap or ferry crossing: ground ahead of the lip / behind the landing falls straight away (no flattening into the void)
      let dd = ow > 0.3 ? 99 : d;                                                                     // no dirt verge in open country
      if (q && tr.open && tr.open[tr.bi(q.i)] === OPEN.stream) v = Math.min(v, tr.H[q.i] - 0.9);        // a stream: the bed dips under its water
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
      if (qt && qt.d < HALF + 18 && !pastMouth(tr, qt.i, x, z)) { const roof = tr.H[qt.i] + 11; v = Math.max(v, lerp(roof, tr.H[qt.i] - 1, smoothstep(HALF + 9, HALF + 18, qt.d))); }
      if (tr.arena) { const A = tr.arena; if (Math.hypot(x - A.x, z - A.z) < A.r + 16) { const ad = arenaOut(A, x, z); if (ad < 16) { v = lerp(A.floor + arenaRamps(A, x, z), v, smoothstep(2, 16, ad)); if (ad < 1) dd = HALF + 2; } } }   // a derby arena: a flat floor out to its outline (elements/arena.js)
      h[r * cols + c] = v; dist[r * cols + c] = dd; nearI[r * cols + c] = q ? q.i : -1;
    }
  }
  // Another stretch of road passing close by (the far end of a flyover, a road under a bridge, the other leg of a knot):
  // the ground above was shaped for the nearest road only and can stand above this one, poking through it. Keep the
  // ground under every road: level with it across its width, rising no steeper than 1:1 beyond. Only other stretches:
  // a road's own banks and cliffs stay as its stage designed them. (tests/scenery.test.js checks every stage.)
  const RC = HALF + 12, L = tr.loopN || 0;
  const sameStretch = (a, b) => { if (a < 0) return false; const d = Math.abs(tr.bi(a) - tr.bi(b)); return (L ? Math.min(d, L - d) : d) < 40; };
  // A bridge deck is kept clear of the ground under it too, its own stretch included (the road flattening above levels
  // the ground to a deck's height, and between grid points that pokes up through it): at least 1.5 m below the deck.
  for (let i = 0; i < tr.N; i++) {
    const deck = tr.bridge[i];
    if (tr.tunnel[i] || (!deck && tr.voidMask && tr.voidMask[tr.bi(i)]) || (tr.open && tr.open[tr.bi(i)])) continue;   // open country: no road to keep the ground under
    const xi = tr.xs[i], zi = tr.zs[i], c0 = Math.max(0, Math.floor((xi - RC - x0) / S)), c1 = Math.min(cols - 1, Math.ceil((xi + RC - x0) / S)), r0 = Math.max(0, Math.floor((zi - RC - z0) / S)), r1 = Math.min(rows - 1, Math.ceil((zi + RC - z0) / S));
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) {
      const k = r * cols + c, ex = x0 + c * S - xi, ez = z0 + r * S - zi, d = Math.hypot(ex, ez); if (d > RC || (!deck && sameStretch(nearI[k], i))) continue;
      if (deck && Math.abs(ex * tr.tx[i] + ez * tr.tz[i]) > 1.2) continue;                  // beside the deck only: not the approach road past its ends
      const cap = deck ? tr.H[i] - 1.5 + Math.max(0, d - WALL - 1) : tr.H[i] - 0.35 + Math.max(0, d - HALF - 1);
      if (h[k] > cap) { h[k] = cap; if (d < dist[k]) dist[k] = d; }
    }
  }
  // Tunnel mouths: the grid steps from the road outside up to the hill over the bore inside, so the cells across a mouth
  // ramp up in front of the opening like a wall. They are drawn sunk under the road instead (the portal and its rock face
  // frame the opening); tests/scenery.test.js checks every mouth is open.
  let holes = null, holeY = null;   // holeY: the cell is drawn sunk to this height instead (a floor under the mouth, not a gap)
  if (tr.tunnel.some(v => v)) for (let r = 0; r < rows - 1; r++) for (let c = 0; c < cols - 1; c++) {
    const qt = tr.nearestTun(x0 + (c + 0.5) * S, z0 + (r + 0.5) * S); if (!qt || qt.d > WALL - 1.3) continue;                                 // inside the bore's width: nothing to see past it
    const k = r * cols + c, hs = [h[k], h[k + 1], h[k + cols], h[k + cols + 1]], y = tr.H[qt.i];
    if (Math.max(...hs) > y + 1 && Math.min(...hs) < y + BORE_H + 1) { if (!holes) { holes = new Uint8Array((cols - 1) * (rows - 1)); holeY = new Float32Array(holes.length); } holes[r * (cols - 1) + c] = 1; holeY[r * (cols - 1) + c] = y - 0.6; }
  }
  function at(x, z) {
    let fx = (x - x0) / S, fz = (z - z0) / S;
    if (fx < 0) fx = 0; if (fz < 0) fz = 0; if (fx > cols - 1.001) fx = cols - 1.001; if (fz > rows - 1.001) fz = rows - 1.001;
    const c = fx | 0, r = fz | 0, u = fx - c, v = fz - r, i = r * cols + c;
    return (h[i] * (1 - u) + h[i + 1] * u) * (1 - v) + (h[i + cols] * (1 - u) + h[i + cols + 1] * u) * v;
  }
  const T = { x0, z0, S, cols, rows, h, dist, at, holes, holeY };
  T.kit = layoutTowns(tr, T, stage);   // towns from the world kit (core/kit/layout.js): before the trees, which keep out of them
  T.obst = placeObstacles(tr, T, stage);   // trees, rocks, cacti, bushes: drawn by render/world/scenery.js, hit in sim/obstacles.js
  return T;
}
