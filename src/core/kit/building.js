import { FURNITURE, STRUCT } from '../../data/structures.js';
import { mulberry32 } from '../math.js';

// ---------- a building's layout (shared by core/features/structures.js and render/elements/structures.js) ----------
// From a placed building o ({ x, z, f, w, d, floors, type, open, shop }) this lays out, in world x/z:
//   walls    the four outer walls (front, right, back, left) and the inner partitions, each a grid of cells
//            STRUCT.CW wide by STRUCT.CH tall: what a car knocks out. A cell is wall, window glass, a door, or void
//            (a doorway, open from the start)
//   bays     slices across the building's width, each with its stretch of roof and upper floors: a bay comes down
//            when the walls under it are mostly gone (core decides when), so a building falls in a bay at a time
//   rooms    the ground floor's rooms, and their furniture (sofas, beds, kitchens, shelves, pews, bales...)
// Deterministic: only the building's own numbers (its position seeds the furniture).
export const CELL = { WALL: 0, WINDOW: 1, DOOR: 2, VOID: 3 };
const frame = o => { const nx = Math.sin(o.f), nz = Math.cos(o.f), tx = Math.cos(o.f), tz = -Math.sin(o.f); return (u, v) => [o.x + nx * u + tx * v, o.z + nz * u + tz * v]; };
export function layoutBuilding(o) {
  const P = frame(o), CW = STRUCT.CW, CH = STRUCT.CH, rows = Math.ceil((o.floors * STRUCT.FLOOR + 0.4) / CH), fr = STRUCT.FLOOR / CH;
  const hd = o.d / 2 - STRUCT.THICK / 2, hw = o.w / 2 - STRUCT.THICK / 2, rnd = mulberry32(Math.abs(Math.round(o.x * 7.3 + o.z * 13.1)) + 17);
  const walls = [];
  // a wall from (u1, v1) to (u2, v2) in the building's frame
  const wall = (kind, side, u1, v1, u2, v2, thick, nRows) => {
    const [ax, az] = P(u1, v1), [bx, bz] = P(u2, v2), L = Math.hypot(bx - ax, bz - az), cols = Math.max(1, Math.round(L / CW));
    const w = { kind, side, ax, az, bx, bz, L, cw: L / cols, cols, rows: nRows, thick, yaw: Math.atan2(bx - ax, bz - az), type: new Uint8Array(cols * nRows) };
    walls.push(w); return w;
  };
  const set = (w, c0, c1, r0, r1, t) => { for (let c = Math.max(0, c0); c <= Math.min(w.cols - 1, c1); c++) for (let r = Math.max(0, r0); r <= Math.min(w.rows - 1, r1); r++) w.type[r * w.cols + c] = t; };
  // windows two cells wide every ~2.5 m on every floor, a door in the middle of the front; a shop window across a
  // shop's ground floor, big doors in a barn's front
  const openings = (w, front) => {
    const step = 5, n = Math.floor((w.cols - 2) / step);
    for (let f = 0; f < o.floors; f++) for (let k = 0; k < n; k++) {
      const c0 = Math.round((w.cols - n * step) / 2 + k * step + 1.5);
      if (front && f === 0 && (k === n >> 1)) { if (o.type === 'barn') set(w, c0 - 2, c0 + 3, 0, 6, CELL.DOOR); else set(w, c0, c0 + 1, 0, 3, CELL.DOOR); continue; }
      if (front && f === 0 && (o.shop || o.type === 'barn')) continue;
      if (o.type === 'warehouse' && f === 0) continue;
      set(w, c0, c0 + 1, Math.round(f * fr) + 2, Math.round(f * fr) + 3, CELL.WINDOW);
    }
    if (front && o.shop) { const mid = w.cols >> 1; for (let c = 1; c < w.cols - 1; c++) if (Math.abs(c - mid) > 1) set(w, c, c, 1, 4, CELL.WINDOW); set(w, mid - 1, mid, 0, 3, CELL.DOOR); }
  };
  if (!o.open) openings(wall('outer', 0, hd, -hw, hd, hw, STRUCT.THICK, rows), true);
  for (const [side, u1, v1, u2, v2] of [[1, hd, hw, -hd, hw], [2, -hd, hw, -hd, -hw], [3, -hd, -hw, hd, -hw]]) openings(wall('outer', side, u1, v1, u2, v2, STRUCT.THICK, rows), false);
  // the rooms: a partition across the middle (front room, back), and across the back for a wide house; each with a
  // doorway; sheds, stalls, barns, warehouses and chapels are one open room
  const rooms = [], roomy = !['shed', 'stall', 'barn', 'warehouse', 'chapel'].includes(o.type) && o.d >= 6.5 && o.w >= 7;
  const pu = -o.d * 0.08, ih = Math.min(rows, Math.round(fr));
  if (roomy) {
    const p0 = wall('inner', 4, pu, -hw + 0.2, pu, hw - 0.2, STRUCT.INNER, ih), dc = Math.round(p0.cols * (0.25 + rnd() * 0.5)); set(p0, dc, dc + 1, 0, 4, CELL.VOID);
    rooms.push({ kind: o.shop ? 'shop' : 'living', u0: pu, u1: hd, v0: -hw, v1: hw });
    if (o.w >= 11) {
      const p1 = wall('inner', 5, pu, 0, -hd + 0.2, 0, STRUCT.INNER, ih), dc1 = Math.round(p1.cols * 0.3); set(p1, dc1, dc1 + 1, 0, 4, CELL.VOID);
      rooms.push({ kind: 'kitchen', u0: -hd, u1: pu, v0: -hw, v1: 0 }, { kind: 'bedroom', u0: -hd, u1: pu, v0: 0, v1: hw });
    } else rooms.push({ kind: rnd() < 0.5 ? 'kitchen' : 'bedroom', u0: -hd, u1: pu, v0: -hw, v1: hw });
  } else rooms.push({ kind: { shed: 'shed', stall: 'stall', barn: 'barn', warehouse: 'warehouse', chapel: 'chapel' }[o.type] || 'living', u0: -hd, u1: hd, v0: -hw, v1: hw });
  // the bays: slices across the width, each with its roof and upper floors
  const nb = Math.max(1, Math.round(o.w / STRUCT.BAY)), bays = [];
  for (let k = 0; k < nb; k++) bays.push({ k, v0: -o.w / 2 + o.w * k / nb, v1: -o.w / 2 + o.w * (k + 1) / nb });
  // furniture: each room's set, placed against its walls where it fits, nothing on top of anything else
  const furn = [];
  for (const rm of rooms) {
    for (const id of FURNITURE.ROOMS[rm.kind] || []) {
      const F = FURNITURE.KINDS[id];
      for (let t = 0; t < 12; t++) {
        const wallSide = Math.floor(rnd() * 4), m = 0.35;
        let u = rm.u0 + m + F.hw + rnd() * Math.max(0, rm.u1 - rm.u0 - 2 * (m + F.hw)), v = rm.v0 + m + F.hl + rnd() * Math.max(0, rm.v1 - rm.v0 - 2 * (m + F.hl)), yaw = 0;
        if (F.wall) { if (wallSide === 0) u = rm.u1 - m - F.hw; else if (wallSide === 1) u = rm.u0 + m + F.hw; }   // against the front or back of the room
        if (F.mid) { u = (rm.u0 + rm.u1) / 2 + (rnd() - 0.5) * (rm.u1 - rm.u0) * 0.3; v = (rm.v0 + rm.v1) / 2 + (rnd() - 0.5) * (rm.v1 - rm.v0) * 0.3; yaw = (rnd() - 0.5) * 0.3; }
        if (u - F.hw < rm.u0 + 0.2 || u + F.hw > rm.u1 - 0.2 || v - F.hl < rm.v0 + 0.2 || v + F.hl > rm.v1 - 0.2) continue;
        if (furn.some(q => Math.abs(q.u - u) < q.hw + F.hw + 0.2 && Math.abs(q.v - v) < q.hl + F.hl + 0.2)) continue;
        const [x, z] = P(u, v); furn.push({ kind: id, x, z, u, v, yaw: o.f + Math.PI / 2 + yaw, hl: F.hl, hw: F.hw, h: F.h, m: F.m }); break;
      }
    }
  }
  return { walls, rows, bays, rooms, furn, P };
}
