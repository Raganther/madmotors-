// Stage: Highland Rally. Bogwood's recipe on a heather moor under a grey sky: a crest jump out of the start, a burn to
// splash through along the edge of the hill, a hairpin, cattle-grid whoops, an old stone bridge over a gully, a peat
// bog, a double jump, an S-bend along the edge, a second burn and a fast kink, and a last crest home. Purple heather
// and yellow gorse to the skyline.
export default { name: 'Highland Rally', blurb: 'Moorland dirt: heather, a stone bridge, burns to splash through and a peat bog', type: 'gorge', laps: 3, seed: 7373, surface: 'gravel', hillAmp: 6, jumps: 0, armco: false, viaduct: true,
  light: { sun: 0xFFF4E4, sunI: 1.02, sky: 0xE2E8EE, ground: 0x6E6A5A, hemiI: 0.74, cloud: 0.45, grade: [1.0, 1.0, 1.02], sat: 1.12, haze: { color: 0xD4DAE0, top: 0, range: 40, amt: 0.25 } },
  colors: { grassA: 0x8FA35C, grassB: 0x9A7AA0, rock: 0x9C9A92, dirt: 0x7A5E48, road: 0x9A8062, sky: 0xD2DCE6, round: [0x8E5E92, 0xA77AA8, 0xC9A23A, 0x7A5A80], pine: [0x2F4A34, 0x36533A] },
  trees: { density: 0.0012, pine: 0.7 }, rocks: 0.0028, bushes: 0.006, village: false,
  segs: (() => {
    const moor = { far: 4, rampF: 16, near: -2, rampN: 16 }, crest = { far: -4, rampF: 10, near: -6, rampN: 10 }, dip = { far: 2, rampF: 12, near: 1, rampN: 12 };
    const bank = { far: 7, rampF: 12, near: -4, rampN: 12 }, edge = { far: 9, rampF: 10, near: -12, rampN: 8 }, burn = { far: 6, rampF: 8, near: -8, rampN: 8, mud: 'water' };
    const gully = { bridge: true, far: -7, rampF: 5, near: -7, rampN: 5 };
    return [
      ['s', 50, 10, moor],                                                         // start
      ['a', 45, 60, 14, moor], ['s', 30, 18, { ...crest, yump: 3 }],               // up to the crest...
      ['s', 36, 12, crest], ['a', 30, -50, 9, edge],                               // ...off it, onto the edge of the hill
      ['s', 40, 6, burn],                                                          // the burn
      ['a', 22, 150, 5, bank],                                                     // hairpin
      ['s', 50, 4, { ...dip, whoops: 0.6 }],                                       // the cattle grids
      ['a', 35, -40, 4, moor], ['s', 20, 6, moor], ['s', 30, 7, gully], ['s', 20, 6, moor],   // over the old stone bridge
      ['s', 40, 3, { ...dip, mud: true }],                                         // the peat bog
      ['a', 34, 80, 5, bank],
      ['s', 22, 7, { ...moor, yump: 2.5 }], ['s', 22, 7, moor], ['s', 22, 7, { ...moor, yump: 2.5 }],   // double jump
      ['a', 28, -45, 8, edge], ['a', 28, 45, 9, bank],                             // the S along the edge
      ['a', 40, 70, 10, moor], ['s', 30, 9, moor], ['s', 34, 6, burn], ['s', 22, 8, moor],   // the second burn
      ['a', 45, 22, 9, bank], ['a', 45, -22, 10, moor],                            // a fast kink
      ['s', { toB: 30 }, 10, moor], ['a', 30, 90, 10, moor], ['s', { toA: 0 }, 10, { ...moor, yump: 2.4 }]   // a last crest home
    ];
  })() };
