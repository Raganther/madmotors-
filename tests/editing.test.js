// The track editor's helpers (core/track/editing.js): the cheap section walk agrees with the real build, and "close
// the loop" really closes a lap that an edit has broken.
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { closeLoop, freeze, sketch } from '../src/core/track/editing.js';
const gorge = M.STAGES.filter(s => s.type === 'gorge');
describe('track editing', () => {
  it('every gorge circuit, walked section by section, comes back to its start line', () => {
    for (const st of gorge) {
      const k = sketch(freeze(st.segs, st.startHeading || 0), st.startHeading || 0);
      expect(k.gap, st.name).toBeLessThan(0.6); expect(Math.abs(k.turn - Math.round(k.turn / 360) * 360), st.name).toBeLessThan(0.5);   // a loop, or a figure of eight
    }
  });
  it('an edited lap that no longer closes is closed by stretching two straights and turning the last curve', () => {
    for (const st of gorge.slice(0, 4)) {
      const h = st.startHeading || 0, segs = freeze(st.segs, h);
      const a = segs.findIndex(sg => sg[0] === 'a'), s = segs.findIndex(sg => sg[0] === 's' && sg[1] > 20);
      segs[a] = [...segs[a]]; segs[a][2] += Math.sign(segs[a][2]) * 8; segs[s] = [...segs[s]]; segs[s][1] += 12;   // a sharper corner, a longer straight
      expect(sketch(segs, h).gap, st.name).toBeGreaterThan(5);
      const r = closeLoop(segs, h);
      expect(r.ok, st.name + ': ' + r.msg).toBe(true);
      const k = sketch(r.segs, h); expect(k.gap).toBeLessThan(0.05); expect(Math.abs(k.turn - Math.round(k.turn / 360) * 360)).toBeLessThan(0.01);
      expect(() => M.buildTrack({ ...st, segs: r.segs, branches: [] }), st.name).not.toThrow();
    }
  });
});
