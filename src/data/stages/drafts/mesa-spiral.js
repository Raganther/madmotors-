// Mesa Spiral: a flat-topped mountain, its slopes ending in a band of cliffs round the top, standing in a forest valley with a lake to the east. The
// road winds once round the mesa, climbing a shelf cut into its cliffs, crosses the top, then leaves it by a viaduct
// straight off the south edge, 70 m over the start of the spiral, and runs down the valley on timber to the lake.
import { LOOK, drawnLap, beatsAt } from './draw.js';

const MAP = {
  ground: { size: 1800, cell: 8, base: 8, floor: 4, seed: 4, rough: [5, 110],
    hills: [[0, 0, 72, 270, 160], [0, 0, 32, 125, 22], [-520, 330, 60, 200], [460, 480, 70, 200], [-470, -380, 30, 200], [620, -330, 25, 150]] },
  lake: { pts: [[380, -30], [440, 90]], level: 2, width: 170, logs: 4, color: 0x4E7F8C },
  streams: [{ pts: [[-560, 360], [-340, 190], [-270, -60], [-140, -270], [120, -300], [300, -190], [370, -60]], width: 11 }]
};
// the shelf round the mesa: one turn clockwise, from the south-east, closing in on the cliff as it climbs
const spiral = []; for (let k = 0; k <= 18; k++) { const th = (-60 - k * 20) * Math.PI / 180, r = 235 - k * 5; spiral.push([Math.round(r * Math.cos(th)), Math.round(r * Math.sin(th))]); }
spiral[0].push('spiral'); spiral[9].push('north');
export const LINE = [
  [540, -190], [390, -235, 'town'],                           // the lakeside town, heading west
  [290, -255], [200, -250], [140, -215],                      // to the foot of the mesa
  ...spiral,                                                  // round and up the cliffs
  [40, -110, 'top'], [0, -60], [-50, -30], [-70, 30], [-20, 75], [45, 60], [70, 5], [35, -55],   // across the top
  [0, -112, 'via0'], [-4, -200], [-8, -290, 'via1'],          // off the south edge on the viaduct, over the spiral
  [40, -355], [140, -380], [260, -360], [380, -310], [480, -265, 'down'], [570, -230]   // down the valley to the lake
];
const { stage, at } = drawnLap(MAP, LINE, { lift: [['via0', 'via1', 20]] });
export default { ...LOOK, ...stage, name: 'Mesa Spiral', blurb: 'Once round the mesa and up its cliffs, then off the top on a viaduct', laps: 2,
  towns: [{ style: 'alpine', at: 0, len: 150, steep: 10 }] };
export const design = {
  title: 'Mesa Spiral',
  story: 'A flat-topped mountain with cliffs all round. The lap winds once round it on a shelf cut into the cliffs, crosses the top, and leaves straight off the edge on a viaduct high over the road you climbed.',
  beats: beatsAt(at, [
    ['town', 'The lakeside town', 'Start by the lake, heading for the mesa.'],
    ['spiral', 'Onto the shelf', 'The road starts round the mesa, the cliff on your right.'],
    ['north', 'Round the back', 'Half way round and half way up, the valley falling away on your left.'],
    ['top', 'The top', 'Over the lip onto the flat top: a wiggly run across it.'],
    ['via0', 'Off the edge', 'Straight off the south cliff on a viaduct, 70 m over the start of the spiral.'],
    ['down', 'Down the valley', 'A long fast descent to the lake.']
  ]),
  build: ['A tall viaduct (the stone one we have, or timber)', 'Rock cliffs round the mesa']
};
