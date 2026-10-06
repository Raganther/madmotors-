// Stage: Village Green. The last Rookie round: a figure of eight round the village fete. Two easy loops of wide
// corners, joined where the road crosses itself: once underneath, once over the old stone bridge. Long straights
// either side of the crossing give the ? crates room to work, so it's the round for learning the weapons.
export default { name: 'Village Green', blurb: 'Rookie: a figure of eight round the village fete, over its own stone bridge', type: 'gorge', laps: 3, seed: 4404, surface: 'tarmac', hillAmp: 2, jumps: 0, armco: false, soft: true, viaduct: true,
  startHeading: Math.PI * 3 / 4,
  light: { sun: 0xFFF2D6, sunI: 1.04, sky: 0xE6F0FA, ground: 0x6E7E52, hemiI: 0.63, cloud: 0.3, grade: [1.02, 1.0, 0.98], sat: 1.12 },
  colors: { grassA: 0x86BE56, grassB: 0x6EA848, rock: 0xB0A894, dirt: 0xB79C72, road: 0x585C64, sky: 0xC4E2F2, round: [0x4E8E3E, 0x62A246, 0x7AB24E], pine: [0x3E6E46] },
  trees: { density: 0.0026, pine: 0.2 }, rocks: 0.0004, bushes: 0.003, towns: [{ style: 'village', at: 300, len: 450 }],
  segs: (() => {
    const green = { far: 0.5, rampF: 30, near: -0.5, rampN: 30 };
    return [
      ['s', 25, 0, green],                                                    // start on the green
      ['a', 45, 90, 0, green], ['s', 50, 1, green], ['a', 45, 90, 2, green],    // the north loop
      ['s', 80, 9, green], ['s', 30, 9, { bridge: true }], ['s', 80, 0, green], // up over the stone bridge and down
      ['a', 45, -90, 0, green], ['s', 50, 0, green], ['a', 45, -90, 0, green], ['s', 50, 0, green], ['a', 45, -90, 0, green],   // the south loop
      ['s', 190, 0, green],                                                   // under the bridge
      ['a', 45, 90, 0, green], ['s', 25, 0, green]
    ];
  })() };
