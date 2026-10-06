// Breakables and the impact rule (data/breakables.js, core/sim/impact.js, core/features/breakables.js): heavy vehicles
// smash what light ones bounce off, and the race remembers what's broken.
import { describe, it, expect } from 'vitest';
import * as M from '../src/core/index.js';
import { breakSpeed, breaks, massOf } from '../src/core/sim/impact.js';
import { raceDefs } from '../src/data/cars.js';
import { vehicleById } from '../src/data/vehicles.js';
import { WORKSHOP_STAGE as S, YARD, YARD_AT } from '../src/data/workshop.js';

const car = id => { const v = vehicleById(id); return { im: v.veh ? v.veh.im : 1, veh: v.veh }; };
const tr = M.buildTrack(S), W = { tr, terr: M.buildTerrain(tr, S), surf: S.surface, armco: true };
function ram(id, kind, kmh) {
  const R = M.createRace(W, raceDefs(vehicleById(id), 1)); R.phase = 'racing';
  const P = R.player, i = tr.startIdx + YARD_AT + YARD.indexOf(kind) * 50 - 30, v = kmh / 3.6; R.cars.find(c => c !== P).hold = true;
  Object.assign(P, { x: tr.xs[i], z: tr.zs[i], y: tr.H[i], yaw: tr.th[i], vx: tr.tx[i] * v, vz: tr.tz[i] * v, progress: i, lastGood: i, pr: M.project(tr, tr.xs[i], tr.zs[i], i, 4, 4), hold: v });
  for (let n = 0; n < 120 * 2.5; n++) M.raceStep(R, M.STEP, W);
  return { R, P, broke: R.brk.find(o => o.kind === kind).broken };
}
describe('impact and breakables', () => {
  it('mass decides: the coupe never breaks concrete, the monster truck and the mixer do', () => {
    expect(breakSpeed(car('coupe'), 'concrete')).toBe(Infinity);
    expect(breaks(car('monster'), 'concrete', 25)).toBe(true); expect(breaks(car('mixer'), 'concrete', 17)).toBe(true);
    expect(massOf(car('mixer'))).toBeGreaterThan(massOf(car('monster')));
    expect(breaks(car('kart'), 'gate', 40)).toBe(false);   // under the gate's minimum mass
  });
  it('the yard: the coupe smashes the fence and bounces off concrete; the monster truck goes through it', () => {
    expect(ram('coupe', 'fence', 80).broke).toBe(true);
    const c = ram('coupe', 'concrete', 100); expect(c.broke).toBe(false); expect(c.P.dmg.f).toBeGreaterThan(0.5); expect(c.P.progress).toBeLessThan(tr.startIdx + YARD_AT + 4 * 50);
    const m = ram('monster', 'concrete', 100); expect(m.broke).toBe(true); expect(m.P.progress).toBeGreaterThan(tr.startIdx + YARD_AT + 4 * 50); expect(m.R.chunks.length).toBe(3);
  });
  it('toughness takes the edge off a hit', () => {
    const hit = id => { const v = vehicleById(id), c = { x: 0, z: 0, yaw: 0, hw: 1, hl: 2, im: 1, veh: v.veh, dmg: { f: 0, b: 0, l: 0, r: 0 }, panels: {}, events: [], wreckT: 0, wrecks: 0 }; M.damageCar(c, 0, 2, 20, 1, 0, -1); return c.dmg.f; };
    expect(hit('mixer')).toBeCloseTo(hit('coupe') / 1.6, 5);
  });
});
