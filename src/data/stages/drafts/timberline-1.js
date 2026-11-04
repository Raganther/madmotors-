// Timberline 1, "The high circuit": the whole mountain in one lap. Out of the log town along the shore, up the east
// valley beside the river in a run of esses, high over the river on a bridge, a stack of hairpins, through the spur
// in a tunnel and straight out onto the high bridge over the north gorge, along a ledge in and out of the gullies on
// the massif's face, under the corkscrew's trestle and round it to cross back over, down the long trestle into the
// west valley, over the creek and down its valley through the forest, and round the coves into town.
// Timberline 2 is the same line the other way round.
import { LOOK, bend, drawnLap, beatsAt } from './timberline.js';

export const LINE = [
  [-40, -150], [140, -150, 'town'],                           // main street, east along the south shore
  [215, -132], [262, -100], [282, -55],                       // out of town, bending north
  [258, -18, 'esses'], [270, 22], [315, 40], [345, 75], [372, 120], [410, 140], [440, 175],   // up the east valley: esses beside the river
  [446, 222, 'east0'], [458, 262], [452, 305, 'east1'],       // high over the east river
  [330, 318], ...bend(330, 345, 27, -90, -270, null, 'hair1').slice(1),   // west, hairpin right...
  [440, 385], ...bend(440, 412, 27, -90, 90, null, 'hair2').slice(1),     // ...east, hairpin left...
  [300, 452], [240, 470, 'spur'], [185, 452],                 // ...west, into the spur
  [120, 382], [78, 352], [40, 346, 'gorge'], [0, 322], [-40, 298],  // out onto the high bridge over the north gorge, then the ledge,
  [-78, 304, 'ledge'], [-112, 326], [-152, 318], [-200, 335], // in and out of the gullies on the massif's face
  [-245, 345, 'low0'],                                        // under the corkscrew's trestle...
  [-300, 345, 'low1'], ...bend(-300, 385, 40, -90, -360).slice(1),  // ...round to the right, climbing...
  [-260, 365, 'high0'], [-260, 325, 'high1'],                 // ...and back over it on the trestle
  ...bend(-300, 300, 40, 0, -90).slice(1),                    // out of it, heading west, down the long trestle
  [-360, 262, 'trestle'], [-410, 240], [-445, 205, 'creek'],  // over the creek
  [-480, 160], [-500, 120], [-485, 80, 'valley'], [-450, 55], [-430, 15],   // down the creek's valley, winding
  [-400, -30], [-372, -80], [-330, -92, 'coves'], [-298, -128], [-252, -122], [-214, -152], [-168, -172], [-118, -162]   // and round the coves into town
];
export const LIFT = [['east0', 'east1', 18], ['low0', 'low1', -5], ['high0', 'high1', 9]];

const { stage, at } = drawnLap(LINE, { lift: LIFT });
export default { ...LOOK, ...stage, name: 'Timberline 1', blurb: 'The whole mountain: valley, hairpins, a ledge, a corkscrew', laps: 2,
  towns: [{ style: 'alpine', at: 0, len: 220, steep: 10 }] };
export const design = {
  title: 'The high circuit',
  story: 'One lap of the whole mountain, about 3.2 km and 100 s, climbing 90 m from the lake to the massif and back. The lake sits in the middle with three rivers coming down into it, and the road crosses all three. Hardly a straight in it: esses, two hairpins, a tunnel, two high bridges, a ledge on the mountain face, and a corkscrew that loops back over itself.',
  beats: beatsAt(at, [
    ['town', 'Main street', 'Start in the log town on the south shore, the lake on your left.'],
    ['esses', 'Up the east valley', 'A run of esses climbing beside the east river, forest on both sides.'],
    ['east0', 'Over the east river', 'A bridge held high over the river where the valley narrows.'],
    ['hair1', 'The hairpins', 'Two tight hairpins, right then left, stacked up the slope: the technical part.'],
    ['spur', 'Through the spur', 'Into a tunnel through the rock spur at the saddle, the highest part of the lap...'],
    ['gorge', 'The high bridge', '...and straight out onto a bridge 40 m over the north gorge, the river falling to the lake below.'],
    ['ledge', 'The ledge', 'Along the massif\'s face, in and out of the gullies, the lake far below on your left.'],
    ['low0', 'The corkscrew', 'Under a timber trestle, round a tight right-hand loop climbing all the way, and back over the road you just drove, 13 m up.'],
    ['trestle', 'Down the long trestle', 'Off the corkscrew onto a long timber trestle dropping into the west valley.'],
    ['creek', 'Over the west creek', 'Across the creek and down its valley, winding through the forest.'],
    ['coves', 'Round the coves', 'Fast curves round the lake\'s inlets and back into town.']
  ]),
  build: ['Timber trestles for the bridges (today: steel bridge or stone viaduct)', 'Waterfalls where the rivers drop off the mountain (the streams step down, but there is no falling water yet)', 'A log-cabin town style (the alpine houses stand in for it)', 'Cliff faces along the ledge and the cuttings: the land is there, the rock look is not']
};
