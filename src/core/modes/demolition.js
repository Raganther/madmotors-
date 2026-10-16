import { clamp, wrapAngle } from '../math.js';
import { arenaWall } from '../elements/arena.js';
import { MATERIALS, holeHp } from '../../data/structures.js';
import { impactOf, massOf } from '../sim/impact.js';

// Demolition: createRace(W, defs, { mode: 'demolition' }) on a stage with buildings (core/elements/structures.js),
// usually an arena with a town in the middle (data/stages/demolition-yard.js). It runs on the derby's rules
// (modes/derby.js: no laps, damage stays, a wrecked car is out, the clock) but the score is what you knock down: every
// wall panel you break is worth its material's PTS, every building you bring down COLLAPSE x its floors more (the
// walls that fall with it are yours too). Highest score at the end wins; it's over when the clock runs out, every
// building is down or every car is out. Scored from the state (R.st), so it's the same however often it's counted.
// The demolition AI (demoControl) picks a building it can break (heavy enough for its material, and fast enough for
// its walls), preferring near ones and ones already falling, drives straight at it, and backs off for a run-up when
// it's stopped against a wall it can't get through. Deterministic: no random numbers.
export const DEMO = { TIME: 120, DMG: 0.6, CELLS: 8, PTS: { timber: 1, brick: 2, stone: 3, concrete: 4 }, COLLAPSE: 10, RUN: 22, CLOSE: 7, SLOW: 4, STUCK_T: 0.6, BACK_T: 1.1, EDGE: 9 };
export function initDemolition(R, opts = {}) {
  R.demo = { pts: R.cars.map(() => 0), razed: R.cars.map(() => 0), walls: R.cars.map(() => 0) };
  R.derby.time = opts.time || DEMO.TIME;
  for (const c of R.cars) { c.dmo = { tgt: -1, runT: 0, backT: 0, stuckT: 0, side: 1 }; c.dmgK *= DEMO.DMG; }   // walls hurt: a bit tougher than in a derby
}
/** Everyone's score from what's down (R.st), into R.demo. */
export function demoScore(R) {
  const S = R.st, D = R.demo; if (!S) return;
  D.pts.fill(0); D.razed.fill(0); D.walls.fill(0);
  const pts = R.cars.map(() => 0), n = R.cars.map(() => 0);   // every cell of outer wall knocked out: its material's points / CELLS
  for (const w of S.walls) if (w.kind === 'outer') for (let i = 0; i < w.by.length; i++) if (w.by[i] >= 0) { pts[w.by[i]] += DEMO.PTS[S.blds[w.bld].mat] || 1; n[w.by[i]]++; }
  pts.forEach((v, k) => { D.walls[k] = Math.round(n[k] / DEMO.CELLS); D.pts[k] += Math.round(v / DEMO.CELLS); });
  for (const o of S.blds) { for (const b of o.bays) if (b.fallen && b.by >= 0) D.pts[b.by] += Math.round(DEMO.COLLAPSE * o.floors / o.bays.length); if (o.collapsed && o.by >= 0) D.razed[o.by]++; }
}
/** The order: highest score first (then the healthier, then grid order). */
export function demoOrder(R, health) {
  const D = R.demo; return R.cars.slice().sort((a, b) => D.pts[R.cars.indexOf(b)] - D.pts[R.cars.indexOf(a)] || (!!a.out - !!b.out) || health(b) - health(a) || R.cars.indexOf(a) - R.cars.indexOf(b));
}
/** Over? The clock, every building down, or nobody left running. */
export const demoOver = R => R.derby.t >= R.derby.time || (R.st && R.st.blds.every(o => o.collapsed)) || R.cars.every(c => c.out);
// can car c break building o's walls, coming in at speed v?
const canBreak = (c, o, v) => massOf(c) >= MATERIALS[o.mat].minMass && impactOf(c, v) >= holeHp(o.mat, o.floors);
/** The demolition AI's controls for car c. */
export function demoControl(R, c, W) {
  const inp = c.inp, A = c.dmo, S = R.st, ar = W.tr.arena, sp = Math.hypot(c.vx, c.vz), top = 30 * ((c.veh && c.veh.top) || 1);
  inp.handbrake = 0; inp.fire = false;
  if (c.out || R.derby.phase !== 'run' || !S) { inp.throttle = 0; inp.brake = c.vf > 0.5 ? 1 : 0; inp.steer = 0; return; }
  // the target: a standing building it can break at the speed it can reach, near, part-down ones first; the same one while it lasts
  let best = -1, bs = -1e9;
  S.blds.forEach((o, k) => {
    if (o.collapsed || !canBreak(c, o, top * 0.85)) return;
    const d = Math.hypot(o.x - c.x, o.z - c.z), sc = -d + 40 * o.down / Math.max(1, o.cells) + (k === A.tgt ? 12 : 0) + DEMO.PTS[o.mat] * 3;
    if (sc > bs) { bs = sc; best = k; }
  });
  A.tgt = best;
  let gx = ar ? ar.x : c.x, gz = ar ? ar.z : c.z;
  if (best >= 0) {
    const o = S.blds[best], d = Math.hypot(o.x - c.x, o.z - c.z);
    if (A.runT > 0) { A.runT -= 1 / 120; const e = d || 1; gx = c.x - (o.x - c.x) / e * 20 + (o.z - c.z) / e * 8 * A.side; gz = c.z - (o.z - c.z) / e * 20 - (o.x - c.x) / e * 8 * A.side; }   // out for a run-up, swinging wide
    else { gx = o.x; gz = o.z; if (d < Math.max(o.w, o.d) / 2 + DEMO.CLOSE && sp < 0.6 * top && !canBreak(c, o, sp)) A.slowT = (A.slowT || 0) + 1 / 120; else A.slowT = 0; if (A.slowT > 0.5) { A.slowT = 0; A.runT = DEMO.RUN / Math.max(8, top) * 1.6; A.side = -A.side; } }
  }
  if (ar) { const w = arenaWall(ar, c.x, c.z); if (w.d < DEMO.EDGE) { const k = (DEMO.EDGE - w.d) / DEMO.EDGE; gx += w.nx * 25 * k; gz += w.nz * 25 * k; } }
  // stuck against a wall it can't break (or a pile of rubble, or another car): back out turning, then go again
  if (A.backT > 0) { A.backT -= 1 / 120; inp.throttle = 0; inp.brake = 1; inp.steer = -A.side; return; }
  if (sp < DEMO.SLOW && inp.throttle > 0.5) A.stuckT += 1 / 120; else A.stuckT = Math.max(0, A.stuckT - 1 / 60);
  if (A.stuckT > DEMO.STUCK_T) { A.stuckT = 0; A.backT = DEMO.BACK_T; A.side = -A.side; A.runT = 0.8; }
  const want = wrapAngle(Math.atan2(gx - c.x, gz - c.z) - c.yaw), skill = c.ai.skill || 0.9;
  inp.steer = clamp(-want * 2.2, -1, 1);
  inp.throttle = Math.abs(want) > 2.2 && sp > 8 ? 0.4 : 0.8 + 0.2 * skill; inp.brake = 0;
  if (Math.abs(want) > 1.2 && sp > 16) { inp.throttle = 0.2; inp.handbrake = 1; }
}
