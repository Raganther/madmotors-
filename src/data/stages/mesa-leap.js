// Stage: Mesa Leap. Pale sandstone country: off the canyon floor, up a ramp onto the first mesa, boost pads along its
// top and a leap across the void to the second; under a stone arch, round the rim and down the far side, then the
// long run home along the canyon floor, over a crest. Behind? Stay on the floor: the wash runs straight under
// both mesas, beneath the leap, through dirt, whoops and three creek crossings, and comes out on the far side.
export default { name: 'Mesa Leap', blurb: 'Leap between mesas, or take the wash underneath through the creek', type: 'gorge', laps: 3, seed: 4747, surface: 'tarmac', hillAmp: 4, jumps: 0, armco: false,
  light: { sun: 0xFFF0D8, sunI: 1.05, sky: 0xC8E4F4, ground: 0x8A6A50, hemiI: 0.6, cloud: 0.15, grade: [1.04, 1.0, 0.96], sat: 1.1, haze: { color: 0xF0D8C0, top: 0, range: 40, amt: 0.3 } },
  colors: { grassA: 0xE2C9A2, grassB: 0xD4B58A, rock: 0xD49A74, rock2: 0xE8C0A0, dirt: 0xC49A70, dirtRoad: 0xB88A62, road: 0x5A5452, sky: 0xA8D4EC, round: [0x8A9A5A, 0x9AA066], pine: [0x5E6E44] },
  trees: { density: 0.0004, pine: 0.2 }, rocks: 0.004, bushes: 0.004, cacti: 0.003, village: false, alpine: { rock: [8, 22], snow: [900, 1000], treeLine: 900 }, strata: 2.6,
  segs: (() => {
    const floor = { far: 3, rampF: 20, near: 1, rampN: 20 }, ramp = { far: 16, rampF: 6, near: -6, rampN: 10 }, mesa = { far: 4, rampF: 5, near: -18, rampN: 4 }, rim = { far: 2, rampF: 5, near: -16, rampN: 5 };
    return [
      ['s', 80, 0, floor],                                                         // start on the canyon floor
      ['a', 35, 90, 4, floor], ['s', 60, 14, ramp], ['a', 30, -90, 20, mesa],       // up onto the first mesa
      ['s', 50, 22, { ...mesa, boost: true }], ['s', 25, 22, { ...mesa, kick: 2.3 }],
      ['s', 28, 20, { gap: true, far: -24, near: -24, rampF: 3, rampN: 3 }],        // the leap
      ['s', 48, 19, mesa], ['a', 30, -90, 18, { ...rim, arch: true }],             // land, under the arch
      ['s', 40, 16, rim], ['a', 30, 90, 14, rim], ['s', 40, 10, ramp],              // round the rim and down
      ['a', 25, -90, 6, floor], ['s', 15, 4, floor], ['a', 25, -90, 2, floor],
      ['s', { toA: 250 }, 1, floor], ['s', 26, 1, { ...floor, yump: 2.4 }], ['s', { toA: -40 }, 1, floor],   // the canyon floor home, over a crest
      ['a', 20, -90, 0, floor], ['a', 20, -90, 0, floor], ['s', { toA: 0 }, 0, floor]
    ];
  })(),
  branches: [{ from: 1, to: 14, name: 'the wash', share: 0.35, segs: (() => {
    const wash = { dirt: true, far: 5, rampF: 6, near: 5, rampN: 6 }, creek = { mud: 'water', far: -1.5, rampF: 6, near: -1.5, rampN: 6 };
    return [
      ['s', 30, -2, wash], ['a', 25, -45, -4, wash], ['s', 14, -6, wash],          // down into the wash, which winds...
      ['a', 25, 90, -8, wash], ['s', 30, -10, creek],                               // ...through the first creek...
      ['a', 25, -90, -10, wash], ['s', 30, -11, { ...wash, whoops: 0.7 }],          // ...whoops under the leap...
      ['a', 25, 90, -12, wash], ['s', 30, -12, creek], ['a', 25, -45, -12, wash],   // ...the second creek...
      ['a', 35, -1.0693, -11, wash], ['s', 69.7454, -2, { ...wash, far: 14, rampF: 5, near: 14, rampN: 5 }],   // ...and the climb out
      ['a', 35, 1.0693, 0, wash], ['a', 25, -90, 4, wash]
    ];
  })() }] };
