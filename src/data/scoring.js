import { FORMATS, RACE_PTS, destructPts } from './formats.js';

// What happened in a race, counted from car.events (G2): the player's own style stats (big airs, drift boosts, weapon
// hits, wrecks, resets: the career's bonuses) and, for every racer, its destruction (data/formats.js): rivals it
// wrecked or stripped of a panel (within ATTRIB s of its last hit on them: a bump, a door, any weapon), breakables it
// smashed and road cars it took out. The game (ui/flow.js) and the career sim (tools/career-sim.mjs) both feed it.
export const ATTRIB = 3;
const HITS = ['missile-hit', 'harpoon-hit', 'pulse-hit', 'oil-hit', 'water-hit', 'cement-hit', 'stinger-hit', 'crush-hit', 'jingle-hit'];
/** A fresh tally for a race of n cars. */
export const newTally = n => ({ air: 0, drift: 0, hits: 0, wrecks: 0, respawns: 0, d: Array.from({ length: n }, () => ({ wrecked: 0, panels: 0, smashed: 0, takedowns: 0 })), by: Array(n).fill(null) });
/** Count event e on car c (cars: the racers, pi: the player's index, now: race time). Returns what it scored for whom
 *  ({ k, what } when a racer's destruction went up), so the game can call it out. */
export function tallyEvent(t, cars, c, e, now, pi) {
  const k = cars.indexOf(c);
  if (k === pi) { if (e.t === 'bigair') t.air++; else if (e.t === 'drift') t.drift++; else if (e.t === 'wreck') t.wrecks++; else if (e.t === 'respawn') t.respawns++; }
  else if (k >= 0 && ((HITS.includes(e.t) && e.from === pi) || (e.t === 'door-hit' && e.by === pi))) t.hits++;
  if (k < 0) return null;
  // who hit whom last
  const mark = (v, from) => { if (v >= 0 && from >= 0 && v !== from) t.by[v] = { from, t: now }; };
  if (HITS.includes(e.t)) mark(k, e.from);
  else if (e.t === 'door-hit') mark(k, e.by);
  else if (e.t === 'bump') { const a = cars.indexOf(e.a), b = cars.indexOf(e.b); mark(a, b); mark(b, a); }
  // what it scores
  const by = t.by[k], blame = by && now - by.t <= ATTRIB ? by.from : -1;
  if (e.t === 'wreck' && blame >= 0) { t.d[blame].wrecked++; return { k: blame, what: 'wreck', victim: k }; }
  if (e.t === 'dent' && e.panels && blame >= 0) { const off = e.panels.filter(p => p[1] === 2).length; if (off) { t.d[blame].panels += off; return { k: blame, what: 'panel', victim: k }; } }
  if (e.t === 'break') { t.d[k].smashed++; return { k, what: 'smash' }; }
  if (e.t === 'takedown') { t.d[k].takedowns++; return { k, what: 'takedown' }; }
  return null;
}
/** The result order in format f: `order` is the finishing order (cars); with a destruct weight it's re-sorted by race
 *  points x weight.race + destruction points x weight.destruct (ties: the finishing order). Returns [{ c, race, destruct, total }]. */
export function scoreOrder(order, cars, t, f) {
  const W = (FORMATS[f] || FORMATS.race).weight;
  const rows = order.map((c, i) => { const d = t && t.d[cars.indexOf(c)], dp = d ? destructPts(d, f) : 0, rp = RACE_PTS[i] || 0; return { c, i, race: rp, destruct: dp, total: rp * W.race + dp * W.destruct }; });
  if (W.destruct > 0) rows.sort((a, b) => b.total - a.total || a.i - b.i);
  return rows;
}
