import { runs } from './jump.js';

// Town: a street with pavements; bollards along the kerb on both sides, houses, parked cars (features/parked.js)
// and a closer camera.
export const element = {
  name: 'town',
  about: 'town street: bollards, houses, parked cars',
  tags: { town: 'this section runs through town' },
  channels: { town: tg => tg.town ? 1 : 0 },
  wallsLate(ctx) {
    const { N0, ch, wallL0, wallR0, kerbL0, kerbR0, gorge } = ctx; if (!gorge) return;
    for (let i = 0; i < N0; i++) if (ch.town[i]) { wallL0[i] = 7; wallR0[i] = 7; kerbL0[i] = kerbR0[i] = 0; }
  },
  track(ctx, out) { out.town = ctx.gorge ? ctx.ch.town : null; },
  markers: tr => runs(tr.town, tr.loopN || tr.N).map(([a, b]) => ({ i: a, label: `town ${b - a}m` }))
};
