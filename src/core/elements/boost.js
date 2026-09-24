import { baseRuns } from './jump.js';

// Boost pads: arrows painted across the road; driving over them fires a short boost (sim/car.js). Use them on the
// run-up to a gap so everyone reaches the lip fast enough.
export const BOOST_PAD = 0.9;   // seconds of boost a pad gives
export const element = {
  name: 'boost', onBranch: true,
  about: 'boost pads across the road',
  tags: { boost: 'boost pads on this section' },
  channels: { boost: tg => tg.boost ? 1 : 0 },
  track(ctx, out) { out.boostPad = ctx.ch.boost.some(v => v) ? ctx.ch.boost : null; },
  markers: tr => baseRuns(tr, tr.boostPad).map(([a, b]) => ({ i: a, label: `boost ${b - a}m` }))
};
