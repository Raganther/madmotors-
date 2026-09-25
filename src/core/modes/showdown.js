// Showdown, King of the Hill: whoever leads wears the crown and banks crown time while they hold it; first to TARGET
// seconds wins (or the most crown time when the leader reaches the finish). The camera frames the leader, zooming out
// to keep the pack in shot:
// - the crown only changes hands on a clear pass (STEAL_GAP metres ahead, or STEAL_EDGE ahead for STEAL_HOLD seconds);
// - no streak bonus (it made runaways worse); a leader who pulls clear meets leader hazards instead (features/hazards.js);
// - a car left off the screen at full zoom blows up, hands BOOM_TAKE seconds of its crown time to the crown holder and
//   respawns rolling behind or beside the leader (never in front, so a blow-up can't hand you the crown).
// Nothing ever stops or regroups. Deterministic: its own seeded generator, never R.rnd, so the race features' random
// sequence is untouched.
// The same pack rules (camera on the leader, blow up off screen, rejoin around the leader) drive two checkpoint
// modes, R.sd.kind: gates come up one after another along the road ahead (CP.FIRST, then every CP.GAP metres), each
// CP.HW wide either side of a point CP.LAT off the centre line, left or right at random; the first car to drive
// through one scores a point (a leader on the wrong line can miss it), win by two like tennis:
//   'deuce'     a tennis game: first to 4, but two clear of everyone (3-3 is deuce, then advantage...)
//   'tiebreak'  first to 7, two clear
// If the road runs out first, the most points wins (ahead on the road breaks a tie). No crown time changes hands.
import { computeGrad } from '../sim/car.js';
import { project } from '../track/query.js';
import { screenOffset } from '../sim/view.js';
import { mulberry32 } from '../math.js';

export const CP = { FIRST: 160, GAP: 210, TARGET: { deuce: 4, tiebreak: 7 }, END: 30, LAT: 3, HW: 2.6 };
/** Menu mode -> kind of pack match. */
export const SD_KINDS = { showdown: 'crown', deuce: 'deuce', tiebreak: 'tiebreak' };
export const SD = { TARGET: 60, ZMIN: 18, ZMAX: 26, FIT: 5, OFF_SLACK: 2, OFF_TIME: 1.0, BOOM: 1.2, GRACE: 1.5, ROLL: 14, LOOK: 0.3,
  STEAL_GAP: 4.5, STEAL_EDGE: 1.5, STEAL_HOLD: 0.4, BOOM_TAKE: 2, STREAK: [] };   // no streak bonus: it fed runaways

/** View half-extents (metres) for a zoom level: `scale` is the half-extent of the screen's short side. */
export function sdExtents(scale, aspect) { return aspect >= 1 ? { hw: scale * aspect, hh: scale } : { hw: scale, hh: scale / aspect }; }

export function initShowdown(R, kind = 'crown') {
  R.sd = { kind, points: R.cars.map(() => 0), gate: null, prev: R.cars.map(c => c.progress), crown: R.cars.map(() => 0), holder: -1, streak: 0, stealer: -1, stealT: 0, phase: 'run', grace: SD.GRACE, focus: null, snap: true, camSnap: true,
    scale: SD.ZMIN, view: null, offT: R.cars.map(() => 0), boomT: R.cars.map(() => 0), winner: -1, booms: R.cars.map(() => 0), taken: R.cars.map(() => 0), steals: R.cars.map(() => 0),
    rng: mulberry32(R.cars.length * 7919 + 17), spawns: [] };
  if (!R.aspect) R.aspect = 16 / 9;
  R.sd.view = sdExtents(SD.ZMIN, R.aspect);
}
const racing = R => R.cars.filter((c, k) => !(R.sd.boomT[k] > 0));   // not currently blown up
export function sdLeader(R) { let best = null; for (const c of racing(R)) if (!best || c.progress > best.progress) best = c; return best; }
/** Drop a car on road sample i (lateral offset lat), already rolling forward at SD.ROLL, briefly ghosted. */
function place(c, W, i, lat) {
  const tr = W.tr;
  if (tr.gap) while (i > 4 && (tr.gap[tr.bi(i)] || tr.jump[i])) i = tr.adv(i, -1);   // never drop a car into a gap or onto a kicker
  c.x = tr.xs[i] + tr.rx[i] * lat; c.z = tr.zs[i] + tr.rz[i] * lat; c.y = tr.H[i]; c.yaw = tr.th[i];
  c.vx = tr.tx[i] * SD.ROLL; c.vz = tr.tz[i] * SD.ROLL; c.vy = 0; c.vf = SD.ROLL; c.vr = 0; c.onGround = true; c.airT = 0; c.boost = 0; c.driftT = 0; c.spin = 0;
  c.offT = 0; c.stuckT = 0; c.wrongT = 0; c.strandT = 0; c.wallStuck = 0; c.lastGood = i; c.progress = tr.progOf(i); c.ai.cur = lat;
  c.pr = project(tr, c.x, c.z, i, 2, 2); computeGrad(c, W);
  if (c.wreckT > 0) { c.wreckT = 0; c.dmg = { f: 0, b: 0, l: 0, r: 0 }; c.events.push({ t: 'repair' }); }
  c.ghost = SD.GRACE;
}
function finish(R, winner) {
  const S = R.sd; S.phase = 'over'; S.winner = R.cars.indexOf(winner);
  R.player.events.push({ t: 'sd-over', winner: S.winner });
}
function mostPoints(R) {
  const P = R.sd.points; let bi = 0;
  R.cars.forEach((c, k) => { if (P[k] > P[bi] || (P[k] === P[bi] && c.progress > R.cars[bi].progress)) bi = k; });
  return R.cars[bi];
}
// where the road splits, a gate would stand on one route only: put it past the rejoin
const inSplit = (tr, s) => tr.alts.some(a => { const p = s % tr.loopN; return p > a.F - 10 && p < a.M + 25; });
function nextGate(tr, s) { while (tr.alts.length && inSplit(tr, s)) s += 10; return s < tr.finishIdx - CP.END ? s : Infinity; }
function newGate(S, tr, s) { S.gate = { s: nextGate(tr, s), lat: (S.rng() < 0.5 ? -1 : 1) * CP.LAT, n: S.gate ? S.gate.n + 1 : 0, open: true }; }
/** Checkpoint modes: a gate stands on one side of the road; the first car to drive through it scores. Once someone
 *  has, or the whole pack has gone past it, the next one goes up CP.GAP further on. */
function cpStep(R, W, L) {
  const S = R.sd, tr = W.tr, G = S.gate || (newGate(S, tr, L.progress + CP.FIRST), S.gate);
  let scorer = -1, best = -1;
  R.cars.forEach((c, k) => {
    const was = S.prev[k]; S.prev[k] = c.progress;
    if (!G.open || S.boomT[k] > 0 || !(was < G.s && c.progress >= G.s)) return;
    if (Math.abs(c.pr.lat - G.lat) <= CP.HW && c.progress > best) { best = c.progress; scorer = k; }   // through it, not past it
  });
  if (scorer >= 0) {
    G.open = false; S.points[scorer]++;
    const won = cpState(S, scorer) === 'win';
    R.cars[scorer].events.push({ t: 'cp-point', to: scorer, n: G.n, pts: S.points[scorer], state: cpState(S, scorer) });
    if (won) { finish(R, R.cars[scorer]); return true; }
  }
  if (!G.open || R.cars.every((c, k) => S.boomT[k] > 0 || c.progress > G.s + 2)) {
    if (G.open) R.player.events.push({ t: 'cp-miss', n: G.n });                    // nobody got through it
    newGate(S, tr, G.s + CP.GAP);
  }
  return false;
}
/** How the match stands for car k: 'win' | 'advantage' (one clear, and it would win with one more) | 'deuce' (level at the top) | ''. */
export function cpState(S, k) {
  const P = S.points, T = CP.TARGET[S.kind], best = Math.max(...P.filter((v, j) => j !== k)), me = P[k], lead = me - best;
  if (lead >= 2 && me >= T) return 'win';
  if (lead >= 1 && me + 1 >= T) return 'advantage';                                   // one more and it's over
  if (lead === 0 && me >= T - 1) return 'deuce';
  return '';
}
function mostCrown(R) {
  const S = R.sd; let bi = 0;
  R.cars.forEach((c, k) => { if (S.crown[k] > S.crown[bi] || (S.crown[k] === S.crown[bi] && c.progress > R.cars[bi].progress)) bi = k; });
  return R.cars[bi];
}
/** Crown time multiplier for the current streak. */
export function sdMult(streak) { for (const [t, m] of SD.STREAK) if (streak >= t) return m; return 1; }
function take(R, k) {
  const S = R.sd, from = S.holder; S.holder = k; S.streak = 0; S.stealer = -1; S.stealT = 0;
  if (from >= 0) S.steals[k]++;
  R.cars[k].events.push({ t: 'sd-crown', to: k, from });
}
/** Hand the crown on a clear pass, then bank the holder's time. Returns true when that wins the match. */
function crownStep(R, L, dt) {
  const S = R.sd, li = R.cars.indexOf(L);
  if (S.holder < 0 || S.boomT[S.holder] > 0) take(R, li);                        // nobody has it yet, or the holder blew up
  else if (li !== S.holder) {
    const gap = L.progress - R.cars[S.holder].progress;
    if (gap > SD.STEAL_GAP) take(R, li);
    else if (gap > SD.STEAL_EDGE) { S.stealT = S.stealer === li ? S.stealT + dt : dt; S.stealer = li; if (S.stealT >= SD.STEAL_HOLD) take(R, li); }
    else S.stealT = 0;
  } else S.stealT = 0;
  const h = S.holder, m0 = sdMult(S.streak); S.streak += dt;
  const m = sdMult(S.streak); if (m > m0) R.cars[h].events.push({ t: 'sd-streak', mult: m });
  S.crown[h] += dt * m;
  if (S.crown[h] >= SD.TARGET) { S.crown[h] = SD.TARGET; finish(R, R.cars[h]); return true; }
  return false;
}
/** Respawn a blown-up car rolling behind the leader or alongside it (a touch back), never in front. */
function rejoin(R, W, c) {
  const S = R.sd, L = sdLeader(R), i = L.pr.i, side = L.pr.lat > 0 ? -2.8 : 2.8, r = S.rng();
  const slot = r < 0.6 ? 'behind' : 'beside';
  const at = W.tr.adv(i, slot === 'behind' ? -12 : -3);
  place(c, W, Math.max(4, at), slot === 'beside' ? side : (S.rng() < 0.5 ? -2.8 : 2.8));
  S.spawns.push(slot); c.events.push({ t: 'sd-spawn', slot });
}
/** Ease the zoom towards whatever keeps every car in shot, between ZMIN and ZMAX. */
function fitZoom(R, dt) {
  const S = R.sd, a = R.aspect, ax = a >= 1 ? a : 1, ay = a >= 1 ? 1 : 1 / a;
  let need = SD.ZMIN;
  for (const c of racing(R)) { const [sx, sy] = screenOffset(c.x, c.y, c.z, S.focus, R.camDir); need = Math.max(need, (Math.abs(sx) + SD.FIT) / ax, (Math.abs(sy) + SD.FIT) / ay); }
  need = Math.min(need, SD.ZMAX);
  S.scale += (need - S.scale) * (1 - Math.exp(-dt * (need > S.scale ? 4 : 0.8)));
  S.view = sdExtents(S.scale, a);
}

export function showdownStep(R, W, dt) {
  const S = R.sd; if (S.phase === 'over') return;
  const L = sdLeader(R); if (!L) return;
  // camera focus: the leader, looking a little ahead of it
  const tx = L.x + L.vx * SD.LOOK, tz = L.z + L.vz * SD.LOOK;
  if (!S.focus || S.snap) { S.focus = { x: tx, y: L.y, z: tz }; S.snap = false; }
  else { const k = 1 - Math.exp(-dt * 5); S.focus.x += (tx - S.focus.x) * k; S.focus.y += (L.y - S.focus.y) * k; S.focus.z += (tz - S.focus.z) * k; }
  fitZoom(R, dt);
  if (R.phase !== 'racing') return;
  if (L.progress >= W.tr.finishIdx) { finish(R, S.kind === 'crown' ? mostCrown(R) : mostPoints(R)); return; }

  // blown-up cars come back once the smoke clears
  R.cars.forEach((c, k) => { if (S.boomT[k] > 0 && (S.boomT[k] -= dt) <= 0) { S.boomT[k] = 0; S.offT[k] = 0; rejoin(R, W, c); } });
  if (S.kind === 'crown' ? crownStep(R, L, dt) : cpStep(R, W, L)) return;

  S.grace -= dt; if (S.grace > 0) return;
  // judged against the most zoomed-out view, so the camera always pulls back as far as it can before anyone blows up
  const far = sdExtents(SD.ZMAX, R.aspect), hw = far.hw + SD.OFF_SLACK, hh = far.hh + SD.OFF_SLACK, dropped = [];
  const tr = W.tr, split = c => tr.alts.some(a => { const p = c.progress % tr.loopN; return p > a.F && p < a.M + 25; });
  R.cars.forEach((c, k) => {
    if (c === L || S.boomT[k] > 0 || c.ghost > 0) { S.offT[k] = 0; return; }          // just respawned: safe for a moment
    if (tr.alts.length && (split(c) || split(L))) { S.offT[k] = 0; return; }           // where the road splits, taking the other route isn't falling behind
    const [sx, sy] = screenOffset(c.x, c.y, c.z, S.focus, R.camDir);
    S.offT[k] = Math.abs(sx) > hw || Math.abs(sy) > hh ? S.offT[k] + dt : 0;
    if (S.offT[k] >= SD.OFF_TIME) dropped.push(k);
  });
  if (!dropped.length) return;
  // left behind: blow up, hand some crown time to the crown holder (to the leader if it was the holder that dropped)
  const to = S.kind !== 'crown' || dropped.includes(S.holder) ? R.cars.indexOf(L) : S.holder, amts = [];
  for (const k of dropped) {
    const c = R.cars[k], amt = S.kind === 'crown' ? Math.min(SD.BOOM_TAKE, S.crown[k]) : 0;   // checkpoint modes: blowing up just costs you the ground
    S.crown[k] -= amt; S.crown[to] += amt; S.taken[to] += amt; S.booms[k]++; amts.push(amt);
    S.offT[k] = 0; S.boomT[k] = SD.BOOM; c.wreckT = 1e9; c.boost = 0; c.driftT = 0; c.events.push({ t: 'wreck' });
  }
  R.cars[to].events.push({ t: 'sd-boom', to, losers: dropped, amts });
  if (S.crown[to] >= SD.TARGET) { S.crown[to] = SD.TARGET; finish(R, R.cars[to]); }
}
