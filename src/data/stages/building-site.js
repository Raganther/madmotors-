// Stage: Building Site. A special (G6): a dirt lap round a half-built estate. The start runs past the site huts, then
// an S-bend round the foundations with a fenced-off cut straight through them (heavy cars smash the fence and open it
// for everyone), a kicker off the spoil heap, the demolition block where two wrecking balls swing across, a mud
// wallow by the cement mixers, and pallets of crates left at the side of the road.
const R = 30, site = { far: 0.6, rampF: 14, near: -0.4, rampN: 14 }, heap = { far: 4, rampF: 10, near: -2, rampN: 10 };
export default { name: 'Building Site', blurb: 'Special: a dirt lap round a half-built estate: a fence to smash, a spoil-heap kicker, wrecking balls and mud', type: 'gorge', laps: 4, seed: 4141, surface: 'gravel', hillAmp: 1.5, jumps: 0, armco: false,
  light: { sun: 0xFFE8C8, sunI: 1.0, sky: 0xD8D4CC, ground: 0x6A5E4E, hemiI: 0.62, cloud: 0.35, grade: [1.03, 1.0, 0.96], sat: 0.98 },
  colors: { grassA: 0x9A8E6A, grassB: 0x8A7E5C, rock: 0x9A9488, dirt: 0x9E7E58, dirtRoad: 0xA4865E, road: 0xA4865E, sky: 0xC8D2DC, round: [0x6E8A48, 0x7A9450], pine: [0x4A6A3A] },
  trees: { density: 0.0006, pine: 0.2 }, rocks: 0.002, bushes: 0.0015,
  towns: [{ style: 'industrial', at: 0, len: 120, side: 'left' }, { style: 'industrial', at: 560, len: 200 }],
  props: [{ kind: 'crates', at: 770, lat: -3.6 }, { kind: 'crates', at: 815, lat: 3.6 }],
  segs: [
    ['s', 60, 0, site],                                                        // past the site huts
    ['a', 40, 60, 0, site], ['a', 40, -120, 0, site], ['a', 40, 60, 0, site],    // round the foundations
    ['s', 60, 0, site],
    ['a', R, 90, 0, site],
    ['s', 40, 2, heap], ['s', 40, 2, { ...heap, kick: 2.4 }], ['s', 30, 0, site],   // up the spoil heap and off it
    ['a', R, 90, 0, site],
    ['s', 60, 0, site], ['s', 90, 0, { ...site, hammers: 2 }], ['s', 50, 0, { ...site, mud: true }], ['s', { toA: 0 }, 0, site],   // the demolition block, the mud by the mixers
    ['a', R, 90, 0, site],
    ['s', 80, 0, site],                                                        // the pallets of crates
    ['s', { toB: R }, 0, site], ['a', R, 90, 0, site]
  ],
  branches: [{ from: 1, to: 4, name: 'through the site', share: 0.7, segs: [['s', 30, 0, { breach: 'fence', far: 0.3, near: 0.3 }], ['s', 50, 0, { whoops: 0.4 }], ['s', { toA: 198.564 }, 0]] }] };
