// Stage: Ravenrock Gorge
export default { name: 'Ravenrock Gorge', traffic: { on: 0, with: 2 }, blurb: 'Viaducts over a river gorge and a cliff-edge ledge', type: 'gorge', laps: 2, seed: 913, surface: 'tarmac', hillAmp: 5, jumps: 1, armco: true, viaduct: true,
  startHeading: Math.PI,
  light: { sun: 0xFFF1DE, sunI: 1.0, sky: 0xDCEBFF, ground: 0x5A6A5A, hemiI: 0.6, cloud: 0.26, grade: [1.0, 1.0, 1.03], sat: 1.1, haze: { color: 0x9DB8D2, top: 0, range: 45, amt: 0.5 } },
  colors: { grassA: 0x8DBD58, grassB: 0x68A046, rock: 0x9A958A, dirt: 0xA88B66, road: 0x4F535B, sky: 0xAFD6EA, round: [0x5E9C45, 0x74B04E], pine: [0x2F6A3E, 0x3A7646, 0x285E38, 0x44804C] },
  trees: { density: 0.0027, pine: 0.85 }, rocks: 0.0012, bushes: 0.0012, village: false, alpine: { rock: [38, 80], snow: [88, 120], treeLine: 70 },
  river: { pts: [[-900, 118], [-560, 134], [-250, 126], [0, 132], [260, 124], [700, 136]], level: -40, width: 20 },
  // valley line: level crossing just after the start, then under the road bridge before the finish
  // mountain line: out of the mountain, across the plateau, along behind its guard rail and back across into the mountain
  rails: [
    { id: 'valley', pts: [[-640, 42, 0], [720, 42, 0]], speed: 30, cars: 4, body: 0xC0392B, coach: 0xEFE3C8, band: 0x7A2230 },
    { id: 'mountain', pts: [[70, 620, 61.6], [-90, 392, 61.6], [-230, 392, 62.9], [-390, 620, 62.9]], round: 40, portals: true, speed: 24, cars: 2, body: 0x2F5FA8, coach: 0xF2C230, band: 0x1C2340 }
  ],
  segs: (() => {
    const town = { far: -2, rampF: 40, near: 1, rampN: 30, town: true }, leg = { far: 14, rampF: 10, near: -12, rampN: 14 };
    const ledge = { far: 44, rampF: 5, near: -80, rampN: 20, rockfall: true }, gallery = { far: 44, rampF: 5, near: -80, rampN: 20, gallery: true }, plat = { far: 16, rampF: 40, near: -6, rampN: 30, jump: true };
    const desc = { far: 12, rampF: 18, near: -14, rampN: 22 }, cross = { far: -26, rampF: 25, near: -17, rampN: 30 };
    return [
      ['s', 70, 0, town], ['a', 35, -90, 0, town], ['s', 18, 0, town],
      ['s', 150, 3, { bridge: true }],                                            // gorge viaduct
      ['a', 30, 90, 4, leg], ['s', 195, 13, leg],                                 // switchback climb: three stacked hairpins
      ['a', 22, -180, 16, leg], ['s', 170, 24, leg],
      ['a', 22, 180, 27, leg], ['s', 170, 35, leg],
      ['a', 22, -180, 38, leg],
      ['s', 160, 42, ledge], ['a', 220, -14, 44, ledge], ['s', 110, 45.5, ledge],                            // cliff ledge (rockfall)
      ['s', 120, 47.1, gallery],                                                                              // rock gallery
      ['s', 70, 48, ledge], ['a', 30, 104, 50, ledge],
      ['s', 105, 58, { tunnel: true, far: 30, near: 20 }],                        // summit tunnel
      ['a', 30, 90, 60, plat], ['s', { toA: -395 }, 64, plat],                     // plateau
      ['a', 35, 90, 62, desc], ['s', 90, 52, desc], ['a', 70, 30, 46, desc], ['a', 70, -30, 40, desc],
      ['s', { toB: 178 }, 30, desc], ['s', { toB: 105 }, 24, { bridge: true }],   // river bridge on the descent
      ['a', 35, 90, 22, cross], ['s', { toA: -140 }, 18, cross],
      ['s', { toA: -70 }, 17, { bridge: true }],                                  // crossover above the viaduct
      ['s', { toA: 115 }, 15, cross], ['a', 35, -60, 12, cross],
      ['a', 35, -30, 9, { bridge: true }],                                        // road bridge over the valley railway
      ['a', 35, -90, 1, town], ['s', { toA: 0 }, 0, town]
    ];
  })() };
