import { HALF } from '../constants.js';

// Surf: `surf: true` on sections along a shore. Waves run up the beach and across the road from the water's side, one
// every PERIOD seconds, the crest sweeping along the stretch; a car caught in one is in standing water (c.aqua: drag,
// less grip, spray) and gets a shove towards the land (features/surf.js). Which side the water is on comes from the
// stage's river (lake or sea): the side its line is nearer. Timing is fixed by race time, so drivers can learn it.
export const SURF = {
  PERIOD: 6.5,       // s between waves
  REACH: 2 * HALF + 6,   // m: how far across from the water-side edge of the road a full wave runs
  ALONG: 0.035,      // rad per metre: the crest's sweep along the stretch (a wave meets the road at a slant), ~28 m/s
  AQUA: 0.85,        // how deep the wash counts as standing water at its fullest
  PUSH: 2.2,         // m/s^2 shove towards the land at a full wave
  FADE: 18           // m: waves die away over this much at each end of a stretch
};
/** How far across the road (m from the water-side edge) a wave reaches at base sample b and race time t. */
export function surfReach(tr, b, t) {
  if (!tr.surf || !tr.surf[b]) return 0;
  const ph = (t / SURF.PERIOD) * 2 * Math.PI + b * SURF.ALONG, w = Math.max(0, Math.sin(ph));   // the crests sweep back along the stretch, against the race, so cars meet them
  const fade = tr.surfEnd ? Math.min(1, tr.surfEnd[b] / SURF.FADE) : 1;   // smaller towards either end of the stretch
  return SURF.REACH * w * w * w * fade;   // a quick run up, a long draw back
}
export const element = {
  name: 'surf',
  about: 'waves washing across a shore road on a cycle: standing water and a shove',
  tags: { surf: 'true: waves from the lake or sea wash across this stretch' },
  channels: { surf: tg => tg.surf ? 1 : 0 },
  track(ctx, out) {
    const { ch, NB, stage, xs0, zs0, th0 } = ctx;
    if (!ch.surf.some(v => v)) { out.surf = null; return; }
    if (!stage.river) throw new Error(`${stage.name}: surf needs the stage's river (its lake or sea) to know where the water is`);
    // the water's side at each surf sample: +1 right of the road, -1 left (towards the river's line)
    const P = stage.river.pts.map(([a, b]) => [(a - b) / Math.SQRT2, -(a + b) / Math.SQRT2]), side = new Int8Array(NB);
    const near = (x, z) => { let best = [1e9, 0, 0]; for (let k = 0; k < P.length - 1; k++) { const [ax, az] = P[k], dx = P[k + 1][0] - ax, dz = P[k + 1][1] - az, u = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz || 1))), px = ax + dx * u, pz = az + dz * u, d = Math.hypot(x - px, z - pz); if (d < best[0]) best = [d, px, pz]; } return best; };
    for (let b = 0; b < NB; b++) if (ch.surf[b]) { const [, px, pz] = near(xs0[b], zs0[b]), rx = -Math.cos(th0[b]), rz = Math.sin(th0[b]); side[b] = (px - xs0[b]) * rx + (pz - zs0[b]) * rz >= 0 ? 1 : -1; }
    // how far each surf sample is from the nearer end of its stretch
    const end = new Uint16Array(NB); let run = 0;
    for (let b = 0; b < NB; b++) { run = ch.surf[b] ? run + 1 : 0; end[b] = run; }
    run = 0; for (let b = NB - 1; b >= 0; b--) { run = ch.surf[b] ? run + 1 : 0; end[b] = Math.min(end[b], run); }
    out.surf = Uint8Array.from(ch.surf); out.surfSide = side; out.surfEnd = end;
  },
  markers: tr => {
    const out = []; if (!tr.surf) return out;
    for (let b = 0; b < tr.NB; b++) if (tr.surf[b] && (b === 0 || !tr.surf[b - 1])) out.push({ i: tr.u0(b), label: 'surf' });
    return out;
  }
};
