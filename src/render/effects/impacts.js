import { G } from '../../game.js';
import { AudioSys } from '../../audio/audio.js';
import { TAU, clamp } from '../../core/math.js';
import { debris } from './debris.js';
import { emit } from './particles.js';
import { shockwave } from './rings.js';
import { sparkBurst } from './sparks.js';
import { visOf } from '../vehicles.js';

G.shake = 0; G.slowmo = 0;
export const WALL_FX = {
  1: { cols: [0x1E1E1E, 0x2A2A2A, 0x3A3A3A, 0xE0402F, 0xF4F4F0], size: [0.25, 0.55], n: 1, sparks: 0.3, dust: 0x9A9A9A, snd: 'rubber' },
  2: { cols: [0x8A5E3B, 0xC4935E, 0x6E4A2E], size: [0.1, 0.7], n: 1, sparks: 0.2, dust: 0xB89A70, snd: 'wood', splinter: true },
  3: { cols: [0xE2C265, 0xD4B050, 0xF0D98A], size: [0.12, 0.35], n: 1.8, sparks: 0, dust: 0xE8D48E, snd: 'hay' },
  4: { cols: [0xB9BBC0, 0xA7AAB1, 0xD5D8DE], size: [0.15, 0.45], n: 0.8, sparks: 1.2, dust: 0xC8CACE, snd: 'metal' },
  5: { cols: [0x6A6660, 0x5F5C57, 0x807B73], size: [0.15, 0.45], n: 0.8, sparks: 1.2, dust: 0x8E8A84, snd: 'metal' },
  7: { cols: [0x2B2F3A, 0x44474F, 0xB9B6AE], size: [0.12, 0.35], n: 0.6, sparks: 1.0, dust: 0xB9B6AE, snd: 'metal' },
  6: { cols: [0x8E897E, 0x7A756B, 0xA39E92], size: [0.15, 0.5], n: 0.9, sparks: 1.0, dust: 0x9A958A, snd: 'metal' },
  armco: { cols: [0xCDD2D9, 0x8D939C, 0xB0B6BF], size: [0.1, 0.4], n: 0.7, sparks: 1.4, dust: 0xC0C4CA, snd: 'metal', splinter: true }
};
export function wallFx(w) { return (w === 2 && G.world.stage.armco) ? WALL_FX.armco : (WALL_FX[w] || WALL_FX[1]); }
export function paintChips(car, x, y, z, n, dirx, dirz, hint) {
  const cols = [car.def.color, car.def.color, car.def.accent, 0x2B2F3A];
  for (let k = 0; k < n; k++) {
    const s = 0.16 + Math.random() * 0.32, sp = 5 + Math.random() * 10;
    debris(x, y + 0.8, z, dirx * sp + (Math.random() - 0.5) * 7 + car.vx * 0.3, 3 + Math.random() * 6, dirz * sp + (Math.random() - 0.5) * 7 + car.vz * 0.3,
      cols[k % cols.length], s * 1.6, s * 0.35, s, 1.8 + Math.random() * 1.6, hint);
  }
}
export function glassBits(x, y, z, n, hint) { for (let k = 0; k < n; k++) { const s = 0.08 + Math.random() * 0.12; debris(x, y + 1.2, z, (Math.random() - 0.5) * 10, 3 + Math.random() * 5, (Math.random() - 0.5) * 10, 0xBFE6F5, s, s, s, 1.2 + Math.random(), hint); } }
export function impactFx(c, e, isPlayer, near) {
  const v = e.v, fx = wallFx(e.w), mag = clamp(v / 18, 0.15, 1.6), hint = c.pr.i;
  const n = Math.round((10 + v * 1.5) * fx.n * (near ? 1 : 0.5));
  for (let k = 0; k < n; k++) {
    const [lo, hi] = fx.size, s = (lo + Math.random() * (hi - lo)) * 1.3, sp = 4 + Math.random() * (4 + v * 0.7);
    const sx = fx.splinter ? s * 2.4 : s, sz = fx.splinter ? s * 0.35 : s;
    debris(e.x, e.y + 0.7, e.z, -e.nx * sp * 0.7 + c.vx * 0.45 + (Math.random() - 0.5) * 9, 4 + Math.random() * (4 + v * 0.45), -e.nz * sp * 0.7 + c.vz * 0.45 + (Math.random() - 0.5) * 9,
      fx.cols[k % fx.cols.length], sx, s * (fx.splinter ? 0.3 : 0.8), sz, 1.6 + Math.random() * 1.8, hint);
  }
  if (v > 7) paintChips(c, e.x, e.y, e.z, Math.round(v * 0.35), -e.nx, -e.nz, hint);
  if (v > 16) glassBits(e.x, e.y, e.z, 6, hint);
  if (fx.sparks) sparks(e.x, e.y, e.z, Math.round(v * 0.9 * fx.sparks), (c.vx - e.nx * 3) / (Math.hypot(c.vx, c.vz) + 3), (c.vz - e.nz * 3) / (Math.hypot(c.vx, c.vz) + 3));
  for (let k = 0; k < 6 + v * 0.4; k++) emit(e.x, e.y + 0.5, e.z, (Math.random() - 0.5) * 6 - e.nx * 2, 1 + Math.random() * 3, (Math.random() - 0.5) * 6 - e.nz * 2, 0.6 + Math.random() * 0.5, 1 + Math.random(), fx.dust, 1);
  shockwave(e.x, e.y, e.z, 2 + mag * 4, fx.sparks > 1 ? 0xFFE08A : 0xFFFFFF);
  const vis = visOf(c); if (vis) vis.wobble = Math.min(0.3, (vis.wobble || 0) + mag * 0.12);
  if (v > 14) c.smokeT = Math.max(c.smokeT || 0, 1.8);
  if (isPlayer) { G.shake = Math.min(1.4, G.shake + mag * 0.7); if (v > 15) G.slowmo = Math.max(G.slowmo, 0.22); }
  if (isPlayer || near) AudioSys.crash(fx.snd, clamp(v / 18, 0.1, 1) * (isPlayer ? 1 : 0.45));
}
export function carCrashFx(e, playerInvolved, near) {
  const v = e.v, A = e.a, B = e.b, mag = clamp(v / 16, 0.2, 1.5), hint = A.pr.i;
  paintChips(A, e.x, e.y, e.z, Math.round(4 + v * 0.5), -e.nx, -e.nz, hint);
  paintChips(B, e.x, e.y, e.z, Math.round(4 + v * 0.5), e.nx, e.nz, hint);
  if (v > 10) glassBits(e.x, e.y, e.z, 4 + Math.round(v * 0.2), hint);
  sparks(e.x, e.y, e.z, Math.round(8 + v * 1.1), -e.nz, e.nx); sparks(e.x, e.y, e.z, Math.round(4 + v * 0.5), e.nz, -e.nx);   // sprayed both ways along the contact
  shockwave(e.x, e.y, e.z, 2 + mag * 3.5, 0xFFFFFF);
  for (const car of [A, B]) { const vis = visOf(car); if (vis) vis.wobble = Math.min(0.3, (vis.wobble || 0) + mag * 0.14); if (v > 13) car.smokeT = Math.max(car.smokeT || 0, 1.4); }
  if (playerInvolved) { G.shake = Math.min(1.4, G.shake + mag * 0.8); if (v > 13) G.slowmo = Math.max(G.slowmo, 0.2); }
  if (playerInvolved || near) AudioSys.crash('car', clamp(v / 16, 0.15, 1) * (playerInvolved ? 1 : 0.45));
}
// sparks: bright streaks, plus a few glowing embers for body
export function sparks(x, y, z, n, dx = 0, dz = 0) {
  sparkBurst(x, y + 0.6, z, Math.round(n * 1.4), dx, dz, 12 + n * 0.1);
  for (let i = 0; i < n * 0.3; i++) emit(x, y + 0.6, z, (Math.random() - 0.5) * 12, 3 + Math.random() * 6, (Math.random() - 0.5) * 12, 0.3 + Math.random() * 0.25, 0.3, Math.random() < 0.5 ? 0xFFF4B0 : 0xFF8A2E, 26);
}
export function dustRing(c, n, col, sp = 5, sz = 1.1) { for (let i = 0; i < n; i++) { const a = i / n * TAU; emit(c.x + Math.cos(a) * 1.4, c.y + 0.2, c.z + Math.sin(a) * 1.4, Math.cos(a) * sp, 1 + Math.random(), Math.sin(a) * sp, 0.7, sz, col, 1); } }
