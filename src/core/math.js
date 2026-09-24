// ==CORE START==
export const TAU = Math.PI * 2;
export const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
export const lerp = (a, b, t) => a + (b - a) * t;
export const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
export function wrapAngle(a) { while (a > Math.PI) a -= TAU; while (a < -Math.PI) a += TAU; return a; }
export function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
export function makeNoise(seed) {
  const rnd = mulberry32(seed);
  const p = []; for (let i = 0; i < 256; i++) p.push(i);
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512); for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const val = new Float32Array(256); for (let i = 0; i < 256; i++) val[i] = rnd() * 2 - 1;
  function n2(x, y) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const X = xi & 255, Y = yi & 255, X1 = (xi + 1) & 255, Y1 = (yi + 1) & 255;
    const a = val[perm[X + perm[Y]]], b = val[perm[X1 + perm[Y]]], c = val[perm[X + perm[Y1]]], d = val[perm[X1 + perm[Y1]]];
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  }
  function fbm(x, y, o) { let s = 0, a = 1, f = 1, n = 0; for (let i = 0; i < o; i++) { s += a * n2(x * f, y * f); n += a; a *= 0.5; f *= 2.03; } return s / n; }
  return { n2, fbm };
}
export function smoothArr(a, r) {
  const n = a.length, o = new Float32Array(n), pre = new Float64Array(n + 1);
  for (let i = 0; i < n; i++) pre[i + 1] = pre[i] + a[i];
  for (let i = 0; i < n; i++) { const lo = Math.max(0, i - r), hi = Math.min(n - 1, i + r); o[i] = (pre[hi + 1] - pre[lo]) / (hi - lo + 1); }
  return o;
}
// ---------- circuit (loop) tracks ----------
export function smoothWrap(a, r) {
  const n = a.length, o = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; for (let j = -r; j <= r; j++) s += a[((i + j) % n + n) % n]; o[i] = s / (2 * r + 1); }
  return o;
}
