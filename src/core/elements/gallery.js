import { runs } from './jump.js';

// Gallery: a rock gallery on a cliff ledge, a roof carried on pillars along the valley side, with a solid parapet.
export const element = {
  name: 'gallery',
  about: 'roofed rock gallery along a cliff ledge',
  tags: { gallery: 'this section is a rock gallery' },
  channels: { gallery: tg => tg.gallery ? 1 : 0 },
  wallsLate(ctx) {
    const { N0, ch, wallL0, wallR0, PF, gorge } = ctx; if (!gorge) return;
    for (let i = 0; i < N0; i++) if (ch.gallery[i]) { if (PF.dot[i] > 0) wallL0[i] = 5; else wallR0[i] = 5; }
  },
  track(ctx, out) { out.gallery = ctx.gorge ? ctx.ch.gallery : null; },
  markers: tr => runs(tr.gallery, tr.loopN || tr.N).map(([a, b]) => ({ i: a, label: `gallery ${b - a}m` }))
};
