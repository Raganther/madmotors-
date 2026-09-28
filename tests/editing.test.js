// The track editor's helpers (core/track/editing.js): the cheap section walk agrees with the real build, and "close
// the loop" really closes a lap that an edit has broken.
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { closeLoop, freeze, fromStroke, sketch } from '../src/core/track/editing.js';
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
describe('drawing a track freehand', () => {
  // a wobbly hand-drawn oval, 300 x 160 m, drawn clockwise from its right end, stopping just short of where it began
  const oval = Array.from({ length: 196 }, (_, i) => { const t = -i / 200 * Math.PI * 2; return { a: 150 * Math.cos(t) + Math.sin(i * 0.7) * 1.5, b: 80 * Math.sin(t) + Math.cos(i * 0.9) * 1.5 }; });
  it('a stroke that comes back to its start is a lap: it turns one whole circle, closes and builds', () => {
    const r = fromStroke(oval); expect(r.closed).toBe(true);
    const k = sketch(r.segs, r.heading); expect(Math.abs(Math.abs(k.turn) - 360)).toBeLessThan(0.5); expect(k.gap).toBeLessThan(25);   // near enough: closing takes up the rest
    const c = closeLoop(r.segs, r.heading); expect(c.ok, c.msg).toBe(true);
    const st = { name: 'Drawn', type: 'gorge', laps: 2, seed: 1, surface: 'tarmac', hillAmp: 2, jumps: 0, armco: true, startHeading: r.heading, segs: c.segs };
    expect(() => M.buildTrack(st)).not.toThrow();
  });
  it('an open stroke is a run of straights and curves that follows it', () => {
    const L = [...Array.from({ length: 40 }, (_, i) => ({ a: i * 3, b: 0 })), ...Array.from({ length: 40 }, (_, i) => ({ a: 120, b: i * 3 }))];
    const r = fromStroke(L); expect(r.closed).toBe(false);
    const arcs = r.segs.filter(s => s[0] === 'a'); expect(arcs.length).toBe(1); expect(Math.abs(arcs[0][2] - 90)).toBeLessThan(3);   // one left-hand corner (the stroke is smoothed a touch)
    const k = sketch(r.segs, r.heading); expect(Math.hypot(k.end.a - r.start.a - 120, k.end.b - r.start.b - 117)).toBeLessThan(8);
  });
  it('drawing on from the end of a track turns off its heading and keeps its height', () => {
    const r = fromStroke(Array.from({ length: 30 }, (_, i) => ({ a: (i + 1) * 3, b: (i + 1) * 3 })), { from: { a: 0, b: 0, phi: 0, h: 4 } });   // heading east, drawn off to the north-east
    expect(r.segs[0][0]).toBe('a'); expect(r.segs.every(s => (s[0] === 's' ? s[2] : s[3]) === 4)).toBe(true);
  });
});
