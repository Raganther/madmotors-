// Hammers: `hammers: n` hangs n wrecking balls from gantries over the section, evenly spaced, each swinging across the
// road from verge to verge (HAMMER.PERIOD s a swing, HAMMER.AMP m either side), each a little behind the last so a gap
// ripples down the line. Get the timing wrong and you're batted sideways and dented (features/hammers.js). The swing
// is a pure function of race time, so it replays exactly. The AI picks its lane for where the ball will be when it
// gets there.
import { HALF } from '../constants.js';
export const HAMMER = { PERIOD: 3.4, AMP: HALF - 0.6, R: 1.35, LAG: 0.9, HIT_V: 10, DENT: 8 };
/** Where hammer h's ball is across the road at race time t (metres), and how fast it's moving (m/s). */
export function hammerLat(h, t) { const w = 2 * Math.PI / HAMMER.PERIOD, a = w * t + h.phase; return { lat: HAMMER.AMP * Math.sin(a), v: HAMMER.AMP * w * Math.cos(a) }; }
export const element = {
  name: 'hammer', onBranch: false,
  about: 'wrecking balls swinging across the road',
  tags: { hammers: 'how many wrecking balls swing over the section' },
  section(tg, i0, i1, marks) { if (tg.hammers) (marks.hammers = marks.hammers || []).push([i0, i1, tg.hammers]); },
  track(ctx, out) {
    out.hammers = [];
    for (const [a, b, n] of ctx.marks.hammers || []) for (let k = 0; k < n; k++) out.hammers.push({ i: ctx.u0(Math.round(a + (b - a) * (k + 0.5) / n)), phase: k * HAMMER.LAG + out.hammers.length * 0.37 });
    if (!out.hammers.length) out.hammers = null;
  },
  markers: tr => (tr.hammers || []).map(h => ({ i: h.i, label: 'hammer' }))
};
