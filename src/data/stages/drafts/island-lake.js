// Island Lake: a lake round an island under a line of cliffs. From the town on the south shore, over the water to the
// island on a long trestle, over the island's hill and off its far side on another, along the north shore under the
// cliffs, up a ramp onto the clifftop and back along it over the top of a waterfall, down the west end and home.
import { LOOK, drawnLap, beatsAt } from './draw.js';

const ring = []; for (let k = 0; k <= 20; k++) { const t = k / 20 * 2 * Math.PI; ring.push([Math.round(175 * Math.cos(t)), Math.round(40 + 175 * Math.sin(t))]); }
const MAP = {
  ground: { size: 1700, cell: 8, base: 6, floor: 3, seed: 9, rough: [5, 100],
    hills: [[0, 40, 34, 85], [-520, -260, 30, 160], [560, -220, 30, 160]], scarps: [[-900, 360, 900, 360, 60, 80]] },
  lake: { pts: ring, level: 1, width: 140, logs: 4, color: 0x4E7F8C },   // a ring of water: the island in the middle stays dry
  streams: [{ pts: [[60, 620], [40, 460], [20, 360], [10, 290]], width: 10 }]
};
export const LINE = [
  [0, -340], [0, -260, 'town'],                               // the south shore town, heading north
  [-10, -210, 'br1'], [-30, -140], [-20, -70],                // the trestle to the island
  [45, -10, 'island'], [-50, 50], [25, 115],                  // over the island's hill
  [40, 150, 'br2'], [55, 220], [40, 285],                        // the trestle off the far side
  [60, 305, 'north'], [160, 300], [250, 310],                 // east along the north shore under the cliffs
  [320, 335, 'ramp'], [430, 370], [490, 400],                 // up the ramp onto the clifftop
  [460, 440], [380, 418], [290, 446], [190, 424], [110, 442], [50, 428, 'falls'], [-40, 446], [-140, 420], [-240, 442], [-350, 412],   // back along the clifftop, over the waterfall
  [-440, 370, 'down'], [-490, 300], [-480, 200], [-440, 90], [-400, -20], [-340, -130], [-250, -230], [-160, -320], [-80, -385, 'home'], [-30, -390]   // down the west end and round to town
];
const { stage, at } = drawnLap(MAP, LINE);
export default { ...LOOK, ...stage, name: 'Island Lake', blurb: 'Over the water to the island, along the cliffs, over the waterfall', laps: 2,
  towns: [{ style: 'alpine', at: 0, len: 110, steep: 10 }] };
export const design = {
  title: 'Island Lake',
  story: 'A lake round a wooded island, under a line of cliffs. You cross the lake by the island, on a trestle each side of it, then climb onto the cliffs and come back along the top, high over the water and across the top of a waterfall.',
  beats: beatsAt(at, [
    ['town', 'The south shore', 'Start in the lakeside town, the island straight ahead.'],
    ['br1', 'The first trestle', 'Out over the water on timber.'],
    ['island', 'The island', 'Up and over the island\'s wooded hill.'],
    ['br2', 'The second trestle', 'Off the far side and over the water again.'],
    ['north', 'Under the cliffs', 'East along the north shore, the cliffs above you.'],
    ['ramp', 'Up the ramp', 'A ramp cut up the cliff face.'],
    ['falls', 'Over the waterfall', 'Back along the clifftop, over the creek right where it falls into the lake.'],
    ['down', 'Down the west end', 'A long descent round the west of the lake.'],
    ['home', 'Home', 'Round to the town.']
  ]),
  build: ['A waterfall off the cliff', 'Low timber trestles over water', 'Rock faces on the cliffs']
};
