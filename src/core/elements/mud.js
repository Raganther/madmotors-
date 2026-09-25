// Mud: `mud: true` makes the section a bog (little grip, the engine bogs down, mud flies); `mud: 'water'` makes it a
// water splash: a shallow stream across the road that drags at the car. Put a splash in a dip with low ground either
// side (far/near about -1.5) so the stream has somewhere to run. The AI takes both slower. Bogs rut as the race goes
// on (features/mud.js): the ruts are firmer, so a line forms, but they tug at the wheels.
export const MUD_SLOW = { 1: 0.92, 2: 0.66 };  // corner speed limit factor: bog (the ruts decide the rest), splash
// ruts in the bogs (features/mud.js): cells across the road and their width (m), wheel half-track, depth dug per metre
// per wheel, share dug into the cells beside, sideways pull toward the bottom of a rut (m/s² per unit of depth change
// per metre), speed scrubbed climbing out
export const RUT = { COLS: 28, CELL: 0.5, TRACK: 0.95, DIG: 0.2, SPREAD: 0.35, TUG: 4.5, SCRUB: 0.4 };
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
