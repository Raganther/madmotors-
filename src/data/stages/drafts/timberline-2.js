// Timberline 2: Timberline 1's line driven the other way round. Out of town west round the coves, up the west valley
// and the long trestle to the corkscrew (climbing into it, dropping out of it), along the ledge, over the high bridge
// into the spur's tunnel, down the hairpins, over the east river and down the esses into town.
import { LOOK, drawnLap, beatsAt, reversed } from './timberline.js';
import { LINE, LIFT } from './timberline-1.js';

const { stage, at } = drawnLap(reversed(LINE), { lift: LIFT });
export default { ...LOOK, ...stage, name: 'Timberline 2', blurb: 'The high circuit the other way: up the corkscrew, down the hairpins', laps: 2,
  towns: [{ style: 'alpine', at: 0, len: 200, steep: 10 }] };
export const design = {
  title: 'The high circuit, reversed',
  story: 'The same line driven the other way. It drives very differently: you climb the long trestle and the corkscrew, and come down the hairpins and the esses, so the technical part is downhill and much harder to get right.',
  beats: beatsAt(at, [
    ['town', 'Main street', 'Start in the log town heading west.'],
    ['coves', 'Round the coves', 'Fast curves along the lake\'s inlets.'],
    ['valley', 'Up the west valley', 'Winding up beside the west creek through the forest.'],
    ['creek', 'Over the west creek', 'Across the creek and onto the long trestle.'],
    ['trestle', 'Up the long trestle', 'Climbing out of the valley on timber.'],
    ['high1', 'The corkscrew', 'Over a trestle, round a tight left-hand loop dropping all the way, and under the road you just drove.'],
    ['ledge', 'The ledge', 'Along the massif\'s face, the lake far below on your right.'],
    ['gorge', 'The high bridge', 'Over the north gorge and straight into the tunnel through the spur.'],
    ['hair2', 'Down the hairpins', 'Two hairpins, downhill: brake early.'],
    ['east1', 'Over the east river', 'The high bridge over the river.'],
    ['esses', 'Down the esses', 'Fast and downhill beside the river, back to the shore and into town.']
  ]),
  build: ['As Timberline 1']
};
