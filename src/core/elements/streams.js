import { clamp } from '../math.js';

// Streams (stage.streams): mountain rivers that run downhill, each a channel cut into the land along its points with
// water that follows it down, falling where its level steps. `streams: [{ pts: [[a, b, level], ...], width }]` in
// plan metres, first point upstream; on a described landscape (stage.ground) the levels can be left out and are taken
// from the land under each point, never rising downstream (core/track/ground.js prepareGround), and where the road
// crosses one it's a bridge. The lake or sea they run into is still stage.river. Drawn by render/elements/streams.js.
export const element = {
  name: 'streams',
  about: 'mountain rivers running downhill in channels, falling where they step down',
  stageKeys: { streams: 'downhill rivers: [{ pts: [[a, b, level?], ...], width }], first point upstream' },
  track(ctx, out) {
    const S = ctx.stage.streams;
    out.streams = S && S.length ? S.map(s => ({ width: s.width || 14, pts: s.pts.map(([a, b, h]) => [(a - b) / Math.SQRT2, -(a + b) / Math.SQRT2, h ?? 0]) })) : null;
  }
};
/** Nearest point of stream s to world (x, z): distance d, the water level there, and how far along it is (s, metres). */
export function streamProject(st, x, z) {
  const P = st.pts; let best = { d: 1e9, level: 0, s: 0 }, run = 0;
  for (let k = 0; k < P.length - 1; k++) {
    const [ax, az, ah] = P[k], [bx, bz, bh] = P[k + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz || 1, L = Math.sqrt(L2);
    const t = clamp(((x - ax) * dx + (z - az) * dz) / L2, 0, 1), d = Math.hypot(x - ax - dx * t, z - az - dz * t);
    if (d < best.d) best = { d, level: ah + (bh - ah) * t, s: run + L * t };
    run += L;
  }
  return best;
}
// the channel: 1.6 m under the water across its width, banks rising steeply either side (as a river's, core terrain.js)
export function streamBed(st, x, z) { const q = streamProject(st, x, z); return q.d > st.width / 2 + 40 ? Infinity : q.level - 1.6 + Math.max(0, q.d - st.width / 2) * 1.2; }
/** The level of any water at world (x, z) whose ground is at height y (a stage's river or lake, or a stream), or null. */
export function waterAt(tr, x, z, y) {
  if (tr.river && !tr.river.frozen && y < tr.river.level) return tr.river.level;
  for (const st of tr.streams || []) { const q = streamProject(st, x, z); if (q.d < st.width / 2 + 3 && y < q.level) return q.level; }
  return null;
}
