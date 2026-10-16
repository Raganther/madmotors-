// Stage: Wrecking Row. A special: a tarmac lap of a run-down canal town where the scenery is part of the race. The
// start runs down the High Street with shops and terraces right at the kerb (no barrier: clip one and you're in the
// front room, and the rubble you knock out is on the road next lap), into a concrete chicane (weave it, or smash it
// in something heavy), and an S-bend round a cottage that stands across the short cut: the first heavy car through
// opens it for everyone. Then a kicker onto the old timber bridge over the canal, which wears through lap by lap
// (heavy cars wear it fastest: by the last lap you're jumping holes), whoops along the towpath, the lifting bridge
// at the lock, a splash through the ford, a jump by the gasworks and the warehouses back to the High Street.
// Buildings: core/elements/structures.js; the bridge: crumble; the chicane: chicane.
const R = 32, st = { far: 0.6, rampF: 16, near: 0.2, rampN: 16 }, canal = { far: -10, near: -10, rampF: 3, rampN: 3 };
export default { name: 'Wrecking Row', blurb: 'Special: a High Street you can drive through, a concrete chicane, a cottage across the short cut and a timber bridge that wears through', type: 'gorge', laps: 3, seed: 6161, surface: 'tarmac', hillAmp: 1.4, jumps: 0, armco: true,
  light: { sun: 0xFFEAD0, sunI: 1.02, sky: 0xD6DCE4, ground: 0x6E6A60, hemiI: 0.64, cloud: 0.4, grade: [1.02, 1.0, 0.97], sat: 1.0 },
  colors: { grassA: 0x8EA866, grassB: 0x7E985A, rock: 0x9A948A, rock2: 0x847E74, dirt: 0xA08A66, dirtRoad: 0x9C8A6A, road: 0x55585E, sky: 0xBFD0E0, round: [0x5E8C45, 0x6E9A4E], pine: [0x3E6A47] },
  trees: { density: 0.0009, pine: 0.2 }, rocks: 0.0008, bushes: 0.002,
  towns: [{ style: 'industrial', at: 1160, len: 150, side: 'left' }],
  buildings: [
    // the High Street: shops and terraces at the kerb on both sides
    { type: 'shop', at: 40, lat: -13.6 }, { type: 'terrace', at: 62, lat: 13 }, { type: 'house', at: 70, lat: -13 }, { type: 'shop', at: 95, lat: 13.6 },
    { type: 'terrace', at: 104, lat: -13 }, { type: 'house', at: 124, lat: 13 }, { type: 'shop', at: 140, lat: -13.6 }, { type: 'terrace', at: 158, lat: 13 },
    { type: 'flats', at: 186, lat: -14.5 }, { type: 'stall', at: 178, lat: 11 }, { type: 'stall', at: 186, lat: 11 },
    // by the chicane and the S-bend
    { type: 'warehouse', at: 262, lat: 18 }, { type: 'house', at: 300, lat: -13 },
    // the cottage across the short cut (placed on the branch: road: true)
    { type: 'cottage', a: 142.3, b: -140.6, face: 180, w: 15, road: true },
    // the gasworks and warehouses on the way back
    { type: 'warehouse', at: 1240, lat: 17 }, { type: 'barn', at: 1290, lat: 16 }, { type: 'shed', at: 1330, lat: 11.5 },
  ],
  segs: [
    ['s', 200, 0, st],                                                           // the High Street
    ['s', 140, 0, { ...st, chicane: 'concrete' }],                               // the chicane
    ['a', 40, 60, 0, st], ['a', 40, -120, 0, st], ['a', 40, 60, 0, st],           // round the cottage
    ['s', 50, 0, st],
    ['a', R, 90, 0, st],
    ['s', 40, 2], ['s', 16, 2, { kick: 1.6 }], ['s', 32, 0, { crumble: 0.6, ...canal }], ['s', 30, 0],   // the kicker and the old timber bridge
    ['s', 70, 0, { whoops: 0.5 }], ['s', 30, 0],                                  // along the towpath
    ['a', R, 90, 0],
    ['s', 60, 0], ['s', 24, 0, { drawbridge: 4, ...canal }], ['s', 50, 0],       // the lock's lifting bridge
    ['s', 30, -1, { mud: 'water', far: -1.5, rampF: 6, near: -1.5, rampN: 6 }], ['s', { toA: 0 }, 0],   // the ford
    ['a', R, 90, 0, st],
    ['s', 50, 0, st], ['s', 24, 2, { kick: 2.2 }], ['s', 50, 0, st],             // the jump by the gasworks
    ['s', { toB: R }, 0, st], ['a', R, 90, 0, st]
  ],
  branches: [{ from: 2, to: 5, name: 'through the cottage', share: 0.6, segs: [['s', 30, 0, st], ['s', 50, 0, st], ['s', { toA: 478.564 }, 0, st]] }] };
