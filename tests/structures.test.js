// Destructible buildings and the Demolition mode (data/structures.js, core/kit/building.js, core/elements/structures.js,
// core/features/structures.js, core/modes/demolition.js): weight decides how far a car gets into a building, a hole is
// the car's shape, cracks add up, the bays come down once enough wall is gone, furniture gets shoved, rubble stays.
import { describe, it, expect } from 'vitest';
import * as M from '../src/core/index.js';
import { SANDBOXES } from '../src/data/sandboxes/index.js';
import { raceDefs } from '../src/data/cars.js';
import { vehicleById } from '../src/data/vehicles.js';
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
  it('the sandbox lays every building out off the road: brick walls of cells, rooms, bays, furniture; trees keep out', () => {
    expect(tr.structures.length).toBe(S.buildings.length);
    const R = M.createRace(W, raceDefs(vehicleById('coupe'), 1)), house = R.st.blds[0];
    expect(house.walls.length).toBeGreaterThan(4); expect(house.cells).toBeGreaterThan(400); expect(house.bays.length).toBeGreaterThan(1); expect(house.furn.length).toBeGreaterThan(4);
    for (const o of R.st.blds) expect(o.walls.length).toBeGreaterThanOrEqual(o.open ? 3 : 4);
    const obst = M.placeObstacles(tr, W.terr, S);
    for (const it of obst.items) for (const o of tr.structures) expect(M.inFootprint(o, it.x, it.z)).toBe(false);
  });
  it('a building on the road without road: true is caught when the track is built', () => {
    expect(() => M.buildTrack({ ...S, buildings: [{ type: 'house', at: 40, lat: 0 }] })).toThrow(/stands on the road/);
  });
  it('weight decides: the kart cracks a house, the coupe gets into the front room, the mixer goes out the back', () => {
    const k = ram('kart', 60); expect(k.ev.wallbreak || 0).toBe(0); expect(k.ev.crack).toBeGreaterThan(0);
    const c = ram('coupe', 100); expect(c.ev.wallbreak).toBeGreaterThan(0); expect(M.inFootprint(c.o, c.P.x, c.P.z)).toBe(true);
    const m = ram('mixer', 80); expect(m.ev.wallbreak).toBeGreaterThanOrEqual(2); expect(M.inFootprint(m.o, m.P.x, m.P.z, 1)).toBe(false);
    expect(Math.hypot(m.P.vx, m.P.vz)).toBeGreaterThan(8);
  });
  it('a hole is the shape of the car: about as wide, not much taller, with brickwork falling in over it as a stepped arch', () => {
    const m = ram('mixer', 80), w = m.R.st.walls.find(q => q.bld === m.o.id && q.side === 0), gone = (c, r) => w.hp[r * w.cols + c] <= 0 && w.type[r * w.cols + c] !== 3;
    const cols = [...Array(w.cols).keys()].filter(c => gone(c, 0)), width = (cols.at(-1) - cols[0] + 1) * w.cw;
    expect(width).toBeGreaterThan(2); expect(width).toBeLessThan(5.5);
    const top = Math.max(...cols.map(c => { let r = 0; while (r < w.rows && gone(c, r)) r++; return r; }));
    expect(top * 0.5).toBeLessThan(5);                                             // the upper floor is still there
    const edge = cols[0], mid = cols[cols.length >> 1], height = c => { let r = 0; while (r < w.rows && gone(c, r)) r++; return r; };
    expect(height(mid)).toBeGreaterThanOrEqual(height(edge));                      // higher in the middle: an arch, not a box
  });
  it('cracks add up: a light car battering the same wall gets through in the end', () => {
    let r = ram('coupe', 60, { secs: 1.5 }); const first = r.ev.wallbreak || 0;
    for (let k = 0; k < 6 && !r.R.st.walls.some(w => w.bld === r.o.id && w.by.some(b => b >= 0)); k++) r = ram('coupe', 60, { R: r.R, secs: 1.5 });
    expect(first).toBe(0); expect(r.R.st.walls.some(w => w.bld === r.o.id && w.by.some(b => b >= 0))).toBe(true);
  });
  it('furniture is shoved out of the way, and kept in by the walls that still stand', () => {
    let m = ram('mixer', 80); m = ram('mixer', 80, { R: m.R }); const R0 = M.createRace(W, raceDefs(vehicleById('coupe'), 1));   // twice through the same hole
    const moved = m.o.furn.filter(k => Math.hypot(m.R.st.furn[k].x - R0.st.furn[k].x, m.R.st.furn[k].z - R0.st.furn[k].z) > 1).length;
    expect(moved).toBeGreaterThan(0);
    for (const k of m.o.furn) if (M.inFootprint(m.o, R0.st.furn[k].x, R0.st.furn[k].z)) expect(Math.hypot(m.R.st.furn[k].x - m.o.x, m.R.st.furn[k].z - m.o.z)).toBeLessThan(30);
  });
  it('enough holes bring the bays down one by one: heaps that slow you, lumps on the ground, and in the end a collapse', () => {
    let r = ram('mixer', 80); r = ram('mixer', 80, { R: r.R, off: 3 }); r = ram('mixer', 80, { R: r.R, off: -3 });
    expect(r.o.bays.some(b => b.fallen)).toBe(true); expect(r.R.st.lumps.length).toBeGreaterThan(3);
    const h = r.R.st.heaps.find(q => q.bld === r.o.id); expect(rubbleAt(r.R.st, h.x, h.z)).toBe(2);
    for (let k = 0; k < 8 && !r.o.collapsed; k++) r = ram('mixer', 85, { R: r.R, off: [4, -4, 0, 2, -2, 4.5, -4.5, 1][k] });
    expect(r.o.collapsed).toBe(true); expect(r.o.bays.every(b => b.fallen)).toBe(true);
  });
  it('a blast breaks the cells in reach and cracks those further off', () => {
    const R = M.createRace(W, raceDefs(vehicleById('coupe'), 1)), o = R.st.blds[0];
    const n = M.blastStructures(R, o.x + Math.sin(o.f) * o.d / 2, o.z + Math.cos(o.f) * o.d / 2, 4, 40, 0);
    expect(n).toBeGreaterThan(0); expect(R.st.walls.some(w => w.bld === o.id && [...w.hp].some((v, i) => v > 0 && v < w.max[i]))).toBe(true);
  });
  it('AI cars lap the street of houses without hitting them', () => {
    seedRandom(5); const R = M.createRace(W, raceDefs(vehicleById('coupe'), 3)); R.phase = 'racing'; R.autoPlayer = true;
    for (let n = 0; n < 120 * 40; n++) M.raceStep(R, M.STEP, W);
    expect(R.st.blds.reduce((a, o) => a + o.down, 0)).toBeLessThan(30);
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
    const pts = R.demo.pts.reduce((a, b) => a + b, 0), walls = R.demo.walls.reduce((a, b) => a + b, 0); expect(pts).toBeGreaterThanOrEqual(walls); expect(walls).toBeGreaterThan(10);
    expect(M.derbyOrder(R)[0]).toBe(R.cars[R.derby.winner]);
    const order = M.derbyOrder(R); for (let k = 1; k < order.length; k++) expect(R.demo.pts[R.cars.indexOf(order[k - 1])]).toBeGreaterThanOrEqual(R.demo.pts[R.cars.indexOf(order[k])]);
  });
});
