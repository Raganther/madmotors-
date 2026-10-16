// Chicane: barrier blocks staggered across a straight, left, right, left, so the line weaves between them. Tag a
// straight section `chicane: '<kind>'` (a breakable: data/breakables.js; true = concrete): a block every CHICANE.GAP m,
// each across one half of the road, the first on the side `chicaneSide` says (1 right, -1 left; default right). They're
// ordinary breakables (core/features/breakables.js): a car heavy and fast enough goes straight through (concrete leaves
// its blocks on the road), the rest weave. The AI weaves (sim/ai.js reads tr.chiLane: the lane to be in, per sample)
// and takes it at VMAX m/s.
import { BREAKABLES, BREAKABLE_KINDS } from '../../data/breakables.js';
import { HALF } from '../constants.js';
import { runs } from './jump.js';
export const CHICANE = { GAP: 44, LEAD: 36, LANE: 3.4, VMAX: 21 };
export const element = {
  name: 'chicane',
  about: 'barrier blocks staggered across a straight: weave through, or smash through in something heavy',
  tags: { chicane: `blocks staggered across this straight: ${BREAKABLE_KINDS.join(' | ')} (true = concrete)`, chicaneSide: 'the side of the first block: 1 right (default), -1 left' },
  channels: { chicane: tg => tg.chicane ? 1 + BREAKABLE_KINDS.indexOf(tg.chicane === true ? 'concrete' : tg.chicane) : 0, chicaneSide: tg => tg.chicaneSide === -1 ? 2 : 1 },
  section(tg) { if (tg.chicane && tg.chicane !== true && !BREAKABLES[tg.chicane]) throw new Error(`chicane: no breakable "${tg.chicane}" (${BREAKABLE_KINDS.join(', ')})`); },
  speeds(ctx) { const { ch, N0, vmax0 } = ctx; for (let i = 0; i < N0; i++) if (ch.chicane[i] || ch.chicane[(i + 20) % N0]) vmax0[i] = Math.min(vmax0[i], CHICANE.VMAX); },
  track(ctx, out) {
    const { ch, N0, xs0, zs0, th0 } = ctx; out.chiLane = null;
    if (!ch.chicane.some(v => v)) return;
    const list = out.breakables || [], lane = new Float32Array(N0).fill(NaN);
    for (const [a, b] of runs(ch.chicane, N0)) {
      const kind = BREAKABLE_KINDS[ch.chicane[a] - 1], K = BREAKABLES[kind], n = Math.max(1, Math.floor((b - a) / CHICANE.GAP)), s0 = ch.chicaneSide[a] === 2 ? -1 : 1;
      for (let k = 0; k < n; k++) {
        const i = Math.round(a + (b - a) * (k + 0.5) / n), side = k % 2 ? -s0 : s0, lat = side * (HALF - K.w / 2 + 0.3);
        list.push({ id: list.length, kind, b: i, alt: -1, x: xs0[i] - Math.cos(th0[i]) * lat, z: zs0[i] + Math.sin(th0[i]) * lat, yaw: th0[i] + Math.PI / 2, chicane: true });
        for (let j = i - CHICANE.LEAD; j <= i + 2; j++) lane[(j + N0) % N0] = -side * CHICANE.LANE;   // the open half
      }
    }
    out.breakables = list; out.chiLane = lane;
  },
  markers: tr => (tr.breakables || []).filter(o => o.chicane).map(o => ({ i: tr.u0(o.b), label: `chicane ${o.kind}` }))
};
