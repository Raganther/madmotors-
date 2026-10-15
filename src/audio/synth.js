import { mulberry32 } from '../core/math.js';

// The sound library, synthesised once when the audio starts (no sample files): each sound is drawn sample by sample
// into a buffer from a few physical-ish parts. Metal rings at a handful of inharmonic modes (a car panel low and
// dense, a barrel deep and hollow, a mine small and bright), an explosion is a falling sub thump under noise whose
// filter closes as it dies plus a tail of crackle, bricks are dozens of short low grains of noise scattered in time,
// glass a spray of high pings, wood a snap and a crackle over two or three dull modes, a gunshot a 5 ms crack on a
// low punch. Each has a few variants (another seed), so repeats don't sound like a loop. sfx.js plays them.
const TAU = Math.PI * 2;
// a state-variable filter run over a signal (the trapezoidal kind: stable at any cutoff): lp / bp / hp, cutoff fixed
// or a function of t (its coefficients refreshed every 16 samples)
function svf(x, sr, mode, fc, q = 0.7) {
  const out = new Float32Array(x.length), F = typeof fc === 'function' ? fc : null, k = 1 / q; let ic1 = 0, ic2 = 0, a1 = 0, a2 = 0, a3 = 0;
  const coef = f => { const g = Math.tan(Math.PI * Math.min(0.49, Math.max(10, f) / sr)); a1 = 1 / (1 + g * (g + k)); a2 = g * a1; a3 = g * a2; };
  coef(F ? F(0) : fc);
  for (let i = 0; i < x.length; i++) {
    if (F && (i & 15) === 0) coef(F(i / sr));
    const v3 = x[i] - ic2, v1 = a1 * ic1 + a2 * v3, v2 = ic2 + a2 * ic1 + a3 * v3; ic1 = 2 * v1 - ic1; ic2 = 2 * v2 - ic2;
    out[i] = mode === 'lp' ? v2 : mode === 'bp' ? v1 : x[i] - k * v1 - v2;
  }
  return out;
}
const noise = (n, rnd) => { const a = new Float32Array(n); for (let i = 0; i < n; i++) a[i] = rnd() * 2 - 1; return a; };
const add = (dst, src, g = 1, at = 0) => { for (let i = 0; i < src.length && i + at < dst.length; i++) dst[i + at] += src[i] * g; return dst; };
const shape = (a, sr, f) => { for (let i = 0; i < a.length; i++) a[i] *= f(i / sr); return a; };
const ar = (t, a, d) => (t < a ? t / a : Math.exp(-(t - a) * d));   // attack a s, then an exponential fall at rate d
// ringing modes: [freq, decay rate, amp] each, struck (with a little random phase)
function modes(n, sr, list, rnd, at = 0) {
  const a = new Float32Array(n);
  for (const [f, d, g] of list) { const ph = rnd() * TAU, w = TAU * f / sr; for (let i = at; i < n; i++) { const t = (i - at) / sr, e = Math.exp(-t * d) * g; if (e < 1e-4) break; a[i] += Math.sin(w * (i - at) + ph) * e; } }
  return a;
}
// a falling sine (a thump, a kick): f from f0 to f1 at rate k, level falling at rate d
function sweep(n, sr, f0, f1, k, d, at = 0.002) { const a = new Float32Array(n); let ph = 0; for (let i = 0; i < n; i++) { const t = i / sr, f = f1 + (f0 - f1) * Math.exp(-t * k); ph += TAU * f / sr; a[i] = Math.sin(ph) * ar(t, at, d); } return a; }
function norm(a, peak = 0.9) { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); if (m > 0) for (let i = 0; i < a.length; i++) a[i] *= peak / m; return a; }
// a short click of filtered noise at `at` (debris, crackle, rattles)
function grain(dst, sr, rnd, at, len, mode, fc, g) { const n = Math.round(len * sr), s = svf(noise(n, rnd), sr, mode, fc, 1.2); for (let i = 0; i < n && at + i < dst.length; i++) dst[at + i] += s[i] * g * Math.exp(-i / n * 5) * Math.min(1, i / 20); }

const RECIPES = {
  // an explosion: the crack, a sub thump falling from 100 to 30 Hz, a noisy body whose filter closes, crackle, a rumble
  boom(sr, rnd, big = 1) {
    const T = 2.4, n = Math.round(T * sr), a = new Float32Array(n);
    add(a, sweep(n, sr, 110, 28, 7, 2.4 / big), 1.1);
    add(a, shape(svf(noise(n, rnd), sr, 'lp', t => 140 + 4200 * Math.exp(-t * 11)), sr, t => ar(t, 0.004, 2.7 / big)), 1.6);
    add(a, shape(svf(noise(n, rnd), sr, 'lp', 260), sr, t => ar(t, 0.05, 1.1 / big)), 0.7);
    add(a, shape(noise(Math.round(0.012 * sr), rnd), sr, t => Math.exp(-t * 300)), 0.9);
    for (let k = 0; k < 70 * big; k++) { const t = 0.05 + Math.pow(rnd(), 2) * 1.4 * big; grain(a, sr, rnd, Math.round(t * sr), 0.004 + rnd() * 0.01, 'bp', 1200 + rnd() * 3000, 0.5 * Math.exp(-t * 1.6)); }
    return norm(a, 0.95);
  },
  // a car hitting metal hard: a crack, dense low panel modes, a grinding scrape, bits rattling off, a low thump
  crunch(sr, rnd) {
    const T = 1.1, n = Math.round(T * sr), a = new Float32Array(n), list = [];
    for (let k = 0; k < 9; k++) { const f = 160 * Math.pow(24, rnd()); list.push([f, 7 + rnd() * 22, 0.5 / Math.sqrt(f / 160)]); }
    add(a, modes(n, sr, list, rnd), 1);
    add(a, shape(svf(noise(n, rnd), sr, 'bp', t => 1800 - t * 900, 0.9), sr, t => ar(t, 0.002, 9) * (0.6 + 0.4 * Math.sin(t * 190))), 1.2);
    add(a, sweep(n, sr, 120, 55, 20, 14), 0.9);
    add(a, shape(noise(Math.round(0.008 * sr), rnd), sr, t => Math.exp(-t * 500)), 0.8);
    for (let k = 0; k < 10; k++) { const t = 0.06 + rnd() * 0.7; grain(a, sr, rnd, Math.round(t * sr), 0.01 + rnd() * 0.02, 'bp', 2500 + rnd() * 4000, 0.25 * Math.exp(-t * 2)); }
    return norm(a);
  },
  // a light knock between cars: a dull thump and a short panel ring
  knock(sr, rnd) {
    const n = Math.round(0.3 * sr), a = sweep(n, sr, 140, 70, 25, 22);
    add(a, modes(n, sr, [[380 + rnd() * 80, 30, 0.4], [930 + rnd() * 200, 40, 0.25], [1720 + rnd() * 300, 55, 0.15]], rnd), 1);
    add(a, shape(svf(noise(n, rnd), sr, 'bp', 1400, 1), sr, t => Math.exp(-t * 60)), 0.6);
    return norm(a, 0.8);
  },
  // armco: a bright ringing rail and a scrape
  rail(sr, rnd) {
    const n = Math.round(0.9 * sr), a = modes(n, sr, [[520 + rnd() * 40, 6, 0.5], [1290 + rnd() * 60, 8, 0.4], [2210 + rnd() * 90, 10, 0.3], [3380, 14, 0.2], [4700, 18, 0.12]], rnd);
    add(a, sweep(n, sr, 110, 60, 20, 18), 0.8); add(a, shape(svf(noise(n, rnd), sr, 'bp', 2600, 1.4), sr, t => ar(t, 0.001, 14)), 0.9);
    return norm(a, 0.85);
  },
  // a barrel hitting the road: deep hollow modes
  clang(sr, rnd) {
    const n = Math.round(1.3 * sr), a = modes(n, sr, [[118 + rnd() * 10, 4, 0.6], [231, 5, 0.5], [349, 6.5, 0.45], [523 + rnd() * 20, 8, 0.35], [741, 10, 0.25], [1012, 13, 0.18], [1588, 18, 0.1]], rnd);
    add(a, shape(svf(noise(n, rnd), sr, 'lp', 900), sr, t => Math.exp(-t * 70)), 0.8);
    return norm(a, 0.85);
  },
  // a mine bouncing: small, bright
  clank(sr, rnd) {
    const n = Math.round(0.45 * sr), a = modes(n, sr, [[640 + rnd() * 60, 14, 0.5], [1170, 18, 0.4], [1830 + rnd() * 80, 22, 0.35], [2710, 28, 0.25], [3950, 35, 0.15]], rnd);
    add(a, shape(noise(Math.round(0.004 * sr), rnd), sr, () => 1), 0.6);
    return norm(a, 0.8);
  },
  // a window going: a spray of high pings and a hiss
  glass(sr, rnd) {
    const n = Math.round(0.9 * sr), a = shape(svf(noise(n, rnd), sr, 'hp', 4500), sr, t => ar(t, 0.001, 18) * 0.5);
    for (let k = 0; k < 34; k++) { const at = Math.round(Math.pow(rnd(), 1.6) * 0.45 * sr); add(a, modes(n - at, sr, [[2400 + rnd() * 7000, 30 + rnd() * 60, 0.25 + rnd() * 0.3]], rnd), 1, at); }
    return norm(a, 0.7);
  },
  // bricks and masonry: a thump, then dozens of short low grains (chunks landing), and dust
  rubble(sr, rnd, long = 1) {
    const T = 1.4 * long, n = Math.round(T * sr), a = sweep(n, sr, 90, 40, 9, 6 / long);
    add(a, shape(svf(noise(n, rnd), sr, 'lp', 700), sr, t => ar(t, 0.01, 2.5 / long)), 0.6);
    for (let k = 0; k < 60 * long; k++) { const t = Math.pow(rnd(), 1.5) * T * 0.85; grain(a, sr, rnd, Math.round(t * sr), 0.02 + rnd() * 0.06, 'bp', 140 + rnd() * 700, 0.5 * Math.exp(-t * 1.5 / long) * (0.4 + rnd())); }
    for (let k = 0; k < 25 * long; k++) { const t = rnd() * T * 0.8; grain(a, sr, rnd, Math.round(t * sr), 0.008, 'bp', 1800 + rnd() * 2500, 0.15 * Math.exp(-t * 2 / long)); }
    if (long > 1) add(a, shape(svf(noise(n, rnd), sr, 'lp', 120), sr, t => ar(t, 0.3, 0.9)), 1.2);   // a building coming down: a long low roar
    return norm(a, 0.9);
  },
  // wood: a snap, a crackle of splinters, two or three dull modes
  wood(sr, rnd) {
    const n = Math.round(0.7 * sr), a = modes(n, sr, [[170 + rnd() * 40, 22, 0.5], [410 + rnd() * 60, 30, 0.35], [760 + rnd() * 100, 45, 0.2]], rnd);
    add(a, shape(svf(noise(Math.round(0.02 * sr), rnd), sr, 'hp', 1200), sr, t => Math.exp(-t * 200)), 1.2);
    for (let k = 0; k < 18; k++) { const t = rnd() * 0.3; grain(a, sr, rnd, Math.round(t * sr), 0.004 + rnd() * 0.008, 'hp', 2000 + rnd() * 3000, 0.4 * Math.exp(-t * 6)); }
    return norm(a, 0.85);
  },
  // a stone wall cracking: a sharp crack and a few bits falling
  crack(sr, rnd) {
    const n = Math.round(0.6 * sr), a = shape(svf(noise(n, rnd), sr, 'bp', 2400, 0.8), sr, t => ar(t, 0.0005, 60));
    add(a, sweep(n, sr, 160, 70, 30, 20), 0.6);
    for (let k = 0; k < 10; k++) { const t = 0.05 + rnd() * 0.45; grain(a, sr, rnd, Math.round(t * sr), 0.02 + rnd() * 0.03, 'bp', 300 + rnd() * 900, 0.3 * Math.exp(-t * 3)); }
    return norm(a, 0.8);
  },
  // one round: a 5 ms crack on a low punch, the action's click, a little room
  gunshot(sr, rnd) {
    const n = Math.round(0.22 * sr), a = shape(svf(noise(n, rnd), sr, 'lp', t => 9000 * Math.exp(-t * 30) + 800), sr, t => ar(t, 0.0003, 70));
    add(a, sweep(n, sr, 190, 65, 50, 32), 0.9);
    add(a, modes(n, sr, [[3100 + rnd() * 500, 120, 0.25], [5200, 160, 0.15]], rnd), 1);
    add(a, shape(svf(noise(n, rnd), sr, 'bp', 1500, 0.6), sr, t => ar(t, 0.01, 18)), 0.18);
    return norm(a, 0.9);
  },
  // a round striking a car: a tick of metal; and a ricochet whining off
  tick(sr, rnd) { const n = Math.round(0.12 * sr), a = modes(n, sr, [[1900 + rnd() * 600, 50, 0.4], [3300 + rnd() * 800, 70, 0.3], [5600, 90, 0.2]], rnd); add(a, shape(noise(Math.round(0.003 * sr), rnd), sr, () => 1), 0.7); return norm(a, 0.75); },
  ricochet(sr, rnd) {
    const n = Math.round(0.5 * sr), a = new Float32Array(n), f0 = 2600 + rnd() * 1400; let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / sr, f = f0 * (0.55 + 0.45 * Math.exp(-t * 5)) * (1 + 0.01 * Math.sin(t * 90)); ph += TAU * f / sr; a[i] = Math.sin(ph) * ar(t, 0.004, 7) * 0.5; }
    add(a, shape(noise(Math.round(0.004 * sr), rnd), sr, () => 1), 0.6);
    return norm(a, 0.6);
  },
  // water: a slap, a rush whose filter rises and falls, bubbles
  splash(sr, rnd) {
    const n = Math.round(1.1 * sr), a = shape(svf(noise(n, rnd), sr, 'bp', t => 500 + 2600 * Math.exp(-((t - 0.12) ** 2) / 0.02), 0.8), sr, t => ar(t, 0.015, 3.5));
    add(a, sweep(n, sr, 90, 50, 15, 15), 0.5);
    for (let k = 0; k < 20; k++) { const at = Math.round((0.05 + rnd() * 0.7) * sr), m = Math.round(0.04 * sr), f = 350 + rnd() * 700, b = new Float32Array(m); let ph = 0; for (let i = 0; i < m; i++) { ph += TAU * f * (1 + i / m) / sr; b[i] = Math.sin(ph) * Math.sin(Math.PI * i / m); } add(a, b, 0.15 * Math.exp(-at / sr * 2), at); }
    return norm(a, 0.8);
  },
  // a fire, burning (looped): a low roar and crackles
  fire(sr, rnd) {
    const T = 2, n = Math.round(T * sr), x = Math.round(0.25 * sr), a = svf(noise(n + x, rnd), sr, 'lp', 420);
    for (let k = 0; k < 70; k++) grain(a, sr, rnd, Math.round(rnd() * (n + x - 800)), 0.003 + rnd() * 0.006, 'hp', 1500 + rnd() * 3000, 0.4 + rnd() * 1.2);
    for (let i = 0; i < x; i++) { const k = i / x; a[i] = a[i] * k + a[n + i] * (1 - k); }   // crossfaded so the loop has no seam
    return norm(a.slice(0, n), 0.7);
  },
  // a tyre bursting on a stinger: a pop, the air rushing out, the rim flapping
  puncture(sr, rnd) {
    const n = Math.round(1.0 * sr), a = shape(noise(Math.round(0.006 * sr), rnd), sr, () => 1);
    const out = new Float32Array(n); add(out, a, 1.2); add(out, sweep(n, sr, 160, 80, 40, 30), 0.6);
    add(out, shape(svf(noise(n, rnd), sr, 'hp', 2500), sr, t => ar(t, 0.01, 3.5)), 0.6);
    for (let k = 0; k < 8; k++) { const t = 0.15 + k * 0.09; grain(out, sr, rnd, Math.round(t * sr), 0.03, 'lp', 300, 0.5 * Math.exp(-t * 2)); }
    return norm(out, 0.85);
  },
  // a heavy landing: a low thud and the springs taking it
  thud(sr, rnd) { const n = Math.round(0.45 * sr), a = sweep(n, sr, 75, 38, 12, 9); add(a, shape(svf(noise(n, rnd), sr, 'lp', 260), sr, t => ar(t, 0.002, 18)), 0.9); add(a, modes(n, sr, [[210, 18, 0.12], [460, 25, 0.08]], rnd), 1); return norm(a, 0.9); },
  // the shockwave: a deep drop, an electric zap and a rush of air
  zap(sr, rnd) {
    const n = Math.round(1.2 * sr), a = new Float32Array(n); let ph = 0, mp = 0;
    for (let i = 0; i < n; i++) { const t = i / sr, f = 60 + 900 * Math.exp(-t * 8); mp += TAU * f * 1.5 / sr; ph += TAU * f / sr + Math.sin(mp) * 2.5 * Math.exp(-t * 4) * TAU * f / sr; a[i] = Math.sin(ph) * ar(t, 0.003, 3); }
    add(a, sweep(n, sr, 90, 30, 5, 2.5), 1); add(a, shape(svf(noise(n, rnd), sr, 'bp', t => 300 + 3000 * t, 0.7), sr, t => ar(t, 0.05, 3)), 0.5);
    return norm(a, 0.9);
  },
  // the harpoon: a plucked line (Karplus-Strong) and a clack
  twang(sr, rnd) {
    const n = Math.round(0.9 * sr), L = Math.round(sr / 98), buf = noise(L, rnd), a = new Float32Array(n);
    for (let i = 0; i < n; i++) { const j = i % L, v = buf[j]; a[i] = v; buf[j] = 0.5 * (v + buf[(j + 1) % L]) * 0.996; }
    add(a, modes(n, sr, [[1400, 60, 0.4], [2900, 80, 0.3]], rnd), 1);
    return norm(a, 0.75);
  },
  // a mortar leaving its tube: a hollow thoomp and a puff of air
  thoomp(sr, rnd) { const n = Math.round(0.6 * sr), a = sweep(n, sr, 130, 55, 18, 10); add(a, shape(svf(noise(n, rnd), sr, 'bp', 600, 0.7), sr, t => ar(t, 0.003, 14)), 0.9); add(a, modes(n, sr, [[240, 20, 0.3], [480, 30, 0.15]], rnd), 1); return norm(a, 0.9); },
  // a shell coming down: a falling whistle
  whistle(sr) {
    const n = Math.round(1.6 * sr), a = new Float32Array(n); let ph = 0;
    for (let i = 0; i < n; i++) { const t = i / sr, f = 1900 - 1150 * (t / 1.6) ** 1.3 + 12 * Math.sin(t * 40); ph += TAU * f / sr; a[i] = (Math.sin(ph) + 0.25 * Math.sin(ph * 2)) * Math.min(1, t * 3) * Math.min(1, (1.6 - t) * 40) * (0.4 + 0.6 * t / 1.6); }
    return norm(a, 0.5);
  },
  // a missile lighting up and roaring away
  rocket(sr, rnd) {
    const n = Math.round(1.5 * sr), a = shape(svf(noise(n, rnd), sr, 'lp', t => 500 + 2400 * Math.min(1, t * 4) * Math.exp(-t * 0.8)), sr, t => ar(t, 0.06, 1.8));
    add(a, shape(noise(Math.round(0.01 * sr), rnd), sr, () => 1), 0.8); add(a, sweep(n, sr, 160, 70, 12, 8), 0.6);
    add(a, shape(svf(noise(n, rnd), sr, 'bp', t => 400 + 2500 * t, 2), sr, t => ar(t, 0.1, 2.2)), 0.4);
    return norm(a, 0.85);
  },
  // the crowd going up: voices (a buzzing pulse at a voice's pitch, rising and falling, through two vowel formants,
  // swelling in syllables), a few whistles and a patter of claps
  cheer(sr, rnd) {
    const T = 3, n = Math.round(T * sr), a = new Float32Array(n), VOW = [[730, 1090], [570, 840], [300, 2300], [660, 1700], [440, 1020]];
    for (let v = 0; v < 18; v++) {
      const f0 = (v % 3 ? 110 : 190) * (0.85 + rnd() * 0.5), st = rnd() * 0.4, len = 1.2 + rnd() * 1.4, up = 1.15 + rnd() * 0.35, syl = 3 + rnd() * 3, [F1, F2] = VOW[(rnd() * VOW.length) | 0];
      const src = new Float32Array(n); let ph = 0;
      for (let i = 0; i < n; i++) { const t = i / sr - st; if (t < 0) continue; const f = f0 * (1 + (up - 1) * Math.sin(Math.min(1, t / len) * Math.PI * 0.8)) * (1 + 0.01 * (rnd() - 0.5)); ph += f / sr; if (ph >= 1) ph -= 1; src[i] = (ph < 0.08 ? 1 : -0.087) + (rnd() - 0.5) * 0.25; }
      const vo = svf(src, sr, 'bp', F1, 6); add(vo, svf(src, sr, 'bp', F2, 8), 0.6);
      add(a, shape(vo, sr, t => { const u = t - st; return u < 0 ? 0 : Math.min(1, u * 5) * Math.exp(-Math.max(0, u - len) * 3) * (0.65 + 0.35 * Math.sin(u * syl * TAU)); }), 0.5);
    }
    for (let k = 0; k < 4; k++) { const st = 0.2 + rnd() * 1.5, f0 = 1600 + rnd() * 1200, m = Math.round(0.7 * sr), b = new Float32Array(m); let ph = 0; for (let i = 0; i < m; i++) { const t = i / sr; ph += TAU * f0 * (1 + 0.3 * Math.sin(t * 6) * (k % 2 ? 1 : -1)) / sr; b[i] = Math.sin(ph) * Math.sin(Math.PI * i / m); } add(a, b, 0.1, Math.round(st * sr)); }
    for (let k = 0; k < 90; k++) { const t = rnd() * T * 0.85; grain(a, sr, rnd, Math.round(t * sr), 0.006, 'bp', 1500 + rnd() * 1500, 0.25 * Math.exp(-Math.max(0, t - 1.8) * 2)); }
    add(a, shape(svf(noise(n, rnd), sr, 'bp', 900, 0.8), sr, t => Math.min(1, t * 3) * Math.exp(-Math.max(0, t - 2) * 2)), 0.08);   // the hubbub under it
    return norm(a, 0.7);
  },
  // leaves and hay: a rustle
  rustle(sr, rnd) { const n = Math.round(0.5 * sr), a = shape(svf(noise(n, rnd), sr, 'bp', t => 3500 - t * 2000, 0.6), sr, t => ar(t, 0.01, 7) * (0.5 + 0.5 * Math.abs(Math.sin(t * 70 + rnd())))); return norm(a, 0.6); },
  // a tyre wall: a rubbery thump
  rubber(sr, rnd) { const n = Math.round(0.35 * sr), a = sweep(n, sr, 110, 60, 20, 16); add(a, shape(svf(noise(n, rnd), sr, 'bp', 500, 1.5), sr, t => ar(t, 0.003, 18)), 0.5); return norm(a, 0.85); },
  // a pick-up: three bell notes up
  chime(sr) {
    const n = Math.round(0.8 * sr), a = new Float32Array(n);
    [1318.5, 1661.2, 1975.5].forEach((f, k) => { const at = Math.round(k * 0.07 * sr); for (let i = at; i < n; i++) { const t = (i - at) / sr, e = Math.exp(-t * 6); a[i] += (Math.sin(TAU * f * t + 1.2 * Math.sin(TAU * f * 1.4 * t) * e) * e) * 0.3; } });
    return norm(a, 0.6);
  },
  // the menu: a soft click
  click(sr, rnd) { const n = Math.round(0.06 * sr), a = modes(n, sr, [[1800, 90, 0.4], [3100, 120, 0.2]], rnd); return norm(a, 0.5); },
  // a hiss of steam (a wrecked engine), looped
  hiss(sr, rnd) { const n = sr, x = Math.round(0.2 * sr), a = svf(noise(n + x, rnd), sr, 'bp', 3800, 0.6); for (let i = 0; i < x; i++) { const k = i / x; a[i] = a[i] * k + a[n + i] * (1 - k); } return norm(a.slice(0, n), 0.5); }
};
// how many takes of each (a different seed each); the explosion's and the rubble's other sizes
const TAKES = { crunch: 4, knock: 3, rail: 2, clang: 2, clank: 3, glass: 2, rubble: 3, wood: 3, crack: 2, gunshot: 4, tick: 3, ricochet: 3, splash: 2, rustle: 2 };
const SIZES = { bigboom: ['boom', 1.6], smallboom: ['boom', 0.6], collapse: ['rubble', 2.6] };
export const SOUNDS = [...Object.keys(RECIPES), ...Object.keys(SIZES)];
/** Sounds with nothing up high, made at a lower sample rate (a fraction of the context's): quicker to make. */
export const RATE = { cheer: 0.5, collapse: 0.5, rubble: 0.75, thud: 0.5, boom: 0.75, bigboom: 0.75, smallboom: 0.75, whistle: 0.5 };
/** The takes of one sound ([Float32Array, ...] at sample rate sr), the same every time. */
export function synth(name, sr) {
  const [r, size] = SIZES[name] || [name, undefined], f = RECIPES[r], seed = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 7);
  return Array.from({ length: TAKES[name] || 1 }, (_, t) => { const a = f(sr, mulberry32(seed + t * 7919), size), fi = Math.min(a.length, Math.round(sr * 0.001)), fo = Math.min(a.length, Math.round(sr * 0.03));
    for (let i = 0; i < fi; i++) a[i] *= i / fi; for (let i = 0; i < fo; i++) a[a.length - 1 - i] *= i / fo;   // no clicks at either end
    return a; });
}
