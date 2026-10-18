// Mud: `mud: true` makes the section a bog (little grip, the engine bogs down, mud flies); `mud: 'water'` makes it a
// water splash: a shallow stream across the road that drags at the car. Put a splash in a dip with low ground either
// side (far/near about -1.5) so the stream has somewhere to run. The AI takes both slower. Bogs rut as the race goes
// on (features/wear.js): the ruts are firmer, so a line forms, but they tug at the wheels.
import { HALF } from '../constants.js';
import { clamp } from '../math.js';

export const MUD_SLOW = { 1: 0.92, 2: 0.66 };  // corner speed limit factor: bog (the ruts decide the rest), splash
/** The bogs on a built track: [start, end) runs of base samples (not the water splashes). */
export function mudRuns(tr) {
  const out = []; if (!tr.mud) return out;
  for (let b = 0; b < tr.NB; b++) if (tr.mud[b] === 1 && (b === 0 || tr.mud[b - 1] !== 1)) { let e = b; while (e < tr.NB && tr.mud[e] === 1) e++; out.push([b, e]); }
  return out;
}
export const element = {
  name: 'mud', onBranch: true,
  about: 'mud bogs and water splashes: less grip, more drag',
  tags: { mud: "true for a mud bog, 'water' for a water splash" },
  channels: { mud: tg => tg.mud === 'water' ? 2 : tg.mud ? 1 : 0 },
  speeds(ctx) {
    const { NB, nb, ch, vmax0 } = ctx, v = vmax0.slice();
    for (let i = 0; i < NB; i++) if (ch.mud[i]) for (let d = -8; d <= 0; d++) { const j = nb(i, d); vmax0[j] = Math.min(vmax0[j], v[i] * MUD_SLOW[ch.mud[i]] + 0.6 * -d); }
  },
  track(ctx, out) { out.mud = ctx.ch.mud.some(v => v) ? ctx.ch.mud : null; },
  markers: tr => {
    const out = []; if (!tr.mud) return out;
    for (let b = 0; b < tr.NB; b++) if (tr.mud[b] && (b === 0 || tr.mud[b - 1] !== tr.mud[b])) out.push({ i: tr.u0(b), label: tr.mud[b] === 2 ? 'water splash' : 'mud' });
    return out;
  }
};

// A water splash's pool: either side of the road the ground is scooped out under the water (the terrain, so a car off
// the road drops into it), out to an edge that wanders along the splash (`splashReach`), and past the ends of the
// splash the bed climbs back out with the road. render/elements/mud.js lays the water over it at the road's height
// + SPLASH_UP, so the pool is deepest a few metres out and its banks make the shoreline.
export const SPLASH_UP = 0.4, SPLASH_EXT = 9, SPLASH_DEEP = 1.3;
const outs = new WeakMap();
/** Sample i of a track with splashes: 0 in a splash, k = 1..SPLASH_EXT samples past one's end, -1 nowhere near. */
export function splashOut(tr, i) {
  let A = outs.get(tr);
  if (!A) {
    A = new Int8Array(tr.N).fill(-1); outs.set(tr, A);
    const nb = (j, d) => tr.loopN ? tr.nb0(j, d) : clamp(j + d, 0, tr.N - 1);
    for (let j = 0; j < tr.N; j++) if (tr.mud[tr.bi(j)] === 2) for (let d = -SPLASH_EXT; d <= SPLASH_EXT; d++) { const k = nb(j, d), w = Math.abs(d); if (A[k] < 0 || w < A[k]) A[k] = w; }
  }
  return A[i];
}
/** How far from the road's middle the pool reaches at sample i, on the side of lateral offset o. */
export const splashReach = (tr, i, o) => HALF + 4 + 6 * (tr.noise.n2(i * 0.045 + (o > 0 ? 3.1 : 7.7), 2.2) + 1);
/** The pool's bed at lateral offset o of sample i (Infinity: no pool there). Clear of the road and its shoulder, it
 *  deepens over 3 m to SPLASH_DEEP under the water and comes back up over the last 5 m to the reach. */
export function splashBed(tr, i, o) {
  if (!tr.mud) return Infinity;
  const out = splashOut(tr, i), a = Math.abs(o); if (out < 0 || a <= HALF + 1) return Infinity;
  const L = SPLASH_DEEP * clamp((a - HALF - 1) / 3, 0, 1) * clamp((splashReach(tr, i, o) - a) / 5, 0, 1) * clamp(1 - out / 6, 0, 1);
  return L > 0 ? tr.H[i] + SPLASH_UP - 0.1 - L : Infinity;
}
