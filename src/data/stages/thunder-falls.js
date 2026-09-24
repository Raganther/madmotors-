// Stage: Thunder Falls. A logging-river canyon built from track elements: right-angle turns and a chicane out of the
// sawmill yard, two corkscrews that dive under their own bridges, boost pads into a jump over the river gorge
// (`gap`), and a barge (`ferry`) back across the river: everyone waits for it and rides over together. Off the barge
// the road splits (`branches`): the main road climbs the S-bend over a crest kicker, short and steep; the low road
// runs west along the river, under the waterfall (`falls`), and climbs back through the woods to merge before the yard.
export default { name: 'Thunder Falls', blurb: 'Corkscrews, a gorge jump, a barge, then pick a road: kicker or waterfall', type: 'gorge', laps: 2, seed: 5151, surface: 'tarmac', hillAmp: 4, jumps: 0, armco: true,
  light: { sun: 0xFFE2BE, sunI: 1.0, sky: 0xD4E6F5, ground: 0x4F5A42, hemiI: 0.58, cloud: 0.26, grade: [1.03, 1.0, 0.97], sat: 1.08, haze: { color: 0xA9C4D8, top: -10, range: 30, amt: 0.45 } },
  colors: { grassA: 0x6E9E4B, grassB: 0x4F8040, rock: 0x8A887F, dirt: 0x8F7352, road: 0x50545C, sky: 0xB3D8E3, round: [0x4F8A3F, 0x5E9A45], pine: [0x2F6A3E, 0x3A7646, 0x285E38, 0x44804C] },
  trees: { density: 0.006, pine: 0.9 }, rocks: 0.0016, bushes: 0.002, village: false,
  river: { pts: [[-500, -228], [-150, -240], [60, -235], [300, -238], [600, -230]], level: -34, width: 34, logs: 9 },
  segs: (() => {
    const yard = { far: 2, rampF: 20, near: 1, rampN: 20 }, bank = { far: 8, rampF: 14, near: -6, rampN: 14 }, lip = { far: -30, rampF: 4, near: -30, rampN: 4 };
    return [
      ['s', 80, 20, { ...yard, mill: true }],                                    // sawmill yard: start / finish
      ['a', 12, -90, 20, yard], ['s', 25, 19, bank],                             // right-angle right
      ['a', 22, 40, 18, { ...bank, logs: true }], ['a', 22, -80, 17, { ...bank, logs: true }], ['a', 22, 40, 16, { ...bank, logs: true }], // chicane between the log piles
      ['s', 20, 16, bank], ['a', 12, 90, 16, bank],                              // right-angle left
      ['s', 20, 16, bank], ['s', 45, 16, { bridge: true }],                      // corkscrew 1: over the bridge...
      ['a', 26, 270, 3, bank], ['s', 40, 1, bank],                               // ...round and down, and under it
      ['s', 24, 1, { drawbridge: 5, far: -10, rampF: 3, near: -10, rampN: 3 }], ['s', 6, 1, bank],   // THE DRAWBRIDGE over the mill race
      ['s', 30, 1, { ...bank, boost: true }], ['s', 20, 1, { ...lip, kick: 3, boost: true }],
      ['s', 30, -5, { gap: true, far: -40, rampF: 3, near: -40, rampN: 3 }],    // THE GAP: over the river gorge
      ['s', 40, -6, { far: -12, rampF: 6, near: -12, rampN: 6 }],
      ['a', 12, -90, -6, bank], ['s', 90, -6, bank],                             // right-angle right
      ['s', 45, -6, { bridge: true }], ['a', 26, 270, -22, bank],               // corkscrew 2: round and down, and under it
      ['s', 65, -31, { far: 6, rampF: 10, near: -2, rampN: 8 }],                  // down the slipway to the river
      ['s', 56, -31, { ferry: true, far: -14, rampF: 3, near: -14, rampN: 3 }],  // THE BARGE across the river
      ['s', 12, -31, { far: 2, rampF: 8, near: 0, rampN: 8 }],
      ['a', 55, 28, -22, bank], ['a', 55, -28, -12, bank],                        // climb out of the gorge: an S-bend...
      ['s', 20, -8, { ...bank, kick: 2.2 }], ['s', { toB: -100 }, 8, bank],     // ...and a crest kicker
      ['a', 25, 90, 10, bank], ['s', { toA: -40 }, 12, bank], ['a', 25, -90, 14, yard],
      ['s', { toB: -25 }, 18, yard], ['a', 25, -90, 20, yard], ['s', { toA: 0 }, 20, yard]
    ];
  })(),
  branches: (() => {
    const shore = { far: 12, rampF: 10, near: -4, rampN: 12 }, cliff = { far: 26, rampF: 8, near: -4, rampN: 12 }, woods = { far: 6, rampF: 14, near: 3, rampN: 14 };
    return [{ from: 25, to: 34, name: 'low road', share: 0.45, segs: [
      ['a', 30, 90, -24, shore], ['s', { toA: -25 }, -28, { ...shore, boost: true }], // off the dock, over a hump beside the S-bend, down to the river
      ['s', 40, -24, { ...cliff, falls: true, boost: true }],                     // under the waterfall
      ['a', 30, -90, -19, woods], ['s', 30, -14, { ...woods, boost: true }], ['s', { toB: -20.18 }, 6, woods],   // boost up through the woods
      ['a', 25, -90, 12, woods], ['s', { toA: -67.36 }, 12.5, woods],
      ['a', 40, -20, 16.5, woods], ['a', 40, 20, 20, woods]                        // and into the merge
    ] }];
  })() };
