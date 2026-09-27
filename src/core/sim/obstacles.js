import { clamp } from '../math.js';
import { damageCar } from './damage.js';

// Hitting the scenery (track/obstacles.js). Trees, cacti and big rocks are solid: the car is pushed out, bounces off
// what it hit head-on (a glancing blow mostly slides by), is spun a little and takes damage like a barrier hit; the
// tree shakes (a 'tree' event for the render). Bushes are soft: you plough through, lose a little speed, and they
// flatten ('bush'). The car is a circle here; the cost is a handful of distance checks per car, off the road only.
const _near = [];
export const OB_WALL = { 0: 8, 1: 8, 2: 10, 3: 9 };   // hit effects by kind (render/effects/impacts.js WALL_FX): wood, cactus, rock
export function collideObstacles(c, W, dt) {
  const O = W.terr && W.terr.obst; if (!O) return;
  const R = c.hw * 1.05;
  for (const k of O.near(c.x, c.z, _near)) {
    const o = O.items[k], dx = c.x - o.x, dz = c.z - o.z, d = Math.hypot(dx, dz), min = o.r + R;
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
    c.vx += nx * vn * 1.3; c.vz += nz * vn * 1.3;                                          // the into-it part, reversed a little
    const kk = 1 - 0.35 * headOn * headOn; c.vx *= kk; c.vz *= kk;
    c.spin += clamp(vn * 0.05, 0, 1.4) * Math.sign(c.vx * nz - c.vz * nx || 1) * 0.6;
    if (vn > 2) {
      const x = o.x + nx * o.r, z = o.z + nz * o.r;
      c.events.push({ t: 'hit', v: vn, w: OB_WALL[o.kind], x, z, y: c.y, nx: -nx, nz: -nz });
      if (o.kind !== 3) c.events.push({ t: 'tree', k, v: vn, nx: -nx, nz: -nz });
      damageCar(c, x, z, vn, o.kind === 3 ? 1 : 0.8, nx, nz);
    }
  }
  if (c.inBush !== undefined && c.inBush >= 0) { const o = O.items[c.inBush]; if (Math.hypot(c.x - o.x, c.z - o.z) > o.r + R + 0.5) c.inBush = -1; }
}
