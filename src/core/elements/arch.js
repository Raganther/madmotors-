// Arch: a natural rock arch standing over the middle of the section. Scenery only (nothing to hit; the pillars stand
// outside the barriers).
export const element = {
  name: 'arch',
  about: 'scenery rock arch over the middle of the section',
  tags: { arch: 'rock arch over the middle of this section' },
  section(tg, i0, i1, marks) { if (tg.arch) (marks.arches = marks.arches || []).push(Math.round((i0 + i1) / 2)); },
  track(ctx, out) { out.arches = (ctx.marks.arches || []).slice(); },
  markers: tr => (tr.arches || []).map(i => ({ i, label: 'arch' }))
};
