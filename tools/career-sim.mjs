// Career pacing (npm run career -- [tier ...] [--car id] [--skill s,s] [--upg n]): races every round of each tier's
// events with the player driven by the AI at a few skills (0.88 ~ a casual player, 0.95 ~ a good one), in the car
// given (default: the tier's natural pick), and prints the finishing places, stars and cash. Use it to tune TIERS
// (skill, pay) and the upgrade and rival levels: a good player in a tier-appropriate car should be on the podium.
import * as M from '../src/core/index.js';
import { STAGES } from '../src/data/stages/index.js';
import { SHOP, TIERS, allowed, careerDefs, newCareer, roundsOf, scoreRace, tierCars } from '../src/data/career.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const want = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const skills = opt('skill', '0.88,0.95').split(',').map(Number), CAR = opt('car', null), UPG = opt('upg', null);
const PICK = { rookie: 'coupe', club: 'hotrod', pro: 'hover', legend: 'police' };
const worlds = new Map();
const world = name => { if (!worlds.has(name)) { const st = STAGES.find(s => s.name === name), tr = M.buildTrack(st); worlds.set(name, { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco }); } return worlds.get(name); };
export function simRace(defs, W, skill, seed0 = 7) {
  let seed = seed0; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const R = M.createRace(W, defs, { weapons: true }); R.phase = 'racing'; R.autoPlayer = true; R.player.ai.skill = skill;
  const t = { air: 0, drift: 0, hits: 0, wrecks: 0, respawns: 0 }, pi = R.cars.indexOf(R.player); let time = 0;
  while (time < 420 && !R.player.finished) {
    M.raceStep(R, 1 / 120, W); time += 1 / 120;
    for (const c of R.cars.concat(R.traffic, R.parked || [])) {
      for (const e of c.events) {
        if (c === R.player) { if (e.t === 'bigair') t.air++; else if (e.t === 'drift') t.drift++; else if (e.t === 'wreck') t.wrecks++; else if (e.t === 'respawn') t.respawns++; }
        else if (R.cars.includes(c) && ['missile-hit', 'harpoon-hit', 'pulse-hit', 'oil-hit'].includes(e.t) && e.from === pi) t.hits++;
        else if (e.t === 'door-hit' && e.by === pi && R.cars.includes(c)) t.hits++;
      }
      c.events.length = 0;
    }
  }
  return { place: R.player.finished ? R.player.place : R.cars.length, n: R.cars.length, t, time };
}
if (process.argv[1] && process.argv[1].endsWith('career-sim.mjs')) {
  for (const T of TIERS) {
    if (want.length && !want.includes(T.id)) continue;
    const car = CAR || PICK[T.id];
    for (const sk of skills) {
      let s = newCareer(car); if (UPG) s.cars[car] = { eng: +UPG, tyr: +UPG, sus: +UPG, arm: +UPG };
      const places = [];
      for (const ev of T.events) roundsOf(ev).forEach((r, k) => {
        // a class cup the pick can't enter: the priciest car of the class on sale in the tier, upgraded the same
        const id = allowed(ev, car) ? car : tierCars(TIERS.indexOf(T)).filter(x => allowed(ev, x)).sort((a, b) => SHOP[b].price - SHOP[a].price)[0];
        s = { ...s, car: id, cars: { ...s.cars, [id]: s.cars[car] } };
        const res = simRace(careerDefs(s, ev), world(r.stage), sk);
        const out = scoreRace(s, ev, k, res.place, res.n, res.t); s = out.state; places.push(res.place);
        if (args.includes('--v')) console.log(`  ${ev.name} ${k + 1} ${id} ${r.stage.padEnd(16)} ${res.place}/${res.n} ${'★'.repeat((out.stars & 1) + (out.stars >> 1 & 1) + (out.stars >> 2 & 1))} +${out.cash} ${JSON.stringify(res.t)}`);
      });
      const avg = places.reduce((a, b) => a + b, 0) / places.length, pod = places.filter(p => p <= 3).length;
      console.log(`${T.name.padEnd(7)} ${car.padEnd(9)} skill ${sk}: avg place ${avg.toFixed(1)}, podiums ${pod}/${places.length}, wins ${places.filter(p => p === 1).length}, stars ${Object.values(s.stars).reduce((a, m) => a + (m & 1) + (m >> 1 & 1) + (m >> 2 & 1), 0)}, cash ${s.cash}`);
    }
  }
}
