import { trackMarkers } from '../elements/index.js';

// A track's report card (looks at the built track and its terrain only; nothing here runs in a race): how long the lap is and how long
// it takes, how much of it is flat out, the corners by how slow they are, the climbs, and its moments (the set pieces
// along it, grouped where they sit together, by kind), then a check against the design pillars of
// docs/TRACK_DESIGN.md. The Track Viewer (ui/viewer.js) shows it beside the track; `npm run report` ranks every stage.
// Speeds are the AI's corner speeds (tr.vmax), braked for at BRAKE m/s² as in sim/ai.js, so the times are a quick AI
// car's, not anyone's best.
export const BRAKE = 28, TOP = 36;   // m/s² of braking (ai.js: v² = vm² + 56 d), and about a quick car's top speed (m/s)
/** The fastest you can be going at each sample and still make every corner ahead (m/s). */
export function speedProfile(tr) {
  const N = tr.N, p = new Float32Array(N), loop = !!tr.loopN, L = tr.loopN || N;
  for (let i = 0; i < N; i++) p[i] = Math.min(TOP, tr.vmax[i]);
  // backwards: slow enough before each corner to brake down to it (twice round a loop so it wraps)
  for (let pass = 0; pass < (loop ? 2 : 1); pass++) for (let i = N - 2; i >= 0; i--) { const j = loop ? (i + 1) % L : i + 1; p[i] = Math.min(p[i], Math.sqrt(p[j] * p[j] + 2 * BRAKE)); }
  return p;
}
// what kind of moment each element makes (pillar 2: three a lap, different in kind)
export const KIND = {
  jump: 'air', kick: 'air', yump: 'air', gap: 'air', whoops: 'air',
  breakables: 'smash', structures: 'smash', crumble: 'smash', chicane: 'smash',
  hammer: 'moving', rockfall: 'moving', drawbridge: 'moving', ferry: 'moving', rails: 'moving', mill: 'moving',
  town: 'place', kit: 'place', tunnel: 'place', gallery: 'place', bridge: 'place', arch: 'place', falls: 'place',
  mud: 'surface', ice: 'surface', dirt: 'surface', boost: 'surface', open: 'route',
};
export const KIND_NAME = { air: 'Air', smash: 'Destruction', moving: 'Moving hazard', place: 'Landmark', surface: 'Surface', route: 'Route choice' };
// how much each kind counts towards "something happening" (a short bridge or a dirt patch is scenery more than a moment)
const WEIGHT = { air: 1, smash: 1, moving: 1, route: 1, place: 0.6, surface: 0.4 };
const GROUP = 60;   // metres: set pieces this close together are one moment
/** The report card of a built track; with its terrain (terr), the towns' houses, barns, fences and gates count too. */
export function trackReport(tr, stage, terr = null) {
  const L = tr.loopN || tr.N, loop = !!tr.loopN, i0 = loop ? 0 : tr.startIdx, i1 = loop ? L : tr.finishIdx || L;
  const p = speedProfile(tr), at = i => (loop ? (i % L + L) % L : i);
  // time and flat out along the lap
  let time = 0, flat = 0; const tAt = new Float32Array(i1 - i0 + 1);
  for (let i = i0; i < i1; i++) { const v = Math.max(4, p[at(i)]); time += 1 / v; if (v >= TOP - 0.5) flat++; tAt[i - i0 + 1] = time; }
  const len = i1 - i0;
  // corners: each braking zone, rated by the slowest speed in it
  const corners = { hairpin: 0, slow: 0, medium: 0, fast: 0 }, cornerAt = [];
  for (let i = i0 + 1; i < i1; i++) {
    const a = p[at(i - 1)], b = p[at(i)]; if (!(a >= TOP - 0.5 && b < TOP - 0.5)) continue;
    let j = i; while (j < i + 400 && j < i1 - 1 && p[at(j)] > p[at(j + 1)] - 0.01) j++;
    const v = p[at(j)], kind = v < 21 ? 'hairpin' : v < 25 ? 'slow' : v < 30 ? 'medium' : 'fast';   // (the AI's corner speeds bottom out near 17 m/s)
    corners[kind]++; cornerAt.push({ i: at(j), v, kind }); i = j;
  }
  // height
  let hMin = Infinity, hMax = -Infinity, climb = 0;
  for (let i = i0; i < i1; i++) { const h = tr.H[at(i)]; hMin = Math.min(hMin, h); hMax = Math.max(hMax, h); if (i > i0) climb += Math.max(0, h - tr.H[at(i - 1)]); }
  // moments: the set pieces, grouped
  const kitN = terr && terr.kit ? terr.kit.solid.length : 0;   // the world kit's pieces: all of them break (features/breakables.js, structures.js)
  const marks = trackMarkers(tr).filter(m => KIND[m.element] && m.i < tr.NB).flatMap(m => m.element === 'kit' && kitN ? [m, { ...m, element: 'kit', label: 'houses to smash', kind: 'smash' }] : [m]).map(m => ({ ...m, i: tr.bi(m.i), kind: m.kind || KIND[m.element] }))
    .filter(m => loop || (m.i >= i0 && m.i <= i1)).sort((a, b) => a.i - b.i);
  const moments = [];
  for (const m of marks) {
    const last = moments[moments.length - 1];
    if (last && m.i - last.i1 < GROUP) { last.items.push(m); last.i1 = m.i; } else moments.push({ i: m.i, i1: m.i, items: [m] });
  }
  if (loop && moments.length > 1) { const a = moments[0], z = moments[moments.length - 1]; if (a.i + L - z.i1 < GROUP) { z.items.push(...a.items); z.i1 = a.i1 + L; moments.shift(); } }
  for (const mo of moments) {
    mo.kinds = [...new Set(mo.items.map(m => m.kind))];
    mo.weight = Math.min(2, mo.items.reduce((s, m) => s + WEIGHT[m.kind], 0));
    mo.big = mo.weight >= 1;
    mo.label = [...new Set(mo.items.map(m => m.label.replace(/ \d+(\.\d+)?m$/, '')))].slice(0, 3).join(', ');
    mo.t = tAt[Math.max(0, Math.min(tAt.length - 1, mo.i - i0))];
  }
  // the longest stretch (in seconds) with nothing worth the name happening
  const big = moments.filter(m => m.big), times = big.map(m => m.t);
  let dead = 0, deadAt = i0;
  if (!times.length) dead = time;
  else {
    for (let k = 1; k < times.length; k++) if (times[k] - times[k - 1] > dead) { dead = times[k] - times[k - 1]; deadAt = big[k - 1].i; }
    const wrap = loop ? times[0] + time - times[times.length - 1] : Math.max(times[0], time - times[times.length - 1]);
    if (wrap > dead) { dead = wrap; deadAt = big[big.length - 1].i; }
  }
  const kinds = new Set(big.flatMap(m => m.kinds));
  const routes = (tr.alts || []).length + (tr.open && tr.open.some(v => v) ? 1 : 0);   // branches, and open country (drive where you like)
  const smash = (tr.structures || []).length + (tr.breakables || []).filter(o => !o.arena).length + (tr.crumbles || []).length + kitN;
  const movers = (tr.hammers || []).length + (tr.drawbridges || []).length + (tr.ferries || []).length + (tr.rails ? tr.rails.crossings.length : 0) + (tr.mills || []).length + moments.filter(m => m.kinds.includes('moving')).length;
  const crossings = countCrossings(tr, L, loop, i0, i1);
  const perMin = big.length / Math.max(0.1, time / 60);
  // the pillars that can be measured (a place with a story and readability are for people to judge: the viewer)
  const pillars = [
    { id: 'moments', name: 'Three signature moments', ok: big.length >= 3 && kinds.size >= 2, val: `${big.length} moments, ${kinds.size} kinds`, tip: 'Add a jump, a smash or a moving hazard: three a lap, each different.' },
    { id: 'rhythm', name: 'Rhythm: no dead stretch', ok: dead <= 15, val: `longest quiet stretch ${dead.toFixed(0)} s`, tip: 'Something every 15 s or so: break up the quiet stretch with a set piece or a sharper corner.' },
    { id: 'variety', name: 'Corner variety', ok: ['hairpin', 'slow', 'medium', 'fast'].filter(k => corners[k]).length >= 3, val: `${corners.hairpin} hairpin, ${corners.slow} slow, ${corners.medium} medium, ${corners.fast} fast`, tip: 'Mix the corners: a hairpin, some medium bends and a fast sweeper.' },
    { id: 'flow', name: 'Fast-slow-fast', ok: flat / len >= 0.3 && flat / len <= 0.8, val: `${Math.round(flat / len * 100)}% flat out`, tip: flat / len > 0.8 ? 'Mostly flat out: add corners that need braking.' : 'Hardly ever flat out: open up a straight or two.' },
    { id: 'choice', name: 'A choice', ok: routes > 0 || smash > 0, val: routes ? `${routes} route split${routes > 1 ? 's' : ''}` : smash ? `${smash} thing${smash > 1 ? 's' : ''} to smash` : 'none', tip: 'A split: a shortcut, or a building to smash through for a quicker line.' },
    { id: 'smash', name: 'Destruction', ok: smash > 0, val: smash ? `${smash} breakable thing${smash > 1 ? 's' : ''}` : 'nothing breaks', tip: 'Something to smash: a breach, a collapse, a topple or a smash lane.' },
    { id: 'alive', name: 'Something moves', ok: movers > 0, val: movers ? `${movers} moving hazard${movers > 1 ? 's' : ''}` : 'all still', tip: 'A moving hazard: wrecking balls, a drawbridge, a train, rockfall.' },
  ];
  const score = pillars.filter(q => q.ok).length;
  return {
    name: stage.name, type: loop ? 'circuit' : 'run', laps: tr.laps || 1, len, time, flat: flat / len, corners, cornerAt,
    hMin, hMax, climb, moments, big: big.length, kinds: [...kinds], perMin, dead, deadAt, routes, smash, movers, crossings, pillars, score, of: pillars.length, profile: p, i0, i1,
  };
}
// where the road passes over itself (a bridge over another part of the lap)
function countCrossings(tr, L, loop, i0, i1) {
  let n = 0; const seen = [];
  for (let i = i0; i < i1; i += 4) {
    if (!tr.bridge[i % (tr.N)]) continue;
    for (let j = i0; j < i1; j += 4) {
      if (Math.abs(i - j) < 80 || (loop && L - Math.abs(i - j) < 80)) continue;
      if (Math.hypot(tr.xs[i] - tr.xs[j], tr.zs[i] - tr.zs[j]) < 10 && tr.H[i] - tr.H[j] > 4) { if (!seen.some(s => Math.abs(s - i) < 60)) { seen.push(i); n++; } break; }
    }
  }
  return n;
}
