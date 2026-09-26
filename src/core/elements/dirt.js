// Dirt: `dirt: true` makes the section a loose dirt track (gravel grip and dust, a dirt colour, no kerbs), on a tarmac
// stage too. Put it on a branch (stage.branches) and it's an off-road shortcut: shorter than the road it cuts off,
// rougher to drive, so it pays for a car that's behind and has the nerve (and suits the off-road vehicles).
// The AI takes dirt at the speeds gravel allows.
import { SURF } from '../constants.js';
export const element = {
  name: 'dirt', onBranch: true,
  about: 'a loose dirt stretch (off-road shortcuts)',
  tags: { dirt: 'true for a dirt track surface' },
  channels: { dirt: tg => tg.dirt ? 1 : 0 },
  walls(ctx) { const { N0, ch, kerbL0, kerbR0 } = ctx; for (let i = 0; i < N0; i++) if (ch.dirt[i]) kerbL0[i] = kerbR0[i] = 0; },
  speeds(ctx) {
    const { NB, ch, vmax0, stage } = ctx, k = Math.sqrt(SURF.gravel.latMax / SURF[stage.surface].latMax);
    if (k < 1) for (let i = 0; i < NB; i++) if (ch.dirt[i]) vmax0[i] *= k;
  },
  track(ctx, out) { out.dirt = ctx.ch.dirt.some(v => v) ? ctx.ch.dirt : null; },
  markers: tr => {
    const out = []; if (!tr.dirt) return out;
    for (let b = 0; b < tr.NB; b++) if (tr.dirt[b] && (b === 0 || !tr.dirt[b - 1])) out.push({ i: tr.u0(b), label: 'dirt' });
    return out;
  }
};
