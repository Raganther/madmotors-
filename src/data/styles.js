// Town styles for the world kit (core/kit/layout.js lays a town out, render/elements/kit.js draws it). A style is
// only data: what its houses look like, how big a plot is, what bounds a garden, what closes a side road, what stands
// on the pavement. The layout rules are the same for every style, so a new style is a new entry here, nothing more.
//   houses   walls / roofs: colour lists; roof: 'gable' | 'steep' | 'hip' | 'flat'; floors [min, max]; w, d: footprint
//            ranges (m, w along the street); barn: chance a plot has a barn or shed behind instead of a garden tree
//   plot     w: frontage along the road [min, max]; d: depth back from the pavement; gap: chance a plot is left empty
//   bound    what runs along the front and sides of each plot: picket | wall | hedge | railing | chain | none
//   gate     the gate in it at the drive (a breakable kind, data/breakables.js)
//   drive    the drive's colour; side: a side road every n plots, len m long, closed at the end by `end` (breakable)
//   street   pavement furniture: lamp every n m, and the odd bin, bench, postbox (chances per plot)
//   garden   ground colour of the plots; tree: chance of a garden tree (colour from the stage's round trees)
export const STYLES = {
  village: {
    name: 'Village', houses: { walls: [0xF3EBDD, 0xE9D3B4, 0xD9C7A3, 0xBFA58A, 0xE7E0CF], roofs: [0x5B4A3E, 0x6E5A48, 0x8C3B2E, 0x4B5563], roof: 'gable', floors: [1, 2], w: [7, 10], d: [6, 8], barn: 0.15 },
    plot: { w: [16, 22], d: [20, 26], gap: 0.1 }, bound: 'hedge', boundSide: 'wall', gate: 'yardgate', drive: 0xB9AE98,
    side: { every: 5, len: 30, end: 'gate' }, street: { lamp: 36, bin: 0.25, bench: 0.15, postbox: 0.1 }, garden: 0x6E9B4A, tree: 0.5
  },
  alpine: {
    name: 'Alpine', houses: { walls: [0xF6F4EE, 0xEDE6D8, 0x8A5E3B, 0x9C6B42], roofs: [0x3A3F47, 0x4B4038, 0x5E6B5A], roof: 'steep', floors: [2, 3], w: [8, 11], d: [8, 10], barn: 0.25 },
    plot: { w: [20, 26], d: [22, 28], gap: 0.15 }, bound: 'picket', boundSide: 'picket', gate: 'yardgate', drive: 0x9A958A,
    side: { every: 4, len: 26, end: 'fence' }, street: { lamp: 40, bin: 0.15, bench: 0.2, postbox: 0.08 }, garden: 0x6F9A55, tree: 0.6
  },
  seaside: {
    name: 'Seaside', houses: { walls: [0xF6F4EE, 0xBFE0EE, 0xF4D7DA, 0xF7E7B0, 0xCDE8D2, 0xE8E0F2], roofs: [0x4B5563, 0x6B7280, 0x8C3B2E, 0x2F5D7A], roof: 'gable', floors: [2, 2], w: [6, 8], d: [7, 9], barn: 0 },
    plot: { w: [12, 15], d: [16, 20], gap: 0.05 }, bound: 'railing', boundSide: 'picket', gate: 'yardgate', drive: 0xCFC6B4,
    side: { every: 6, len: 22, end: 'crates' }, street: { lamp: 28, bin: 0.35, bench: 0.35, postbox: 0.12 }, garden: 0x86AE63, tree: 0.2
  },
  farm: {
    name: 'Farm', houses: { walls: [0xF3EBDD, 0xD4C4A8, 0xE9D3B4], roofs: [0x5B4A3E, 0x8C3B2E, 0x4B5563], roof: 'gable', floors: [1, 2], w: [8, 11], d: [7, 9], barn: 0.9 },
    plot: { w: [34, 44], d: [30, 38], gap: 0.2 }, bound: 'picket', boundSide: 'hedge', gate: 'gate', drive: 0x9C8466,
    side: { every: 3, len: 34, end: 'hay' }, street: { lamp: 0, bin: 0.1, bench: 0, postbox: 0.15 }, garden: 0x7FA14E, tree: 0.7
  },
  desert: {
    name: 'Desert', houses: { walls: [0xD9A877, 0xC98E5F, 0xE3C29A, 0xCFA27A], roofs: [0xB98A63, 0xA97C55], roof: 'flat', floors: [1, 2], w: [7, 10], d: [7, 9], barn: 0.2 },
    plot: { w: [18, 24], d: [18, 24], gap: 0.25 }, bound: 'wall', boundSide: 'wall', gate: 'yardgate', drive: 0xC9A77E,
    side: { every: 4, len: 28, end: 'crates' }, street: { lamp: 48, bin: 0.1, bench: 0.05, postbox: 0 }, garden: 0xC9A06A, tree: 0.15
  },
  industrial: {
    name: 'Industrial', houses: { walls: [0x9CA3AB, 0xB7B2A6, 0x7E8790, 0xC2B59B], roofs: [0x4B5563, 0x5E6670, 0x6B4A3A], roof: 'flat', floors: [2, 3], w: [14, 20], d: [12, 16], barn: 0.5 },
    plot: { w: [28, 36], d: [26, 32], gap: 0.1 }, bound: 'chain', boundSide: 'chain', gate: 'gate', drive: 0x7C7A75,
    side: { every: 3, len: 32, end: 'concrete' }, street: { lamp: 32, bin: 0.3, bench: 0, postbox: 0 }, garden: 0x8A8778, tree: 0.05
  },
};
export const STYLE_IDS = Object.keys(STYLES);
