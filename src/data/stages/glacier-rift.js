// Stage: Glacier Rift. Blue hour on a glacier: from the start the road climbs over its own return leg on a short
// bridge, through an ice cave in the ridge, and leaps the crevasse off a kicker; then a long descent on black ice and
// home round the frozen lake's shore. Behind? Go straight across the lake: shorter, but every metre of it is ice.
export default { name: 'Glacier Rift', blurb: 'Ice cave, a crevasse leap, black ice, and a shortcut across the frozen lake', type: 'gorge', laps: 3, seed: 8181, surface: 'snow', hillAmp: 5, jumps: 0, armco: true, snowfall: 0.8,
  light: { sun: 0xC8D8FF, sunI: 0.8, sky: 0x9AB4DC, ground: 0x5A6A88, hemiI: 0.85, cloud: 0.25, grade: [0.92, 0.98, 1.1], sat: 0.9, haze: { color: 0xA8BEE0, top: 0, range: 35, amt: 0.5 } },
  colors: { grassA: 0xE8F0F8, grassB: 0xCCDCEC, rock: 0x5A6878, rock2: 0x7890A8, dirt: 0xB8C8DA, road: 0xAAB8C8, sky: 0x8AA8D4, round: [0xD8E2EE, 0xC8D4E4], pine: [0x1E3A40, 0x244650] },
  trees: { density: 0.002, pine: 1 }, rocks: 0.002, bushes: 0.002, village: false,
  river: { pts: [[252, 52], [180, 50], [98, 52]], level: 0.2, width: 30, frozen: true },
  segs: (() => {
    const base = { far: 3, rampF: 16, near: -1, rampN: 16 }, climb = { far: 10, rampF: 8, near: -4, rampN: 12 }, ridge = { far: 16, rampF: 8, near: -12, rampN: 8 };
    const shore = { far: 2, rampF: 10, near: 1, rampN: 10 };
    return [
      ['s', 70, 0, base], ['a', 35, 90, 4, base],                                   // start
      ['s', 15, 7, climb], ['s', 20, 11, { bridge: true }], ['s', 45, 14, climb],  // up over your own return leg
      ['s', 70, 18, { tunnel: true, far: 24, near: 18 }],                           // the ice cave
      ['a', 35, -90, 20, ridge], ['s', 28, 21, ridge], ['s', 12, 21, { ...ridge, kick: 2.6 }],   // the kicker right at the lip
      ['s', 22, 19, { gap: true, far: -24, near: -24, rampF: 3, rampN: 3 }],        // over the crevasse
      ['s', 44, 18, ridge], ['a', 30, -90, 16, ridge],
      ['s', 100, 6, { ...climb, ice: true }],                                       // black ice all the way down
      ['a', 30, -90, 3, base], ['s', 10, 1, shore],
      ['a', 40, 45, 1, shore], ['s', 20, 1, shore], ['a', 40, -90, 1, shore], ['s', 20, 1, shore], ['a', 40, 45, 1, shore],   // round the lake shore
      ['s', { toA: -40 }, 1, base], ['a', 25, 90, 0.5, base], ['s', { toB: 25 }, 0, base], ['a', 25, 90, 0, base], ['s', { toA: 0 }, 0, base]
    ];
  })(),
  branches: [{ from: 15, to: 20, name: 'across the lake', share: 0.35, segs: [['s', 141.42, 1, { ice: true, far: 0, rampF: 20, near: 0, rampN: 20 }]] }] };
