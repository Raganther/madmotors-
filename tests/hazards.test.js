// Leader hazards and slipstream (catch-up): who they target, that they're fair, and what they do.
import { describe, it, expect } from 'vitest';
import M from './core-under-test.js';
import { seedRandom } from './scenarios.js';

const DEFS = [{ name: 'a', skill: 0.95, flick: 0.38, driftK: 1 / 62 }, { name: 'b', skill: 0.99, flick: 0.22, driftK: 1 / 38 }, { name: 'p', player: true }, { name: 'c', skill: 0.92, flick: 0.28, driftK: 1 / 50 }];
const HALF = M.HALF, HZ = M.HZ;
const straight = (tr, from = 200) => { for (let i = from; i < tr.N - 200; i++) { let ok = true; for (let k = i; k < i + 80; k++) if (Math.abs(tr.ks[k]) > 1 / 400 || tr.jump[k]) { ok = false; break; } if (ok) return i; } return -1; };
const put = (tr, c, k, lat, v) => { c.x = tr.xs[k] + tr.rx[k] * lat; c.z = tr.zs[k] + tr.rz[k] * lat; c.y = tr.H[k]; c.yaw = tr.th[k]; c.pr = M.project(tr, c.x, c.z, k, 3, 3); c.vx = tr.tx[k] * v; c.vz = tr.tz[k] * v; c.vy = 0; c.onGround = true; };
function world(si) { const st = M.STAGES[si], tr = M.buildTrack(st), terr = M.buildTerrain(tr, st); return { tr, terr, surf: st.surface, armco: !!st.armco, traffic: st.traffic }; }

describe('leader hazards', () => {
  for (const mode of ['race', 'showdown']) it(`${mode}: spawn only ahead of a leader who is clear, with a warning, a clear gap and time between them`, () => {
    seedRandom(5); const W = world(6), R = M.createRace(W, DEFS, { mode }); R.phase = 'racing'; R.autoPlayer = true; R.aspect = 16 / 9;
    const seen = [], log = { hazards: 0, cowHits: 0, oilHits: 0 }; let t = 0, lastSpawn = -99;
    while (t < 240 && (mode === 'race' ? R.cars.some(c => !c.finished) : R.sd.phase !== 'over')) {
      const before = R.hazards.length, lead = M.hzLeader(R);
      M.raceStep(R, 1 / 120, W); t += 1 / 120;
      for (const h of R.hazards) if (!seen.includes(h)) {
        seen.push(h); log.hazards++;
        expect(before).toBeLessThanOrEqual(R.hazards.length);
        expect(lead && lead.earned).toBe(true);                                // only once the leader has pulled clear
        expect(h.i).toBeGreaterThan(lead.L.pr.i + 30);                          // in front of the leader
        for (const c of R.cars) if (c !== lead.L && !c.finished) expect(c.pr.i).toBeLessThan(h.i);
        expect(h.i - h.warnI).toBe(HZ.WARN);                                   // with a warning sign before it
        expect(t - lastSpawn).toBeGreaterThanOrEqual(HZ.COOL - 1e-6); lastSpawn = t;
        if (h.kind === 'oil') expect(HALF + Math.abs(h.lat) - h.r).toBeGreaterThan(4);   // the other side is clear
        else { expect(h.cows.length).toBeLessThanOrEqual(3); expect(HZ.COW_GAP - 2 * HZ.COW_R).toBeGreaterThan(2.3); }   // a car fits between cows
      }
      for (const c of R.cars) { for (const e of c.events) { if (e.t === 'cowhit') log.cowHits++; if (e.t === 'oil') log.oilHits++; } c.events.length = 0; }
    }
    expect(log.hazards).toBeGreaterThan(0);
    console.log(`${mode}: ${log.hazards} hazards, ${log.cowHits} cow hits, ${log.oilHits} oil slides in ${t.toFixed(0)} s`);
  });

  const setupHit = kind => {
    seedRandom(2); const W = world(0), tr = W.tr, R = M.createRace(W, [{ name: 'p', player: true }]); R.phase = 'racing';
    const c = R.cars[0], i = straight(tr); expect(i).toBeGreaterThan(0); put(tr, c, i, 0, 30);
    const j = i + 15, h = { id: 1, i: j, warnI: j - HZ.WARN, age: 0, kind };
    if (kind === 'oil') Object.assign(h, { x: tr.xs[j], z: tr.zs[j], y: tr.H[j], lat: 0, r: HZ.OIL_R });
    else h.cows = [{ x: tr.xs[j], z: tr.zs[j], y: tr.H[j], i: j, dir: 1, vx: 0, vy: 0, vz: 0, hit: false, spin: 0, rot: 0, gait: 0 }];
    R.hazards.push(h); R.hzT = 1e9;
    return { R, W, c, h };
  };
  it('hitting a cow costs speed and a spin, knocks the cow flying, and does not wreck the car', () => {
    const { R, W, c, h } = setupHit('cows'); let hit = null;
    for (let n = 0; n < 120 && !hit; n++) { c.inp.throttle = 1; const v0 = Math.hypot(c.vx, c.vz); M.raceStep(R, 1 / 120, W); for (const e of c.events) if (e.t === 'cowhit') hit = { v0, v1: Math.hypot(c.vx, c.vz) }; c.events.length = 0; }
    expect(hit).not.toBeNull();
    expect(hit.v1).toBeLessThan(hit.v0 * 0.7);
    expect(h.cows[0].hit).toBe(true); expect(h.cows[0].vy).toBeGreaterThan(4);
    expect(c.wreckT).toBe(0);
  });
  it('an oil slick takes the grip away: a steered car slides much further sideways', () => {
    const slide = kind => {
      const { R, W, c, h } = setupHit(kind); if (kind === 'none') R.hazards.length = 0;
      let maxVr = 0; for (let n = 0; n < 90; n++) { c.inp.throttle = 1; c.inp.steer = 1; M.raceStep(R, 1 / 120, W); if (Math.hypot(c.x - (h.x ?? 0), c.z - (h.z ?? 0)) < 4) maxVr = Math.max(maxVr, Math.abs(c.vr)); c.events.length = 0; }
      return { maxVr, oilT: c.oilT };
    };
    const oil = slide('oil');
    expect(oil.maxVr).toBeGreaterThan(6);
  });
});

describe('slipstream', () => {
  it('a car tucked in behind another gets a tow; alongside or far back does not', () => {
    seedRandom(3); const W = world(0), tr = W.tr, R = M.createRace(W, [{ name: 'p', player: true }, { name: 'a', skill: 0.9 }]); R.phase = 'racing'; R.hzT = 1e9;
    const [B, A] = R.cars, i = straight(tr);
    const draftAt = (ahead, lat) => { put(tr, B, i, 0, 30); B.draft = 0; for (let n = 0; n < 60; n++) { put(tr, A, Math.round(B.pr.s + ahead), lat, 30); M.raceStep(R, 1 / 120, W); } return B.draft; };
    expect(draftAt(6, 0)).toBeGreaterThan(0.5);
    expect(draftAt(6, 4.5)).toBeLessThan(0.05);
    expect(draftAt(40, 0)).toBeLessThan(0.05);
  });
});
