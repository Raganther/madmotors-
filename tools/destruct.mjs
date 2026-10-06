// What each vehicle can smash (npm run destruct [-- kmh]): every vehicle against every breakable (data/breakables.js).
// For each: the slowest it breaks it at (from its mass, core/sim/impact.js), or '-' if it's too light ever to; then a
// real run on the Workshop loop's yard (data/workshop.js) at the given speed (default 90 km/h), driven by the
// simulation itself: B = broke through (speed it came out at), x = bounced off (its worst damage).
import * as M from '../src/core/index.js';
import { BREAKABLES, BREAKABLE_KINDS } from '../src/data/breakables.js';
import { VEHICLES } from '../src/data/vehicles.js';
import { raceDefs } from '../src/data/cars.js';
import { WORKSHOP_STAGE as S, YARD, YARD_AT } from '../src/data/workshop.js';
import { breakSpeed, massOf } from '../src/core/sim/impact.js';
import { PHYS } from '../src/core/constants.js';

const KMH = +(process.argv[2] || 90), tr = M.buildTrack(S), W = { tr, terr: M.buildTerrain(tr, S), surf: S.surface, armco: true };
function run(v, kind) {
  const R = M.createRace(W, raceDefs(v, 1)); R.phase = 'racing';
  const P = R.player, T = R.cars.find(c => c !== P), i = tr.startIdx + YARD_AT + YARD.indexOf(kind) * 50 - 30, sp = KMH / 3.6;
  T.hold = true; Object.assign(T, { x: tr.xs[tr.startIdx + 60], z: tr.zs[tr.startIdx + 60] });
  Object.assign(P, { x: tr.xs[i], z: tr.zs[i], y: tr.H[i], yaw: tr.th[i], vx: tr.tx[i] * sp, vz: tr.tz[i] * sp, progress: i, lastGood: i, pr: M.project(tr, tr.xs[i], tr.zs[i], i, 4, 4), hold: sp });
  let broke = false, out = 0;
  for (let n = 0; n < 120 * 2.5; n++) { M.raceStep(R, M.STEP, W); for (const e of P.events) if (e.t === 'break') { broke = true; P.hold = false; out = Math.hypot(P.vx, P.vz); } P.events.length = 0; }
  return broke ? `B ${Math.round(out * 3.6)}`.padEnd(6) : `x ${Math.round(Math.max(...Object.values(P.dmg)) * 100)}%`.padEnd(6);
}
const top = v => Math.sqrt(PHYS.ENGINE / PHYS.DRAG) * ((v.veh && v.veh.top) || 1) * 3.6;
console.log(`breaks from (km/h) | a run at ${KMH} km/h: B = broke through (km/h after), x = bounced (worst damage)\n`);
console.log('vehicle'.padEnd(16) + 'mass  tough  top  | ' + BREAKABLE_KINDS.map(k => k.padEnd(8)).join(' ') + '| ' + BREAKABLE_KINDS.map(k => k.slice(0, 6).padEnd(6)).join(' '));
for (const v of VEHICLES) {
  const c = { im: v.veh ? v.veh.im : 1, veh: v.veh }, t = top(v);
  const from = BREAKABLE_KINDS.map(k => { const s = breakSpeed(c, k) * 3.6; return (s === Infinity ? '-' : s > t ? `(${Math.ceil(s)})` : String(Math.ceil(s))).padEnd(8); });
  console.log(v.name.padEnd(16) + massOf(c).toFixed(2).padEnd(6) + String((v.veh && v.veh.tough) || 1).padEnd(7) + String(Math.round(t)).padEnd(5) + '| ' + from.join(' ') + '| ' + BREAKABLE_KINDS.map(k => run(v, k)).join(' '));
}
console.log('\n(n) = faster than its top speed: it would need a boost or a slope. Kinds: ' + BREAKABLE_KINDS.map(k => `${k} hp ${BREAKABLES[k].hp}${BREAKABLES[k].minMass ? ', mass >= ' + BREAKABLES[k].minMass : ''}`).join('; '));
