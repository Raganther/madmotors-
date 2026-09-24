// Sawmill scenery: `mill: true` puts a sawmill shed with log stacks beside the middle of the section, on the far
// (up-screen) side; `logs: true` lines the section with log piles on both sides, outside the barriers. Nothing to hit.
export const element = {
  name: 'mill', onBranch: true,
  about: 'sawmill shed and log piles beside the road (scenery)',
  tags: { mill: 'a sawmill shed and log stacks beside the middle of this section', logs: 'log piles along both sides of this section' },
  section(tg, i0, i1, marks) {
    if (tg.mill) (marks.mills = marks.mills || []).push(Math.round((i0 + i1) / 2));
    if (tg.logs) (marks.logs = marks.logs || []).push([i0, i1]);
  },
  track(ctx, out) { out.mills = (ctx.marks.mills || []).map(ctx.u0); out.logPiles = (ctx.marks.logs || []).map(([a, b]) => [ctx.u0(a), ctx.u0(a) + b - a]); },
  markers: tr => (tr.mills || []).map(i => ({ i, label: 'sawmill' })).concat((tr.logPiles || []).map(([a]) => ({ i: a, label: 'log piles' })))
};
