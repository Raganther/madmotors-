import { HALF, SURF } from '../constants.js';
import { TAU, lerp, makeNoise, mulberry32, smoothWrap, smoothstep, wrapAngle } from '../math.js';
import { makeRailLine, railAt, railProject } from './rails.js';

export function loopHeight(t) {
  if (t < Math.PI) { const s = t / Math.PI; return 9 * smoothstep(0.5, 1, s) + 3.5 * Math.sin(4 * Math.PI * s) * Math.sin(Math.PI * s); }
  const s = (t - Math.PI) / Math.PI;
  return s < 0.5 ? 9 + 34 * smoothstep(0, 0.5, s) : 43 * (1 - smoothstep(0.5, 1, s));
}
export function genLoop(stage, seed) {
  const rnd = mulberry32(seed), L = stage.L, W = stage.W;
  const a1 = 30 + rnd() * 12, f1 = rnd() < 0.5 ? 5 : 7, p1 = rnd() * TAU, a2 = 14 + rnd() * 8, f2 = rnd() < 0.5 ? 9 : 11, p2 = rnd() * TAU;
  const M = 24000, dx = [], dz = [], dt = [];
  for (let k = 0; k <= M; k++) {
    const t = k / M * TAU, s = Math.sin(t), cs = Math.cos(t);
    const x0 = W * s * cs, z0 = L * s, ddx = W * Math.cos(2 * t), ddz = L * cs, len = Math.hypot(ddx, ddz) || 1;
    const off = s * s * (a1 * Math.sin(f1 * t + p1) + a2 * Math.sin(f2 * t + p2));
    dx.push(x0 - ddz / len * off); dz.push(z0 + ddx / len * off); dt.push(t);
  }
  let total = 0; const acc = [0];
  for (let k = 1; k <= M; k++) { total += Math.hypot(dx[k] - dx[k - 1], dz[k] - dz[k - 1]); acc.push(total); }
  const N0 = Math.round(total), step = total / N0, shift = 60;
  const xs = [], zs = [], ts = [], hs = [], bridge = [], tunnel = [];
  let k = 0;
  for (let i = 0; i < N0; i++) {
    let target = (i + shift) * step; if (target >= total) target -= total;
    if (acc[k] > target) k = 0;
    while (k < M && acc[k + 1] < target) k++;
    const f = (target - acc[k]) / Math.max(1e-9, acc[k + 1] - acc[k]);
    const x = lerp(dx[k], dx[k + 1], f), z = lerp(dz[k], dz[k + 1], f), t = lerp(dt[k], dt[k + 1], f);
    xs.push(x); zs.push(z); ts.push(t); hs.push(loopHeight(t)); tunnel.push(0);
    bridge.push(Math.hypot(x, z) < 32 && Math.abs(t - Math.PI) < 0.8 ? 1 : 0);
  }
  return { xs, zs, ts, hs, bridge, tunnel, smoothH: 8 };
}
export function validLoop(g) {
  const xs = g.xs, zs = g.zs, N = xs.length, w = i => (i % N + N) % N;
  const th = new Float32Array(N); for (let i = 0; i < N; i++) th[i] = Math.atan2(xs[w(i + 1)] - xs[w(i - 1)], zs[w(i + 1)] - zs[w(i - 1)]);
  const k = new Float32Array(N); for (let i = 0; i < N; i++) k[i] = wrapAngle(th[w(i + 1)] - th[w(i - 1)]) / 2;
  const ks = smoothWrap(k, 3); for (let i = 0; i < N; i++) if (Math.abs(ks[i]) > 1 / 22) return false;
  for (let i = 0; i < N; i += 2) for (let j = i + 80; j < N; j += 2) {
    if (N - (j - i) < 80) continue;
    const ex = xs[j] - xs[i], ez = zs[j] - zs[i], d2 = ex * ex + ez * ez;
    if (d2 < 44 * 44) {
      const nearX = Math.hypot(xs[i], zs[i]) < 50 && Math.hypot(xs[j], zs[j]) < 50;
      if (!nearX) return false;
      if (d2 < 16 * 16 && Math.abs(g.hs[i] - g.hs[j]) < 7) return false;
    }
  }
  return true;
}
export function genPass(stage) {
  // (a, b) = (screen-right, up-screen); every step is 1 unit long
  const segs = [['s', 70, 0], ['a', 60, 40, 3], ['s', 40, 8], ['a', 50, 50, 13], ['s', 30, 19], ['a', 26, 90, 22],
    ['s', 90, 34], ['a', 24, -180, 37], ['s', 90, 49], ['a', 24, 180, 52], ['s', 90, 63], ['a', 30, -90, 66], ['s', 60, 78],
    ['a', 45, 90, 81], ['s', 60, 83], ['a', 80, -25, 84], ['s', 50, 84, 'tunnel'], ['a', 80, 25, 85], ['s', 60, 86],
    ['a', 35, 90, 84], ['s', 50, 74], ['a', 26, 90, 71], ['s', 70, 60], ['a', 24, -180, 57], ['s', 70, 46], ['a', 24, 180, 43],
    ['s', 70, 32], ['a', 40, -90, 29], ['s', 'X', 10], ['a', 50, 90, 5], ['s', 'Y', 0]];
  let a = 0, b = 0, phi = 0, h = 0;
  const A = [], B = [], hs = [], tunnel = [];
  const emit = (hh, tun) => { A.push(a); B.push(b); hs.push(hh); tunnel.push(tun ? 1 : 0); };
  emit(0, false);
  for (const sg of segs) {
    let [type, p1, p2, p3] = sg;
    if (type === 's') {
      let len = p1; if (len === 'X') len = b - 50; if (len === 'Y') len = -a - 50;
      const n = Math.max(1, Math.round(len)), h0 = h, st = len / n;
      for (let q = 1; q <= n; q++) { a += Math.cos(phi) * st; b += Math.sin(phi) * st; emit(lerp(h0, p2, q / n), p3 === 'tunnel'); }
      h = p2;
    } else {
      const R = p1, th = p2 * Math.PI / 180, n = Math.max(2, Math.round(R * Math.abs(th))), dphi = th / n, h0 = h;
      const chord = 2 * R * Math.sin(Math.abs(dphi) / 2);
      for (let q = 1; q <= n; q++) { phi += dphi / 2; a += Math.cos(phi) * chord; b += Math.sin(phi) * chord; phi += dphi / 2; emit(lerp(h0, p3, q / n), false); }
      h = p3;
    }
  }
  // drop the closing duplicate
  while (A.length > 2 && Math.hypot(A[A.length - 1] - A[0], B[B.length - 1] - B[0]) < 0.6) { A.pop(); B.pop(); hs.pop(); tunnel.pop(); }
  // extend the tunnel flag a little into its bends so portals sit on straight road
  const T = tunnel.slice(); for (let i = 0; i < T.length; i++) if (tunnel[i]) for (let j = i - 6; j <= i + 6; j++) if (j >= 0 && j < T.length) T[j] = 1;
  const xs = [], zs = [];
  for (let i = 0; i < A.length; i++) { xs.push((A[i] - B[i]) / Math.SQRT2); zs.push(-(A[i] + B[i]) / Math.SQRT2); }
  return { xs, zs, hs, tunnel: T, bridge: new Array(A.length).fill(0), smoothH: 12, pass: true };
}
export function genCircuit(stage) {
  let a = 0, b = 0, phi = stage.startHeading || 0, h = 0;
  const A = [], B = [], hs = [], tunnel = [], bridge = [], farH = [], nearH = [], rampF = [], rampN = [], jumpOK = [], townF = [], galleryF = [], rockF = [];
  const emit = (hh, tg) => {
    A.push(a); B.push(b); hs.push(hh); tunnel.push(tg.tunnel ? 1 : 0); bridge.push(tg.bridge ? 1 : 0); jumpOK.push(tg.jump ? 1 : 0);
    farH.push(tg.far ?? 0); nearH.push(tg.near ?? 0); rampF.push(tg.rampF ?? 20); rampN.push(tg.rampN ?? 20);
    townF.push(tg.town ? 1 : 0); galleryF.push(tg.gallery ? 1 : 0); rockF.push(tg.rockfall ? 1 : 0);
  };
  emit(0, stage.segs[0][3] || {});
  for (const sg of stage.segs) {
    const type = sg[0];
    if (type === 's') {
      let [, len, eh, tg = {}] = sg;
      if (typeof len === 'object') len = len.toA !== undefined ? (len.toA - a) / Math.cos(phi) : (len.toB - b) / Math.sin(phi);
      const n = Math.max(1, Math.round(len)), h0 = h, st = len / n;
      for (let q = 1; q <= n; q++) { a += Math.cos(phi) * st; b += Math.sin(phi) * st; emit(lerp(h0, eh, q / n), tg); }
      h = eh;
    } else {
      const [, R, deg, eh, tg = {}] = sg, th = deg * Math.PI / 180, n = Math.max(2, Math.round(R * Math.abs(th))), dphi = th / n, h0 = h;
      const chord = 2 * R * Math.sin(Math.abs(dphi) / 2);
      for (let q = 1; q <= n; q++) { phi += dphi / 2; a += Math.cos(phi) * chord; b += Math.sin(phi) * chord; phi += dphi / 2; emit(lerp(h0, eh, q / n), tg); }
      h = eh;
    }
  }
  while (A.length > 2 && Math.hypot(A[A.length - 1] - A[0], B[B.length - 1] - B[0]) < 0.6) { A.pop(); B.pop(); for (const arr of [hs, tunnel, bridge, farH, nearH, rampF, rampN, jumpOK, townF, galleryF, rockF]) arr.pop(); }
  const xs = [], zs = [];
  for (let i = 0; i < A.length; i++) { xs.push((A[i] - B[i]) / Math.SQRT2); zs.push(-(A[i] + B[i]) / Math.SQRT2); }
  const river = stage.river ? { pts: stage.river.pts.map(([ra, rb]) => [(ra - rb) / Math.SQRT2, -(ra + rb) / Math.SQRT2]), level: stage.river.level, width: stage.river.width } : null;
  return { xs, zs, hs, tunnel, bridge, smoothH: 10, profile: { farH, nearH, rampF, rampN, jumpOK, townF, galleryF, rockF }, river, closeGap: Math.hypot(A[A.length - 1] - A[0], B[B.length - 1] - B[0]) };
}
export function buildLoop(stage) {
  if (stage.type === 'gorge') return finishLoop(stage, genCircuit(stage), stage.seed);
  if (stage.type === 'pass') return finishLoop(stage, genPass(stage), stage.seed);
  let seed = stage.seed;
  for (let attempt = 0; attempt < 80; attempt++, seed += 977) { const g = genLoop(stage, seed); if (validLoop(g)) return finishLoop(stage, g, seed); }
  throw new Error('Circuit generation failed');
}
export function finishLoop(stage, g, seed) {
  const N0 = g.xs.length, w = i => (i % N0 + N0) % N0;
  const xs0 = Float32Array.from(g.xs), zs0 = Float32Array.from(g.zs);
  const F0 = () => new Float32Array(N0), U0 = () => new Uint8Array(N0);
  const th0 = F0(), k0 = F0(), bridge0 = U0(), jump0 = U0(), wallL0 = U0(), wallR0 = U0(), kerbL0 = U0(), kerbR0 = U0(), vmax0 = F0();
  for (let i = 0; i < N0; i++) th0[i] = Math.atan2(xs0[w(i + 1)] - xs0[w(i - 1)], zs0[w(i + 1)] - zs0[w(i - 1)]);
  for (let i = 0; i < N0; i++) k0[i] = wrapAngle(th0[w(i + 1)] - th0[w(i - 1)]) / 2;
  const ks0 = smoothWrap(k0, 6);
  const hraw = Float32Array.from(g.hs);
  const H0 = smoothWrap(hraw, g.smoothH || 8);
  const tunnel0 = U0();
  for (let i = 0; i < N0; i++) { bridge0[i] = g.bridge[i]; tunnel0[i] = g.tunnel[i]; }
  const noise = makeNoise(seed);
  const startIdx = 36;
  // railways: where a line meets the road at the same height is a level crossing
  const rails = stage.rails ? { lines: stage.rails.map(makeRailLine), crossings: [] } : null;
  if (rails) for (const L of rails.lines) {
    let run = [];
    const flush = () => { if (run.length) { const i = run[Math.floor(run.length / 2)], pj = railProject(L, xs0[i], zs0[i]); const C = { i, s: pj.s, line: L, closed: false }; L.crossings.push(C); rails.crossings.push(C); } run = []; };
    for (let i = 0; i < N0; i++) {
      const pj = railProject(L, xs0[i], zs0[i]), h = railAt(L, pj.s).h;
      if (pj.d < 3 && Math.abs(H0[i] - h) < 2.5) run.push(i); else flush();
    }
    flush();
  }
  const nearCrossing = (j, r) => rails && rails.crossings.some(C => { const d = Math.abs(j - C.i); return Math.min(d, N0 - d) < r; });
  // jump: straight section, away from the crossing and the start
  let placed = 0;
  for (let i = startIdx + 150; i < N0 - 80 && placed < stage.jumps; i += 5) {
    let ok = true;
    for (let j = i - 15; j <= i + 60; j++) if (Math.abs(ks0[w(j)]) > 1 / 110 || Math.hypot(xs0[w(j)], zs0[w(j)]) < 80 || tunnel0[w(j)] || bridge0[w(j)] || (g.profile && !g.profile.jumpOK[w(j)]) || nearCrossing(w(j), 80)) { ok = false; break; }
    if (!ok) continue;
    const RH = 2.4;
    for (let q = 0; q <= 17; q++) H0[i + q] += RH * Math.pow(q / 17, 1.7);
    H0[i + 18] += RH * 0.62; H0[i + 19] += RH * 0.28;
    for (let q = 0; q < 20; q++) jump0[i + q] = 1;
    placed++; i += 400;
  }
  const idwX = [], idwZ = [], idwH = [];
  for (let i = 0; i < N0; i += 6) if (!bridge0[i]) { idwX.push(xs0[i]); idwZ.push(zs0[i]); idwH.push(H0[i]); }
  let tunMid = -1; { const ti = []; for (let i = 0; i < N0; i++) if (tunnel0[i]) ti.push(i); if (ti.length) tunMid = ti[Math.floor(ti.length / 2)]; }
  const toAB = (x, z) => [(x - z) / Math.SQRT2, -(x + z) / Math.SQRT2];
  const idw = (x, z) => {
    let sw = 0, sh = 0;
    for (let q = 0; q < idwX.length; q++) { const ex = x - idwX[q], ez = z - idwZ[q], d2 = ex * ex + ez * ez + 900; const wt = 1 / (d2 * Math.sqrt(d2)); sw += wt; sh += wt * idwH[q]; }
    return sh / sw;
  };
  const shape = (x, z) => {
    if (!g.pass) return 0;
    const [a, b] = toAB(x, z);
    const wallMask = smoothstep(-400, -320, a) * (1 - smoothstep(60, 150, a));
    let v = 75 * smoothstep(395, 470, b) * wallMask;
    v += 70 * Math.max(0, noise.fbm(a * 0.011 + 3, b * 0.011 - 2, 3) + 0.25) * smoothstep(420, 520, b);
    if (tunMid >= 0) {
      const ex = x - xs0[tunMid], ez = z - zs0[tunMid], tt = Math.sin(th0[tunMid]), tz = Math.cos(th0[tunMid]);
      const along = ex * tt + ez * tz, lat = Math.abs(ex * -tz + ez * tt);
      v += 30 * Math.exp(-along * along / (2 * 16 * 16)) * (1 - smoothstep(35, 80, lat));
    }
    return v;
  };
  // gorge tracks: ground height comes from the nearest road section's profile (far = up-screen side, near = camera side)
  const PF = g.profile ? { far: smoothWrap(Float32Array.from(g.profile.farH), 12), near: smoothWrap(Float32Array.from(g.profile.nearH), 12),
    rF: smoothWrap(Float32Array.from(g.profile.rampF), 12), rN: smoothWrap(Float32Array.from(g.profile.rampN), 12),
    dot: Float32Array.from(th0, t => -Math.cos(t) * -Math.SQRT1_2 + Math.sin(t) * -Math.SQRT1_2) } : null;   // how much the road's right side faces up-screen
  // profile for one side of sample i (side = +1 right, -1 left): roads running up/down the screen blend far and near
  const sideProf = (i, side) => { const f = smoothstep(-0.45, 0.45, side * PF.dot[i]); return [lerp(PF.near[i], PF.far[i], f), lerp(PF.rN[i], PF.rF[i], f), f]; };
  const profBase = (x, z) => {
    const q = nearestT(x, z) || nearestFar(x, z); if (!q) return 0;
    const i = q.i, lat = (x - xs0[i]) * -Math.cos(th0[i]) + (z - zs0[i]) * Math.sin(th0[i]);
    const [prof, ramp] = sideProf(i, lat >= 0 ? 1 : -1);
    const nearV = H0[i] + prof * smoothstep(HALF + 3, HALF + 3 + ramp, q.d);
    // well away from every road, fade to a smooth regional surface: average road height, mountains rising up-screen
    const k = smoothstep(55, 130, q.d), up = -(x + z) * Math.SQRT1_2;
    const regional = k > 0 ? idw(x, z) + Math.max(0, up - 330) * 0.45 + 18 * Math.max(0, noise.fbm(x * 0.005 + 7, z * 0.005 - 3, 3) + 0.2) : 0;
    return lerp(nearV, regional, k) + 4 * noise.fbm(x * 0.012 + 2.2, z * 0.012 - 4.1, 3) * smoothstep(HALF + 3, HALF + 25, q.d);
  };
  const base = g.profile ? profBase : (x, z) => idw(x, z) + shape(x, z) + 5 * noise.fbm(x * 0.006 + 2.2, z * 0.006 - 4.1, 2);
  const carveW = g.pass ? (x, z) => 1 - smoothstep(380, 440, toAB(x, z)[1]) : null;
  for (let i = 0; i < N0; i++) {
    const a = Math.abs(ks0[i]);
    if (a > 1 / 48) { const out = ks0[i] > 0 ? wallR0 : wallL0; for (let j = i - 8; j <= i + 8; j++) out[w(j)] = 1; }
    if (a > 1 / 75) for (let j = i - 5; j <= i + 5; j++) { kerbL0[w(j)] = 1; kerbR0[w(j)] = 1; }
  }
  for (let i = 0; i < N0; i++) {
    const a = Math.abs(ks0[i]), out = ks0[i] > 0 ? wallR0 : wallL0;
    if (a > 1 / 110 && a <= 1 / 48 && !out[i] && !jump0[i]) out[i] = 3;
    if (PF) {
      if (!tunnel0[i] && !bridge0[i]) {
        for (const side of [1, -1]) {
          const W = side > 0 ? wallR0 : wallL0, pr = sideProf(i, side)[0];
          if (!W[i] && pr > 3) W[i] = 6;                               // rock face: the terrain is the wall
          else if (!W[i] && pr < -3) W[i] = 2;                          // guard rail along the drop
        }
      }
    } else if (g.pass) {
      if (!tunnel0[i]) {
        const rx = -Math.cos(th0[i]), rz = Math.sin(th0[i]);
        const L = base(xs0[i] - rx * 18, zs0[i] - rz * 18) - (stage.carve || 0) * 0.6, R = base(xs0[i] + rx * 18, zs0[i] + rz * 18) - (stage.carve || 0) * 0.6;
        const Hh = H0[i];
        if (Hh - L > 3 && !wallL0[i]) wallL0[i] = 2;
        if (Hh - R > 3 && !wallR0[i]) wallR0[i] = 2;
      }
    } else {
      const down = H0[w(i + 1)] - H0[w(i - 1)];
      if (a < 1 / 60 && !jump0[i] && Math.abs(down) > 0.12) { const side = ks0[i] >= 0 ? wallR0 : wallL0; if (!side[i] && noise.n2(i * 0.03, 5.5) > 0) side[i] = 2; }
    }
    if (i < 48) { if (!wallL0[i]) wallL0[i] = 2; if (!wallR0[i]) wallR0[i] = 2; }
  }
  for (let i = 0; i < N0; i++) if (bridge0[i]) { for (let j = i - 2; j <= i + 2; j++) { wallL0[w(j)] = 4; wallR0[w(j)] = 4; } kerbL0[i] = kerbR0[i] = 0; }
  for (let i = 0; i < N0; i++) if (tunnel0[i]) { wallL0[i] = 5; wallR0[i] = 5; kerbL0[i] = kerbR0[i] = 0; }
  const hairpins = [];
  for (let i = 0; i < N0; i++) if (Math.abs(ks0[i]) > 1 / 40) {
    let j = i; while (j < N0 - 1 && Math.abs(ks0[j]) > 1 / 40) j++;
    if (Math.abs(wrapAngle(th0[j] - th0[i])) > 1.4 || j - i > 55) hairpins.push({ a: i, b: j, side: ks0[i] > 0 ? 1 : -1 });
    i = j;
  }
  const lm = SURF[stage.surface].latMax * 0.8;
  for (let i = 0; i < N0; i++) { let m = 1e-4; for (let j = i - 2; j <= i + 2; j++) m = Math.max(m, Math.abs(ks0[w(j)])); vmax0[i] = Math.min(70, Math.sqrt(lm / m)); }

  // town: bollards along the pavement edge on both sides; gallery: a solid parapet on the valley side
  const town0 = U0(), gallery0 = U0(), rock0 = U0();
  if (PF) for (let i = 0; i < N0; i++) {
    town0[i] = g.profile.townF[i]; gallery0[i] = g.profile.galleryF[i]; rock0[i] = g.profile.rockF[i];
    if (town0[i]) { wallL0[i] = 7; wallR0[i] = 7; kerbL0[i] = kerbR0[i] = 0; }
    if (gallery0[i]) { if (PF.dot[i] > 0) wallL0[i] = 5; else wallR0[i] = 5; }
  }
  // gaps in the barriers where a railway crosses
  if (rails) for (const C of rails.crossings) for (let j = C.i - 9; j <= C.i + 9; j++) { wallL0[w(j)] = 0; wallR0[w(j)] = 0; kerbL0[w(j)] = 0; kerbR0[w(j)] = 0; }
  // unroll laps into a straight run of samples so every lap is just "further along"
  const laps = stage.laps, N = N0 * laps + startIdx + 110;
  const F = () => new Float32Array(N), U = () => new Uint8Array(N);
  const xs = F(), zs = F(), th = F(), tx = F(), tz = F(), rx = F(), rz = F(), k = F(), ks = F(), H = F(), vmax = F();
  const jump = U(), wallL = U(), wallR = U(), kerbL = U(), kerbR = U(), bridge = U(), tunnel = U();
  for (let i = 0; i < N; i++) {
    const b = i % N0;
    xs[i] = xs0[b]; zs[i] = zs0[b]; th[i] = th0[b]; tx[i] = Math.sin(th0[b]); tz[i] = Math.cos(th0[b]); rx[i] = -tz[i]; rz[i] = tx[i];
    k[i] = k0[b]; ks[i] = ks0[b]; H[i] = H0[b]; vmax[i] = vmax0[b]; jump[i] = jump0[b]; wallL[i] = wallL0[b]; wallR[i] = wallR0[b];
    kerbL[i] = kerbL0[b]; kerbR[i] = kerbR0[b]; bridge[i] = bridge0[b]; tunnel[i] = tunnel0[b];
  }
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (let i = 0; i < N0; i++) { minX = Math.min(minX, xs0[i]); maxX = Math.max(maxX, xs0[i]); minZ = Math.min(minZ, zs0[i]); maxZ = Math.max(maxZ, zs0[i]); }
  const hk = (cx, cz) => (cx + 1000) * 100000 + (cz + 1000);
  const mkHash = (skipBridge, only, CELL = 36, step = 1) => { const h = new Map(); h.cell = CELL; for (let i = 0; i < N0; i += step) { if (skipBridge && (bridge0[i] || tunnel0[i])) continue; if (only && !only[i]) continue; const kk = hk(Math.floor(xs0[i] / CELL), Math.floor(zs0[i] / CELL)); let a = h.get(kk); if (!a) { a = []; h.set(kk, a); } a.push(i); } return h; };
  const mkNearest = h => (x, z) => {
    const CELL = h.cell, cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); let best = Infinity, bi = -1;
    for (let ddx = -1; ddx <= 1; ddx++) for (let ddz = -1; ddz <= 1; ddz++) {
      const a = h.get(hk(cx + ddx, cz + ddz)); if (!a) continue;
      for (let q = 0; q < a.length; q++) { const i = a[q]; const ex = x - xs0[i], ez = z - zs0[i]; const d = ex * ex + ez * ez; if (d < best) { best = d; bi = i; } }
    }
    return bi < 0 ? null : { i: bi, d: Math.sqrt(best) };
  };
  const nearest = mkNearest(mkHash(false)), nearestT = mkNearest(mkHash(true)), nearestFar = mkNearest(mkHash(true, null, 240, 3));   // coarse, for ground far from any road
  const nearestTun = tunMid >= 0 ? mkNearest(mkHash(false, tunnel0)) : () => null;
  // tunnel portals: walk out from the line's first crossing until the ground stands 7 m over the rails
  if (rails) for (const L of rails.lines) if (L.def.portals && L.crossings.length) {
    const s0 = Math.min(...L.crossings.map(C => C.s)), s1 = Math.max(...L.crossings.map(C => C.s));
    const deep = s => { const p = railAt(L, s); return base(p.x, p.z) - p.h > 7; };
    let a = s0; while (a > 0 && !deep(a)) a -= 2; let b = s1; while (b < L.len && !deep(b)) b += 2;
    L.visA = Math.max(0, a); L.visB = Math.min(L.len, b);
  }
  return { N, xs, zs, th, tx, tz, rx, rz, k, ks, H, jump, wallL, wallR, kerbL, kerbR, vmax, hairpins, finishIdx: startIdx + laps * N0, startIdx, noise, base, nearest, nearestT,
    minZ, maxZ, minX, maxX, surface: stage.surface, seed, bridge, tunnel, nearestTun, carve: stage.carve || 0, carveW, margin: g.pass ? 230 : g.profile ? 120 : 95,
    loopN: N0, laps, crossX: 0, crossZ: 0, river: g.river || null, rails, town: PF ? town0 : null, gallery: PF ? gallery0 : null, rockfall: PF && rock0.some(v => v) ? rock0 : null, gridS: g.profile ? 4 : 3, edge: g.profile ? HALF + 4 : HALF + 15 };
}
