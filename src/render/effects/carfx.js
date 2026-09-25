import { carWear } from '../../core/sim/damage.js';
import { debris } from './debris.js';
import { wallFx } from './impacts.js';
import { emit } from './particles.js';
import { addSkid } from './skids.js';
import { spark } from './sparks.js';

// what flies up from the wheels on each surface: dust, grass, clods of mud, a spray of water
const SURF_FX = { tarmac: { rate: 0, col: 0xE8E8E8, up: 1.5, size: 0.8 }, gravel: { rate: 1.1, col: 0xD8C29A, up: 1.5, size: 0.8 }, grass: { rate: 0.6, col: 0x8E9A5B, up: 1.5, size: 0.8 },
  mud: { rate: 1.6, col: 0x4E3622, up: 2.5, size: 0.6 }, ford: { rate: 2.4, col: 0xE4F2FF, up: 3.5, size: 1.1 } };
export function effectsForCar(c, v, dt) {
  const sp = Math.hypot(c.vx, c.vz), fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  const slide = Math.abs(c.vr), loose = c.surface !== 'tarmac';
  const skidding = c.onGround && c.surface !== 'grass' && (slide > 4.2 || (c.inp.handbrake && sp > 6));
  for (let w = 0; w < 2; w++) {
    const s = w ? 1 : -1, px = c.x - fx * 1.15 - fz * 0.95 * s, pz = c.z - fz * 1.15 + fx * 0.95 * s, cur = [px, c.y + 0.07, pz];
    if (skidding && c.surface === 'tarmac') { const pr = v.skPrev[w]; if (pr && Math.hypot(px - pr[0], pz - pr[2]) > 0.35) { addSkid(pr, cur); v.skPrev[w] = cur; } else if (!pr) v.skPrev[w] = cur; }
    else v.skPrev[w] = null;
  }
  if (c.onGround && sp > 6 && (loose || slide > 3.5)) {
    const F = SURF_FX[c.surface] || SURF_FX.tarmac, rate = loose ? sp * F.rate : slide * 2.4;
    v.emitAcc += rate * dt;
    while (v.emitAcc > 1) {
      v.emitAcc -= 1; const s = Math.random() < 0.5 ? 1 : -1;
      emit(c.x - fx * 1.5 - fz * 0.9 * s, c.y + 0.3, c.z - fz * 1.5 + fx * 0.9 * s, -c.vx * 0.12 + (Math.random() - 0.5) * 3, F.up + Math.random() * 2.5, -c.vz * 0.12 + (Math.random() - 0.5) * 3, 0.6 + Math.random() * 0.5, F.size + Math.random() * 0.8, F.col, 2);
    }
  }
  if (c.scrape) {
    const s = c.scrape, fx = wallFx(s.w), rate = s.sp * (fx.sparks ? 1.3 : 0.4);
    v.scrapeAcc = (v.scrapeAcc || 0) + rate * dt;
    while (v.scrapeAcc > 1) {
      v.scrapeAcc -= 1;
      if (fx.sparks) { spark(s.x, s.y + 0.5, s.z, -s.vx * 0.45 + (Math.random() - 0.5) * 5, 1.5 + Math.random() * 4, -s.vz * 0.45 + (Math.random() - 0.5) * 5); if (Math.random() < 0.3) emit(s.x, s.y + 0.5, s.z, -s.vx * 0.35, 1 + Math.random() * 3, -s.vz * 0.35, 0.25, 0.25, 0xFFB03A, 20); }
      else emit(s.x, s.y + 0.4, s.z, -s.vx * 0.2 + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2, -s.vz * 0.2 + (Math.random() - 0.5) * 3, 0.5, 0.8, fx.dust, 1);
      if (Math.random() < 0.08) { const [lo, hi] = fx.size, sz = lo + Math.random() * (hi - lo); debris(s.x, s.y + 0.5, s.z, -s.vx * 0.2 + (Math.random() - 0.5) * 4, 2 + Math.random() * 3, -s.vz * 0.2 + (Math.random() - 0.5) * 4, fx.cols[0], sz, sz * 0.6, sz, 1.4, c.pr.i); }
    }
  }
  // two cars grinding side by side: a stream of sparks from the rubbing point, flung back along the contact
  if (c.grind) {
    const g = c.grind, dir = Math.sign(c.vx * g.tx + c.vz * g.tz) || 1;
    v.grindAcc = (v.grindAcc || 0) + g.v * 1.6 * dt;
    while (v.grindAcc > 1) { v.grindAcc -= 1; spark(g.x, g.y + 0.6, g.z, -g.tx * dir * g.v * 0.5 + (Math.random() - 0.5) * 4, 1.5 + Math.random() * 4, -g.tz * dir * g.v * 0.5 + (Math.random() - 0.5) * 4); }
  }
  // slipstream: pale wind lines streaming past a car that's being towed
  if (c.draft > 0.3 && sp > 15) { v.draftAcc = (v.draftAcc || 0) + c.draft * 22 * dt;
    while (v.draftAcc > 1) { v.draftAcc -= 1; const s = Math.random() < 0.5 ? 1 : -1; emit(c.x + fx * 1.8 - fz * 1.1 * s, c.y + 0.5 + Math.random() * 0.8, c.z + fz * 1.8 + fx * 1.1 * s, c.vx * 0.55, 0, c.vz * 0.55, 0.3, 0.35, 0xF2F6FF, 0); } }
  const wear = carWear(c);
  if (c.wreckT > 0 && Math.random() < 0.8) emit(c.x + fx * 1.3 + (Math.random() - 0.5), c.y + 1.1, c.z + fz * 1.3 + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 3 + Math.random() * 3, (Math.random() - 0.5) * 2, 0.35 + Math.random() * 0.3, 0.9, Math.random() < 0.5 ? 0xFFB03A : 0xFF5A1E, -3);
  if (wear > 0.35 && Math.random() < (wear - 0.25) * 1.3) emit(c.x + fx * 1.4 + (Math.random() - 0.5) * 0.6, c.y + 1.0, c.z + fz * 1.4 + (Math.random() - 0.5) * 0.6, -c.vx * 0.15 + (Math.random() - 0.5), 1.5 + Math.random() * 1.5, -c.vz * 0.15 + (Math.random() - 0.5), 0.8 + Math.random() * 0.6, 0.8 + wear, wear > 0.7 ? 0x3C3C3C : 0x9A9A9A, -1.5);
  if (c.smokeT > 0) { c.smokeT -= dt; if (Math.random() < 0.5) emit(c.x + (Math.random() - 0.5), c.y + 1.2, c.z + (Math.random() - 0.5), -c.vx * 0.1 + (Math.random() - 0.5), 2 + Math.random() * 2, -c.vz * 0.1 + (Math.random() - 0.5), 0.9 + Math.random() * 0.6, 1.1 + Math.random() * 0.8, Math.random() < 0.5 ? 0x4A4A4A : 0x6E6E6E, -1.5); }
  if (c.boost > 0 && Math.random() < 0.7) emit(c.x - fx * 1.9, c.y + 0.6, c.z - fz * 1.9, -fx * 6 + (Math.random() - 0.5), 0.5, -fz * 6 + (Math.random() - 0.5), 0.25, 0.7, Math.random() < 0.5 ? 0xFFC72C : 0xFF7A2E, 0);
}
