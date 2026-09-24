import { runs } from './jump.js';

// Ferry: the road stops at a dock and a barge carries the cars across the water to the dock on the far side
// (features/ferry.js moves it). Tag the water crossing as one straight section, `ferry: true`, at the height of the
// docks, a couple of metres above the river. Like a gap, the ground under it falls away into the water; the only
// thing to drive on is the barge deck.
export const FERRY = { LEN: 24, HALF: 6.3, SPEED: 8, DWELL: 2, WAIT: 6, LEAVE_B: 1.5, APPROACH: 160 };
export const element = {
  name: 'ferry',
  about: 'a barge carries the cars across the water between two docks',
  tags: { ferry: 'this section is the water crossing (the barge shuttles along it)' },
  channels: { ferry: tg => tg.ferry ? 1 : 0 },
  walls(ctx) {
    const { N0, ch, wallL0, wallR0, kerbL0, kerbR0 } = ctx;
    for (let i = 0; i < N0; i++) if (ch.ferry[i]) { wallL0[i] = wallR0[i] = 0; kerbL0[i] = kerbR0[i] = 0; }
  },
  track(ctx, out) {
    const { ch, N0, H0 } = ctx; if (!ch.ferry.some(v => v)) { out.ferry = null; out.ferries = []; return; }
    out.ferry = ch.ferry;
    out.ferries = runs(ch.ferry, N0).map(([a, b]) => ({ a, b, h: H0[(a - 1 + N0) % N0] }));   // dock A at a, dock B at b
  },
  markers: tr => (tr.ferries || []).map(f => ({ i: f.a, label: `ferry ${f.b - f.a}m` }))
};
