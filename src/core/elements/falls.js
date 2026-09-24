// Falls: a waterfall leaps off the cliff on the up-screen side of the section, arcs high over the road and crashes
// down on the bank below: you drive underneath the curtain. Scenery only. Give the section a tall cliff on the far
// side (far: ~26, rampF: ~8) so there's a lip to pour from.
export const element = {
  name: 'falls', onBranch: true,
  about: 'a waterfall arcing over the road (scenery)',
  tags: { falls: 'a waterfall arcs over the middle of this section' },
  section(tg, i0, i1, marks) { if (tg.falls) (marks.falls = marks.falls || []).push({ i: Math.round((i0 + i1) / 2), n: i1 - i0 }); },
  track(ctx, out) { out.falls = (ctx.marks.falls || []).map(f => ({ ...f, i: ctx.u0(f.i) })); },
  markers: tr => (tr.falls || []).map(f => ({ i: f.i, label: 'waterfall' }))
};
