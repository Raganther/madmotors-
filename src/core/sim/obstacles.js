import { clamp } from '../math.js';
import { damageCar } from './damage.js';

// Hitting the scenery (track/obstacles.js). Trees, cacti and big rocks are solid, but only their trunks and cores:
// a pine's low branches (o.brush) just rustle and drag a little as you brush through. A glancing hit slides you past:
// the car is pushed out, its nose swung along the obstacle's side and it keeps nearly all its speed, no spin, no
// damage, so weaving through a forest flows. Only a real head-on hit (FLOW.HEAD) bounces you, costs speed and dents
// the car. Bushes are soft: you plough through, lose a little speed, and they flatten ('bush'). The car is a circle
// here; the cost is a handful of distance checks per car, off the road only.
export const FLOW = { HEAD: 0.72, KEEP: 0.96, DENT: 7 };   // head-on above this share of the speed; glancing keeps KEEP of it; dents above DENT m/s
const _near = [];
export const OB_WALL = { 0: 8, 1: 8, 2: 10, 3: 9 };   // hit effects by kind (render/effects/impacts.js WALL_FX): wood, cactus, rock
export function collideObstacles(c, W, dt) {
  const O = W.terr && W.terr.obst; if (!O) return;
  const R = c.hw * 1.05;
  for (const k of O.near(c.x, c.z, _near)) {
    const o = O.items[k], dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz), min = o.r + R;
    if (o.brush && d < o.brush + R && d >= min && c.y < o.y + 3) {                          // through a pine's low branches
      if (c.inBrush !== k) { c.inBrush = k; c.events.push({ t: 'tree', k, v: 1.5, nx: dx / (d || 1), nz: dz / (d || 1) }); }
      const f = Math.max(0, 1 - 0.5 * dt); c.vx *= f; c.vz *= f; continue;
    }
    if (d >= min || c.y > o.y + (o.kind === 3 ? o.sy * 1.1 : 3)) continue;              // clear, or sailing over a rock
    const nx = d > 1e-3 ? dx / d : Math.sin(c.yaw + Math.PI), nz = d > 1e-3 ? dz / d : Math.cos(c.yaw + Math.PI), vn = -(c.vx * nx + c.vz * nz);
    if (o.soft) {
      if (!c.inBush || c.inBush !== k) { c.inBush = k; c.events.push({ t: 'bush', k, v: Math.hypot(c.vx, c.vz), x: o.x, z: o.z }); }
      const f = Math.max(0, 1 - 1.4 * dt); c.vx *= f; c.vz *= f;
      continue;
    }
    c.x += nx * (min - d); c.z += nz * (min - d);
    if (vn <= 0) continue;
    const sp = Math.hypot(c.vx, c.vz), headOn = clamp(vn / Math.max(sp, 1), 0, 1);
    if (headOn < FLOW.HEAD) {
      // glancing: lose only the into-it part, keep the speed along the side, turn the nose to follow it
      c.vx += nx * vn; c.vz += nz * vn;
      const s2 = Math.hypot(c.vx, c.vz) || 1, keep = sp * FLOW.KEEP / s2; c.vx *= keep; c.vz *= keep;
      const want = Math.atan2(c.vx, c.vz); if (Math.cos(want - c.yaw) > 0) c.yaw += clamp(Math.atan2(Math.sin(want - c.yaw), Math.cos(want - c.yaw)), -0.12, 0.12);
      if (vn > 3 && o.kind !== 3) c.events.push({ t: 'tree', k, v: vn * 0.5, nx: -nx, nz: -nz });
      continue;
    }
    c.vx += nx * vn * 1.3; c.vz += nz * vn * 1.3;                                          // head-on: the into-it part, reversed a little
    const kk = 1 - 0.35 * headOn * headOn; c.vx *= kk; c.vz *= kk;
    c.spin += clamp(vn * 0.05, 0, 1.4) * Math.sign(c.vx * nz - c.vz * nx || 1) * 0.6;
    if (vn > 2) {
      const x = o.x + nx * o.r, z = o.z + nz * o.r;
      c.events.push({ t: 'hit', v: vn, w: OB_WALL[o.kind], x, z, y: c.y, nx: -nx, nz: -nz });
      if (o.kind !== 3) c.events.push({ t: 'tree', k, v: vn, nx: -nx, nz: -nz });
      if (vn > FLOW.DENT) damageCar(c, x, z, vn, o.kind === 3 ? 1 : 0.8, nx, nz);
    }
  }
  if (c.inBrush !== undefined && c.inBrush >= 0) { const o = O.items[c.inBrush]; if (Math.hypot(c.x - o.x, c.z - o.z) > o.brush + R + 0.5) c.inBrush = -1; }
  if (c.inBush !== undefined && c.inBush >= 0) { const o = O.items[c.inBush]; if (Math.hypot(c.x - o.x, c.z - o.z) > o.r + R + 0.5) c.inBush = -1; }
}
