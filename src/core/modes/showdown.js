// Showdown: Micro Machines-style head-to-head. The camera frames the leader and the race keeps flowing:
// - a car left off the screen explodes, the leader takes one of its lights, and it respawns rolling just behind the leader;
// - only a breakaway (the leader drops every other car at once) stops play: the leader takes a light from each and everyone
//   regroups at the leader's position with a rolling start.
// Deterministic (no random numbers), so it never disturbs the race features' random sequence.
import { computeGrad } from '../sim/car.js';
import { project } from '../track/query.js';
import { screenOffset } from '../sim/view.js';

export const SD = { START: 4, WIN: 10, OFF_SLACK: 3, OFF_TIME: 1.2, BOOM: 1.2, ANNOUNCE: 1.0, GRACE: 1.5, ROLL: 14, LOOK: 0.42 };
const GRID = [[0, -2.8], [0, 2.8], [-8, -2.8], [-8, 2.8]];

export function initShowdown(R) {
  R.sd = { lights: R.cars.map(() => SD.START), phase: 'run', timer: 0, grace: SD.GRACE, focus: null, snap: true, camSnap: true,
    offT: R.cars.map(() => 0), boomT: R.cars.map(() => 0), winner: -1, rounds: 0 };
  if (!R.view) R.view = { hw: 40, hh: 22 };
}
const active = R => R.cars.filter(c => !c.out);
const racing = R => R.cars.filter((c, k) => !c.out && !(R.sd.boomT[k] > 0));   // in the match and not currently blown up
export function sdLeader(R) { let best = null; for (const c of racing(R)) if (!best || c.progress > best.progress) best = c; return best; }

/** Drop a car on road sample i (lateral offset lat), already rolling forward at SD.ROLL, briefly ghosted. */
function place(c, W, i, lat) {
  const tr = W.tr;
  c.x = tr.xs[i] + tr.rx[i] * lat; c.z = tr.zs[i] + tr.rz[i] * lat; c.y = tr.H[i]; c.yaw = tr.th[i];
  c.vx = tr.tx[i] * SD.ROLL; c.vz = tr.tz[i] * SD.ROLL; c.vy = 0; c.vf = SD.ROLL; c.vr = 0; c.onGround = true; c.airT = 0; c.boost = 0; c.driftT = 0; c.spin = 0;
  c.offT = 0; c.stuckT = 0; c.wrongT = 0; c.strandT = 0; c.wallStuck = 0; c.lastGood = i; c.progress = i; c.ai.cur = lat;
  c.pr = project(tr, c.x, c.z, i, 2, 2); computeGrad(c, W);
  if (c.wreckT > 0) { c.wreckT = 0; c.dmg = { f: 0, b: 0, l: 0, r: 0 }; c.events.push({ t: 'repair' }); }
  c.ghost = SD.GRACE;
}
/** Put every car still in the match on a 2x2 rolling grid at the leader's position, in running order. */
export function regroup(R, W) {
  const order = active(R).sort((a, b) => b.progress - a.progress), i = order[0].pr.i;
  order.forEach((c, k) => place(c, W, Math.max(4, i + GRID[k % 4][0] - 8 * Math.floor(k / 4)), GRID[k % 4][1]));
  R.sd.boomT.fill(0); R.sd.offT.fill(0);
  R.sd.snap = true; R.sd.camSnap = true;
}
function finish(R, winner) {
  const S = R.sd; S.phase = 'over'; S.winner = R.cars.indexOf(winner);
  R.player.events.push({ t: 'sd-over', winner: S.winner });
}
function mostLights(R) {
  const S = R.sd; let best = null, bi = -1;
  R.cars.forEach((c, k) => { if (!best || S.lights[k] > S.lights[bi] || (S.lights[k] === S.lights[bi] && c.progress > best.progress)) { best = c; bi = k; } });
  return best;
}
/** Move lights from the losers to the leader; knock out anyone left on none. Returns true when the match is over. */
function score(R, L, losers, boom) {
  const S = R.sd, li = R.cars.indexOf(L);
  S.lights[li] += losers.length; for (const k of losers) S.lights[k] -= 1;
  S.rounds++;
  L.events.push({ t: 'sd-round', winner: li, losers, boom });
  for (const k of losers) if (S.lights[k] <= 0) { const c = R.cars[k]; c.out = true; c.ghost = Infinity; S.boomT[k] = 0; c.events.push({ t: 'sd-out' }); }
  const left = active(R);
  if (S.lights[li] >= SD.WIN || left.length <= 1 || R.player.out) { finish(R, S.lights[li] >= SD.WIN || left.length <= 1 ? L : mostLights(R)); return true; }
  return false;
}
/** Respawn a blown-up car rolling just behind the leader, well inside the screen, beside whoever is there. */
function rejoin(R, W, c) {
  const L = sdLeader(R), i = Math.max(4, L.pr.i - 14);
  const near = racing(R).find(o => o !== c && Math.abs(o.pr.i - i) < 8), lat = near ? (near.ai.cur > 0 ? -2.8 : 2.8) : -Math.sign(L.ai.cur || 1) * 2.8;
  place(c, W, i, lat);
}

export function showdownStep(R, W, dt) {
  const S = R.sd; if (S.phase === 'over') return;
  const L = sdLeader(R); if (!L) return;
  // camera focus: the leader, looking a little ahead of it
  const tx = L.x + L.vx * SD.LOOK, tz = L.z + L.vz * SD.LOOK;
  if (!S.focus || S.snap) { S.focus = { x: tx, y: L.y, z: tz }; S.snap = false; }
  else { const k = 1 - Math.exp(-dt * 5); S.focus.x += (tx - S.focus.x) * k; S.focus.y += (L.y - S.focus.y) * k; S.focus.z += (tz - S.focus.z) * k; }
  if (R.phase !== 'racing') return;
  if (L.progress >= W.tr.finishIdx) { finish(R, mostLights(R)); return; }

  if (S.phase === 'announce') { S.timer -= dt; if (S.timer <= 0) { regroup(R, W); S.phase = 'run'; S.grace = SD.GRACE; } return; }

  // blown-up cars come back once the smoke clears
  R.cars.forEach((c, k) => { if (S.boomT[k] > 0 && !c.out && (S.boomT[k] -= dt) <= 0) { S.boomT[k] = 0; S.offT[k] = 0; rejoin(R, W, c); } });

  S.grace -= dt; if (S.grace > 0) return;
  const hw = R.view.hw + SD.OFF_SLACK, hh = R.view.hh + SD.OFF_SLACK, chasers = [];
  R.cars.forEach((c, k) => {
    if (c.out || c === L || S.boomT[k] > 0) { S.offT[k] = 0; return; }
    chasers.push(k);
    if (c.ghost > 0) { S.offT[k] = 0; return; }                               // just respawned: safe for a moment
    const [sx, sy] = screenOffset(c.x, c.y, c.z, S.focus);
    S.offT[k] = Math.abs(sx) > hw || Math.abs(sy) > hh ? S.offT[k] + dt : 0;
  });
  const dropped = chasers.filter(k => S.offT[k] >= SD.OFF_TIME);
  if (!dropped.length) return;
  if (dropped.length === chasers.length) {
    // breakaway: the leader has left everyone behind, so stop and regroup
    if (score(R, L, dropped, false)) return;
    S.offT.fill(0); S.phase = 'announce'; S.timer = SD.ANNOUNCE;
    return;
  }
  // stragglers: blow them up and keep racing
  for (const k of dropped) { const c = R.cars[k]; S.offT[k] = 0; S.boomT[k] = SD.BOOM; c.wreckT = 1e9; c.boost = 0; c.driftT = 0; c.events.push({ t: 'wreck' }); }
  score(R, L, dropped, true);
}
