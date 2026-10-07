// Car ratings (G1), measured, not guessed: `npm run ratings` writes src/data/ratings-data.js, which data/ratings.js turns
// into pace and toughness bands (D C B A S) for any vehicle with any build (data/parts.js).
//   pace       each vehicle's solo AI lap vs the coupe's, % of lap time, on tarmac and on loose stages (as npm run
//              balance); and how much a 10% change in accel, top, grip and off moves the coupe's lap (the
//              sensitivities a build's parts are priced with)
//   toughness  two crashes on the Workshop loop: into a parked coupe side-on at 80 km/h (the damage it takes and
//              deals) and into the Armco at 90 km/h, 25 degrees (the damage it takes); the coupe is 1
// The file carries the key of what it was measured from (tools/ratings-key.js): tests/ratings.test.js fails when it's stale.
import fs from 'node:fs';
import * as M from '../src/core/index.js';
import { STAGES } from '../src/data/stages/index.js';
import { VEHICLES, vehicleById } from '../src/data/vehicles.js';
import { raceDefs } from '../src/data/cars.js';
import { WORKSHOP_STAGE } from '../src/data/workshop.js';
import { ratingsKey } from './ratings-key.js';

const SETS = { tarmac: [4, 11, 13, 15], loose: [2, 9, 10, 14] }, STATS = ['accel', 'top', 'grip', 'off'], STD = { accel: 1, top: 1, grip: 1, off: 1, im: 1 };
const seed = () => { let s = 7; Math.random = () => { s = (s * 16807) % 2147483647; return s / 2147483647; }; };
const worlds = Object.fromEntries(Object.entries(SETS).map(([k, sts]) => [k, sts.map(si => { const st = STAGES[si], tr = M.buildTrack(st); return { tr, W: { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco } }; })]));
// one solo AI lap (trains off: pace, not luck)
function lap(v, { tr, W }) {
  seed(); const R = M.createRace(W, raceDefs(v, 1)); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9; R.cars = R.cars.filter(c => c.isPlayer); R.trains = [];
  const P = R.player, end = tr.loopN ? tr.startIdx + tr.loopN : tr.finishIdx; let t = 0;
  while (t < 200 && P.progress < end) { M.raceStep(R, 1 / 120, W); t += 1 / 120; }
  return t;
}
const coupe = vehicleById('coupe'), base = Object.fromEntries(Object.keys(SETS).map(k => [k, worlds[k].map(w => lap(coupe, w))]));
const pct = (v, k) => { const a = worlds[k].map((w, i) => 100 * (lap(v, w) / base[k][i] - 1)); return a.reduce((x, y) => x + y, 0) / a.length; };
const r2 = x => Math.round(x * 100) / 100;
// crash tests on the Workshop loop: the car (any def) into a parked standard coupe, and into the Armco
const ws = { tr: M.buildTrack(WORKSHOP_STAGE) }; ws.W = { tr: ws.tr, terr: M.buildTerrain(ws.tr, WORKSHOP_STAGE), surf: WORKSHOP_STAGE.surface, armco: true };
function place(c, idx, lat, sp, dyaw = 0) {
  const n = M.makeCar(ws.W, idx, lat, c.def);
  for (const k of ['x', 'y', 'z', 'yaw', 'pr', 'onGround', 'airT', 'progress', 'lastGood', 'lap']) c[k] = n[k];
  c.yaw += dyaw; c.vx = Math.sin(c.yaw) * sp; c.vz = Math.cos(c.yaw) * sp; c.vy = 0;
}
const total = c => Object.values(c.dmg).reduce((a, b) => a + b, 0);
function crash(v, kind) {
  seed(); const me = raceDefs(v, 1).find(d => d.player), R = M.createRace(ws.W, [me, { name: 't', skill: 0.9 }]); R.phase = 'racing';
  const P = R.player, T = R.cars.find(c => c !== P), s0 = ws.tr.startIdx + 10, sp = (kind === 'wall' ? 90 : 80) / 3.6;
  place(P, s0, 0, sp, kind === 'wall' ? 0.44 : 0); P.hold = sp;
  if (kind === 'tbone') place(T, s0 + 40, 0, 0, Math.PI / 2); else place(T, s0 + 250, 3, 0);
  T.hold = true;
  for (let n = 0; n < 120 * 3; n++) { M.raceStep(R, M.STEP, ws.W); for (const c of R.cars) c.events.length = 0; }
  return { taken: total(P), dealt: total(T) };
}
const toughRaw = v => { const a = crash(v, 'tbone'), b = crash(v, 'wall'); return { dealt: a.dealt, taken: a.taken + b.taken }; };

const c0 = toughRaw(coupe), cars = {};
for (const v of VEHICLES) {
  const t = v.id === 'coupe' ? c0 : toughRaw(v);
  cars[v.id] = { tarmac: v.id === 'coupe' ? 0 : r2(pct(v, 'tarmac')), loose: v.id === 'coupe' ? 0 : r2(pct(v, 'loose')), tough: r2(Math.sqrt(t.dealt / c0.dealt) * (c0.taken / Math.max(1e-3, t.taken))) };
  console.log(v.id.padEnd(10), String(cars[v.id].tarmac).padStart(6), String(cars[v.id].loose).padStart(6), String(cars[v.id].tough).padStart(6));
}
// sensitivities: % lap change per ln(multiplier), from the coupe with each stat 10% up
const sens = {};
for (const k of Object.keys(SETS)) { sens[k] = {}; for (const s of STATS) sens[k][s] = r2(pct({ ...coupe, veh: { ...STD, [s]: 1.1 } }, k) / Math.log(1.1)); }
console.log('sensitivities (% lap per ln x):', JSON.stringify(sens));
fs.writeFileSync(new URL('../src/data/ratings-data.js', import.meta.url), '// Written by `npm run ratings` (tools/ratings.mjs): measured, do not edit. data/ratings.js reads it.\nexport default ' + JSON.stringify({ key: ratingsKey(), sens, cars }, null, 1) + ';\n');
console.log('wrote src/data/ratings-data.js');
