// Stage: Mud Pit. A derby arena (core/elements/arena.js) on the farm: a churned mud field walled with hay bales, a hedge
// of bales splitting it into two lobes, two mud wallows and a duck pond, more bales and fences, and a ramp over the
// pond. Slow, sideways and heavy: the trucks love it.
export default { name: 'Mud Pit', blurb: 'Derby arena: a kidney-shaped farm field, mud wallows, a pond to jump', type: 'gorge', laps: 3, seed: 7272, surface: 'gravel', hillAmp: 2.5, jumps: 0, armco: false, soft: true,
  light: { sun: 0xFFEBC4, sunI: 1.05, sky: 0xF0EAD8, ground: 0x7A6E48, hemiI: 0.62, cloud: 0.3, grade: [1.04, 1.0, 0.94], sat: 1.1 },
  colors: { grassA: 0xC2B85E, grassB: 0xA8A04E, rock: 0x9A8E78, dirt: 0x6E5238, dirtRoad: 0x6E5238, road: 0x6E5238, sky: 0xE8E0C8, round: [0x6E9A3E, 0x84A848, 0x9AB04E], pine: [0x4A6A3A] },
  trees: { density: 0.002, pine: 0.1 }, rocks: 0.0006, bushes: 0.003, village: false,
  // a kidney of a field: two lobes split by a hedge of bales, two deep mud wallows and a duck pond, and a ramp that
  // jumps the pond (or drops you in it)
  arena: { ring: 'bales',
    shape: [[-30, -38], [0, -43], [30, -37], [42, -14], [40, 10], [28, 30], [6, 38], [-6, 24], [-14, 22], [-22, 42], [-40, 36], [-47, 8], [-43, -18]],
    walls: [[-10, 23, -9, 6], [18, -2, 29, 4]],
    ramps: [{ a: -6, b: -17, dir: 190 }], pits: [{ a: -27, b: 14, r: 9, kind: 'mud' }, { a: 12, b: 12, r: 7, kind: 'mud' }, { a: -23, b: -22, r: 6, kind: 'water' }],
    props: [{ kind: 'hay', n: 5 }, { kind: 'fence', n: 3 }] },
  segs: [['a', 28, 360, 0, { open: 'field' }]] };
