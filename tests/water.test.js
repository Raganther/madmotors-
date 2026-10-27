// Water stands level: a splash's water is flat (its lowest road + SPLASH_UP), and rain only leaves standing water where
// the road is near level or at the bottom of a hollow (tools/water-audit.mjs prints the same, stage by stage).
import { describe, expect, it } from 'vitest';
import { STAGES, buildTrack } from '../src/core/index.js';
import { poolMap, WEATHER, WEAR_OPT } from '../src/core/features/wear.js';
import { splashLevelOf, SPLASH_UP } from '../src/core/elements/mud.js';

describe('water stands level', () => {
  for (const st of STAGES) {
    if (!(st.wet > 0) && !st.segs?.some?.(g => g.mud === 'water') && !JSON.stringify(st).includes('"water"')) continue;
    it(st.name, () => {
      const tr = buildTrack(st), N = tr.NB, h = (r, d) => tr.H[tr.u0(Math.min(N - 1, Math.max(0, r + d)))];
      if (tr.mud) for (let r = 0; r < N; r++) if (tr.mud[r] === 2) {   // every sample of a splash: one level per run, no higher than its lowest road + SPLASH_UP
        const i = tr.u0(r), lv = splashLevelOf(tr, i); expect(lv).not.toBeNull(); expect(lv).toBeLessThanOrEqual(tr.H[i] + SPLASH_UP + 1e-4);
      }
      const P = st.wet > 0 ? poolMap({ tr }, { ...WEAR_OPT, standing: true }) : null;
      if (P) for (let r = 0; r < N; r++) if (P[r * 2] || P[r * 2 + 1]) expect(Math.min(Math.abs(h(r, 5) - h(r, -5)) / 10, Math.abs(h(r, 2) - h(r, -2)) / 4)).toBeLessThanOrEqual(WEATHER.SLOPE + 1e-6);
    });
  }
});
