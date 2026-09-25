// Ice: `ice: true` glazes the section's road with ice (the verges stay snow). Hardly any grip: brake before it, keep
// the wheels straight, and don't touch the throttle hard mid-corner. The AI takes it at ICE_SLOW of its usual corner
// speed and starts slowing a little before. Best on the fast downhill bends of a snow stage.
export const ICE_SLOW = 0.7;
export const element = {
  name: 'ice', onBranch: true,
  about: 'an ice patch across the road: hardly any grip',
  tags: { ice: 'true to glaze the section with ice' },
  channels: { ice: tg => tg.ice ? 1 : 0 },
  speeds(ctx) {
    const { NB, nb, ch, vmax0 } = ctx, v = vmax0.slice();
    for (let i = 0; i < NB; i++) if (ch.ice[i]) for (let d = -14; d <= 0; d++) { const j = nb(i, d); vmax0[j] = Math.min(vmax0[j], v[i] * ICE_SLOW + 0.5 * -d); }
  },
  track(ctx, out) { out.ice = ctx.ch.ice.some(v => v) ? ctx.ch.ice : null; },
  markers: tr => {
    const out = []; if (!tr.ice) return out;
    for (let b = 0; b < tr.NB; b++) if (tr.ice[b] && (b === 0 || !tr.ice[b - 1])) out.push({ i: tr.u0(b), label: 'ice' });
    return out;
  }
};
