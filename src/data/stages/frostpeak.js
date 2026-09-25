// Stage: Frostpeak. An alpine circuit in winter on a packed-snow road: a crest jump out of the valley, a climb along a
// cliff ledge through an avalanche shed, a tunnel through the ridge, then fast downhill sweepers glazed with ice,
// a bridge over the frozen river and a run of snowy rollers back to the start. Snow falls the whole time.
export default { name: 'Frostpeak', blurb: 'Packed snow and black ice: an avalanche shed, a ridge tunnel and a frozen river', type: 'gorge', laps: 3, seed: 2024, surface: 'snow', hillAmp: 4, jumps: 0, armco: true,
  light: { sun: 0xFFF4E8, sunI: 0.95, sky: 0xE4EEF8, ground: 0x8A96A8, hemiI: 0.75, cloud: 0.2, grade: [0.98, 1.0, 1.06], sat: 0.95, haze: { color: 0xDCE6F0, top: 0, range: 40, amt: 0.45 } },
  colors: { grassA: 0xF2F5F8, grassB: 0xDCE4EE, rock: 0x6E747E, dirt: 0xC9D2DC, road: 0xB7C1CC, sky: 0xCFDDEA, round: [0xE6ECF2, 0xD8E0EA], pine: [0x23493A, 0x2B5543, 0x1F4034] },
  trees: { density: 0.004, pine: 1 }, rocks: 0.001, bushes: 0.002, village: false, snowfall: 0.6,
  river: { pts: [[-700, 314], [-281, 72], [100, -150]], level: -8, width: 14, frozen: true },
  segs: (() => {
    const vale = { far: 3, rampF: 18, near: -2, rampN: 18 }, crest = { far: -4, rampF: 10, near: -5, rampN: 10 };
    const ledge = { far: 26, rampF: 6, near: -16, rampN: 14 }, desc = { far: 10, rampF: 16, near: -10, rampN: 20 };
    return [
      ['s', 60, 0, vale],                                                         // start
      ['a', 40, 45, 3, vale], ['s', 30, 9, { ...crest, yump: 2.6 }], ['s', 35, 5, crest],   // the crest jump
      ['a', 30, 90, 8, vale],
      ['s', 80, 16, ledge], ['s', 110, 22, { ...ledge, gallery: true }], ['s', 40, 24, ledge],   // the ledge and the avalanche shed
      ['a', 28, 90, 27, ledge],
      ['s', 90, 30, { tunnel: true, far: 30, near: 20 }],                         // through the ridge
      ['a', 50, -30, 28, desc], ['s', 20, 27, desc], ['s', 30, 24, { ...desc, ice: true }],   // icy sweepers down the far side
      ['a', 60, 20, 21, desc], ['a', 60, 25, 18, { ...desc, ice: true }], ['s', 40, 14, desc],
      ['s', 90, 12, { bridge: true }],                                            // over the frozen river
      ['a', 35, 90, 8, vale], ['s', 66, 5, { ...vale, whoops: 0.7 }],              // snowy rollers
      ['a', 40, 60, 5, vale], ['s', { toB: -5.4 }, 4, { bridge: true }],          // back over the river
      ['a', 40, -30, 2, vale], ['s', { toA: 0 }, 0, vale]
    ];
  })() };
