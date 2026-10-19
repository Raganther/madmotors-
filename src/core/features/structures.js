import { MATERIALS, STRUCT, cellHp, holeHp, rowsHit } from '../../data/structures.js';
import { buildingsOf, inFootprint } from '../elements/structures.js';
import { CELL, layoutBuilding } from '../kit/building.js';
import { carSAT } from '../sim/collide.js';
import { damageCar } from '../sim/damage.js';
import { impactOf, massOf } from '../sim/impact.js';
import { groundAt, project } from '../track/query.js';

// ---------- destructible buildings ----------
// Every building on the track (core/elements/structures.js places them, core/kit/building.js lays them out) is brick
// walls of cells round rooms of furniture under bays of roof (data/structures.js says how it all behaves). Here:
//   - a car touching a wall where cells still stand at its height spends its impact knocking them out, the middle of its
//     nose first; if it clears everything in front of it, it carries on through (with what it had over) and the hole's
//     edges go ragged; if not, it's stopped and bounced, and what's left of the impact cracks the cells it hit;
//   - brickwork with nothing under it and to both sides below falls in after a hole (stepped arches);
//   - a bay of roof and upper floors falls when the walls holding it up are mostly gone; all of them, and it's down;
//   - knocked-out brickwork throws lumps (R.st.lumps), holes leave strips and fallen bays heaps; furniture is shoved
//     about by cars and out of holes; rubble and furniture drag a little at whoever goes through them;
//   - blasts (weapons) knock out or crack the cells in reach (blastStructures).
// What's broken stays broken for the race. State in R.st (W.st for the AI). Deterministic: no random numbers (a
// hole's ragged edge comes from a hash of the cell).
const GRID = 16, key = (a, b) => a * 100003 + b, L = STRUCT.LUMP;
const hash = (a, b, c) => { const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453; return h - Math.floor(h); };
function addGrid(G, o, k) { const r = Math.ceil(Math.max(o.hl, o.hw) / GRID); for (let a = -r; a <= r; a++) for (let b = -r; b <= r; b++) { const g = key(Math.floor(o.x / GRID) + a, Math.floor(o.z / GRID) + b); let l = G.get(g); if (!l) G.set(g, l = []); l.push(k); } }
export function initStructures(R, W) {
  if (W) W.heaps = null; const S0 = buildingsOf(W.tr, W.terr); if (!S0) { R.st = null; return; }   // the stage's buildings and the towns' houses and barns
  const terr = W.terr, at = (x, z) => terr ? terr.at(x, z) : W.tr.H[W.tr.nearest(x, z).i];
  const blds = [], walls = [], furn = [];
  for (const o0 of S0) {
    const ys = [[0, 0], [1, 1], [-1, 1], [1, -1], [-1, -1]].map(([a, b]) => at(o0.x + Math.sin(o0.f) * a * o0.d / 2 + Math.cos(o0.f) * b * o0.w / 2, o0.z + Math.cos(o0.f) * a * o0.d / 2 - Math.sin(o0.f) * b * o0.w / 2));
    const o = { ...o0, y: Math.min(...ys), walls: [], bays: [], furn: [], cells: 0, down: 0, through: 0, collapsed: false, by: -1, t: -1 }, Lo = layoutBuilding(o), base = cellHp(o.mat, o.floors);
    for (const w0 of Lo.walls) {
      const w = { ...w0, id: walls.length, bld: o.id, x: (w0.ax + w0.bx) / 2, z: (w0.az + w0.bz) / 2, hl: w0.L / 2, hw: w0.thick / 2, y: o.y, h: w0.rows * STRUCT.CH, hp: new Float32Array(w0.cols * w0.rows), max: new Float32Array(w0.cols * w0.rows), by: new Int16Array(w0.cols * w0.rows).fill(-1), ver: 0, hit: null };
      const k0 = (w.kind === 'inner' ? STRUCT.INNER_HP : 1) * base;
      for (let i = 0; i < w.hp.length; i++) { const t = w.type[i]; w.max[i] = w.hp[i] = t === CELL.VOID ? 0 : k0 * (t === CELL.WINDOW ? STRUCT.WINDOW_HP : t === CELL.DOOR ? STRUCT.DOOR_HP : 1); if (t !== CELL.VOID && w.kind === 'outer') o.cells++; }
      walls.push(w); o.walls.push(w.id);
    }
    // each bay is held up by the outer walls' cells under it: the front and the back over its width, the end wall at an end
    const hw = o.w / 2 - STRUCT.THICK / 2;
    for (const b0 of Lo.bays) {
      const sup = [];
      for (const id of o.walls) {
        const w = walls[id]; if (w.kind !== 'outer') continue;
        if (w.side === 0 || w.side === 2) { const cs = []; for (let c = 0; c < w.cols; c++) { const v = (w.side === 0 ? -hw : hw) + (w.side === 0 ? 1 : -1) * (c + 0.5) * w.cw; if (v >= b0.v0 - STRUCT.BAY_REACH && v <= b0.v1 + STRUCT.BAY_REACH) cs.push(c); } if (cs.length) sup.push([id, cs[0], cs[cs.length - 1]]); }
        else if ((w.side === 3 && b0.k === 0) || (w.side === 1 && b0.k === Lo.bays.length - 1)) sup.push([id, 0, w.cols - 1]);
      }
      o.bays.push({ ...b0, fallen: false, t: -1, by: -1, sup });
    }
    for (const f0 of Lo.furn) { const f = { ...f0, id: furn.length, bld: o.id, y: at(f0.x, f0.z), vx: 0, vz: 0, vy: 0, spin: 0, buried: false, moving: false, hint: -1 }; furn.push(f); o.furn.push(f.id); }
    blds.push(o);
  }
  const grid = new Map(); walls.forEach((w, k) => addGrid(grid, w, k));
  R.st = { blds, walls, furn, grid, lumps: [], strips: [], heaps: [], lumpN: 0 };
}
// ---------- the walls' cells ----------
const gone = (w, c, r) => c < 0 || c >= w.cols ? false : r < 0 ? false : w.hp[r * w.cols + c] <= 0;   // off the ends: the corner holds it
function breakCell(o, w, i, by) { if (w.hp[i] <= 0) return false; w.hp[i] = 0; w.by[i] = by; if (w.kind === 'outer' && w.type[i] !== CELL.VOID) o.down++; return true; }
/** Brickwork over a hole that has lost what's under it and both sides below falls in. Returns how many cells went. */
function settle(o, w, by) {
  let n = 0;
  for (let r = 1; r < w.rows; r++) for (let c = 0; c < w.cols; c++) {
    const i = r * w.cols + c; if (w.hp[i] <= 0) continue;
    if (gone(w, c, r - 1) && gone(w, c - 1, r - 1) && gone(w, c + 1, r - 1)) { breakCell(o, w, i, by); n++; }
  }
  return n;
}
/** Where cell (c, r) of wall w is: { x, y, z }. */
export const cellPos = (w, c, r) => { const t = (c + 0.5) / w.cols; return { x: w.ax + (w.bx - w.ax) * t, y: w.y + (r + 0.5) * STRUCT.CH, z: w.az + (w.bz - w.az) * t }; };
// after cells go: rubble lumps the way they were pushed, the building's bays checked
function aftermath(R, o, w, n, c0, c1, r0, dx, dz, sp, by) {
  const S = R.st, M = MATERIALS[o.mat]; w.ver++;
  for (let k = 0; k < Math.max(1, Math.round(n / STRUCT.LUMP_CELLS)); k++) {
    const p = cellPos(w, Math.round(c0 + (c1 - c0) * (k + 0.5) / Math.max(1, Math.round(n / STRUCT.LUMP_CELLS))), r0 + 1), v = Math.max(3, sp * (0.4 + 0.15 * (k % 3)));
    addLump(S, p.x, p.y, p.z, dx * v + Math.sin(w.yaw) * (k % 2 ? 1 : -1), 2.5 + (k % 3), dz * v + Math.cos(w.yaw) * (k % 2 ? 1 : -1), M.rubble, R.time);
  }
  checkBays(R, o, by);
}
function addLump(S, x, y, z, vx, vy, vz, color, t, r = L.R, m = L.MASS) {
  S.lumps.push({ id: S.lumpN++, x, y, z, vx, vy, vz, a: 0, spin: (vx - vz) * 0.3, born: t, hint: -1, color, r, m });
  if (S.lumps.length > L.MAX) { let k = S.lumps.findIndex(q => Math.hypot(q.vx, q.vz) < 0.5); if (k < 0) k = 0; S.lumps.splice(k, 1); }   // the oldest at rest makes room
}
// ---------- bays: the roof and upper floors, a slice at a time ----------
function checkBays(R, o, by) {
  if (o.collapsed) return;
  const S = R.st;
  // nothing hangs in the air: a bay comes down when too little of the wall under it stands (BAY_FALL), when either
  // long wall under it is mostly gone (a floor can't hang off one side: BAY_SIDE), or when it would stick out over
  // fallen bays next to it without most of its walls (BAY_ALONE); one falling can bring the next down, so check again
  for (let again = true; again && !o.collapsed;) {
    again = false;
    o.bays.forEach((b, q) => {
      if (b.fallen || o.collapsed) return; let up = 0, all = 0, weak = false, end = 1;
      for (const [id, c0, c1] of b.sup) {
        const w = S.walls[id]; let u = 0, a = 0;
        for (let c = c0; c <= c1; c++) for (let r = 0; r < Math.min(STRUCT.BAY_ROWS, w.rows); r++) { const i = r * w.cols + c; if (w.type[i] === CELL.VOID) continue; a++; if (w.hp[i] > 0) u++; }
        up += u; all += a; if (a && (w.side === 0 || w.side === 2) && u / a < STRUCT.BAY_SIDE) weak = true;
        if (a && (w.side === 1 || w.side === 3)) end = u / a;                       // an end bay's end wall
      }
      // held at each end by a standing neighbour, or (an end bay) by its end wall while most of it stands
      const prev = o.bays[q - 1], next = o.bays[q + 1], held = n => n ? !n.fallen : end >= 0.5, alone = !held(prev) && !held(next);
      if (all && (up / all < STRUCT.BAY_FALL || weak || (alone && up / all < STRUCT.BAY_ALONE))) { fallBay(R, o, b, by); again = true; }
    });
  }
}
const frameOf = o => ({ nx: Math.sin(o.f), nz: Math.cos(o.f), tx: Math.cos(o.f), tz: -Math.sin(o.f) });
/** Bay b of building o comes down: its roof and floors fall in, the walls above the ground floor over it go, a heap. */
function fallBay(R, o, b, by) {
  const S = R.st, M = MATERIALS[o.mat], { nx, nz, tx, tz } = frameOf(o), fr = Math.round(STRUCT.FLOOR / STRUCT.CH);
  b.fallen = true; b.t = R.time; b.by = by;
  const vm = (b.v0 + b.v1) / 2, hx = o.x + tx * vm, hz = o.z + tz * vm;
  S.heaps.push({ bld: o.id, bay: b.k, x: hx, z: hz, f: o.f, w: b.v1 - b.v0 + 1.4, d: o.d + 1.2, y: o.y, top: STRUCT.HEAP_TOP * (0.7 + 0.3 * o.floors) });
  // the walls over this bay above the ground floor fall with it
  const endSide = b.k === 0 ? 3 : b.k === o.bays.length - 1 ? 1 : -1;   // an end bay takes its end wall's upper storeys (the gable) with it
  for (const id of o.walls) { const w = S.walls[id]; if (w.kind === 'outer' && w.side === endSide) { let n = 0; for (let i = fr * w.cols; i < w.hp.length; i++) if (breakCell(o, w, i, by)) n++; if (n) { w.ver++; } } }
  for (const id of o.walls) { const w = S.walls[id]; if (w.kind !== 'outer' || w.side % 2) continue; let n = 0; for (let c = 0; c < w.cols; c++) { const p = cellPos(w, c, 0), v = (p.x - o.x) * tx + (p.z - o.z) * tz; if (v < b.v0 || v > b.v1) continue; for (let r = fr; r < w.rows; r++) if (breakCell(o, w, r * w.cols + c, by)) n++; } if (n) { n += settle(o, w, by); w.ver++; } }
  for (const id of o.walls) { const w = S.walls[id]; if (w.kind !== 'inner') continue; let n = 0; for (let c = 0; c < w.cols; c++) { const p = cellPos(w, c, 0), v = (p.x - o.x) * tx + (p.z - o.z) * tz; if (v < b.v0 || v > b.v1) continue; for (let r = 0; r < w.rows; r++) if (breakCell(o, w, r * w.cols + c, by)) n++; } if (n) w.ver++; }
  for (const k of o.furn) { const f = S.furn[k]; const v = (f.x - o.x) * tx + (f.z - o.z) * tz; if (inFootprint(o, f.x, f.z) && v >= b.v0 && v <= b.v1) f.buried = true; }
  for (let k = 0; k < 1 + o.floors; k++) { const s = k % 2 ? 1 : -1, u = s * o.d * 0.45; addLump(S, hx + nx * u, o.y + 3, hz + nz * u, nx * s * (2 + k), 3, nz * s * (2 + k), k % 2 ? M.rubble : 0x5B4A3E, R.time); }
  if (by >= 0) R.cars[by].events.push({ t: 'bayfall', bld: o.id, bay: b.k, x: hx, y: o.y, z: hz });
  if (o.bays.every(q => q.fallen)) collapse(R, o, by);
}
/** The last bay is down: whatever still stands goes, and the footprint is one heap. */
function collapse(R, o, by) {
  const S = R.st; o.collapsed = true; o.by = by; o.t = R.time;
  let all = 0; for (const id of o.walls) { const w = S.walls[id]; let n = 0; for (let i = 0; i < w.hp.length; i++) if (breakCell(o, w, i, by)) n++; if (n) w.ver++; all += n; }
  S.heaps.push({ bld: o.id, bay: -1, x: o.x, z: o.z, f: o.f, w: o.w + 2, d: o.d + 2, y: o.y, top: STRUCT.HEAP_TOP * 0.6 });
  // what stood comes down as rubble that stays: chunks across the footprint and a little past it, light enough to plough
  // through and shove about (the same lumps a hole throws, smaller), for the rest of the race
  const { nx, nz, tx, tz } = frameOf(o), M = MATERIALS[o.mat], hh = q => { const v = Math.sin(q * 12.9898 + o.id * 78.233) * 43758.5453; return v - Math.floor(v); };
  for (let k = 0, n = Math.max(8, Math.min(L.COLLAPSE, Math.round(all / (STRUCT.LUMP_CELLS * 2)))); k < n; k++) {
    const u = (hh(k * 3) - 0.5) * (o.w + 1.5), v = (hh(k * 3 + 1) - 0.5) * (o.d + 1.5), out = 1 + 2 * hh(k * 3 + 2), x = o.x + tx * u + nx * v, z = o.z + tz * u + nz * v;
    addLump(S, x, o.y + 1 + o.floors * 1.2 * hh(k + 7), z, (tx * u + nx * v) / (o.w / 2) * out, 1.5, (tz * u + nz * v) / (o.w / 2) * out, k % 3 ? M.rubble : M.color, R.time, L.R * (0.55 + 0.35 * hh(k + 11)), L.MASS * 0.35);
  }
  for (const k of o.furn) S.furn[k].buried = S.furn[k].buried || inFootprint(o, S.furn[k].x, S.furn[k].z);
  if (by >= 0) R.cars[by].events.push({ t: 'collapse', bld: o.id, type: o.type, x: o.x, y: o.y, z: o.z, floors: o.floors });
}
// ---------- a car against a wall ----------
// the car's footprint along wall w (metres from its start), and the cells it covers at its height
function span(w, c) {
  const ux = (w.bx - w.ax) / w.L, uz = (w.bz - w.az) / w.L, fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), rx = -fz, rz = fx;
  let u0 = 1e9, u1 = -1e9;
  for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const x = c.x + fx * c.hl * a + rx * c.hw * b, z = c.z + fz * c.hl * a + rz * c.hw * b, u = (x - w.ax) * ux + (z - w.az) * uz; u0 = Math.min(u0, u); u1 = Math.max(u1, u); }
  const r0 = Math.max(0, Math.floor((c.y - w.y) / STRUCT.CH)), r1 = Math.min(w.rows - 1, r0 + rowsHit(massOf(c)) - 1);
  return { c0: Math.max(0, Math.floor(u0 / w.cw)), c1: Math.min(w.cols - 1, Math.floor(u1 / w.cw)), r0, r1 };
}
// the solid runs of wall w over columns c0..c1 at rows r0..r1, as boxes a car can hit
function runs(w, c0, c1, r0, r1) {
  const out = []; let a = -1;
  const solid = c => { for (let r = r0; r <= r1; r++) if (w.hp[r * w.cols + c] > 0) return true; return false; };
  for (let c = c0; c <= c1 + 1; c++) {
    if (c <= c1 && solid(c)) { if (a < 0) a = c; continue; }
    if (a >= 0) { const t0 = a / w.cols, t1 = c / w.cols, tm = (t0 + t1) / 2; out.push({ x: w.ax + (w.bx - w.ax) * tm, z: w.az + (w.bz - w.az) * tm, yaw: w.yaw, hl: (t1 - t0) * w.L / 2, hw: w.hw }); a = -1; }
  }
  return out;
}
function hitWall(R, c, w, h, sp) {
  const S = R.st, o = S.blds[w.bld], M = MATERIALS[o.mat], ri = R.cars.indexOf(c);
  const vn = -(c.vx * h.nx + c.vz * h.nz), hx = c.x - h.nx * c.hl, hz = c.z - h.nz * c.hl;
  if (vn <= 0) { c.x += h.nx * (h.depth + 0.01); c.z += h.nz * (h.depth + 0.01); return; }
  const E = impactOf(c, vn), canBreak = massOf(c) >= M.minMass, mid = (sp.c0 + sp.c1) / 2;
  // the cells in front of the car, the middle of its nose first, low first
  const cells = []; for (let col = sp.c0; col <= sp.c1; col++) for (let r = sp.r0; r <= sp.r1; r++) { const i = r * w.cols + col; if (w.hp[i] > 0) cells.push([i, col, r]); }
  cells.sort((a, b) => Math.abs(a[1] - mid) - Math.abs(b[1] - mid) || a[2] - b[2]);
  // too light a hit for this wall (as cracked as it is) only cracks it
  let spent = 0, n = 0; const worn = cells.reduce((a, [i]) => a + w.hp[i] / w.max[i], 0) / Math.max(1, cells.length);
  if (canBreak && E >= STRUCT.BREAK * holeHp(o.mat, o.floors) * (w.kind === 'inner' ? STRUCT.INNER_HP : 1) * worn) for (const [i] of cells) { if (E - spent < w.hp[i]) continue; spent += w.hp[i]; breakCell(o, w, i, ri); n++; }
  const left = cells.filter(([i]) => w.hp[i] > 0), dx = -h.nx, dz = -h.nz;
  if (!left.length) {
    // through: the car keeps what the wall didn't take; the hole's edges go ragged, the brickwork round it cracks
    const keep = Math.max(STRUCT.KEEP_MIN, 1 - STRUCT.KEEP * spent / E); c.vx *= keep; c.vz *= keep;
    for (const col of [sp.c0 - 1, sp.c1 + 1]) for (let r = sp.r0; r <= sp.r1 + 1; r++) if (col >= 0 && col < w.cols && r < w.rows && hash(w.id, col, r) < STRUCT.RAG && breakCell(o, w, r * w.cols + col, ri)) n++;
    for (let col = sp.c0 - 2; col <= sp.c1 + 2; col++) for (let r = sp.r0; r <= Math.min(w.rows - 1, sp.r1 + 2); r++) { if (col < 0 || col >= w.cols) continue; const i = r * w.cols + col; if (w.hp[i] > 0) w.hp[i] = Math.max(w.max[i] * 0.05, w.hp[i] - w.max[i] * 0.3 * hash(col, r, w.id)); }
    damageCar(c, hx, hz, 2 + vn * 0.25 * Math.min(1, spent / 20), 0.6, h.nx, h.nz);
    if (w.kind === 'outer' && (c.x - o.x) * c.vx + (c.z - o.z) * c.vz > 0) o.through++;   // out the other side
    S.strips.push({ x: w.x + (w.bx - w.ax) / w.L * ((sp.c0 + sp.c1 + 1) / 2 * w.cw - w.L / 2) + dx * 1.2, z: w.z + (w.bz - w.az) / w.L * ((sp.c0 + sp.c1 + 1) / 2 * w.cw - w.L / 2) + dz * 1.2, yaw: w.yaw, hl: (sp.c1 - sp.c0 + 1) * w.cw / 2 + 0.3, hw: STRUCT.STRIP });
  } else {
    // stopped: pushed back out and bounced (softer if some of it gave); what's left of the hit cracks what's left
    const crack = (E - spent) * STRUCT.CRACK / left.length; for (const [i] of left) w.hp[i] = Math.max(w.max[i] * 0.03, w.hp[i] - crack);
    c.x += h.nx * (h.depth + 0.01); c.z += h.nz * (h.depth + 0.01);
    c.vx += h.nx * vn * (n ? 1.0 : 1.3); c.vz += h.nz * vn * (n ? 1.0 : 1.3);
    if (vn > 4) { damageCar(c, hx, hz, vn * (n ? 0.7 : 1), 1, h.nx, h.nz); c.events.push({ t: 'hit', x: hx, y: c.y + 0.5, z: hz, v: vn, nx: -h.nx, nz: -h.nz, kind: 'house' }); }
    if (!n && crack > 0) { w.ver++; if (vn > 3 && !(R.time - (c.crackT || -9) < 0.3)) { c.crackT = R.time; c.events.push({ t: 'crack', bld: w.bld, mat: o.mat, x: hx, y: c.y + 0.6, z: hz, v: vn }); } }   // (one crack a hit, not a step)
  }
  if (n) {
    n += settle(o, w, ri); w.hit = { dx, dz, v: Math.max(4, Math.hypot(c.vx, c.vz)), t: R.time };
    c.events.push({ t: 'wallbreak', bld: w.bld, wall: w.id, mat: o.mat, n, through: !left.length, x: hx, y: c.y, z: hz, nx: h.nx, nz: h.nz, v: vn });
    aftermath(R, o, w, n, sp.c0, sp.c1, sp.r0, dx, dz, Math.hypot(c.vx, c.vz), ri);
  }
}
/** A blast (a missile, a mine, a shockwave) at (x, z) of strength `power` (as a car's impact) out to `r` metres: cells in
 *  reach go if it beats them, falling off with distance, and crack if not. Returns how many cells went. */
export function blastStructures(R, x, z, r, power, by) {
  const S = R.st; if (!S) return 0; let total = 0;
  for (const w of S.walls) {
    if (Math.hypot(w.x - x, w.z - z) > r + w.hl) continue;
    const o = S.blds[w.bld], y0 = S.blds[w.bld].y + 1; let n = 0, cmin = 1e9, cmax = -1;
    for (let col = 0; col < w.cols; col++) for (let rr = 0; rr < w.rows; rr++) {
      const i = rr * w.cols + col; if (w.hp[i] <= 0) continue;
      const p = cellPos(w, col, rr), d = Math.hypot(p.x - x, p.z - z, (p.y - y0) * 0.8); if (d > r) continue;
      const I = power * (1 - d / r);
      if (I >= w.hp[i]) { breakCell(o, w, i, by); n++; cmin = Math.min(cmin, col); cmax = Math.max(cmax, col); } else w.hp[i] -= I * STRUCT.CRACK;
    }
    if (n) {
      n += settle(o, w, by); total += n; const dx = (w.x - x) / (Math.hypot(w.x - x, w.z - z) || 1), dz = (w.z - z) / (Math.hypot(w.x - x, w.z - z) || 1);
      w.hit = { dx, dz, v: 9, t: R.time }; aftermath(R, o, w, n, cmin, cmax, 0, dx, dz, 9, by);
      if (by >= 0) R.cars[by].events.push({ t: 'wallbreak', bld: w.bld, wall: w.id, mat: o.mat, n, through: false, x: w.x, y: w.y, z: w.z, nx: -dx, nz: -dz, v: 8, blast: true });
    } else if (power > 0) w.ver++;
  }
  for (const f of S.furn) { const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz); if (f.buried || d > r * 1.3) continue; const k = 10 * (1 - d / (r * 1.3)) / Math.max(0.2, f.m); f.vx += dx / (d || 1) * k; f.vz += dz / (d || 1) * k; f.vy = Math.max(f.vy, 2 + k * 0.3); f.spin += k * 0.4; f.moving = true; }
  return total;
}
/** Is (x, y, z) inside a standing bit of wall (a missile flying into it)? */
export function solidAt(R, x, y, z) {
  const S = R.st; if (!S) return false;
  const near = S.grid.get(key(Math.floor(x / GRID), Math.floor(z / GRID))); if (!near) return false;
  for (const k of near) {
    const w = S.walls[k], ux = (w.bx - w.ax) / w.L, uz = (w.bz - w.az) / w.L, u = (x - w.ax) * ux + (z - w.az) * uz, across = -(x - w.ax) * uz + (z - w.az) * ux;
    if (u < 0 || u > w.L || Math.abs(across) > w.hw + 0.3) continue;
    const c = Math.min(w.cols - 1, Math.floor(u / w.cw)), r = Math.floor((y - w.y) / STRUCT.CH); if (r < 0 || r >= w.rows) continue;
    if (w.hp[r * w.cols + c] > 0) return true;
  }
  return false;
}
/** The rubble under (x, z): 2 on a heap, 1 on a strip, 0 none. */
export function rubbleAt(S, x, z) {
  for (const h of S.heaps) if (inFootprint(h, x, z)) return 2;
  for (const s of S.strips) { const dx = x - s.x, dz = z - s.z, a = dx * Math.sin(s.yaw) + dz * Math.cos(s.yaw), b = dx * Math.cos(s.yaw) - dz * Math.sin(s.yaw); if (Math.abs(a) < s.hl && Math.abs(b) < s.hw) return 1; }
  return 0;
}
// ---------- furniture ----------
// shoved by cars (momentum shared by mass, the car slowed a little), it slides to a stop, and it stays inside unless
// it goes out through a hole: an outer wall still standing low down where it crosses throws it back
function containFurniture(S, o, f) {
  if (!inFootprint(o, f.x, f.z, 0.6) || inFootprint(o, f.x, f.z, -0.7)) return;
  for (const id of o.walls) {
    const w = S.walls[id]; if (w.kind !== 'outer') continue;
    const ux = (w.bx - w.ax) / w.L, uz = (w.bz - w.az) / w.L, u = (f.x - w.ax) * ux + (f.z - w.az) * uz, across = -(f.x - w.ax) * uz + (f.z - w.az) * ux;
    if (u < 0 || u > w.L || Math.abs(across) > w.hw + 0.5) continue;
    const c = Math.min(w.cols - 1, Math.floor(u / w.cw)); if (w.hp[c] <= 0 && w.hp[w.cols + c] <= 0) continue;   // a hole low down: out it goes
    const nx = -uz * Math.sign(across || 1), nz = ux * Math.sign(across || 1), vn = f.vx * nx + f.vz * nz;
    if (vn < 0) { f.vx -= nx * vn * 1.4; f.vz -= nz * vn * 1.4; } f.x += nx * (w.hw + 0.5 - Math.abs(across)); f.z += nz * (w.hw + 0.5 - Math.abs(across));
  }
}
function stepFurniture(R, W, dt, cars) {
  const S = R.st, tr = W.tr;
  for (const o of S.blds) {
    if (!o.furn.length) continue;
    const r = Math.max(o.w, o.d) / 2 + 8, near = cars.filter(c => Math.abs(c.x - o.x) < r && Math.abs(c.z - o.z) < r && !(c.ghost > 0));
    for (const k of o.furn) {
      const f = S.furn[k]; if (f.buried || (!f.moving && !near.length)) continue;
      for (const c of near) {
        const dx = f.x - c.x, dz = f.z - c.z, rr = Math.max(f.hl, f.hw) * 0.85 + c.hw; if (dx * dx + dz * dz > rr * rr || Math.abs(c.y - f.y) > 1.6) continue;
        const d = Math.hypot(dx, dz), nx = dx / (d || 1), nz = dz / (d || 1), rel = (c.vx - f.vx) * nx + (c.vz - f.vz) * nz; if (rel <= 0) continue;
        const m = massOf(c), share = m / (m + f.m);
        f.vx += nx * rel * share * 1.15; f.vz += nz * rel * share * 1.15; f.spin += (nx * c.vz - nz * c.vx > 0 ? 1 : -1) * rel * 0.25; if (rel > 7) f.vy = Math.max(f.vy, Math.min(5, rel * 0.2));
        c.vx -= nx * rel * (1 - share) * STRUCT.FURN_SLOW; c.vz -= nz * rel * (1 - share) * STRUCT.FURN_SLOW;
        f.x = c.x + nx * rr; f.z = c.z + nz * rr; f.moving = true;
        if (rel > 5) c.events.push({ t: 'furniture', kind: f.kind, x: f.x, y: f.y, z: f.z, v: rel });
      }
      if (!f.moving) continue;
      f.vy -= 30 * dt; f.x += f.vx * dt; f.z += f.vz * dt; f.y += f.vy * dt; f.yaw += f.spin * dt;
      if (f.hint < 0) { const n0 = tr.nearest(f.x, f.z); f.hint = n0 ? n0.i : tr.startIdx; }
      const pr = project(tr, f.x, f.z, f.hint, 20, 20); f.hint = pr.i;
      const g = groundAt(W, pr.s, pr.lat, f.x, f.z);
      if (f.y <= g) { f.y = g; f.vy = f.vy < -4 ? -f.vy * 0.2 : 0; const fr = Math.exp(-dt * STRUCT.FURN_FRIC); f.vx *= fr; f.vz *= fr; f.spin *= fr; }
      containFurniture(S, o, f);
      if (f.vy === 0 && f.vx * f.vx + f.vz * f.vz < 0.02 && Math.abs(f.spin) < 0.05) { f.vx = f.vz = f.spin = 0; f.moving = false; }
    }
  }
}
export function structureStep(R, W, dt) {
  const S = W.st = R.st; W.heaps = S ? S.heaps : null; if (!S) return;          // the AI checks a building across a branch (sim/ai.js); groundAt rides the heaps
  const tr = W.tr, cars = R.cars.concat(R.traffic || [], R.parked || []);
  for (const c of cars) {
    if (c.ghost > 0) continue;
    const near = S.grid.get(key(Math.floor(c.x / GRID), Math.floor(c.z / GRID)));
    if (near) for (const k of near) {
      const w = S.walls[k]; if (c.y < w.y - 1.5 || c.y > w.y + w.h) continue;
      if (!carSAT(w, c)) continue;
      const sp = span(w, c);
      for (const run of runs(w, Math.max(0, sp.c0 - 2), Math.min(w.cols - 1, sp.c1 + 2), sp.r0, sp.r1)) {
        const h = carSAT(run, c); if (!h) continue;
        hitWall(R, c, w, h, sp); break;
      }
    }
    // rubble underfoot drags at the wheels
    if (c.onGround && (S.heaps.length || S.strips.length)) { const r = rubbleAt(S, c.x, c.z); if (r) { const f = Math.exp(-dt * (r === 2 ? STRUCT.HEAP_DRAG : STRUCT.STRIP_DRAG)); c.vx *= f; c.vz *= f; c.rubble = r; } else c.rubble = 0; }
  }
  stepFurniture(R, W, dt, cars);
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
      const m = massOf(c), share = m / (m + (q.m || L.MASS));
      q.vx += nx * rel * share * 1.6; q.vz += nz * rel * share * 1.6; q.spin += rel * 0.5; if (q.vy === 0) q.vy = 0.01;
      c.vx -= nx * rel * (1 - share) * 0.5; c.vz -= nz * rel * (1 - share) * 0.5; c.spin += (nx * c.vz - nz * c.vx > 0 ? 1 : -1) * rel * 0.02;
      q.x = c.x + nx * rr; q.z = c.z + nz * rr;
      if (rel > 7) damageCar(c, q.x, q.z, rel * 0.4, 0.5, -nx, -nz);
    }
  }
}
export const feature = {
  name: 'structures',
  init: initStructures,
  after: structureStep
};
