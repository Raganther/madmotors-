// Destructible buildings and the Demolition mode (data/structures.js, core/elements/structures.js,
// core/features/structures.js, core/modes/demolition.js): weight decides how far a car gets into a building, cracks
// add up, a building comes down once enough of it is gone, and rubble stays on the ground.
import { describe, it, expect } from 'vitest';
import * as M from '../src/core/index.js';
import { SANDBOXES } from '../src/data/sandboxes/index.js';
import { raceDefs } from '../src/data/cars.js';
import { vehicleById } from '../src/data/vehicles.js';
import { STRUCT } from '../src/data/structures.js';
import { rubbleAt } from '../src/core/features/structures.js';
import { seedRandom } from './scenarios.js';

const S = SANDBOXES.structures, tr = M.buildTrack(S), W = { tr, terr: M.buildTerrain(tr, S), surf: S.surface, armco: false };
/** car `id` driven straight at building `b`'s front from `back` m out, held at `kmh`, for `secs`. */
function ram(id, kmh, { b = 0, R = null, back = 22, secs = 2.5, off = 0 } = {}) {
  R = R || M.createRace(W, raceDefs(vehicleById(id), 1)); R.phase = 'racing';
  const P = R.player, o = R.st.blds[b], sp = kmh / 3.6, yaw = Math.atan2(-Math.sin(o.f), -Math.cos(o.f));
  const x = o.x + Math.sin(o.f) * back + Math.cos(o.f) * off, z = o.z + Math.cos(o.f) * back - Math.sin(o.f) * off;
  for (const c of R.cars) if (c !== P) c.hold = true;
  Object.assign(P, { x, z, yaw, vx: Math.sin(yaw) * sp, vz: Math.cos(yaw) * sp, hold: sp, pr: M.project(tr, x, z, tr.nearest(x, z).i, 4, 4) });
  const ev = {}; for (let n = 0; n < 120 * secs; n++) { M.raceStep(R, M.STEP, W); for (const e of P.events) ev[e.t] = (ev[e.t] || 0) + 1; P.events.length = 0; }
  return { R, P, o, ev };
}
describe('destructible buildings', () => {
  it('the sandbox places every building off the road, as a ring of panels, and trees keep out of them', () => {
    expect(tr.structures.length).toBe(S.buildings.length);
    const R = M.createRace(W, raceDefs(vehicleById('coupe'), 1));
    for (const o of R.st.blds) expect(o.panels.length).toBeGreaterThan(o.open ? 3 : 6);
    const obst = M.placeObstacles(tr, W.terr, S);
    for (const it of obst.items) for (const o of tr.structures) expect(Math.abs(it.x - o.x) < o.w / 2 && Math.abs(it.z - o.z) < o.w / 2 && Math.hypot(it.x - o.x, it.z - o.z) < Math.min(o.w, o.d) / 2).toBe(false);
  });
  it('a building on the road without road: true is caught when the track is built', () => {
    expect(() => M.buildTrack({ ...S, buildings: [{ type: 'house', at: 40, lat: 0 }] })).toThrow(/stands on the road/);
  });
  it('weight decides: the kart cracks a house, the coupe gets in, the mixer goes through and out the back', () => {
    const k = ram('kart', 100); expect(k.ev.wallbreak || 0).toBe(0); expect(k.ev.crack).toBeGreaterThan(0); expect(k.R.st.panels.some(p => p.dmg > 0)).toBe(true);
    const c = ram('coupe', 100); expect(c.ev.wallbreak).toBeGreaterThan(0); expect(M.inFootprint(c.o, c.P.x, c.P.z)).toBe(true);   // in the front room
    const m = ram('mixer', 80); expect(m.ev.wallbreak).toBeGreaterThanOrEqual(2); expect(M.inFootprint(m.o, m.P.x, m.P.z, 1)).toBe(false);   // out the other side
    expect(Math.hypot(m.P.vx, m.P.vz)).toBeGreaterThan(10);
  });
  it('cracks add up: a light car battering the same wall gets through in the end', () => {
    let r = ram('coupe', 75, { secs: 1.5 }); const first = r.ev.wallbreak || 0;
    for (let k = 0; k < 4 && !r.R.st.panels.some(p => p.broken); k++) r = ram('coupe', 75, { R: r.R, secs: 1.5 });
    expect(first).toBe(0); expect(r.R.st.panels.some(p => p.broken)).toBe(true);
  });
  it('enough holes bring it down: a heap that slows you, lumps on the ground, a collapse event', () => {
    let r = ram('mixer', 80); r = ram('mixer', 80, { R: r.R, off: 3 }); r = ram('mixer', 80, { R: r.R, off: -3 });
    expect(r.o.collapsed).toBe(true); expect(r.o.down).toBe(r.o.panels.length); expect(r.R.st.lumps.length).toBeGreaterThan(3);
    expect(rubbleAt(r.R.st, r.o.x, r.o.z)).toBe(2);
    expect(r.R.st.panels.filter(p => p.bld === r.o.id).every(p => p.broken)).toBe(true);
    expect(r.o.down).toBeGreaterThanOrEqual(Math.ceil(r.o.panels.length * STRUCT.COLLAPSE));
  });
  it('a blast breaks walls in reach and cracks those further off', () => {
    const R = M.createRace(W, raceDefs(vehicleById('coupe'), 1)), o = R.st.blds[0];
    const n = M.blastStructures(R, o.x + Math.sin(o.f) * o.d / 2, o.z + Math.cos(o.f) * o.d / 2, 4, 60, 0);
    expect(n).toBeGreaterThan(0); expect(R.st.panels.some(p => !p.broken && p.dmg > 0)).toBe(true);
  });
  it('AI cars lap the street of houses without hitting them', () => {
    seedRandom(5); const R = M.createRace(W, raceDefs(vehicleById('coupe'), 3)); R.phase = 'racing'; R.autoPlayer = true;
    for (let n = 0; n < 120 * 40; n++) M.raceStep(R, M.STEP, W);
    expect(R.st.panels.filter(p => p.broken).length).toBeLessThan(3);
    for (const c of R.cars) expect(c.respawns).toBe(0);
  });
});
describe('demolition', () => {
  const D = M.STAGES.find(s => s.demolition), dtr = M.buildTrack(D), DW = { tr: dtr, terr: M.buildTerrain(dtr, D), surf: D.surface, armco: false };
  it('the AI knocks the yard down against the clock; heavy cars score more; the score is what is down', () => {
    seedRandom(3); const R = M.createRace(DW, raceDefs(vehicleById('coupe'), 5), { mode: 'demolition' }); R.phase = 'racing'; R.autoPlayer = true;
    let n = 0; while (R.derby.phase === 'run' && n++ < 120 * 200) M.raceStep(R, M.STEP, DW);
    expect(R.derby.phase).toBe('over');
    const down = R.st.blds.filter(o => o.collapsed).length; expect(down).toBeGreaterThan(R.st.blds.length / 3);
    const pts = R.demo.pts.reduce((a, b) => a + b, 0), walls = R.st.panels.filter(p => p.broken && p.by >= 0).length; expect(pts).toBeGreaterThanOrEqual(walls);
    expect(M.derbyOrder(R)[0]).toBe(R.cars[R.derby.winner]);
    const order = M.derbyOrder(R); for (let k = 1; k < order.length; k++) expect(R.demo.pts[R.cars.indexOf(order[k - 1])]).toBeGreaterThanOrEqual(R.demo.pts[R.cars.indexOf(order[k])]);
  });
});
