// Track report cards (core/track/report.js): every stage gets one, with sane numbers, and the pillars respond to what's
// on the track (a bare oval misses most of them; a set piece counts as a moment).
import { describe, expect, it } from 'vitest';
import { buildTrack, trackReport } from '../src/core/index.js';
import { STAGES } from '../src/data/stages/index.js';

const oval = (tags = {}) => ({ name: 'Report oval', type: 'gorge', laps: 3, seed: 3, surface: 'tarmac', hillAmp: 0, jumps: 0, armco: true,
  colors: { grassA: 0x6E9E4B, grassB: 0x4F8040, rock: 0x8E8C84, dirt: 0x8F7352, road: 0x50545C, sky: 0xB3D8E3, round: [0x4F8A3F], pine: [0x2F6A3E] },
  light: { sun: 0xFFFFFF, sunI: 1, sky: 0xCFE0F0, ground: 0x5A5A3A, hemiI: 0.6, cloud: 0.2, grade: [1, 1, 1], sat: 1 },
  segs: [['s', 200, 0, tags], ['a', 40, 180, 0, {}], ['s', 200, 0, {}], ['a', 40, 180, 0, {}]] });
describe('track report', () => {
  it('reports every stage with sane numbers', () => {
    for (const st of STAGES.filter(s => !s.arena)) {
      const R = trackReport(buildTrack(st), st);
      expect(R.len, st.name).toBeGreaterThan(200); expect(R.time, st.name).toBeGreaterThan(R.len / 40); expect(R.time, st.name).toBeLessThan(R.len / 4);
      expect(R.flat).toBeGreaterThanOrEqual(0); expect(R.flat).toBeLessThanOrEqual(1);
      expect(R.pillars.length).toBe(R.of); expect(R.score).toBe(R.pillars.filter(q => q.ok).length);
      for (const m of R.moments) expect(m.kinds.length, st.name).toBeGreaterThan(0);
    }
  });
  it('a bare oval misses the pillars; a kicker and wrecking balls count as moments', () => {
    const bare = trackReport(buildTrack(oval()), oval());
    expect(bare.big).toBe(0); expect(bare.pillars.find(q => q.id === 'moments').ok).toBe(false); expect(bare.pillars.find(q => q.id === 'alive').ok).toBe(false);
    const st = oval({ kick: 2.4, hammers: 3 }), R = trackReport(buildTrack(st), st);
    expect(R.big).toBeGreaterThan(0); expect(R.kinds).toEqual(expect.arrayContaining(['air'])); expect(R.pillars.find(q => q.id === 'alive').ok).toBe(true);
  });
});
