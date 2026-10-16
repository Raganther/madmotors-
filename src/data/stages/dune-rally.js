// Stage: Dune Rally. Bogwood's recipe in the desert: a short dirt lap where something happens every few seconds. A
// crest jump off the first dune, a kink into washboard whoops, a hairpin round a red rock and through its arch, a
// splash through the oasis, a double jump over the dunes, an S through the scrub, a mud wallow and a fast kink, and a
// last crest home.
export default { name: 'Dune Rally', blurb: 'Desert dirt: dune jumps, washboard, a rock arch and an oasis splash', type: 'gorge', laps: 3, seed: 6161, surface: 'gravel', hillAmp: 4, jumps: 0, armco: false,
  light: { sun: 0xFFDDB0, sunI: 1.08, sky: 0xFFEBD0, ground: 0x8E6A44, hemiI: 0.58, cloud: 0.1, grade: [1.06, 1.0, 0.92], sat: 1.12, haze: { color: 0xEFC89A, top: 0, range: 34, amt: 0.32 } },
  colors: { grassA: 0xE2B47A, grassB: 0xD4A066, rock: 0xB8603E, rock2: 0xD8875A, dirt: 0xD9A86E, road: 0xC08A58, sky: 0xF6D6AE, round: [0x8C9450, 0x9AA25A, 0x7C8646], pine: [0x6E7F45] },
  trees: { density: 0.0007, pine: 0 }, rocks: 0.0035, bushes: 0.004, cacti: 0.0026, village: false,
  alpine: { rock: [10, 30], snow: [900, 1000], treeLine: 900 }, strata: 2.4,
  segs: (() => {
    const dune = { far: 4, rampF: 14, near: -2, rampN: 14 }, crest = { far: -4, rampF: 10, near: -5, rampN: 10 }, dip = { far: 2, rampF: 12, near: 1, rampN: 12 };
    const bank = { far: 7, rampF: 12, near: -4, rampN: 12 }, oasis = { far: -1.5, rampF: 6, near: -1.5, rampN: 6 }, arch = { arch: true, far: 18, rampF: 6, near: 2, rampN: 10 };
    return [
      ['s', 60, 6, dune],                                                          // start
      ['a', 35, 50, 9, dune], ['s', 28, 13, { ...crest, yump: 3 }],                // up the first dune...
      ['s', 36, 7, crest], ['a', 26, -70, 5, bank],                                // ...off it, and a kink right
      ['s', 60, 4, { ...dip, whoops: 0.7 }],                                       // washboard
      ['a', 20, 160, 3, bank], ['s', 40, 1, arch],                                 // the hairpin round the red rock, and through its arch
      ['a', 36, -40, 0, dune], ['s', 32, -3, { ...oasis, mud: 'water' }], ['s', 26, -1, dune],   // the oasis splash
      ['s', 22, 2, { ...dune, yump: 2.6 }], ['s', 22, 2, dune], ['s', 22, 2, { ...dune, yump: 2.6 }],   // double jump over the dunes
      ['a', 32, 90, 4, bank], ['s', 55, 7, dune], ['s', 25, 9, { ...crest, yump: 2 }], ['s', 35, 7, crest],   // a small crest on the way out
      ['a', 28, 50, 8, bank], ['a', 28, -50, 7, dip],                              // the S through the scrub
      ['a', 40, 80, 6, dune], ['s', 25, 5, dune], ['s', 36, 3, { ...dip, mud: true }],                   // the mud wallow
      ['a', 40, 25, 4, bank], ['a', 40, -25, 5, bank],                            // a fast kink
      ['s', { toB: 30 }, 6, dune], ['a', 30, 90, 6, dune], ['s', { toA: 0 }, 6, { ...dune, yump: 2.4 }]   // a last crest home
    ];
  })() };
