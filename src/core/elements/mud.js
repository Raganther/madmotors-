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

// A water splash's water is level, like any water that stands: at the lowest point of the road under the splash
// + SPLASH_UP (splashLevelOf). A splash laid on a slope is wet only at its low end, the road climbing out of the water
// above it (sim/car.js: only there is it a ford). Either side of the road the ground is scooped out under the water
// (the terrain, so a car off the road drops into it), out to an edge that wanders along the splash (`splashReach`),
// and past the ends of the splash the bed climbs back out. render/elements/mud.js lays the water over it at that level.
export const SPLASH_UP = 0.4, SPLASH_EXT = 9, SPLASH_DEEP = 1.3;
const cache = new WeakMap();
// per sample: out = 0 in a splash, k = 1..SPLASH_EXT samples past one's end, -1 nowhere near; lev = that splash's level
function splashes(tr) {
  let C = cache.get(tr); if (C) return C;
  const N = tr.N, out = new Int8Array(N).fill(-1), lev = new Float32Array(N).fill(NaN);
  const nb = (j, d) => tr.loopN ? tr.nb0(j, d) : clamp(j + d, 0, N - 1), wet = j => tr.mud[tr.bi(j)] === 2;
  for (let j = 0; j < N; j++) {
    if (!wet(j) || wet(nb(j, -1))) continue;                                       // the first sample of a run
    let n = 0, lo = Infinity; while (n < 400 && wet(nb(j, n))) { lo = Math.min(lo, tr.H[nb(j, n)]); n++; }
    for (let d = -SPLASH_EXT; d < n + SPLASH_EXT; d++) { const k = nb(j, d), w = d < 0 ? -d : d >= n ? d - n + 1 : 0; if (out[k] < 0 || w < out[k]) { out[k] = w; lev[k] = lo + SPLASH_UP; } }
  }
  cache.set(tr, C = { out, lev }); return C;
}
/** Sample i of a track with splashes: 0 in a splash, k = 1..SPLASH_EXT samples past one's end, -1 nowhere near. */
const lap1 = (tr, i) => tr.loopN ? tr.u0(tr.bi(i)) : i;                          // (on a circuit, laps 2+ map onto lap 1's samples)
export const splashOut = (tr, i) => tr.mud ? splashes(tr).out[lap1(tr, i)] : -1;
/** The water level of the splash at (or near) sample i, or null. */
export function splashLevelOf(tr, i) { if (!tr.mud) return null; const v = splashes(tr).lev[lap1(tr, i)]; return Number.isNaN(v) ? null : v; }
/** How far from the road's middle the pool reaches at sample i, on the side of lateral offset o. */
export const splashReach = (tr, i, o) => HALF + 4 + 6 * (tr.noise.n2(i * 0.045 + (o > 0 ? 3.1 : 7.7), 2.2) + 1);
/** The pool's bed at lateral offset o of sample i (Infinity: no pool there). Clear of the road and its shoulder, it
 *  deepens over 3 m to SPLASH_DEEP under the water and comes back up over the last 5 m to the reach. */
export function splashBed(tr, i, o) {
  if (!tr.mud) return Infinity;
  const out = splashOut(tr, i), a = Math.abs(o); if (out < 0 || a <= HALF + 1) return Infinity;
  const lv = splashLevelOf(tr, i), under = clamp((lv - tr.H[i]) / SPLASH_UP, 0, 1);   // only where the road here is under the water (no pit beside a dry road)
  const L = SPLASH_DEEP * clamp((a - HALF - 1) / 3, 0, 1) * clamp((splashReach(tr, i, o) - a) / 5, 0, 1) * clamp(1 - out / 6, 0, 1) * under;
  return L > 0 ? lv - 0.1 - L : Infinity;
}
