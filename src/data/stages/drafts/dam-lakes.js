// Dam Lakes: a valley closed by a dam. A reservoir behind it, the river falling out of its foot. Up the valley from
// the town below, up the west side by hairpins, across the top of the dam (a 40 m wall one side, the water the
// other), round the reservoir and over its far end on a long trestle, and back down the west side, over the road
// you climbed.
import { LOOK, bend, drawnLap, beatsAt } from './draw.js';

const MAP = {
  ground: { size: 1600, cell: 8, base: 45, seed: 6, rough: [6, 120],
    hills: [[-480, 200, 50, 180], [480, 260, 55, 180]],
    ridges: [[[[0, 650], [0, 300], [30, 0], [0, -450]], -42, 150, 70], [-170, 150, 170, 150, 38, 14, 8]] },   // the valley (flat floor), and the dam across it
  lake: { pts: [[0, 200], [0, 330], [-20, 470]], level: 33, width: 170, logs: 3, color: 0x47767F },
  streams: [{ pts: [[10, 125, 4], [20, 40], [35, -100], [10, -260], [0, -520]], width: 12 }]
};
export const LINE = [
  [80, -330], [60, -180, 'town'],                             // the town below the dam, up the valley
  [70, -60], [55, 40], [-30, 90, 'climb'],                    // up to the foot of the dam
  [-90, 60], ...bend(-120, 85, 28, -90, -270).slice(1), [-70, 125], [-130, 145, 'x1'], ...bend(-150, 120, 25, 90, 270).slice(1),   // hairpins up the west side
  [-150, 95], [-200, 130], [-180, 150, 'dam'], [0, 150], [175, 150],   // across the top of the dam
  [210, 200], [180, 300, 'shore'], [150, 420], [90, 520],              // up the east shore
  [20, 560, 'trestle'], [-80, 540],                                    // over the far end on a long trestle
  [-150, 450], [-160, 320], [-200, 230, 'down'],                        // down the west shore
  [-250, 180], [-230, 130, 'over'], [-220, 60], [-160, -20], [-90, -110], [-20, -220], [30, -340], [50, -430], [100, -460], [120, -400]   // and down the valley side, over the hairpins, to town
];
const { stage, at } = drawnLap(MAP, LINE, { lift: [['x1', 'x1', -5], ['over', 'over', 9]] });
export default { ...LOOK, ...stage, name: 'Dam Lakes', blurb: 'Across the top of the dam, round the reservoir, over the long trestle', laps: 2,
  towns: [{ style: 'alpine', at: 0, len: 150, steep: 10 }] };
export const design = {
  title: 'Dam Lakes',
  story: 'A valley closed off by a dam: the reservoir behind it, the river falling out of its foot. The signature is the run along the dam\'s top, a sheer 40 m wall on one side and the water on the other.',
  beats: beatsAt(at, [
    ['town', 'The town below the dam', 'Start in the valley town, the dam wall towering ahead.'],
    ['climb', 'To the foot of the dam', 'Up the valley beside the river to where it pours out of the dam.'],
    ['x1', 'Hairpins up the side', 'Stacked hairpins up the west side of the valley.'],
    ['dam', 'Across the dam', 'Flat out along the top of the dam, the water on your left, the drop on your right.'],
    ['shore', 'The east shore', 'Up the reservoir\'s east side through the trees.'],
    ['trestle', 'The long trestle', 'Over the far end of the reservoir on timber, low over the water.'],
    ['down', 'Down the west shore', 'Back down the other side.'],
    ['over', 'Over the hairpins', 'Across the hairpins you climbed, on a bridge, and down the valley to town.']
  ]),
  build: ['A dam: a concrete wall with a spillway (the shape is in the land, it needs its look)', 'A low timber trestle across water']
};
