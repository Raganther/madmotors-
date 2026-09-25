// Whoops: a run of rolling bumps, `whoops: <height m>` (0.5-1), one every 11 m, easing in and out at the ends of the
// section. Taken fast they toss the car into the air; the AI just rides them.
export const WHOOP_LEN = 11;
export const element = {
  name: 'whoops', onBranch: true,
  about: 'a run of rolling bumps',
  tags: { whoops: 'bump height in metres (0.5-1)' },
  section(tg, i0, i1, marks) { if (tg.whoops) (marks.whoops = marks.whoops || []).push([i0, i1, tg.whoops]); },
  heights(ctx) {
    for (const [a, b, h] of ctx.marks.whoops || []) {
      const n = Math.floor((b - a) / WHOOP_LEN) * WHOOP_LEN;
      for (let q = 0; q < n; q++) ctx.H0[a + q] += h * 0.5 * (1 - Math.cos(2 * Math.PI * q / WHOOP_LEN));
    }
  },
  track(ctx, out) { out.whoops = (ctx.marks.whoops || []).map(([a, b, h]) => ({ i: ctx.u0(a), n: b - a, h })); },
  markers: tr => (tr.whoops || []).map(w => ({ i: w.i, label: `whoops ${w.h}m` }))
};
