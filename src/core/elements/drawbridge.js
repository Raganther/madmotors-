// Drawbridge: a double-leaf bascule bridge over a mill race. Every so often a bell rings and both leaves rise from the
// middle (features/drawbridge.js runs the cycle). While they're still low (up to AJUMP) the near leaf is a ramp: arrive
// fast and you launch over the gap and land on the far leaf; too slow and you drop in the water. Steeper than that
// and the gate shuts until they come down. Tag one straight section `drawbridge: <seconds>` (the number shifts its
// cycle, so two bridges needn't rise together); like a gap, nothing is under it but the drop, so give it a channel
// (far/near about -10 with short ramps).
export const DRAW = { DOWN: 16, WARN: 3, RISE: 7, HOLD: 3, LOWER: 6, AMAX: 75 * Math.PI / 180, AJUMP: 35 * Math.PI / 180 };
DRAW.CYCLE = DRAW.DOWN + DRAW.WARN + DRAW.RISE + DRAW.HOLD + DRAW.LOWER;
export const element = {
  name: 'drawbridge', hollow: true,
  about: 'a bascule bridge that rises every so often: jump it while it is low, wait while it is up',
  tags: { drawbridge: 'this straight section is a drawbridge; the value (seconds) shifts its cycle' },
  channels: { drawbridge: tg => tg.drawbridge !== undefined && tg.drawbridge !== false ? 1 : 0 },
  section(tg, i0, i1, marks) { if (tg.drawbridge !== undefined && tg.drawbridge !== false) (marks.draws = marks.draws || []).push({ a: i0, b: i1, phase: typeof tg.drawbridge === 'number' ? tg.drawbridge : 0 }); },
  walls(ctx) {
    const { N0, ch, wallL0, wallR0, kerbL0, kerbR0 } = ctx;
    for (let i = 0; i < N0; i++) if (ch.drawbridge[i]) { wallL0[i] = wallR0[i] = 4; kerbL0[i] = kerbR0[i] = 0; }   // the leaves' railings
  },
  track(ctx, out) {
    const { marks, H0, N0 } = ctx;
    out.drawbridge = ctx.ch.drawbridge.some(v => v) ? ctx.ch.drawbridge : null;
    out.drawbridges = (marks.draws || []).map(d => ({ ...d, h: H0[(d.a - 1 + N0) % N0] }));
  },
  markers: tr => (tr.drawbridges || []).map(d => ({ i: d.a, label: `drawbridge ${d.b - d.a}m` }))
};
