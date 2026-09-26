// Weapons balance (npm run balance): each hit incident's cost = time the victim took over the next 4 s' stretch minus what the same car took
// over that same stretch in the identical race with weapons off. Aim for roughly 1 s per use for every weapon.
//   node tools/balance-weapons.mjs [stage,stage,...]
import * as M from '../src/core/index.js';
import { raceDefs } from '../src/data/cars.js';
import { VEHICLES } from '../src/data/vehicles.js';
const HIT = { 'missile-hit': 'missile', 'bullet-hit': 'gun', 'oil-hit': 'oil', 'pulse-hit': 'pulse', 'harpoon-hit': 'harpoon', 'door-hit': 'door', 'hammer-hit': 'hammer' };
const agg = {}; const add = (k, f, v) => { agg[k] = agg[k] || { use: 0, loss: 0, n: 0 }; agg[k][f] += v; };
const stages = process.argv[2] ? process.argv[2].split(',').map(Number) : [0, 4, 9, 11, 12, 13, 15];
for (const si of stages) for (const seedBase of [1, 2]) {
  const st = M.STAGES[si], tr = M.buildTrack(st), W = { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco, traffic: st.traffic };
  const base = [];
  for (const weapons of [false, true]) {
    let s = 777 * seedBase; Math.random = () => (s = (s * 16807) % 2147483647) / 2147483647;
    const R = M.createRace(W, raceDefs(VEHICLES[0], 7), { weapons }); R.phase = 'racing'; R.autoPlayer = true; R.hzT = 1e9;
    let t = 0; const watch = [];
    R.cars.forEach((c, k) => { c._k = k; if (!weapons) base[k] = []; });
    const tAt = (k, p) => { const a = base[k], i = Math.floor(p); return a[i] ?? a[a.length - 1]; };
    while (t < 400 && !R.cars.every(c => c.finished)) { M.raceStep(R, 1 / 120, W); t += 1 / 120;
      for (const c of R.cars) {
        if (!weapons) { const a = base[c._k]; while (a.length <= c.progress) a.push(t); }
        for (const e of c.events) {
          if (e.t === 'use') add(e.item, 'use', 1);
          const k = HIT[e.t]; if (k && weapons && !watch.some(w => w.c === c && w.k === k && t - w.t0 < 1.5)) watch.push({ c, k, t0: t, p0: c.progress });
        }
        c.events.length = 0;
      }
      for (let j = watch.length - 1; j >= 0; j--) { const w = watch[j]; if (t - w.t0 >= 4 || w.c.finished) { const dt = t - w.t0, exp = tAt(w.c._k, w.c.progress) - tAt(w.c._k, w.p0); if (exp > 0.5) { add(w.k, 'loss', dt - exp); add(w.k, 'n', 1); } watch.splice(j, 1); } }
    }
  }
}
for (const [k, v] of Object.entries(agg)) console.log(k.padEnd(8), 'uses', String(v.use).padStart(4), 'incidents', String(v.n).padStart(4), 'lost per incident', (v.loss / Math.max(1, v.n)).toFixed(2) + 's', 'per use', v.use ? (v.loss / v.use).toFixed(2) + 's' : '-');
