// Tarmac handling (core/sim/car.js): at speed on tarmac the nose turns little faster than the tyres can carry the car,
// so full lock holds a tight line instead of swinging round into a slide; a tarmac car (data/vehicles.js `planted`)
// slides least of all; on gravel the cars still slide as they always did. Steering past what the tyres can carry
// scrubs speed off instead, so the turn tightens by itself and a corner at full lock needs no brake.
import { describe, expect, it } from 'vitest';
import * as M from '../src/core/index.js';
import { raceDefs } from '../src/data/cars.js';
import { vehicleById } from '../src/data/vehicles.js';

const stage = (surface) => ({ name: 'Handling ' + surface, type: 'gorge', laps: 1, seed: 5, surface, hillAmp: 0, jumps: 0, armco: false, traffic: null,
  colors: { grassA: 0x6E9E4B, grassB: 0x4F8040, rock: 0x8E8C84, dirt: 0x8F7352, road: 0x50545C, sky: 0xB3D8E3, round: [0x4F8A3F], pine: [0x2F6A3E] },
  light: { sun: 0xFFFFFF, sunI: 1, sky: 0xCFE0F0, ground: 0x5A5A3A, hemiI: 0.6, cloud: 0.2, grade: [1, 1, 1], sat: 1 },
  segs: [['s', 400, 0]] });
/** The worst slide (sideways speed, m/s) of vehicle id at full lock from 120 km/h, while it's still on the road. */
function slide(id, surface) {
  const st = stage(surface), tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: surface, armco: false };
  const R = M.createRace(W, raceDefs(vehicleById(id), 1)); R.phase = 'racing';
  const P = R.player, i = tr.startIdx + 60, lat = -4.5; for (const c of R.cars) if (c !== P) c.hold = true;
  Object.assign(P, { x: tr.xs[i] + tr.rx[i] * lat, z: tr.zs[i] + tr.rz[i] * lat, y: tr.H[i], yaw: tr.th[i], vx: tr.tx[i] * 33, vz: tr.tz[i] * 33, pr: M.project(tr, tr.xs[i], tr.zs[i], i, 4, 4) });
  let worst = 0;
  for (let n = 0; n < 120; n++) { Object.assign(P.inp, { throttle: 1, brake: 0, steer: 1, handbrake: 0 }); M.raceStep(R, M.STEP, W); if (P.surface !== surface) break; worst = Math.max(worst, Math.abs(P.vr)); }
  return worst;
}
/** How far (radians) vehicle id's path has turned 0.5 s into full lock at full throttle from 120 km/h, and its speed then. */
function turnIn(id, surface = 'tarmac') {
  const st = stage(surface), tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: surface, armco: false };
  const R = M.createRace(W, raceDefs(vehicleById(id), 1)); R.phase = 'racing';
  const P = R.player, i = tr.startIdx + 60, lat = -4.5; for (const c of R.cars) if (c !== P) c.hold = true;
  Object.assign(P, { x: tr.xs[i] + tr.rx[i] * lat, z: tr.zs[i] + tr.rz[i] * lat, y: tr.H[i], yaw: tr.th[i], vx: tr.tx[i] * 33, vz: tr.tz[i] * 33, pr: M.project(tr, tr.xs[i], tr.zs[i], i, 4, 4) });
  const h0 = Math.atan2(P.vx, P.vz);
  for (let n = 0; n < 60; n++) { Object.assign(P.inp, { throttle: 1, brake: 0, steer: 1, handbrake: 0 }); M.raceStep(R, M.STEP, W); }
  const d = Math.atan2(P.vx, P.vz) - h0; return { turned: Math.abs(Math.atan2(Math.sin(d), Math.cos(d))), kmh: Math.hypot(P.vx, P.vz) * 3.6 };
}
describe('handling on tarmac', () => {
  it('full lock at speed holds a line on tarmac: far less slide than on gravel', () => {
    expect(slide('coupe', 'tarmac')).toBeLessThan(slide('coupe', 'gravel') * 0.6);
  });
  it('a tarmac car (sports & supercars) slides least of all on tarmac', () => {
    const gt = slide('gt', 'tarmac'), coupe = slide('coupe', 'tarmac'), hot = slide('hotrod', 'tarmac');
    expect(gt).toBeLessThan(coupe); expect(gt).toBeLessThan(hot); expect(gt).toBeLessThan(5);
  });
  it('full lock tightens the turn on its own: steering past the grip scrubs speed rather than running wide', () => {
    // (with the nose held to the grip alone, the coupe came out at 118 km/h having turned 0.40 rad; the gt 123 and 0.42)
    const c = turnIn('coupe'), g = turnIn('gt');
    expect(c.kmh).toBeLessThan(112); expect(c.turned).toBeGreaterThan(0.41);
    expect(g.kmh).toBeLessThan(116); expect(g.turned).toBeGreaterThan(0.43);
  });
});
