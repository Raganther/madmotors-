// Stage: Seafront. A special (G6): a tarmac lap of a seaside town. Boost pads along the promenade with the sea
// beside it, an S-bend round the pier with a short cut along the sand, the harbour's lifting bridge (it lifts every so
// often: jump it while it's low, or wait), back through the old town's narrow streets and down to the front again.
const R = 30, prom = { far: 0.3, rampF: 20, near: -2.5, rampN: 8 }, town = { far: 1.5, rampF: 16, near: 0.3, rampN: 16 };
export default { name: 'Seafront', blurb: 'Special: the promenade on boost pads, a short cut along the sand, the harbour lifting bridge and the old town', type: 'gorge', laps: 4, seed: 5151, surface: 'tarmac', hillAmp: 1.2, jumps: 0, armco: true,
  light: { sun: 0xFFF2DA, sunI: 1.08, sky: 0xDDEFFF, ground: 0x8A8E80, hemiI: 0.66, cloud: 0.2, grade: [1.0, 1.0, 1.03], sat: 1.12 },
  colors: { grassA: 0xA8C26E, grassB: 0x94AE60, rock: 0xB0A898, dirt: 0xE2CF9E, dirtRoad: 0xE0CC98, road: 0x55595F, sky: 0xB6DDF2, round: [0x5E9C45, 0x74B04E], pine: [0x3E7447] },
  trees: { density: 0.0008, pine: 0.15 }, rocks: 0.0008, bushes: 0.002,
  towns: [{ style: 'seaside', at: 560, len: 260 }, { style: 'seaside', at: 0, len: 40, side: 'left' }, { style: 'seaside', at: 200, len: 150, side: 'left' }],   // the old town; hotels facing the sea
  river: { pts: [[-400, -62], [800, -62]], level: -3, width: 70, color: 0x5FAFD8 },   // the sea below the promenade (pts in the segs' screen axes)
  segs: [
    ['s', 50, 0, prom],
    ['a', 40, 60, 0, prom], ['a', 40, -120, 0, prom], ['a', 40, 60, 0, prom],   // round the pier
    ['s', 160, 0, { ...prom, boost: true }],                                  // the promenade
    ['a', R, 90, 0, town],
    ['s', 40, 0, town], ['s', 24, 0, { drawbridge: 0, far: -10, rampF: 3, near: -10, rampN: 3 }], ['s', 40, 0, town],   // the harbour's lifting bridge
    ['a', R, 90, 0, town],
    ['s', 120, 0, town], ['s', 120, 0, town], ['s', { toA: 0 }, 0, town],     // the old town
    ['a', R, 90, 0, town],
    ['s', 70, 0, town],
    ['s', { toB: R }, 0, town], ['a', R, 90, 0, town]
  ],
  branches: [{ from: 1, to: 4, name: 'along the sand', share: 0.4, segs: [['s', 30, 0, { dirt: true, near: -1.5 }], ['s', 50, 0, { dirt: true, whoops: 0.3, near: -1.5 }], ['s', { toA: 188.564 }, 0, { dirt: true, near: -1.5 }]] }] };
