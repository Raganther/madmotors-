import { placeKicker } from './jump.js';

// Kick: a kicker jump placed exactly at the start of a section, `kick: <height m>`. Best on a crest before a descent.
export const element = {
  name: 'kick',
  about: 'a placed kicker jump at the start of the section',
  tags: { kick: 'kicker height in metres (2-3.5)' },
  section(tg, i0, i1, marks) { if (tg.kick) (marks.kicks = marks.kicks || []).push({ i: i0, h: tg.kick }); },
  heights(ctx) { for (const { i, h } of ctx.marks.kicks || []) placeKicker(ctx.H0, ctx.jump0, i, h, ctx.w); },
  track(ctx, out) { out.kicks = (ctx.marks.kicks || []).map(k => ({ ...k })); },
  markers: tr => (tr.kicks || []).map(k => ({ i: k.i, label: `kick ${k.h}m` }))
};
