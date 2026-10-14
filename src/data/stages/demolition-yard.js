// Stage: Demolition Yard. A Demolition arena (core/modes/demolition.js; buildings: core/elements/structures.js): a
// condemned estate walled in with concrete, two minutes on the clock, and every building in it worth points. In the
// middle a market square (a shop and four stalls) inside the ring road the cars line up on; round the outside a ring of
// cottages, houses, a terrace, a chapel, a barn, a warehouse and a block of flats. Light cars crack walls and take the
// stalls and sheds; heavy ones drive in one side and out the other and bring the big ones down. Rubble stays where
// it falls, so the yard fills up as the fight goes on. Two earth ramps and a mud wallow between the houses.
export default { name: 'Demolition Yard', blurb: 'Demolition: two minutes to knock down a condemned estate. Heavy cars go through walls, light ones crack them', type: 'gorge', laps: 3, seed: 5353, surface: 'gravel', hillAmp: 2, jumps: 0, armco: false,
  light: { sun: 0xFFE6C4, sunI: 1.0, sky: 0xD4D0C8, ground: 0x625A4E, hemiI: 0.62, cloud: 0.3, grade: [1.03, 1.0, 0.96], sat: 0.97, haze: { color: 0xC8BCA8, top: 0, range: 40, amt: 0.25 } },
  colors: { grassA: 0x8C8466, grassB: 0x7C7458, rock: 0x9A9488, rock2: 0x7E786C, dirt: 0x9A8462, dirtRoad: 0x9A8462, road: 0x8E7A5C, sky: 0xC8D0D8, round: [0x6E8A48, 0x7A9450], pine: [0x4A6A3A] },
  trees: { density: 0.0008, pine: 0.3 }, rocks: 0.001, bushes: 0.0015, village: false,
  demolition: { time: 120 },
  arena: { ring: 'barrier',
    shape: [[70, 0], [49, 49], [0, 70], [-49, 49], [-70, 0], [-49, -49], [0, -70], [49, -49]],
    ramps: [{ a: 20, b: 58, dir: 200 }, { a: -58, b: -22, dir: 80 }], pits: [{ a: -28, b: 54, r: 6, kind: 'mud' }],
    props: [{ kind: 'crates', n: 3 }] },
  buildings: [
    // the market square inside the ring
    { type: 'shop', a: 0, b: 2, face: 270 }, { type: 'stall', a: -11, b: -8, face: 225 }, { type: 'stall', a: 11, b: -8, face: 315 }, { type: 'stall', a: -12, b: 10, face: 135 }, { type: 'stall', a: 12, b: 10, face: 45 },
    // the estate round the outside, facing in (the grid's corner, lower right, is left clear)
    { type: 'house', a: 45.4, b: 12.2, face: 195 }, { type: 'cottage', a: 33.2, b: 33.2, face: 225 }, { type: 'shop', a: 12.2, b: 45.4, face: 255 },
    { type: 'barn', a: -12.9, b: 48.3, face: 285 }, { type: 'terrace', a: -33.2, b: 33.2, face: 315 }, { type: 'chapel', a: -45.4, b: 12.2, face: 345 },
    { type: 'warehouse', a: -48.3, b: -12.9, face: 15 }, { type: 'house', a: -33.2, b: -33.2, face: 45 }, { type: 'cottage', a: -12.2, b: -45.4, face: 75 },
    { type: 'shed', a: 12.2, b: -45.4, face: 105 }, { type: 'flats', a: 48.3, b: -12.9, face: 165 }
  ],
  segs: [['a', 26, 360, 0, { open: 'field' }]] };
