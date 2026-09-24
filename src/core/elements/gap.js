import { baseRuns, runs } from './jump.js';

// Gap: no road and no ground: a void (a gorge, a river) that cars must jump. Put a `kick` right before it, ideally
// with `boost` pads on the run-up, and land the far side a little lower. A car that drops in respawns on the far
// side (sim/car.js). The terrain under it ignores the road (like a bridge), so the ground falls away into the void.
export const element = {
  name: 'gap',
  about: 'a void to jump over; fall in and you respawn on the far side',
  tags: { gap: 'this section is a void (no road, no ground)' },
  channels: { gap: tg => tg.gap ? 1 : 0 },
  walls(ctx) {
    const { N0, ch, wallL0, wallR0, kerbL0, kerbR0 } = ctx;
    for (let i = 0; i < N0; i++) if (ch.gap[i]) { wallL0[i] = wallR0[i] = 0; kerbL0[i] = kerbR0[i] = 0; }
  },
  track(ctx, out) {
    const { ch, N0 } = ctx; if (!ch.gap.some(v => v)) { out.gap = null; return; }
    out.gap = ch.gap;
    // where to put a car that fell in: a little way past the far edge
    const land = new Int32Array(N0).fill(-1);
    for (const [a, b] of runs(ch.gap, N0)) for (let i = a; i < b; i++) land[i] = (b + 8) % N0;
    out.gapLand = land;
  },
  markers: tr => baseRuns(tr, tr.gap).map(([a, b]) => ({ i: a, label: `gap ${b - a}m` }))
};
