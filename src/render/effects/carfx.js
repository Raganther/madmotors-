import { carWear } from '../../core/sim/damage.js';
import { debris } from './debris.js';
import { wallFx } from './impacts.js';
import { emit } from './particles.js';
import { addSkid } from './skids.js';

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
    const rate = loose ? sp * (c.surface === 'grass' ? 0.6 : 1.1) : slide * 2.4;
    v.emitAcc += rate * dt;
    const col = c.surface === 'grass' ? 0x8E9A5B : c.surface === 'gravel' ? 0xD8C29A : 0xE8E8E8;
    while (v.emitAcc > 1) {
      v.emitAcc -= 1; const s = Math.random() < 0.5 ? 1 : -1;
      emit(c.x - fx * 1.5 - fz * 0.9 * s, c.y + 0.3, c.z - fz * 1.5 + fx * 0.9 * s, -c.vx * 0.12 + (Math.random() - 0.5) * 3, 1.5 + Math.random() * 2.5, -c.vz * 0.12 + (Math.random() - 0.5) * 3, 0.6 + Math.random() * 0.5, 0.8 + Math.random() * 0.8, col, 2);
    }
  }
  if (c.scrape) {
    const s = c.scrape, fx = wallFx(s.w), rate = s.sp * (fx.sparks ? 1.3 : 0.4);
    v.scrapeAcc = (v.scrapeAcc || 0) + rate * dt;
    while (v.scrapeAcc > 1) {
      v.scrapeAcc -= 1;
      if (fx.sparks) emit(s.x, s.y + 0.5, s.z, -s.vx * 0.35 + (Math.random() - 0.5) * 5, 1 + Math.random() * 4, -s.vz * 0.35 + (Math.random() - 0.5) * 5, 0.25 + Math.random() * 0.2, 0.25, Math.random() < 0.5 ? 0xFFF4B0 : 0xFFB03A, 20);
      else emit(s.x, s.y + 0.4, s.z, -s.vx * 0.2 + (Math.random() - 0.5) * 3, 0.5 + Math.random() * 2, -s.vz * 0.2 + (Math.random() - 0.5) * 3, 0.5, 0.8, fx.dust, 1);
      if (Math.random() < 0.08) { const [lo, hi] = fx.size, sz = lo + Math.random() * (hi - lo); debris(s.x, s.y + 0.5, s.z, -s.vx * 0.2 + (Math.random() - 0.5) * 4, 2 + Math.random() * 3, -s.vz * 0.2 + (Math.random() - 0.5) * 4, fx.cols[0], sz, sz * 0.6, sz, 1.4, c.pr.i); }
    }
  }
  const wear = carWear(c);
  if (c.wreckT > 0 && Math.random() < 0.8) emit(c.x + fx * 1.3 + (Math.random() - 0.5), c.y + 1.1, c.z + fz * 1.3 + (Math.random() - 0.5), (Math.random() - 0.5) * 2, 3 + Math.random() * 3, (Math.random() - 0.5) * 2, 0.35 + Math.random() * 0.3, 0.9, Math.random() < 0.5 ? 0xFFB03A : 0xFF5A1E, -3);
  if (wear > 0.35 && Math.random() < (wear - 0.25) * 1.3) emit(c.x + fx * 1.4 + (Math.random() - 0.5) * 0.6, c.y + 1.0, c.z + fz * 1.4 + (Math.random() - 0.5) * 0.6, -c.vx * 0.15 + (Math.random() - 0.5), 1.5 + Math.random() * 1.5, -c.vz * 0.15 + (Math.random() - 0.5), 0.8 + Math.random() * 0.6, 0.8 + wear, wear > 0.7 ? 0x3C3C3C : 0x9A9A9A, -1.5);
  if (c.smokeT > 0) { c.smokeT -= dt; if (Math.random() < 0.5) emit(c.x + (Math.random() - 0.5), c.y + 1.2, c.z + (Math.random() - 0.5), -c.vx * 0.1 + (Math.random() - 0.5), 2 + Math.random() * 2, -c.vz * 0.1 + (Math.random() - 0.5), 0.9 + Math.random() * 0.6, 1.1 + Math.random() * 0.8, Math.random() < 0.5 ? 0x4A4A4A : 0x6E6E6E, -1.5); }
  if (c.boost > 0 && Math.random() < 0.7) emit(c.x - fx * 1.9, c.y + 0.6, c.z - fz * 1.9, -fx * 6 + (Math.random() - 0.5), 0.5, -fz * 6 + (Math.random() - 0.5), 0.25, 0.7, Math.random() < 0.5 ? 0xFFC72C : 0xFF7A2E, 0);
}
