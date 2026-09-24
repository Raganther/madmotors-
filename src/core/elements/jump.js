// Jumps: the kicker profile (an 18 m ramp to a lip, then a sharp drop) and the automatic placement used by generated
// stages (`stage.jumps`). Section tag `jump` marks where a 'gorge' stage allows automatic jumps.
/** Add a kicker of height rh starting at sample i. `w` wraps indices on circuits. */
export function placeKicker(H, jump, i, rh, w = k => k) {
  for (let q = 0; q <= 17; q++) H[w(i + q)] += rh * Math.pow(q / 17, 1.7);
  H[w(i + 18)] += rh * 0.62; H[w(i + 19)] += rh * 0.28;
  for (let q = 0; q < 20; q++) jump[w(i + q)] = 1;
}
/** Place up to `count` kickers, trying every 5th sample in [from, to), at least `gap` apart, where ok(i) allows. */
export function autoJumps(H, jump, { from, to, count, gap, rh, ok }) {
  let placed = 0, last = -1e9;
  for (let i = from; i < to && placed < count; i += 5) {
    if (i - last < gap || !ok(i)) continue;
    placeKicker(H, jump, i, rh); last = i; placed++;
  }
}
export const element = {
  name: 'jump',
  about: 'automatic jumps on straights (stage.jumps); the `jump` tag marks where a gorge stage allows them',
  tags: { jump: 'allow automatic jumps in this section' },
  stageKeys: { jumps: 'how many automatic jumps to place' },
  channels: { jump: tg => tg.jump ? 1 : 0 },
  heights(ctx) {
    const { stage, N0, w, xs0, zs0, ks0, H0, jump0, ch, startIdx, gorge } = ctx;
    // straight, away from the start, tunnels, bridges and level crossings
    autoJumps(H0, jump0, { from: startIdx + 150, to: N0 - 80, count: stage.jumps, gap: 405, rh: 2.4, ok: i => {
      for (let j = i - 15; j <= i + 60; j++) if (Math.abs(ks0[w(j)]) > 1 / 110 || Math.hypot(xs0[w(j)], zs0[w(j)]) < 80 || ch.tunnel[w(j)] || ch.bridge[w(j)] || (gorge && !ch.jump[w(j)]) || ctx.nearCrossing(w(j), 80)) return false;
      return true;
    } });
  },
  markers: tr => runs(tr.jump, tr.loopN || tr.N).map(([a]) => ({ i: a, label: 'jump' }))
};
/** Runs of non-zero samples in a per-sample array: [[start, end], ...] (end exclusive). */
export function runs(arr, N) {
  const out = []; if (!arr) return out;
  for (let i = 0; i < N; i++) if (arr[i] && (i === 0 || !arr[i - 1])) { let j = i; while (j < N && arr[j]) j++; out.push([i, j]); }
  return out;
}
