// Yump: a natural crest jump, `yump: <height m>` at the start of the section. The road rises like a kicker but
// rolls over a rounded dirt crest and falls away behind it, with no painted ramp: take it fast and you fly. Made
// for dirt stages; put it where the road drops away after the crest.
const PROFILE = [0.97, 0.9, 0.78, 0.62, 0.45, 0.29, 0.16, 0.07, 0.02];   // over the crest and down the far side
export function placeYump(H, jump, i, h, at = (i, q) => i + q) {
  for (let q = 0; q <= 16; q++) H[at(i, q)] += h * Math.pow(q / 17, 1.6);
  PROFILE.forEach((f, k) => { H[at(i, 17 + k)] += h * f; });
  for (let q = 0; q < 17 + PROFILE.length; q++) jump[at(i, q)] = 2;             // 2 = natural: no painted ramp
}
export const element = {
  name: 'yump', onBranch: true,
  about: 'a natural dirt crest jump at the start of the section',
  tags: { yump: 'crest height in metres (2-3.5)' },
  section(tg, i0, i1, marks) { if (tg.yump) (marks.yumps = marks.yumps || []).push({ i: i0, h: tg.yump }); },
  heights(ctx) { for (const { i, h } of ctx.marks.yumps || []) placeYump(ctx.H0, ctx.jump0, i, h, (a, q) => ctx.nb(a, q)); },
  track(ctx, out) { out.yumps = (ctx.marks.yumps || []).map(y => ({ ...y, i: ctx.u0(y.i) })); },
  markers: tr => (tr.yumps || []).map(y => ({ i: y.i, label: `yump ${y.h}m` }))
};
