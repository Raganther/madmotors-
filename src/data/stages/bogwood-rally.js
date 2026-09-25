// Stage: Bogwood Rally. An autumn forest rally on dirt, built for air and mess: crest jumps ('kick'), a run of
// whoops, mud bogs and a water splash ('mud'), and a double jump and a muddy S-bend back to the start.
export default { name: 'Bogwood Rally', blurb: 'Forest dirt: crest jumps, whoops, mud bogs and a water splash', type: 'gorge', laps: 3, seed: 777, surface: 'gravel', hillAmp: 5, jumps: 0, armco: false,
  light: { sun: 0xFFE0B0, sunI: 1.0, sky: 0xE8DCC8, ground: 0x5A4A32, hemiI: 0.6, cloud: 0.3, grade: [1.05, 0.99, 0.92], sat: 1.1, haze: { color: 0xD9C4A0, top: -4, range: 26, amt: 0.3 } },
  colors: { grassA: 0x7E7A3E, grassB: 0x6A6634, rock: 0x857B6C, dirt: 0x8A6440, road: 0x9A7650, sky: 0xE6D6BC, round: [0xC8742A, 0xD9A03A, 0xB0502A, 0x8E8A3A], pine: [0x3E5A36, 0x486640, 0x34502E] },
  trees: { density: 0.009, pine: 0.45 }, rocks: 0.002, bushes: 0.003, village: false,
  segs: (() => {
    const wood = { far: 3, rampF: 16, near: -2, rampN: 16 }, crest = { far: -4, rampF: 10, near: -6, rampN: 10 }, dip = { far: 2, rampF: 12, near: 1, rampN: 12 };
    const bank = { far: 7, rampF: 12, near: -5, rampN: 12 }, creek = { far: -1.5, rampF: 6, near: -1.5, rampN: 6 };
    return [
      ['s', 70, 10, wood],                                                        // start
      ['a', 40, 45, 13, wood], ['s', 30, 17, { ...crest, kick: 2.4 }],             // up to the crest...
      ['s', 40, 9, crest], ['a', 30, 45, 7, wood],                                 // ...and yump off it
      ['s', 66, 5, { ...dip, whoops: 0.8 }],                                       // the whoops
      ['a', 22, -60, 3, bank], ['a', 22, 150, 1, bank],                            // kink and hairpin
      ['s', 45, -2, { ...dip, mud: true }], ['a', 35, -45, -1, { ...dip, mud: true }],   // the bog
      ['s', 30, 2, wood], ['s', 25, 2, { ...crest, kick: 2.8 }], ['s', 35, -4, crest],   // big jump
      ['a', 30, 45, -6, wood], ['s', 34, -8, { ...creek, mud: 'water' }], ['s', 30, -4, wood],   // the water splash
      ['a', 40, 90, 0, bank],
      ['s', 20, 3, { ...wood, kick: 2.2 }], ['s', 22, 3, wood], ['s', 20, 3, { ...wood, kick: 2.2 }],   // double jump
      ['s', 40, 6, wood], ['a', 25, 40, 5, bank], ['a', 25, -40, 4, { ...dip, mud: true }],   // a muddy S-bend...
      ['s', { toB: 30 }, 6, wood], ['a', 30, 90, 8, wood], ['s', { toA: 0 }, 10, { ...wood, kick: 2 }]   // ...and a last jump home
    ];
  })() };
