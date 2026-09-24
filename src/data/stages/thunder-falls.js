// Stage: Thunder Falls. A logging-river canyon built from track elements: right-angle turns and a chicane out of the
// sawmill yard, two corkscrews that dive under their own bridges, boost pads into a jump over the river gorge
// (`gap`), and a low bridge back across the river.
export default { name: 'Thunder Falls', blurb: 'Corkscrews, chicanes and a jump over the river gorge', type: 'gorge', laps: 2, seed: 5151, surface: 'tarmac', hillAmp: 4, jumps: 0, armco: true,
  light: { sun: 0xFFE2BE, sunI: 1.0, sky: 0xD4E6F5, ground: 0x4F5A42, hemiI: 0.58, cloud: 0.26, grade: [1.03, 1.0, 0.97], sat: 1.08, haze: { color: 0xA9C4D8, top: -10, range: 30, amt: 0.45 } },
  colors: { grassA: 0x6E9E4B, grassB: 0x4F8040, rock: 0x8A887F, dirt: 0x8F7352, road: 0x50545C, sky: 0xB3D8E3, round: [0x4F8A3F, 0x5E9A45], pine: [0x2F6A3E, 0x3A7646, 0x285E38, 0x44804C] },
  trees: { density: 0.006, pine: 0.9 }, rocks: 0.0016, bushes: 0.002, village: false,
  river: { pts: [[-500, -228], [-150, -240], [60, -233], [300, -238], [600, -230]], level: -34, width: 16 },
  segs: (() => {
    const yard = { far: 2, rampF: 20, near: 1, rampN: 20 }, bank = { far: 8, rampF: 14, near: -6, rampN: 14 }, lip = { far: -30, rampF: 4, near: -30, rampN: 4 };
    return [
      ['s', 80, 20, yard],                                                       // sawmill yard: start / finish
      ['a', 12, -90, 20, yard], ['s', 25, 19, bank],                             // right-angle right
      ['a', 22, 40, 18, bank], ['a', 22, -80, 17, bank], ['a', 22, 40, 16, bank], // chicane
      ['s', 20, 16, bank], ['a', 12, 90, 16, bank],                              // right-angle left
      ['s', 20, 16, bank], ['s', 45, 16, { bridge: true }],                      // corkscrew 1: over the bridge...
      ['a', 26, 270, 3, bank], ['s', 70, 1, bank],                               // ...round and down, and under it
      ['s', 30, 1, { ...bank, boost: true }], ['s', 20, 1, { ...lip, kick: 3, boost: true }],
      ['s', 30, -5, { gap: true, far: -40, rampF: 3, near: -40, rampN: 3 }],    // THE GAP: over the river gorge
      ['s', 40, -6, { far: -12, rampF: 6, near: -12, rampN: 6 }],
      ['a', 12, -90, -6, bank], ['s', 90, -6, bank],                             // right-angle right
      ['s', 45, -6, { bridge: true }], ['a', 26, 270, -18, bank],               // corkscrew 2: round and down, and under it
      ['s', 40, -18, bank], ['s', 60, -17, { bridge: true }],                    // low bridge back over the river
      ['a', 55, 28, -12, bank], ['a', 55, -28, -6, bank],                         // climb out of the gorge: an S-bend...
      ['s', 20, -3, { ...bank, kick: 2.2 }], ['s', { toB: -100 }, 8, bank],     // ...and a crest kicker
      ['a', 25, 90, 10, bank], ['s', { toA: -40 }, 12, bank], ['a', 25, -90, 14, yard],
      ['s', { toB: -25 }, 18, yard], ['a', 25, -90, 20, yard], ['s', { toA: 0 }, 20, yard]
    ];
  })() };
