import { SURF } from '../constants.js';
import { autoJumps } from '../elements/jump.js';
import { TAU, clamp, makeNoise, mulberry32, smoothArr, wrapAngle } from '../math.js';

export function genPath(stage, seed) {
  const rnd = mulberry32(seed);
  const xs = [0], zs = [0]; let x = 0, z = 0, th = 0;
  const step = (target, kmax) => { const d = wrapAngle(target - th); th += d > kmax ? kmax : d < -kmax ? -kmax : d; x += Math.sin(th); z += Math.cos(th); xs.push(x); zs.push(z); };
  for (const [type, arg] of stage.plan) {
    if (type === 'st') { for (let i = 0; i < arg; i++) step(0, 1 / 45); }
    else if (type === 'sw') {
      const ph = rnd() * TAU, fr = 0.013 + rnd() * 0.009, amp = 0.5 + rnd() * 0.35, ph2 = rnd() * TAU;
      for (let i = 0; i < arg; i++) {
        const t = amp * Math.sin(ph + i * fr) + 0.22 * Math.sin(ph2 + i * fr * 2.4) - clamp(x / 100, -1.3, 1.3) * 0.75;
        step(clamp(t, -1.15, 1.15), 1 / 34);
      }
    } else if (type === 'sb') {
      let dir = x > 0 ? -1 : 1;
      for (let h = 0; h <= arg; h++) {
        const last = h === arg; const xl = last ? -10 : 72 + rnd() * 28; const wph = rnd() * TAU; let n = 0;
        while (n < 420) { step(dir * (Math.PI / 2 - 0.2 + 0.07 * Math.sin(wph + n * 0.035)), 1 / 28); n++; if (n > 45 && dir * x > xl) break; }
        if (!last) { const target = -dir * (Math.PI / 2 - 0.2); let g = 0; while (Math.abs(wrapAngle(target - th)) > 0.01 && g < 300) { step(target, 1 / 24); g++; } dir = -dir; }
      }
    }
  }
  return { xs, zs };
}
export function validPath(g) {
  const xs = g.xs, zs = g.zs, N = xs.length, C = 44, map = new Map();
  const key = (cx, cz) => (cx + 500) * 100000 + (cz + 500);
  for (let i = 0; i < N; i++) {
    if (Math.abs(xs[i]) > 150) return false;
    const k = key(Math.floor(xs[i] / C), Math.floor(zs[i] / C)); let a = map.get(k); if (!a) { a = []; map.set(k, a); } a.push(i);
  }
  for (let i = 0; i < N; i += 2) {
    const cx = Math.floor(xs[i] / C), cz = Math.floor(zs[i] / C);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const a = map.get(key(cx + dx, cz + dz)); if (!a) continue;
      for (const j of a) { if (j - i > 80) { const ex = xs[j] - xs[i], ez = zs[j] - zs[i]; if (ex * ex + ez * ez < 44 * 44) return false; } }
    }
  }
  return true;
}
export function finishTrack(stage, g, seed) {
  const N = g.xs.length;
  const xs = Float32Array.from(g.xs), zs = Float32Array.from(g.zs);
  const F = () => new Float32Array(N), U = () => new Uint8Array(N);
  const th = F(), tx = F(), tz = F(), rx = F(), rz = F(), k = F(), vmax = F();
  const jump = U(), wallL = U(), wallR = U(), kerbL = U(), kerbR = U();
  for (let i = 0; i < N; i++) {
    const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1);
    th[i] = Math.atan2(xs[b] - xs[a], zs[b] - zs[a]);
    tx[i] = Math.sin(th[i]); tz[i] = Math.cos(th[i]); rx[i] = -tz[i]; rz[i] = tx[i];
  }
  for (let i = 0; i < N; i++) { const a = Math.max(0, i - 1), b = Math.min(N - 1, i + 1); k[i] = wrapAngle(th[b] - th[a]) / (b - a); }
  const ks = smoothArr(k, 6);
  const noise = makeNoise(seed);
  const base = (x, z) => -stage.grade * z + 7 * noise.fbm(x * 0.004 + 3.1, z * 0.004 - 1.7, 2);
  const raw = F(); for (let i = 0; i < N; i++) raw[i] = base(xs[i], zs[i]);
  const H = smoothArr(smoothArr(raw, 18), 18);
  const finishIdx = N - 75;

  // jumps on straight-ish sections
  autoJumps(H, jump, { from: 170, to: finishIdx - 160, count: stage.jumps, gap: 360, rh: 2.6, ok: i => { for (let j = i - 15; j <= i + 60; j++) if (Math.abs(ks[j]) > 1 / 110) return false; return true; } });

  // barriers and kerbs
  for (let i = 0; i < N; i++) {
    const a = Math.abs(ks[i]);
    if (a > 1 / 48) { const out = ks[i] > 0 ? wallR : wallL; for (let j = Math.max(0, i - 8); j <= Math.min(N - 1, i + 8); j++) out[j] = 1; }
    if (a > 1 / 75) for (let j = Math.max(0, i - 5); j <= Math.min(N - 1, i + 5); j++) { kerbL[j] = 1; kerbR[j] = 1; }
  }
  for (let i = 0; i < N; i++) {
    const a = Math.abs(ks[i]);
    const out = ks[i] > 0 ? wallR : wallL;
    if (a > 1 / 110 && a <= 1 / 48 && !out[i] && !jump[i]) out[i] = 3; // hay bales on sweeper exits
    if (Math.abs(tx[i]) > 0.8 && a < 1 / 60 && !jump[i]) {
      const down = rz[i] > 0 ? wallR : wallL;
      if (!down[i] && noise.n2(i * 0.03, 5.5) > -0.25) down[i] = 2;
    }
    if (i < 48 || i > finishIdx - 30) { if (!wallL[i]) wallL[i] = 2; if (!wallR[i]) wallR[i] = 2; }
  }

  // hairpins (for signage)
  const hairpins = [];
  for (let i = 0; i < N; i++) {
    if (Math.abs(ks[i]) > 1 / 40) {
      let j = i; while (j < N - 1 && Math.abs(ks[j]) > 1 / 40) j++;
      if (Math.abs(wrapAngle(th[j] - th[i])) > 1.4 || j - i > 55) hairpins.push({ a: i, b: j, side: ks[i] > 0 ? 1 : -1 });
      i = j;
    }
  }

  const lm = SURF[stage.surface].latMax * 0.8;
  for (let i = 0; i < N; i++) {
    let m = 1e-4; for (let j = Math.max(0, i - 2); j <= Math.min(N - 1, i + 2); j++) m = Math.max(m, Math.abs(ks[j]));
    vmax[i] = Math.min(70, Math.sqrt(lm / m));
  }

  let minZ = Infinity, maxZ = -Infinity; for (let i = 0; i < N; i++) { minZ = Math.min(minZ, zs[i]); maxZ = Math.max(maxZ, zs[i]); }
  const CELL = 36, hash = new Map(); const hk = (cx, cz) => (cx + 1000) * 100000 + (cz + 1000);
  for (let i = 0; i < N; i++) { const kk = hk(Math.floor(xs[i] / CELL), Math.floor(zs[i] / CELL)); let a = hash.get(kk); if (!a) { a = []; hash.set(kk, a); } a.push(i); }
  function nearest(x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL); let best = Infinity, bi = -1;
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
      const a = hash.get(hk(cx + dx, cz + dz)); if (!a) continue;
      for (let q = 0; q < a.length; q++) { const i = a[q]; const ex = x - xs[i], ez = z - zs[i]; const d = ex * ex + ez * ez; if (d < best) { best = d; bi = i; } }
    }
    return bi < 0 ? null : { i: bi, d: Math.sqrt(best) };
  }
  let minX = Infinity, maxX = -Infinity; for (let i = 0; i < N; i++) { minX = Math.min(minX, xs[i]); maxX = Math.max(maxX, xs[i]); }
  return { N, xs, zs, th, tx, tz, rx, rz, k, ks, H, jump, wallL, wallR, kerbL, kerbR, vmax, hairpins, finishIdx, startIdx: 36, noise, base, nearest, nearestT: nearest,
    minZ, maxZ, minX, maxX, surface: stage.surface, seed, bridge: new Uint8Array(N), tunnel: new Uint8Array(N), nearestTun: () => null, carve: 0, carveW: null, margin: 95, loopN: 0, laps: 1 };
}
