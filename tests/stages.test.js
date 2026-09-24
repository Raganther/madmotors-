// Shape checks for section-built stages: they close, and Red Mesa stays short and jump-heavy.
import { it, expect } from 'vitest';
import M from './core-under-test.js';
import { genCircuit } from '../src/core/track/circuit.js';

it('Red Mesa Canyon: closes, five placed jumps, no straight over 90 m or backwards, under 2.1 km a lap', () => {
  const st = M.STAGES.find(s => s.name === 'Red Mesa Canyon'), g = genCircuit(st), tr = M.buildTrack(st);
  expect(g.closeGap).toBeLessThan(1.5);
  expect(tr.kicks.length).toBe(5);
  for (const sg of st.segs) if (sg[0] === 's' && typeof sg[1] === 'number') expect(sg[1]).toBeLessThanOrEqual(90);
  expect(tr.loopN).toBeLessThan(2100);
  // no section may come out backwards ({toA}/{toB} straights depend on everything before them)
  let a = 0, b = 0, phi = st.startHeading || 0;
  for (const sg of st.segs) {
    if (sg[0] === 's') { let L = sg[1]; if (typeof L === 'object') L = L.toA !== undefined ? (L.toA - a) / Math.cos(phi) : (L.toB - b) / Math.sin(phi); expect(L).toBeGreaterThan(5); a += Math.cos(phi) * L; b += Math.sin(phi) * L; }
    else { const th = sg[2] * Math.PI / 180, L = sg[1] * Math.abs(th); for (let q = 0; q < 200; q++) { phi += th / 400; a += Math.cos(phi) * L / 200; b += Math.sin(phi) * L / 200; phi += th / 400; } }
  }
  let jumps = 0; for (let i = 1; i < tr.loopN; i++) if (tr.jump[i] && !tr.jump[i - 1]) jumps++;
  expect(jumps).toBe(5);
});
