// The world kit (core/kit/layout.js, data/styles.js): towns laid out by rules from a style, the same every time, off
// the road, with nothing growing in them, and made of breakables of the right strength.
import { describe, it, expect } from 'vitest';
import * as M from '../src/core/index.js';
import { HALF } from '../src/core/constants.js';
import { STYLE_IDS } from '../src/data/styles.js';
import { kitStage } from '../src/data/workshop.js';
import { breaks } from '../src/core/sim/impact.js';
import { vehicleById } from '../src/data/vehicles.js';

const build = st => { const tr = M.buildTrack(st); return { tr, terr: M.buildTerrain(tr, st) }; };
const car = id => { const v = vehicleById(id); return { im: v.veh ? v.veh.im : 1, veh: v.veh }; };
describe('world kit', () => {
  for (const style of STYLE_IDS) it(`${style}: a town of houses, boundaries and gates, off the road, with nothing growing in it`, () => {
    const st = kitStage(style); expect(() => M.validateStage(st)).not.toThrow();
    const { tr, terr } = build(st), K = terr.kit, kinds = new Set(K.solid.map(p => p.kind));
    expect(K.solid.filter(p => p.kind === 'house').length).toBeGreaterThan(6);
    expect(kinds.has('yardgate') || kinds.has('gate')).toBe(true);
    for (const p of K.solid) { const q = tr.nearest(p.x, p.z); expect(q.d, `${p.kind} at ${p.x.toFixed(1)}, ${p.z.toFixed(1)}`).toBeGreaterThan(HALF + 0.5); }
    expect(terr.obst.items.filter(o => K.inZone(o.x, o.z)).length).toBe(0);
  });
  it('is the same every time', () => {
    const a = build(kitStage('village')).terr.kit.solid, b = build(kitStage('village')).terr.kit.solid;
    expect(b.map(p => [p.kind, p.x.toFixed(3), p.z.toFixed(3)])).toEqual(a.map(p => [p.kind, p.x.toFixed(3), p.z.toFixed(3)]));
  });
  it('strengths: houses never give way, a picket fence snaps, a stone wall needs weight', () => {
    expect(breaks(car('mixer'), 'house', 60)).toBe(false);
    expect(breaks(car('coupe'), 'picket', 10)).toBe(true);
    expect(breaks(car('coupe'), 'wall', 40)).toBe(false); expect(breaks(car('mixer'), 'wall', 15)).toBe(true);
  });
  it('a race has the town as breakables', () => {
    const st = kitStage('seaside'), { tr, terr } = build(st), W = { tr, terr, surf: st.surface, armco: false };
    const R = M.createRace(W, [{ name: 'p', player: true }]);
    expect(R.brk.length).toBe(terr.kit.solid.length);
  });
});
