// Vehicle balance (npm run balance): each vehicle's solo AI lap vs the coupe's, % of lap time, averaged over tarmac and
// loose stages (trains off, so it's pace, not luck). Specialists should win their surface by a few % and pay on the other.
import * as M from '../src/core/index.js';
import { STAGES } from '../src/data/stages/index.js';
import { VEHICLES } from '../src/data/vehicles.js';
import { raceDefs } from '../src/data/cars.js';
const sets = { tarmac: [4, 11, 13, 15], loose: [2, 9, 10, 14] }, res = {};
for (const [name, sts] of Object.entries(sets)) for (const si of sts) {
  const st = STAGES[si], tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco }; let base = 0;
  for (const v of VEHICLES) {
    let seed = 7; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const R = M.createRace(W, raceDefs(v, 1)); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9; R.cars = R.cars.filter(c => c.isPlayer); R.trains = [];
    const P = R.player, end = tr.loopN ? tr.startIdx + tr.loopN : tr.finishIdx; let t = 0;
    while (t < 200 && P.progress < end) { M.raceStep(R, 1 / 120, W); t += 1 / 120; }
    if (v.id === 'coupe') base = t;
    ((res[v.id] = res[v.id] || {})[name] = res[v.id][name] || []).push(100 * (t / base - 1));
  }
}
const avg = a => a.reduce((x, y) => x + y, 0) / a.length;
console.log('vehicle    tarmac%  loose%   (negative = faster than the coupe)');
for (const [k, r] of Object.entries(res)) console.log(k.padEnd(10), avg(r.tarmac).toFixed(1).padStart(6), avg(r.loose).toFixed(1).padStart(7));
