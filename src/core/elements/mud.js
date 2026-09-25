// Mud: `mud: true` makes the section a bog (little grip, the engine bogs down, mud flies); `mud: 'water'` makes it a
// water splash: a shallow stream across the road that drags at the car. Put a splash in a dip with low ground either
// side (far/near about -1.5) so the stream has somewhere to run. The AI takes both slower.
export const MUD_SLOW = { 1: 0.8, 2: 0.66 };   // corner speed limit factor: bog, splash
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
