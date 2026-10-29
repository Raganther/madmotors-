import { mulberry32 } from '../math.js';
import { BUILDINGS, BUILDING_TYPES } from '../../data/structures.js';

// The Track Studio's edits (ui/studio.js), laid over any stage as data: stage.edits = {
//   sculpt: { cell, d: { "c,r": metres } }   the land raised or lowered: a sparse grid in world x / z, `cell` m apart
//                                           (cell c, r is at x = c * cell, z = r * cell), added to the ground and to the
//                                           road over it (a hump in the road, a jump, a hill, a drop)
//   props: [{ k, x, z, s, ry, t }]           scenery put there: k one of PROPS (trees, bushes, rocks, cacti), s its size,
//                                           t a shade (-1 darker .. 1 lighter)
//   clears: [[x, z, r, f], ...]              the stage's own scenery taken away inside these circles: f 'trees', 'rocks',
//                                           'bushes', 'street' (the towns' fences, walls and furniture) or all of it
//   kit: [{ k, x, z, yaw, w, style }]        street and boundary pieces (KIT_PIECES): walls, hedges and fences w long,
//                                           lamps, bins, benches, hay; yaw in degrees along the piece
//   houses: [{ type, x, z, f }]              buildings put there (data/structures.js types; f: degrees, the way the front
//                                           faces), as breakable as any other building
// }. A stage without edits builds exactly as before. Applied by core/track/circuit.js and downhill.js (the road),
// terrain.js (the ground), obstacles.js (props, clears) and build.js (houses).
export const SCULPT = { CELL: 4, MAX: 60 };
export const PROPS = { pine: 'Pine', fir: 'Tall fir', tree: 'Oak', autumn: 'Autumn tree', blossom: 'Blossom tree', bush: 'Bush', rock: 'Rock', boulder: 'Boulder', cactus: 'Cactus' };
// trees with colours of their own (the rest take the stage's palette)
const PROP_COL = { fir: [0x22513A, 0x1D4530, 0x2A5C40], autumn: [0xD9822B, 0xC4562A, 0xE0A93A, 0xB8452B], blossom: [0xF2A7C3, 0xF7C6D9, 0xE88AB0, 0xFFFFFF] };
/** Street and boundary pieces the Studio can put down (the world kit's kinds, core/kit/layout.js; the stand-alone
 *  breakables, data/breakables.js): what one is called, its size (a boundary's length is its run's), how it stands. */
export const KIT_PIECES = {
  wall: { name: 'Stone wall', d: 0.5, h: 0.95, len: true }, hedge: { name: 'Hedge', d: 0.9, h: 1.35, len: true }, picket: { name: 'Picket fence', d: 0.14, h: 1.0, len: true },
  railing: { name: 'Railing', d: 0.1, h: 1.0, len: true }, chain: { name: 'Chain-link fence', d: 0.08, h: 1.8, len: true }, fence: { name: 'Wooden fence', d: 0.25, h: 1.2, len: true },
  post: { name: 'Lamp post', w: 0.3, d: 0.3, h: 4.6 }, bin: { name: 'Bin', w: 0.6, d: 0.6, h: 1.0 }, bench: { name: 'Bench', w: 1.6, d: 0.5, h: 0.8 }, postbox: { name: 'Postbox', w: 0.5, d: 0.5, h: 1.4 },
  hay: { name: 'Hay bales', w: 4.4, d: 1.3, h: 1.3 }, crates: { name: 'Crates', w: 3.2, d: 1.2, h: 1.2 }, concrete: { name: 'Concrete blocks', w: 6, d: 0.8, h: 1.0 },
};
const scaleHex = (c, k) => { const f = v => Math.max(0, Math.min(255, Math.round(v * k))); return (f(c >> 16 & 255) << 16) | (f(c >> 8 & 255) << 8) | f(c & 255); };
/** How much the land is raised at world (x, z) (0 without edits). */
export function sculptAt(sc, x, z) {
  if (!sc || !sc.d) return 0;
  const C = sc.cell || SCULPT.CELL, fx = x / C, fz = z / C, c = Math.floor(fx), r = Math.floor(fz), u = fx - c, v = fz - r, d = sc.d;
  const g = (a, b) => d[a + ',' + b] || 0;
  return (g(c, r) * (1 - u) + g(c + 1, r) * u) * (1 - v) + (g(c, r + 1) * (1 - u) + g(c + 1, r + 1) * u) * v;
}
/** The road's heights raised with the land under it (samples xs, zs; H changed in place). */
export function sculptRoad(edits, xs, zs, H, n = H.length) {
  const sc = edits && edits.sculpt; if (!sc || !sc.d) return;
  for (let i = 0; i < n; i++) H[i] += sculptAt(sc, xs[i], zs[i]);
}
const fall = t => t >= 1 ? 0 : (1 - t * t) ** 2;
/**
 * One dab of a brush at (x, z), radius r, strength k (0..1), on sculpt sc (changed in place). op: raise, lower, smooth,
 * flatten (to height `to`). base(x, z): the ground's height without any sculpting, so smooth and flatten work on the
 * land as it stands. Returns the cells it changed.
 */
export function sculptDab(sc, op, x, z, r, k, base, to = 0) {
  const C = sc.cell || (sc.cell = SCULPT.CELL), d = sc.d || (sc.d = {}), c0 = Math.floor((x - r) / C), c1 = Math.ceil((x + r) / C), r0 = Math.floor((z - r) / C), r1 = Math.ceil((z + r) / C);
  const total = (c, q) => base(c * C, q * C) + (d[c + ',' + q] || 0), changed = [];
  const next = [];
  for (let c = c0; c <= c1; c++) for (let q = r0; q <= r1; q++) {
    const w = fall(Math.hypot(c * C - x, q * C - z) / r) * k; if (w <= 0) continue;
    const key = c + ',' + q, now = d[key] || 0; let v = now;
    if (op === 'raise') v = now + 0.35 * w;
    else if (op === 'lower') v = now - 0.35 * w;
    else if (op === 'flatten') v = now + (to - total(c, q)) * w * 0.5;
    else if (op === 'smooth') { let s = 0; for (const [a, b] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) s += total(c + a, q + b); v = now + (s / 8 - total(c, q)) * w * 0.5; }
    next.push([key, Math.max(-SCULPT.MAX, Math.min(SCULPT.MAX, v))]);
  }
  for (const [key, v] of next) { if (Math.abs(v) < 0.005) delete d[key]; else d[key] = Math.round(v * 100) / 100; changed.push(key); }
  return changed;
}
/** Scenery items (core/track/obstacles.js kinds) for the stage's props, after taking its own away inside the clears. */
const CLEAR = { trees: [0, 1, 2], rocks: [3], bushes: [4] };
export function editObstacles(edits, items, terr, stage, OB) {
  if (!edits) return;
  for (const [x, z, r, f] of edits.clears || []) { if (f === 'street') continue; const only = CLEAR[f]; for (let k = items.length - 1; k >= 0; k--) if ((!only || only.includes(items[k].kind)) && Math.hypot(items[k].x - x, items[k].z - z) < r) items.splice(k, 1); }
  const C = stage.colors, rnd = mulberry32(stage.seed * 13 + 77), pick = a => a[Math.floor(rnd() * a.length)];
  for (const p of edits.props || []) {
    const s = p.s || 1, y = terr.at(p.x, p.z), ry = p.ry || 0, x = p.x, z = p.z, shade = c => p.t ? scaleHex(c, 1 + 0.28 * p.t) : c, own = PROP_COL[p.k];
    if (p.k === 'pine' || p.k === 'fir') items.push({ kind: OB.PINE, x, y: y - 0.2, z, s, sy: s * (p.k === 'fir' ? 1.6 : 1.1), ry, color: shade(pick(own || C.pine)), r: 0.3 * s, brush: 0.75 * s });
    else if (p.k === 'tree' || p.k === 'autumn' || p.k === 'blossom') items.push({ kind: OB.ROUND, x, y: y - 0.2, z, s, sy: s, ry, color: shade(pick(own || C.round)), r: 0.32 * s });
    else if (p.k === 'bush') items.push({ kind: OB.BUSH, x, y: y + 0.2 * s, z, s, sy: s * 0.7, ry, color: shade(pick(C.round)), r: 0.9 * s, soft: true });
    else if (p.k === 'cactus') items.push({ kind: OB.CACTUS, x, y: y - 0.2, z, s, sy: s, ry, dh: 0, dl: (p.t || 0) * 0.08, r: 0.34 * s });
    else if (p.k === 'rock' || p.k === 'boulder') { const b = p.k === 'boulder' ? 2.6 : 1.2, S = s * b; items.push({ kind: OB.ROCK, x, y: y - 0.2 * S, z, s: S, sx: S * 1.1, sy: S * 0.75, sz: S, ry, rx: 0.15, dl: (p.t || 0) * 0.12, r: 0.8 * S, shape: Math.abs(Math.round(x + z)) % 3 }); }
  }
}
/** The world kit with the Studio's own pieces on it (and the towns' street pieces it cleared away): kit as
 *  core/kit/layout.js makes it, or an empty one when the stage has no towns. */
export function editKit(kit, stage, terr) {
  const E = stage.edits; if (!E || (!(E.kit || []).length && !(E.clears || []).some(c => c[3] === 'street'))) return kit;
  const K = kit || { solid: [], ground: [], decor: [], zones: [], pave: [], inZone: () => false };
  for (const [x, z, r, f] of E.clears || []) if (f === 'street') K.solid = K.solid.filter(o => o.kind === 'house' || o.kind === 'barn' || Math.hypot(o.x - x, o.z - z) >= r);
  for (const e of E.kit || []) {
    const P = KIT_PIECES[e.k]; if (!P) throw new Error(`${stage.name}: edits.kit: no piece "${e.k}" (${Object.keys(KIT_PIECES).join(', ')})`);
    K.solid.push({ kind: e.k, x: e.x, z: e.z, y: terr.at(e.x, e.z), yaw: (e.yaw || 0) * Math.PI / 180, w: P.len ? Math.max(0.5, e.w || 4) : P.w, d: P.d, h: P.h, sd: 1, style: e.style || 'village', lamp: e.k === 'post', placed: true });
  }
  return K;
}
/** The stage's placed buildings, appended to the track's own (tr.structures: core/elements/structures.js shapes). */
export function editHouses(tr, stage) {
  const H = stage.edits && stage.edits.houses; if (!H || !H.length) return;
  const rnd = mulberry32(stage.seed * 19 + 913), pick = a => a[Math.floor(rnd() * a.length)], out = tr.structures || (tr.structures = []);
  for (const B of H) {
    const T = BUILDINGS[B.type]; if (!T) throw new Error(`${stage.name}: edits.houses: no type "${B.type}" (${BUILDING_TYPES.join(', ')})`);
    out.push({ id: out.length, type: B.type, mat: T.mat, x: B.x, z: B.z, f: (B.f || 0) * Math.PI / 180, w: T.w, d: T.d, floors: T.floors, open: !!T.open, shop: !!T.shop, road: false,
      wall: pick(T.walls), roofC: pick(T.roofC), roof: T.roof, placed: true });
  }
}
/** What changed from stage a to stage b (two versions of a draft), in a few words each: [string]. */
export function editsDiff(a, b) {
  const A = (a && a.edits) || {}, B = (b && b.edits) || {}, out = [], n = (k, x) => `${x} ${k}${x === 1 ? '' : 's'}`;
  const da = (A.sculpt && A.sculpt.d) || {}, db = (B.sculpt && B.sculpt.d) || {};
  let cells = 0; for (const k of new Set([...Object.keys(da), ...Object.keys(db)])) if (Math.abs((da[k] || 0) - (db[k] || 0)) > 0.05) cells++;
  if (cells) out.push(`reshaped the land (${Math.round(cells * 16)} m²)`);
  const pa = A.path && A.path.pts, pb = B.path && B.path.pts;
  if (pb && !pa) out.push(`redrew the road (${n('point', pb.length)})`);
  else if (pa && !pb) out.push('put the road back as it was');
  else if (pa && pb) {
    const moved = pb.filter(q => !pa.some(r => Math.hypot(r[0] - q[0], r[1] - q[1]) < 1 && (r[2] || 0) === (q[2] || 0))).length, d = pb.length - pa.length;
    if (d > 0) out.push(`added ${n('road point', d)}`); if (d < 0) out.push(`took out ${n('road point', -d)}`);
    if (moved > Math.max(0, d)) out.push(`moved or lifted ${n('road point', moved - Math.max(0, d))}`);
  }
  const list = (L, key) => (L || []).map(key), diff = (la, lb) => [lb.filter(x => !la.includes(x)), la.filter(x => !lb.includes(x))];
  const [pAdd, pDel] = diff(list(A.pieces, q => `${q.k}@${q.s}/${q.len || ''}`), list(B.pieces, q => `${q.k}@${q.s}/${q.len || ''}`));
  if (pAdd.length) out.push(`set pieces in or changed: ${[...new Set(pAdd.map(x => x.split('@')[0]))].join(', ')}`); if (pDel.length > pAdd.length) out.push(`took out ${n('set piece', pDel.length - pAdd.length)}`);
  for (const [key, word] of [['houses', 'building'], ['props', 'tree or rock']]) {
    const [add, del] = diff(list(A[key], o => JSON.stringify(o)), list(B[key], o => JSON.stringify(o)));
    if (add.length) out.push(`placed or moved ${n(word, add.length)}`.replace('tree or rocks', 'trees and rocks')); if (del.length > add.length) out.push(`took away ${n(word, del.length - add.length)}`.replace('tree or rocks', 'trees and rocks'));
  }
  if ((B.clears || []).length > (A.clears || []).length) out.push('cleared scenery');
  const rest = s => JSON.stringify({ ...s, edits: undefined, name: undefined });
  if (a && b && rest(a) !== rest(b)) out.push('changed the track itself (its sections, look or options)');
  if (a && b && a.name !== b.name) out.push(`renamed it "${String(b.name).replace(/^✎ /, '')}"`);
  return out;
}
