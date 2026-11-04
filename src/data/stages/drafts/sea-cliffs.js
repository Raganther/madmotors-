// Sea Cliffs: the coast. A village on the clifftop, the sea below on the camera's side. Along the cliff edge and over a
// gully on a high bridge, down a ravine to the beach, back along the sand through a tunnel in a headland and under
// the gully bridge, and up the west ravine to the village.
import { LOOK, bend, drawnLap, beatsAt } from './draw.js';

const MAP = {
  ground: { size: 1900, cell: 8, base: 0, floor: 1, seed: 12, rough: [5, 90, 1],
    scarps: [[-950, -170, 950, -170, 55, 50]],
    hills: [[-350, -215, 20, 60], [300, -228, 26, 70]],         // headlands
    ridges: [[[[110, 250], [90, 50], [72, -200]], -42, 45, 20], [[[700, 120], [650, -100], [600, -260]], -48, 75], [[[-680, 120], [-620, -100], [-570, -260]], -48, 75]] },   // the gully, the east and west ravines
  lake: { pts: [[-1100, -600], [1100, -600]], level: 0, width: 680, logs: 0, color: 0x2F7FA8 },   // the sea, out past the edge of the map
  streams: [{ pts: [[100, 330], [90, 60], [76, -120], [70, -270]], width: 9 }]
};
export const LINE = [
  [-450, -100], [-250, -110, 'village'],                      // the clifftop village, heading east
  [-150, -130], [-50, -125], [20, -120], [80, -120, 'gully'], [140, -122],   // along the edge; the high bridge over the gully
  [210, -128], [300, -150, 'edge'], [420, -130], [500, -100], [560, -40], [630, 30],   // over the headland, inland round the ravine's head
  ...bend(660, -10, 45, 120, -30).slice(1),                   // round into the ravine
  [690, -100], [650, -170, 'ravine'], [580, -215],            // down it to the beach
  [470, -215, 'beach'], [400, -238], [300, -226, 'arch'], [210, -238], [140, -212], [76, -205, 'under'], [0, -225], [-90, -205], [-180, -235], [-280, -212],   // west along the sand
  [-420, -228], [-530, -215], [-600, -160, 'up'], [-640, -60], [-650, 30],   // up the west ravine
  ...bend(-610, 50, 45, 200, 330).slice(1), [-520, -40]       // and out onto the clifftop
];
const { stage, at } = drawnLap(MAP, LINE);
export default { ...LOOK, ...stage, name: 'Sea Cliffs', blurb: 'Along the cliff edge, down to the beach, under your own bridge', laps: 2,
  colors: { ...LOOK.colors, dirt: 0xB59B72 }, towns: [{ style: 'seaside', at: 0, len: 150, steep: 10 }] };
export const design = {
  title: 'Sea Cliffs',
  story: 'The coast: the sea below you on the camera\'s side, a fishing and logging village on the clifftop. Half the lap is on the cliff edge, half on the beach below it, and the two cross at the gully.',
  beats: beatsAt(at, [
    ['village', 'The clifftop village', 'Start on the cliff edge, the sea far below on your right.'],
    ['gully', 'Over the gully', 'A high bridge over the gully where the creek falls to the beach.'],
    ['edge', 'The cliff edge', 'Fast along the edge over the headland.'],
    ['ravine', 'Down the ravine', 'Inland round the ravine\'s head and down it to the sea.'],
    ['beach', 'The beach', 'Flat out along the sand, the surf on your left.'],
    ['arch', 'Through the headland', 'Through the headland in a short sea tunnel.'],
    ['under', 'Under the bridge', 'Under the gully bridge you crossed at the start of the lap.'],
    ['up', 'Up the west ravine', 'Climbing back up to the village.']
  ]),
  build: ['Sand and surf on the beach', 'Sea-cliff rock', 'A waterfall down the gully']
};
