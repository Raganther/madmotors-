import { runs } from './jump.js';

// Tunnel: walls both sides, a bore and portals; the ground is raised over it. Long covered stretches also switch
// on the see-through window over the player (render/world/index.js coverMap).
export const element = {
  name: 'tunnel',
  about: 'road through a bored tunnel',
  tags: { tunnel: 'this section is in a tunnel' },
  channels: { tunnel: tg => tg.tunnel ? 1 : 0 },
  walls(ctx) {
    const { N0, ch, wallL0, wallR0, kerbL0, kerbR0 } = ctx;
    for (let i = 0; i < N0; i++) if (ch.tunnel[i]) { wallL0[i] = 5; wallR0[i] = 5; kerbL0[i] = kerbR0[i] = 0; }
  },
  markers: tr => runs(tr.tunnel, tr.loopN || tr.N).map(([a, b]) => ({ i: a, label: `tunnel ${b - a}m` }))
};
