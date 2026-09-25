import { HALF } from '../constants.js';
import { clamp, mulberry32 } from '../math.js';
import { damageCar } from '../sim/damage.js';
import { groundAt, project } from '../track/query.js';

// ---------- leader hazards (catch-up) ----------
// Once a leader has pulled clear (Race: 35 m on the next car; Showdown: holding the crown 8 s or 35 m clear), a hazard
// is dropped on the road ~3 s ahead of it: a small herd of cows ambling across, or an oil slick on one side.
// Fair by construction: a warning sign stands 70 m before it, there is always a clear gap to thread, it hits anyone
// who drives into it (chasers too), costs a second or two rather than a wreck, and there are 8-12 s between them.
// Uses its own seeded generator, so the other features' random sequences are untouched.
export const HZ = { LEAD: 35, SD_HOLD: 8, AHEAD: 2.8, COOL: 6, COOL_VAR: 3, WARN: 70, COW_R: 1.1, COW_WALK: 1.2, COW_GAP: 4.6, OIL_R: 3.2, OIL_T: 0.9 };

/** The car the hazards target, and how far clear it is (metres), or null. */
export function hzLeader(R) {
  const live = R.cars.filter(c => !c.finished && !(c.wreckT > 0));
  if (live.length < 2) return null;
  const S = R.sd, byProg = live.slice().sort((a, b) => b.progress - a.progress);
  if (S && S.kind === 'crown') {                                                   // Showdown: the crown holder; checkpoint modes: whoever leads
    if (S.holder < 0) return null;
    const L = R.cars[S.holder], next = byProg.find(c => c !== L);
    return { L, gap: L.progress - next.progress, earned: S.streak >= HZ.SD_HOLD || L.progress - next.progress >= HZ.LEAD };
  }
  const gap = byProg[0].progress - byProg[1].progress;
  return { L: byProg[0], gap, earned: gap >= HZ.LEAD };
}
function spotOK(tr, j) {
  const N0 = tr.loopN || tr.N, w = k => tr.loopN ? k % N0 : k;
  if (j > tr.finishIdx - 60 || j >= tr.NM) return false;
  if (tr.alts.some(a => w(j) > a.F - 40 && w(j) < a.M + 20)) return false;           // not where the road splits: which way would it be fair?
  for (let k = j - 18; k <= j + 18; k++) { const b = w(k); if (tr.jump[b] || tr.tunnel[b] || tr.bridge[b] || (tr.gap && tr.gap[b]) || (tr.ferry && tr.ferry[b]) || (tr.boostPad && tr.boostPad[b]) || Math.abs(tr.ks[b]) > 1 / 45) return false; }
  if (tr.rails && tr.rails.crossings.some(C => Math.abs(C.i - w(j)) < 40)) return false;
  if ((tr.ferries || []).some(f => w(j) > f.a - 190 && w(j) < f.b + 30)) return false;   // not in the ferry queue
  return true;
}
function spawnHazard(R, W, L) {
  const tr = W.tr, rng = R.hzRng, sp = Math.max(15, Math.hypot(L.vx, L.vz));
  let j = Math.round(L.pr.i + sp * HZ.AHEAD + 25), tries = 0;
  while (!spotOK(tr, j) && tries++ < 6) j += 12;
  if (tries > 6) return false;
  const at = (i, lat) => ({ x: tr.xs[i] + tr.rx[i] * lat, z: tr.zs[i] + tr.rz[i] * lat });
  const id = ++R.hzId, h = { id, i: j, warnI: j - HZ.WARN, age: 0 };
  if (rng() < 0.5) {
    // cows: 2-3 in a line across the road, 4.6 m apart (gaps a car fits through), walking the same way
    const dir = rng() < 0.5 ? -1 : 1, n = rng() < 0.5 ? 2 : 3, lat0 = -dir * (HALF - 1.5);
    h.kind = 'cows'; h.cows = [];
    for (let k = 0; k < n; k++) { const i = j + Math.round((rng() - 0.5) * 6), lat = lat0 + dir * k * HZ.COW_GAP, p = at(i, lat); h.cows.push({ x: p.x, z: p.z, y: tr.H[i], i, dir, vx: 0, vy: 0, vz: 0, hit: false, spin: 0, rot: 0, gait: rng() * 6 }); }
  } else {
    // oil slick on one side: the other side stays clear
    const side = rng() < 0.5 ? -1 : 1, lat = side * (1.8 + rng() * 1.6), p = at(j, lat);
    h.kind = 'oil'; h.x = p.x; h.z = p.z; h.y = tr.H[j]; h.lat = lat; h.r = HZ.OIL_R;
  }
  R.hazards.push(h); R.player.events.push({ t: 'hazard', id, kind: h.kind, i: j, target: R.cars.indexOf(L) });
  return true;
}
function moveHazards(R, W, dt) {
  const tr = W.tr;
  for (const h of R.hazards) {
    h.age += dt;
    if (h.kind !== 'cows') continue;
    for (const c of h.cows) {
      if (c.hit) {
        c.vy -= 30 * dt; c.x += c.vx * dt; c.y += c.vy * dt; c.z += c.vz * dt; c.rot += c.spin * dt;
        const pr = project(tr, c.x, c.z, c.i, 10, 10); c.i = pr.i; const g = groundAt(W, pr.s, pr.lat, c.x, c.z);
        if (c.y < g) { c.y = g; c.vy = Math.abs(c.vy) > 3 ? -c.vy * 0.3 : 0; c.vx *= 0.5; c.vz *= 0.5; c.spin *= 0.4; }
      } else {                                              // amble across, along the road's right-hand normal
        c.x += tr.rx[c.i] * c.dir * HZ.COW_WALK * dt; c.z += tr.rz[c.i] * c.dir * HZ.COW_WALK * dt; c.gait += dt;
        c.y = tr.H[c.i];
      }
    }
  }
  // gone once everyone still racing is well past it (or after a while)
  const back = Math.min(...R.cars.filter(c => !c.finished).map(c => c.pr.i).concat([Infinity]));
  R.hazards = R.hazards.filter(h => h.age < 40 && !(back > h.i + 60));
}
/** Cars driving into hazards: cows are knocked flying and cost speed and a spin; oil takes the grip away. */
function hitHazards(R, W) {
  for (const h of R.hazards) for (const c of R.cars) {
    if (c.ghost > 0 || c.finished || Math.abs(c.pr.i - h.i) > 30) continue;
    if (h.kind === 'oil') {
      if (c.onGround && Math.hypot(c.x - h.x, c.z - h.z) < h.r) { if (!(c.oilT > 0)) c.events.push({ t: 'oil', x: c.x, y: c.y, z: c.z }); c.oilT = HZ.OIL_T; }
      continue;
    }
    for (const cow of h.cows) {
      if (cow.hit || Math.abs(c.y - cow.y) > 2 || Math.hypot(c.x - cow.x, c.z - cow.z) > HZ.COW_R + 1.2) continue;
      const v = Math.hypot(c.vx, c.vz), side = Math.sign((cow.x - c.x) * c.vz - (cow.z - c.z) * c.vx) || 1;
      cow.hit = true; cow.vx = c.vx * 0.7; cow.vz = c.vz * 0.7; cow.vy = 5 + v * 0.2; cow.spin = side * (5 + v * 0.1);
      c.vx *= 0.55; c.vz *= 0.55; c.spin = clamp(c.spin - side * (1.5 + v * 0.05), -4, 4); c.boost = 0;
      damageCar(c, cow.x, cow.z, v, 0.25, (cow.x - c.x) / (v || 1), (cow.z - c.z) / (v || 1));
      c.events.push({ t: 'cowhit', x: cow.x, y: cow.y, z: cow.z, v });
    }
  }
}
export const feature = {
  name: 'hazards',
  init(R, W) { R.hazards = []; R.hzT = 10; R.hzId = 0; R.hzRng = mulberry32(((W.tr.seed || 1) * 97 + 5) >>> 0); },
  spawn(R, W, dt) {
    if (R.phase !== 'racing') return;
    moveHazards(R, W, dt);
    if ((R.hzT -= dt) > 0) return;
    const lead = hzLeader(R);
    if (!lead || !lead.earned) { R.hzT = 1; return; }
    R.hzT = spawnHazard(R, W, lead.L) ? HZ.COOL + R.hzRng() * HZ.COOL_VAR : 2;
  },
  after(R, W) { hitHazards(R, W); }
};
