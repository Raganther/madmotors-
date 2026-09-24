// Deterministic scenarios over the pure simulation. Used by the golden test: any refactor must reproduce these
// numbers exactly. `M` is the core API: { STAGES, buildTrack, buildTerrain, createRace, raceStep, stepCar, dispatchTrain, wallAt, HALF, WALL }.

const DEFS = [
  { name: 'a', skill: 0.95, flick: 0.38, driftK: 1 / 62 }, { name: 'b', skill: 0.99, flick: 0.22, driftK: 1 / 38 },
  { name: 'p', player: true }, { name: 'c', skill: 0.92, flick: 0.28, driftK: 1 / 50 }
];
// the simulation uses Math.random for small visual/AI jitter; seed it so runs repeat exactly
export function seedRandom(seed = 7) { let a = seed; Math.random = () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; }

const r3 = v => Math.round(v * 1000) / 1000;
function world(M, si) {
  const st = M.STAGES[si], tr = M.buildTrack(st), terr = M.buildTerrain(tr, st);
  return { st, tr, terr, W: { tr, terr, surf: st.surface, armco: !!st.armco, traffic: st.traffic } };
}

export function raceScenario(M, si) {
  seedRandom(7 + si);
  const { tr, terr, W } = world(M, si);
  let hsum = 0; for (let i = 0; i < terr.h.length; i += 7) hsum += terr.h[i];
  const R = M.createRace(W, DEFS); R.phase = 'racing'; R.autoPlayer = true;
  const stats = { trafficSeen: 0, trainHits: 0, rockHits: 0, rocks: 0 }; const seen = new Set(), rseen = new Set();
  let t = 0;
  while (t < 420 && R.cars.some(c => !c.finished)) {
    M.raceStep(R, 1 / 120, W); t += 1 / 120;
    for (const c of R.traffic) if (!seen.has(c)) { seen.add(c); stats.trafficSeen++; }
    for (const o of R.rocks || []) if (!rseen.has(o.id)) { rseen.add(o.id); stats.rocks++; }
    for (const c of R.cars.concat(R.traffic, R.parked || [])) { for (const e of c.events) { if (e.t === 'trainhit') stats.trainHits++; if (e.t === 'rockhit') stats.rockHits++; } c.events.length = 0; }
  }
  const broken = W.bar ? W.bar.broken[0].reduce((a, b) => a + b, 0) + W.bar.broken[1].reduce((a, b) => a + b, 0) : 0;
  return {
    samples: tr.N, loopN: tr.loopN || 0, terrain: [terr.cols, terr.rows, r3(hsum)],
    times: R.cars.map(c => c.finished ? r3(c.finishTime) : null), respawns: R.cars.map(c => c.respawns), wrecks: R.cars.map(c => c.wrecks),
    progress: R.cars.map(c => r3(c.progress)), broken, ...stats
  };
}

// drive a single car into the right-hand wall of a given type and report what happened
export function wallScenario(M, si, wt, speed, ang = 1.0) {
  seedRandom(99);
  const { tr, W } = world(M, si);
  const R = M.createRace(W, [{ name: 'p', player: true }]), c = R.cars[0];
  let i = -1; for (let k = 100; k < tr.N - 100; k++) if (tr.wallR[k] === wt && tr.wallR[k + 6] === wt && tr.wallR[k - 6] === wt) { i = k; break; }
  if (i < 0) return { none: true };
  const a = tr.th[i] - ang; c.x = tr.xs[i] + tr.rx[i] * 3; c.z = tr.zs[i] + tr.rz[i] * 3; c.y = tr.H[i]; c.yaw = a;
  c.vx = Math.sin(a) * speed; c.vz = Math.cos(a) * speed; c.pr.i = i; c.pr.lat = 3; c.onGround = true;
  const ev = {};
  for (let n = 0; n < 240; n++) { c.inp.throttle = 1; M.stepCar(c, 1 / 120, W, true); for (const e of c.events) ev[e.t] = (ev[e.t] || 0) + 1; c.events.length = 0; }
  return { i, events: ev, x: r3(c.x), z: r3(c.z), y: r3(c.y), dmg: Object.values(c.dmg).map(r3), changes: W.bar.changes.map(ch => ch.t + ch.p) };
}

export function trainScenario(M) {
  seedRandom(5);
  const { tr, W } = world(M, 6);
  const R = M.createRace(W, [{ name: 'p', player: true }]); R.phase = 'racing';
  const c = R.cars[0], C = tr.rails.lines[0].crossings[0];
  c.x = tr.xs[C.i]; c.z = tr.zs[C.i]; c.y = tr.H[C.i]; c.vx = c.vz = 0; c.pr.i = C.i; c.ghost = 0;
  R.trains.forEach(T => T.idleT = 1e9); M.dispatchTrain(R.trains[0], 1, C.s - 150);
  const ev = []; let closedAt = null;
  for (let n = 0; n < 900; n++) { M.raceStep(R, 1 / 120, W); if (C.closed && closedAt === null) closedAt = n; for (const e of c.events) if (e.t === 'trainhit' || e.t === 'wreck') ev.push(n + e.t); c.events.length = 0; }
  return { crossings: tr.rails.crossings.map(k => [k.i, r3(k.s)]), portals: tr.rails.lines.map(L => [r3(L.visA), r3(L.visB)]), closedAt, ev };
}
