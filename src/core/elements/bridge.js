import { runs } from './jump.js';

// Bridge: the road carried on a deck (bridge rails as barriers, no kerbs); the ground under it is left alone, so a
// bridge can cross a gorge, a river or another road. Rendered as a steel bridge or, with stage.viaduct, stone arches.
export const element = {
  name: 'bridge',
  about: 'road on a deck over whatever is below',
  tags: { bridge: 'this section is a bridge' },
  stageKeys: { viaduct: 'bridges are stone viaducts' },
  channels: { bridge: tg => tg.bridge ? 1 : 0 },
  walls(ctx) {
    const { N0, w, ch, wallL0, wallR0, kerbL0, kerbR0 } = ctx;
    for (let i = 0; i < N0; i++) if (ch.bridge[i]) { for (let j = i - 2; j <= i + 2; j++) { wallL0[w(j)] = 4; wallR0[w(j)] = 4; } kerbL0[i] = kerbR0[i] = 0; }
  },
  markers: tr => runs(tr.bridge, tr.loopN || tr.N).map(([a, b]) => ({ i: a, label: `bridge ${b - a}m` }))
};
