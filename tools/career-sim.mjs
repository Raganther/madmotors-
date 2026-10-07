// Career pacing (npm run career -- [tier ...] [--car id] [--skill s,s] [--upg n|tier] [--json]): races every round of each tier's
// events with the player driven by the AI at a few skills (0.88 ~ a casual player, 0.95 ~ a good one), in the car
// given (default: the tier's natural pick), and prints the finishing places, stars and cash. Use it to tune TIERS
// (skill, pay) and the upgrade and rival levels: a good player in a tier-appropriate car should be on the podium.
// --par prints each time trial's time (set `par`, the gold time, from a good run: --skill 0.97 --upg <tier level>).
import * as M from '../src/core/index.js';
import { STAGES } from '../src/data/stages/index.js';
import { SHOP, TIERS, allowed, careerDefs, newCareer, roundsOf, scoreRace, tierCars } from '../src/data/career.js';
import { formatOf } from '../src/data/formats.js';
import { paceOf } from '../src/data/ratings.js';
import { SLOTS, buildOf } from '../src/data/parts.js';
import { readFileSync, writeFileSync } from 'node:fs';
import { newTally, scoreOrder, tallyEvent } from '../src/data/scoring.js';

const args = process.argv.slice(2), opt = (k, d) => { const i = args.indexOf('--' + k); return i >= 0 ? args[i + 1] : d; };
const want = args.filter((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1].startsWith('--')));
const skills = opt('skill', '0.88,0.95').split(',').map(Number), CAR = opt('car', null), UPG = opt('upg', null);
const PICK = { rookie: 'coupe', club: 'hotrod', pro: 'hover', legend: 'police' };
const worlds = new Map();
const world = name => { if (!worlds.has(name)) { const st = STAGES.find(s => s.name === name), tr = M.buildTrack(st); worlds.set(name, { tr, terr: M.buildTerrain(tr, st), surf: st.surface, armco: !!st.armco }); } return worlds.get(name); };
// one round, any format (data/formats.js): the race, or a Showdown / checkpoint match played to its end; the result
// order is the format's (finish and destruction: data/scoring.js)
export function simRace(defs, W, skill, seed0 = 7, ev = {}) {
  let seed = seed0; Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const mode = ev.kind === 'mode' ? ev.mode : 'race', R = M.createRace(W, defs, { weapons: true, mode }); R.phase = 'racing'; R.autoPlayer = true; R.player.ai.skill = skill;
  const t = newTally(R.cars.length), pi = R.cars.indexOf(R.player); let time = 0;
  const over = () => R.sd ? R.sd.phase === 'over' : R.derby ? R.derby.phase === 'over' : R.player.finished;
  while (time < 420 && !over()) {
    M.raceStep(R, 1 / 120, W); time += 1 / 120;
    for (const c of R.cars.concat(R.traffic, R.parked || [])) { for (const e of c.events) tallyEvent(t, R.cars, c, e, R.time, pi); c.events.length = 0; }
  }
  const finish = R.derby ? M.derbyOrder(R) : R.sd ? R.cars.map((c, k) => ({ c, v: (R.sd.kind === 'crown' ? R.sd.crown : R.sd.points)[k] })).sort((a, b) => b.v - a.v || b.c.progress - a.c.progress).map(x => x.c) : M.ranking(R);
  const order = scoreOrder(finish, R.cars, t, formatOf(ev)).map(x => x.c), place = R.sd || R.derby || R.player.finished ? order.indexOf(R.player) + 1 : R.cars.length;
  return { place, n: R.cars.length, t: { ...t, ...t.d[pi] }, time: R.player.finished ? R.player.finishTime : 0 };
}
if (process.argv[1] && process.argv[1].endsWith('career-sim.mjs')) {
  const report = [];
  for (const T of TIERS) {
    if (want.length && !want.includes(T.id)) continue;
    const car = CAR || PICK[T.id];
    for (const sk of skills) {
      let s = newCareer(car); const L = UPG === 'tier' ? T.upg : +UPG; if (L) s.cars[car] = { eng: L, tyr: L, sus: L, arm: L };   // --upg tier: the tier's own level, like its rivals
      const places = [], cash = [s.cash], gaps = [], ti = TIERS.indexOf(T);
      for (const ev of T.events) roundsOf(ev).forEach((r, k) => {
        // a discipline cup the pick can't enter: the priciest car of it on sale in the tier, upgraded the same
        const id = allowed(ev, car) ? car : tierCars(TIERS.indexOf(T)).filter(x => allowed(ev, x)).sort((a, b) => SHOP[b].price - SHOP[a].price)[0];
        s = { ...s, car: id, cars: { ...s.cars, [id]: s.cars[car] } };
        const res = simRace(careerDefs(s, ev), world(r.stage), sk, 7, ev);
        if (ev.kind === 'trial' && args.includes('--par')) console.log(`  par ${ev.id}: ${res.time.toFixed(1)} s (${id}, skill ${sk})`);
        const out = scoreRace(s, ev, k, res.place, res.n, res.t, res.time); s = out.state; places.push(res.place); cash.push(s.cash);
        // your car's pace against the field's on this stage's surface (data/ratings.js: % of a lap vs the stock coupe)
        const surf = STAGES.find(x => x.name === r.stage).surface === 'tarmac' ? 'tarmac' : 'loose', field = careerDefs(s, ev).filter(d => !d.player);
        if (field.length) gaps.push(paceOf(id, buildOf(s.cars[id]), surf) - field.reduce((a, d) => a + paceOf(d.vehicle, d.build, surf), 0) / field.length);
        if (args.includes('--v')) console.log(`  ${ev.name} ${k + 1} ${id} ${r.stage.padEnd(16)} ${res.place}/${res.n} ${'★'.repeat((out.stars & 1) + (out.stars >> 1 & 1) + (out.stars >> 2 & 1))} +${out.cash} ${JSON.stringify(res.t)}`);
      });
      const avg = places.reduce((a, b) => a + b, 0) / places.length, pod = places.filter(p => p <= 3).length;
      // races until the winnings buy the next tier's cheapest car (from a fresh start), and a level-1 part
      const next = Object.values(SHOP).filter(p => p.tier === ti + 1).reduce((m, p) => Math.min(m, p.price), Infinity), raceTo = goal => { const i = cash.findIndex(c => c >= goal); return i < 0 ? null : i; };
      const perRace = (cash[cash.length - 1] - cash[0]) / places.length;
      report.push({ tier: T.name, car, skill: sk, races: places.length, avgPlace: +avg.toFixed(2), podiums: pod, wins: places.filter(p => p === 1).length, winRate: +(places.filter(p => p === 1).length / places.length).toFixed(3),
        cash, perRace: Math.round(perRace), nextCar: isFinite(next) ? next : null, racesToNextCar: isFinite(next) ? raceTo(next) : null, racesPerPart: +(SLOTS[0].price[0] / perRace).toFixed(2), paceGap: +(gaps.reduce((a, b) => a + b, 0) / Math.max(1, gaps.length)).toFixed(2), places });
      console.log(`${T.name.padEnd(7)} ${car.padEnd(9)} skill ${sk}: avg place ${avg.toFixed(1)}, podiums ${pod}/${places.length}, wins ${places.filter(p => p === 1).length}, stars ${Object.values(s.stars).reduce((a, m) => a + (m & 1) + (m >> 1 & 1) + (m >> 2 & 1), 0)}, cash ${s.cash}`);
    }
  }
  if (args.includes('--json')) {   // only some tiers raced: the others' rows are kept from the last run
    let old = []; if (want.length) try { old = JSON.parse(readFileSync('tools/out/career.json', 'utf8')).report.filter(r => !report.some(n => n.tier === r.tier)); } catch (e) { /* no earlier run */ }
    const all = [...old, ...report].sort((a, b) => TIERS.findIndex(t => t.name === a.tier) - TIERS.findIndex(t => t.name === b.tier) || a.skill - b.skill);
    writeFileSync('tools/out/career.json', JSON.stringify({ at: new Date().toISOString(), report: all }, null, 1)); console.log('wrote tools/out/career.json');
  }
}
