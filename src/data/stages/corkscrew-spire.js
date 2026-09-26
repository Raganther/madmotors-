// Stage: Corkscrew Spire. A sunset climb round a slate spire: from the start the road loops a full three-quarter turn
// up round the spire's foot (a pigtail) and crosses over its own approach on a bridge, climbs a cliff shelf to the
// summit, then zig-zags back down two hairpins. Behind? The goat track leaves at the first hairpin and plunges
// straight down the fall line in the dirt, over a crest jump and a run of whoops, to rejoin below the second.
export default { name: 'Corkscrew Spire', blurb: 'Loop up round the spire and over your own road; a goat track cuts the hairpins', type: 'gorge', laps: 3, seed: 3131, surface: 'tarmac', hillAmp: 6, jumps: 0, armco: true,
  light: { sun: 0xFFC08A, sunI: 1.05, sky: 0xF2C9A6, ground: 0x5A4A42, hemiI: 0.55, cloud: 0.2, grade: [1.08, 0.98, 0.92], sat: 1.12, haze: { color: 0xE0A884, top: -6, range: 40, amt: 0.4 } },
  colors: { grassA: 0x9A8A4E, grassB: 0x7E7040, rock: 0x6C6A70, rock2: 0x585660, dirt: 0x9A6A48, road: 0x4A4C54, sky: 0xE7B993, round: [0x7A8A3E, 0x8E7A38], pine: [0x3A5238, 0x44603E] },
  trees: { density: 0.0028, pine: 0.8 }, rocks: 0.003, bushes: 0.002, village: false, alpine: { rock: [18, 40], snow: [70, 90], treeLine: 36 },
  segs: (() => {
    const base = { far: 2, rampF: 18, near: -1, rampN: 18 }, spire = { far: 10, rampF: 10, near: -4, rampN: 14 }, shelf = { far: 18, rampF: 6, near: -14, rampN: 12 };
    const top = { far: 6, rampF: 10, near: -10, rampN: 10 }, zig = { far: 8, rampF: 12, near: -8, rampN: 12 };
    return [
      ['s', 90, 1, base],                                                         // start
      ['a', 30, 270, 12, spire],                                                  // the pigtail: round the spire's foot...
      ['s', 60, 15, { bridge: true }],                                            // ...and over your own approach
      ['a', 40, 90, 19, shelf], ['s', 60, 26, { ...shelf, rockfall: true }],     // up the cliff shelf, rocks coming down
      ['a', 40, 90, 31, shelf], ['s', 60, 37, shelf],
      ['a', 30, 90, 40, top], ['a', 30, -90, 40, top],                           // the summit
      ['s', 70, 34, zig], ['a', 30, 90, 30, zig], ['s', 60, 24, zig],            // down the far side
      ['a', 18, 180, 20, zig], ['s', 50, 17, zig], ['a', 18, -180, 14, zig],     // two hairpins
      ['s', { toA: -45 }, 9, base], ['s', { toA: -60 }, 8, base],
      ['a', 30, 90, 4, base], ['s', { toB: 30 }, 2, base], ['a', 30, 90, 1, base], ['s', { toA: 0 }, 1, base]
    ];
  })(),
  branches: [{ from: 12, to: 16, name: 'goat track', share: 0.3, segs: [
    ['s', 45, 22, { dirt: true, far: 5, rampF: 8, near: -3, rampN: 8 }],       // straight on past the hairpin, into the dirt
    ['a', 25, 90, 17, { dirt: true, whoops: 0.6, far: 4, rampF: 8, near: -3, rampN: 8 }],
    ['s', 22, 13, { dirt: true, yump: 2.2 }],                                  // over the lip
    ['a', 25, -90, 9, { mud: true, far: 3, rampF: 8, near: -3, rampN: 8 }]     // and through the bog at the bottom
  ] }] };
