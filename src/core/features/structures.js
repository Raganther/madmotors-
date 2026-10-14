import { MATERIALS, STRUCT, panelHp } from '../../data/structures.js';
import { inFootprint } from '../elements/structures.js';
import { carSAT } from '../sim/collide.js';
import { damageCar } from '../sim/damage.js';
import { impactOf, massOf } from '../sim/impact.js';
import { groundAt, project } from '../track/query.js';

// ---------- destructible buildings ----------
// Every building on the track (core/elements/structures.js) is a ring of wall panels (data/structures.js). A car
// hitting a panel breaks it when its impact reaches what the panel has left, then carries on with what it had over
// (so it can go through the next wall too); a weaker hit cracks it (the cracks add up); weaker still, it's a wall.
// When COLLAPSE of a building's panels are down it falls in: every panel goes and the footprint is a rubble heap.
// What's broken stays broken for the race. Rubble: every panel throws lumps the way the car was going (R.st.lumps:
// shoved about, slowing whoever hits them) and leaves a strip on the ground; a heap or a strip drags at a car's wheels.
// Weapons and shockwaves can blast walls too (blastStructures). Deterministic: no random numbers.
const CELL = 16, key = (a, b) => a * 100003 + b;
const L = STRUCT.LUMP;
function addGrid(G, o, k) { const r = Math.ceil(Math.max(o.hl, o.hw) / CELL); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const g = key(Math.floor(o.x / CELL) + a, Math.floor(o.z / CELL) + b); let l = G.get(g); if (!l) G.set(g, l = []); l.push(k); } }
/** The panels of building o: front (wall 0), right, back, left; an open front has none. */
function panelsOf(o, y, out) {
  const nx = Math.sin(o.f), nz = Math.cos(o.f), tx = Math.cos(o.f), tz = -Math.sin(o.f), h = o.floors * STRUCT.FLOOR + 0.4, hp = panelHp(o.mat, o.floors);
  // a wall from (u, v1) to (u, v2) in the building's frame (u out the front, v along it) or (u1..u2, v) for the ends
  const run = (wall, ax, az, bx, bz) => {
    const len = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.round(len / STRUCT.PANEL)), yaw = Math.atan2(bx - ax, bz - az);
    for (let k = 0; k < n; k++) { const t = (k + 0.5) / n; out.push({ bld: o.id, wall, k, n, x: ax + (bx - ax) * t, z: az + (bz - az) * t, yaw, hl: len / n / 2, hw: STRUCT.THICK / 2, y, h, hp, dmg: 0, broken: false, by: -1 }); }
  };
  const P = (u, v) => [o.x + nx * u + tx * v, o.z + nz * u + tz * v], hd = o.d / 2 - STRUCT.THICK / 2, hw = o.w / 2 - STRUCT.THICK / 2;
  if (!o.open) run(0, ...P(hd, -hw), ...P(hd, hw));
  run(1, ...P(hd, hw), ...P(-hd, hw)); run(2, ...P(-hd, hw), ...P(-hd, -hw)); run(3, ...P(-hd, -hw), ...P(hd, -hw));
}
export function initStructures(R, W) {
  const S = W.tr.structures; if (!S) { R.st = null; return; }
  const terr = W.terr, at = (x, z) => terr ? terr.at(x, z) : W.tr.H[W.tr.nearest(x, z).i];
  const blds = S.map(o => { const ys = [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, b]) => at(o.x + Math.sin(o.f) * a * o.d / 2 + Math.cos(o.f) * b * o.w / 2, o.z + Math.cos(o.f) * a * o.d / 2 - Math.sin(o.f) * b * o.w / 2)); return { ...o, y: Math.min(...ys), panels: [], down: 0, collapsed: false, by: -1, t: -1 }; });
  const panels = []; for (const o of blds) { const a = panels.length; panelsOf(o, o.y, panels); for (let k = a; k < panels.length; k++) { panels[k].id = k; o.panels.push(k); } }
  const grid = new Map(); panels.forEach((p, k) => addGrid(grid, p, k));
  R.st = { blds, panels, grid, lumps: [], strips: [], heaps: [], lumpN: 0 };
}
/** Panel p of R.st goes (car index `by`, the way it was pushed: dx, dz at speed sp). Throws its rubble; may bring the house down. */
function breakPanel(R, p, by, dx, dz, sp, t) {
  const S = R.st, o = S.blds[p.bld], M = MATERIALS[o.mat];
  p.broken = true; p.by = by; o.down++;
  // a strip of rubble where it stood, and lumps thrown on the way the car went (more from a taller, stronger wall)
  S.strips.push({ x: p.x, z: p.z, yaw: p.yaw, hl: p.hl + 0.3, hw: STRUCT.STRIP, y: p.y });
  const n = Math.min(3, 1 + Math.floor(o.floors / 2) + (o.mat === 'concrete' ? 1 : 0)), ax = Math.sin(p.yaw), az = Math.cos(p.yaw);
  for (let k = 0; k < n; k++) {
    const s = (k - (n - 1) / 2) * 0.8, v = Math.max(3, sp * (0.45 + 0.12 * k));
    addLump(S, p.x + ax * s * p.hl, p.y + 1.2 + k * 0.4, p.z + az * s * p.hl, dx * v + ax * s * 1.5, 2.5 + k, dz * v + az * s * 1.5, M.rubble, t);
  }
  if (!o.collapsed && o.down >= Math.ceil(o.panels.length * STRUCT.COLLAPSE)) collapse(R, o, by, t);
}
function addLump(S, x, y, z, vx, vy, vz, color, t) {
  S.lumps.push({ id: S.lumpN++, x, y, z, vx, vy, vz, a: 0, spin: (vx - vz) * 0.3, born: t, hint: -1, color, r: L.R });
  if (S.lumps.length > L.MAX) { let k = S.lumps.findIndex(q => Math.hypot(q.vx, q.vz) < 0.5); if (k < 0) k = 0; S.lumps.splice(k, 1); }   // the oldest at rest makes room
}
/** Building o falls in: every wall goes, the footprint becomes a heap, rubble spills out all round. */
function collapse(R, o, by, t) {
  const S = R.st; o.collapsed = true; o.by = by; o.t = t;
  S.heaps.push({ bld: o.id, x: o.x, z: o.z, f: o.f, w: o.w + 1, d: o.d + 1, y: o.y });
  const M = MATERIALS[o.mat];
  for (const k of o.panels) {
    const p = S.panels[k]; if (p.broken) continue; p.broken = true; p.by = by; o.down++;
    if ((p.k + p.wall) % 2) continue;                                          // half of them throw a lump outwards
    const ox = p.x - o.x, oz = p.z - o.z, d = Math.hypot(ox, oz) || 1;
    addLump(S, p.x, p.y + 2, p.z, ox / d * (3 + o.floors), 3, oz / d * (3 + o.floors), M.rubble, t);
  }
  if (by >= 0) R.cars[by].events.push({ t: 'collapse', bld: o.id, type: o.type, x: o.x, y: o.y, z: o.z, floors: o.floors });
}
/** A blast (a missile, a shockwave) at (x, z) of strength `power` (as a car's impact) out to `r` metres: walls in
 *  reach take it, falling off with distance. Returns how many panels broke. `by` is the car to credit. */
export function blastStructures(R, x, z, r, power, by) {
  const S = R.st; if (!S) return 0; let n = 0;
  for (const p of S.panels) {
    if (p.broken) continue; const d = Math.hypot(p.x - x, p.z - z); if (d > r + p.hl) continue;
    const I = power * Math.max(0, 1 - Math.max(0, d - p.hl) / r); if (I <= 0) continue;
    if (I >= p.hp - p.dmg) { const dx = (p.x - x) / (d || 1), dz = (p.z - z) / (d || 1); breakPanel(R, p, by, dx, dz, 6, R.time); n++; if (by >= 0) R.cars[by].events.push({ t: 'wallbreak', id: p.id, bld: p.bld, mat: S.blds[p.bld].mat, x: p.x, y: p.y, z: p.z, nx: -dx, nz: -dz, v: 8, blast: true }); }
    else p.dmg += I * STRUCT.CRACK;
  }
  return n;
}
/** The rubble under (x, z): 2 on a heap, 1 on a strip, 0 none. */
export function rubbleAt(S, x, z) {
  for (const h of S.heaps) if (inFootprint(h, x, z)) return 2;
  for (const s of S.strips) { const dx = x - s.x, dz = z - s.z, a = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw), b = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw); if (Math.abs(a) < s.hl && Math.abs(b) < s.hw) return 1; }
  return 0;
}
export function structureStep(R, W, dt) {
  const S = W.st = R.st; if (!S) return;                                          // the AI checks a building across a branch (sim/ai.js)
  const tr = W.tr, cars = R.cars.concat(R.traffic || [], R.parked || []);
  for (let ci = 0; ci < cars.length; ci++) {
    const c = cars[ci]; if (c.ghost > 0) continue;
    const near = S.grid.get(key(Math.floor(c.x / CELL), Math.floor(c.z / CELL)));
    if (near) for (const k of near) {
      const p = S.panels[k]; if (p.broken || c.y < p.y - 1.5 || c.y > p.y + p.h) continue;
      const h = carSAT(p, c); if (!h) continue;                                 // normal from the wall to the car
      const vn = -(c.vx * h.nx + c.vz * h.nz), I = impactOf(c, Math.max(0, vn)), o = S.blds[p.bld], M = MATERIALS[o.mat];
      const same = c.stHole && c.stHole.bld === p.bld && c.stHole.wall === p.wall && R.time - c.stHole.t < 0.3, need = (p.hp - p.dmg) * (same ? STRUCT.SAME : 1);   // the same hole, wider
      const ri = R.cars.indexOf(c), hx = c.x - h.nx * c.hl, hz = c.z - h.nz * c.hl;
      if (vn > 0 && massOf(c) >= M.minMass && I >= need) {
        // through: the car keeps what the wall didn't take
        const keep = Math.max(STRUCT.KEEP_MIN, 1 - STRUCT.KEEP * need / I); c.vx *= keep; c.vz *= keep;
        damageCar(c, hx, hz, 3 + vn * 0.3 * Math.min(1, p.hp / 20), 0.6, h.nx, h.nz);
        c.events.push({ t: 'wallbreak', id: p.id, bld: p.bld, mat: o.mat, x: p.x, y: p.y, z: p.z, nx: h.nx, nz: h.nz, v: vn });
        breakPanel(R, p, ri, -h.nx, -h.nz, vn * keep, R.time); c.stHole = { bld: p.bld, wall: p.wall, t: R.time };
        continue;
      }
      // a wall: pushed out, bounced, and if it was hard enough, the wall cracks
      c.x += h.nx * (h.depth + 0.01); c.z += h.nz * (h.depth + 0.01);
      if (vn > 0) {
        c.vx += h.nx * vn * 1.3; c.vz += h.nz * vn * 1.3;
        if (I >= STRUCT.CHIP * p.hp) { p.dmg = Math.min(p.hp * 0.97, p.dmg + I * STRUCT.CRACK); c.events.push({ t: 'crack', id: p.id, bld: p.bld, mat: o.mat, x: hx, y: c.y + 0.6, z: hz, v: vn }); }
        if (vn > 4) { damageCar(c, hx, hz, vn, 1, h.nx, h.nz); c.events.push({ t: 'hit', x: hx, y: c.y + 0.5, z: hz, v: vn, nx: -h.nx, nz: -h.nz, kind: 'house' }); }
      }
    }
    // rubble underfoot drags at the wheels
    if (c.onGround && (S.heaps.length || S.strips.length)) { const r = rubbleAt(S, c.x, c.z); if (r) { const f = Math.exp(-dt * (r === 2 ? STRUCT.HEAP_DRAG : STRUCT.STRIP_DRAG)); c.vx *= f; c.vz *= f; c.rubble = r; } else c.rubble = 0; }
  }
  // the lumps: fly, land, slide to a stop; shoved by cars, slowing them
  for (let k = S.lumps.length - 1; k >= 0; k--) {
    const q = S.lumps[k];
    if (R.time - q.born > L.LIFE) { S.lumps.splice(k, 1); continue; }
    if (q.vy !== 0 || q.vx * q.vx + q.vz * q.vz > 1e-4) {
      q.vy -= 30 * dt; q.x += q.vx * dt; q.y += q.vy * dt; q.z += q.vz * dt; q.a += q.spin * dt;
      if (q.hint < 0) { const n0 = tr.nearest(q.x, q.z); q.hint = n0 ? n0.i : tr.startIdx; }
      const pr = project(tr, q.x, q.z, q.hint, 20, 20); q.hint = pr.i;
      const g = groundAt(W, pr.s, pr.lat, q.x, q.z) + q.r * 0.6;
      if (q.y <= g) { q.y = g; q.vy = Math.abs(q.vy) > 3 ? -q.vy * 0.25 : 0; const f = Math.exp(-dt * L.FRIC); q.vx *= f; q.vz *= f; q.spin *= f; if (q.vx * q.vx + q.vz * q.vz < 0.04) { q.vx = 0; q.vz = 0; } }
    }
    for (const c of cars) {
      if (c.ghost > 0) continue;
      const dx = q.x - c.x, dz = q.z - c.z, rr = q.r + c.hw; if (dx * dx + dz * dz > rr * rr || Math.abs(c.y - q.y) > 1.5) continue;
      const d = Math.hypot(dx, dz), nx = dx / (d || 1), nz = dz / (d || 1), rel = (c.vx - q.vx) * nx + (c.vz - q.vz) * nz; if (rel <= 0) continue;
      const m = massOf(c), share = m / (m + L.MASS);
      q.vx += nx * rel * share * 1.6; q.vz += nz * rel * share * 1.6; q.spin += rel * 0.5; if (q.vy === 0) q.vy = 0.01;
      c.vx -= nx * rel * (1 - share) * 0.8; c.vz -= nz * rel * (1 - share) * 0.8; c.spin += (nx * c.vz - nz * c.vx > 0 ? 1 : -1) * rel * 0.03;
      q.x = c.x + nx * rr; q.z = c.z + nz * rr;
      if (rel > 7) damageCar(c, q.x, q.z, rel * 0.5, 0.5, -nx, -nz);
    }
  }
}
export const feature = {
  name: 'structures',
  init: initStructures,
  after: structureStep
};
