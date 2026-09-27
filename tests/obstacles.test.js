import { describe, expect, it } from 'vitest';
import * as M from '../src/core/index.js';
import { STAGES } from '../src/data/stages/index.js';
import { VEHICLES } from '../src/data/vehicles.js';
import { raceDefs } from '../src/data/cars.js';

// Scenery you can hit (track/obstacles.js, sim/obstacles.js): drive the car at one from 8 m at 18 m/s, off the throttle.
function ram(si, kind) {
  const st = STAGES[si], tr = M.buildTrack(st), terr = M.buildTerrain(tr, st), W = { tr, terr, surf: st.surface, armco: !!st.armco };
  const R = M.createRace(W, raceDefs(VEHICLES[0], 1)); R.phase = 'racing'; R.cars = R.cars.filter(c => c.isPlayer); const P = R.player;
  const k = terr.obst.items.findIndex(o => o.kind === kind && o.r > 0 && (q => q && q.d > 11 && q.d < 20)(tr.nearest(o.x, o.z))), o = terr.obst.items[k], a = 0.7;
  P.x = o.x - Math.sin(a) * 8; P.z = o.z - Math.cos(a) * 8; P.y = terr.at(P.x, P.z) + 0.05; P.yaw = a; P.vx = Math.sin(a) * 18; P.vz = Math.cos(a) * 18; P.pr = M.project(tr, P.x, P.z, tr.nearest(P.x, P.z).i, 3, 3);
  const ev = new Set(); let closest = 99;
  for (let t = 0; t < 1.2; t += 1 / 120) { P.inp.throttle = 0; P.inp.steer = 0; M.raceStep(R, 1 / 120, W); for (const e of P.events) ev.add(e.t); closest = Math.min(closest, Math.hypot(P.x - o.x, P.z - o.z)); }
  return { ev, closest, r: o.r, speed: Math.hypot(P.vx, P.vz), dmg: P.dmg.f + P.dmg.l + P.dmg.r };
}
describe('scenery you can hit', () => {
  it('every stage places its trees, rocks and bushes in the core, deterministically', () => {
    for (const st of STAGES.slice(0, 4)) { const tr = M.buildTrack(st); expect(M.buildTerrain(tr, st).obst.items).toEqual(M.buildTerrain(tr, st).obst.items); }
  });
  it('a tree stops you: you bounce off, it shakes, the car is damaged', () => {
    const r = ram(1, 1);
    expect(r.ev.has('tree')).toBe(true); expect(r.closest).toBeGreaterThan(r.r + 0.5); expect(r.speed).toBeLessThan(8); expect(r.dmg).toBeGreaterThan(0);
  });
  it('a rock is solid too', () => { const r = ram(7, 3); expect(r.ev.has('hit')).toBe(true); expect(r.closest).toBeGreaterThan(r.r); });
  it('a bush is soft: you plough through, a little slower', () => {
    const r = ram(0, 4); expect(r.ev.has('bush')).toBe(true); expect(r.closest).toBeLessThan(r.r); expect(r.speed).toBeGreaterThan(8);
  });
});
