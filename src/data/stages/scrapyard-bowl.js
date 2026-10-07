// Stage: Scrapyard Bowl. A derby arena (core/elements/arena.js; the derby: core/modes/derby.js) in the breaker's yard
// at dusk: a lopsided dirt yard walled with stacked tyres, a car-stack island, pockets, a crusher bay up a neck,
// a mud wallow, crates and concrete to smash or hide behind, and two earth ramps to fly off. Last car running wins. The ring of track round the middle is only where the cars line up.
export default { name: 'Scrapyard Bowl', blurb: 'Derby arena: a lopsided scrapyard, a car-stack island, a crusher bay and ramps', type: 'gorge', laps: 3, seed: 7171, surface: 'gravel', hillAmp: 3, jumps: 0, armco: false,
  light: { sun: 0xFFD2A0, sunI: 0.95, sky: 0xC9B8A8, ground: 0x4A4038, hemiI: 0.6, cloud: 0.35, grade: [1.04, 0.99, 0.95], sat: 0.95, haze: { color: 0xB09880, top: 0, range: 30, amt: 0.35 } },
  colors: { grassA: 0x7A6E5A, grassB: 0x6A5E4C, rock: 0x7A5A44, rock2: 0x5E4A3E, dirt: 0x7A624C, dirtRoad: 0x7A624C, road: 0x6E5A48, sky: 0xB8A898, round: [0x6A7040, 0x5E6438], pine: [0x3A4A34, 0x44543A] },
  trees: { density: 0.0012, pine: 0.4 }, rocks: 0.004, bushes: 0.002, village: false,
  // a lopsided yard: a car-stack island in the middle to circle and ambush round, a spur and a V of tyres off the east
  // wall making pockets to pin cars in, a narrow neck up into the crusher bay (a ramp throws you in, an alley inside),
  // and an oil-soaked wallow on the west side
  arena: { ring: 'tyres',
    shape: [[-20, -38], [12, -41], [36, -31], [41, -6], [31, 8], [35, 26], [16, 36], [-6, 28], [-10, 44], [-32, 50], [-44, 32], [-24, 16], [-38, -4], [-36, -26]],
    walls: [[-8, -6, 8, -6], [8, -6, 8, 8], [8, 8, -8, 8], [-8, 8, -8, -6],      // the car stack
      [31, 8, 20, 12],                                                              // a spur off the east wall
      [24, 22, 28, 30], [24, 22, 33, 18],                                          // a V: a pocket to shove someone into
      [-22, 38, -30, 32]],                                                          // the alley in the crusher bay
    ramps: [{ a: -12, b: 22, dir: 125 }, { a: 22, b: -8, dir: 200 }], pits: [{ a: -27, b: -14, r: 7, kind: 'mud' }],
    props: [{ kind: 'crates', n: 4 }, { kind: 'concrete', n: 3 }] },
  segs: [['a', 26, 360, 0, { open: 'field' }]] };
