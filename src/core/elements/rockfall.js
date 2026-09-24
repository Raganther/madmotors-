import { baseRuns } from './jump.js';

// Rockfall: boulders drop off the rock face above this section and bounce across the road (features/rockfall.js).
export const element = {
  name: 'rockfall',
  about: 'boulders fall across the road here',
  tags: { rockfall: 'boulders fall here' },
  stageKeys: { rockGap: 'spaces the boulders out (1 = default)' },
  channels: { rockfall: tg => tg.rockfall ? 1 : 0 },
  track(ctx, out) { const r = ctx.ch.rockfall; out.rockfall = ctx.gorge && r.some(v => v) ? r : null; out.rockGap = ctx.stage.rockGap || 1; },
  markers: tr => baseRuns(tr, tr.rockfall).map(([a, b]) => ({ i: a, label: `rockfall ${b - a}m` }))
};
