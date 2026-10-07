import { clamp, wrapAngle } from '../math.js';
import { arenaWall } from '../elements/arena.js';

// Derby (G3): createRace(W, defs, { mode: 'derby' }). No laps and no finish line: everyone fights in the arena (an
// `arena` stage, core/elements/arena.js) or on any circuit, and a wrecked car is out for good (it stays where it died, a
// burnt shell to drive round). Damage doesn't mend. The last car running wins; at the time limit the survivors rank by
// the damage they've taken. Result order: survivors (least damage first), then the wrecked, last out first.
// The derby AI (derbyControl) picks a target (the nearest, the most battered, whoever hit it last), drives at it with a
// little lead, keeps off the arena's walls (the outline and the runs inside it) and steers round them, backs off while
// it's badly hurt (until the last two, or late on), breaks off for a run-up when two cars only chase each other's tails,
// and reverses out when it's stuck. Damage is scaled by DERBY.DMG (c.dmgK, sim/damage.js) so a derby lasts.
// Deterministic: no R.rnd, no Math.random.
export const DERBY = { TIME: 150, DMG: 0.33, LAST: 1, STUCK_T: 1, BACK_T: 1, SLOW: 5, HURT: 0.72, EDGE: 10, PROBE: 3, LEAD: 0.35, REVENGE: 4, ORBIT: 16, ORBIT_T: 2.5, RUN_T: 1.4 };
/** Health 0..1: 1 - the worst-hit zone. */
export const health = c => 1 - Math.max(c.dmg.f, c.dmg.b, c.dmg.l, c.dmg.r);
const live = c => !c.out;
export function initDerby(R) {
  R.derby = { t: 0, time: DERBY.TIME, out: [], outT: [], phase: 'run', winner: -1 };
  for (const c of R.cars) { c.out = false; c.dmgK = DERBY.DMG; c.dai = { tgt: -1, stuckT: 0, backT: 0, side: 1, orbT: 0, runT: 0 }; c.hitBy = -1; c.hitT = -1e9; }
}
/** The derby's order right now: the survivors (healthiest first), then the wrecked, last out first. */
export function derbyOrder(R) {
  const alive = R.cars.filter(live).sort((a, b) => health(b) - health(a) || R.cars.indexOf(a) - R.cars.indexOf(b));
  return alive.concat(R.derby.out.slice().reverse().map(k => R.cars[k]));
}
/** One step of the derby's rules (after the cars and collisions): wrecks put cars out, the clock runs, someone wins. */
export function derbyStep(R, W, dt) {
  const D = R.derby; if (D.phase !== 'run' || R.phase !== 'racing') return;
  D.t += dt;
  for (const c of R.cars) {
    for (const e of c.events) {   // who hit it last (for the AI's revenge): a bump either way, a door, any weapon
      const hit = (v, by) => { if (v && by >= 0 && R.cars[by] !== v) { v.hitBy = by; v.hitT = D.t; } };
      if (e.t === 'bump') { hit(e.a, R.cars.indexOf(e.b)); hit(e.b, R.cars.indexOf(e.a)); }
      else if (e.t === 'door-hit') hit(c, e.by); else if (/-hit$/.test(e.t) && e.from >= 0) hit(c, e.from);
    }
    if (!c.out && c.wreckT > 0) { c.out = true; c.wreckT = 1e9; D.out.push(R.cars.indexOf(c)); D.outT[R.cars.indexOf(c)] = D.t; c.events.push({ t: 'derby-out', left: R.cars.filter(live).length }); }
  }
  const left = R.cars.filter(live);
  if (left.length <= DERBY.LAST || D.t >= D.time) {
    D.phase = 'over'; D.winner = R.cars.indexOf(derbyOrder(R)[0]);
    R.player.events.push({ t: 'derby-over', winner: D.winner, timeUp: left.length > DERBY.LAST });
  }
}
/** The derby AI's controls for car c (instead of aiControl). */
export function derbyControl(R, c, W) {
  const inp = c.inp, A = c.dai, D = R.derby, ar = W.tr.arena; inp.handbrake = 0; inp.fire = false;
  if (c.out || D.phase !== 'run') { inp.throttle = 0; inp.brake = c.vf > 0.5 ? 1 : 0; inp.steer = 0; return; }
  const sp = Math.hypot(c.vx, c.vz), k0 = R.cars.indexOf(c), hurt = health(c) < 1 - DERBY.HURT && R.cars.filter(live).length > 2 && D.t < D.time * 0.6;   // (never hiding in the endgame: no stand-offs)
  // the target: near and battered are tempting; whoever hit it in the last few seconds even more so
  let best = -1, bs = -1e9;
  R.cars.forEach((o, k) => {
    if (k === k0 || !live(o)) return;
    const d = Math.hypot(o.x - c.x, o.z - c.z), score = -d + (1 - health(o)) * 30 + (c.hitBy === k && D.t - c.hitT < DERBY.REVENGE ? 25 : 0) + (k === A.tgt ? 8 : 0);
    if (score > bs) { bs = score; best = k; }
  });
  A.tgt = best;
  let gx, gz;
  if (best < 0) { gx = ar ? ar.x : c.x; gz = ar ? ar.z : c.z; }
  else {
    const T = R.cars[best];
    if (hurt) {   // badly hurt: keep away, heading on round the arena away from the target
      const ex = c.x - T.x, ez = c.z - T.z, a = Math.atan2(ex, ez) + 0.6 * A.side;
      gx = c.x + Math.sin(a) * 20; gz = c.z + Math.cos(a) * 20;
    } else if (A.runT > 0) {   // breaking off for a run-up: away from the target, then turn and come back fast
      A.runT -= 1 / 120; const ex = c.x - T.x, ez = c.z - T.z, e = Math.hypot(ex, ez) || 1; gx = c.x + ex / e * 20; gz = c.z + ez / e * 20;
    } else {
      const d = Math.hypot(T.x - c.x, T.z - c.z), lead = clamp(d / Math.max(8, sp), 0, 1.2) * DERBY.LEAD; gx = T.x + T.vx * lead; gz = T.z + T.vz * lead;
      // two cars chasing each other's tails round and round at walking pace do no damage: one breaks off for a run-up
      const off = Math.abs(wrapAngle(Math.atan2(T.x - c.x, T.z - c.z) - c.yaw));
      if (d < DERBY.ORBIT && off > 0.9) A.orbT += 1 / 120; else A.orbT = Math.max(0, A.orbT - 1 / 240);
      if (A.orbT > DERBY.ORBIT_T + (k0 % 3) * 0.7) { A.orbT = 0; A.runT = DERBY.RUN_T; }
    }
  }
  // keep off the arena's walls (the outline and the runs inside it): near one, aim away from it
  if (ar) { const w = arenaWall(ar, c.x, c.z); if (w.d < DERBY.EDGE) { const k = (DERBY.EDGE - w.d) / DERBY.EDGE; gx += w.nx * 25 * k; gz += w.nz * 25 * k; } }
  let want = wrapAngle(Math.atan2(gx - c.x, gz - c.z) - c.yaw);
  // a wall run in the way (an island, a wedge): look a few headings either side and take the nearest clear one
  if (ar && ar.walls.length) {
    const reach = Math.hypot(gx - c.x, gz - c.z) - 3, clear = h => { const a = c.yaw + h; for (const s of [4, 8, 12]) { if (s > reach) break; const w = arenaWall(ar, c.x + Math.sin(a) * s, c.z + Math.cos(a) * s); if (w.d < DERBY.PROBE) return false; } return true; };
    if (!clear(want)) for (const dh of [0.5, -0.5, 1, -1, 1.6, -1.6].map(v => v * A.side)) if (clear(want + dh)) { want = wrapAngle(want + dh); break; }
  }
  // stuck (pushing a wall, a shell or a pile of cars, going nowhere): back out, turning, then charge again
  if (A.backT > 0) { A.backT -= 1 / 120; inp.throttle = 0; inp.brake = 1; inp.steer = -A.side; return; }
  if (sp < DERBY.SLOW && Math.abs(c.inp.throttle) > 0.5) A.stuckT += 1 / 120; else A.stuckT = Math.max(0, A.stuckT - 1 / 60);   // shoving at walking pace does no damage: back off for a run-up
  if (A.stuckT > DERBY.STUCK_T) { A.stuckT = 0; A.backT = DERBY.BACK_T; A.side = -A.side; }
  const skill = c.ai.skill || 0.9;
  inp.steer = clamp(-want * 2.2, -1, 1);   // (negative steer turns towards +angle: sim/nav.js)
  inp.throttle = Math.abs(want) > 2.2 && sp > 8 ? 0.4 : 0.75 + 0.25 * skill;
  inp.brake = 0;
  if (Math.abs(want) > 1.2 && sp > 18) { inp.throttle = 0.2; inp.handbrake = 1; }   // slide it round
}
