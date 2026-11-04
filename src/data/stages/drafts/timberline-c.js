// Timberline C, "Two ways past the falls": out of town the road splits. The high road swings east and crosses the
// gorge on a tall trestle above the falls; the low road runs straight up the lakeshore and fords the creek right under
// them. They meet again on the ridge road, which runs west over the lake and down the west side into town.
import { LOOK } from './timberline.js';

export default { ...LOOK, name: 'Timberline C', blurb: 'Pick a way past the falls: the trestle above them or the ford beneath', laps: 2,
  drape: { lift: [[705, 750, 16]] },   // the tall trestle over the gorge
  towns: [{ style: 'alpine', at: 10, len: 200 }],
  segs: [
    ['s', 220, 0, {}],                     // main street
    ['a', 50, 90, 0, {}],
    ['s', 60, 0, {}],                      // the fork
    ['a', 40, -90, 0, {}],                 // high road: east...
    ['s', 120, 0, {}],
    ['a', 40, 90, 0, {}],
    ['s', 200, 0, {}],                     // ...and north over the tall trestle above the falls
    ['a', 40, 90, 0, {}],
    ['s', 210, 0, {}],
    ['s', 300, 0, {}],                     // the ridge road, where the low road joins
    ['a', 70, 90, 0, {}],
    ['s', 60, 0, {}], ['a', 45, -60, 0, {}], ['a', 45, 120, 0, {}], ['a', 45, -60, 0, {}],
    ['s', { toB: 60 }, 0, {}],
    ['a', 60, 90, 0, {}],
    ['s', { toA: 0 }, 0, {}]
  ],
  branches: [{ from: 3, to: 9, name: 'low road', share: 0.5, segs: [
    ['s', 120, 0, {}],                     // up the shore
    ['s', 50, 0, { mud: 'water', falls: true }],   // through the creek, under the falls
    ['s', 100, 0, {}],
    ['a', 50, 90, 0, {}]                   // and left onto the ridge road
  ] }] };
export const design = {
  title: 'Two ways past the falls',
  story: 'The quickest lap, 55-65 s, built around a choice. Out of town the road splits: the high road takes the long way round over a tall trestle above the falls, and the low road takes the short way, straight up the shore and through the creek right under the falls. The low road is shorter but wet and slow; the AI splits about half and half.',
  beats: [
    { m: 60, name: 'Main street', text: 'Start in the log town on the lake shore; sawmill at the east end.' },
    { m: 323, name: 'The fork', text: 'Right for the high road, straight on for the low road.' },
    { m: 323, alt: 0, along: 145, name: 'Low road: the ford under the falls', text: 'Straight up the shore and through the creek where the falls come down: splashy, slippery, about 350 m shorter.' },
    { m: 690, name: 'High road: the tall trestle', text: 'East and north onto a tall timber trestle across the gorge, above the falls.' },
    { m: 1041, name: 'The roads meet', text: 'The low road comes in from the left onto the ridge road.' },
    { m: 1605, name: 'Down the west side', text: 'An S through dense forest, back down towards the water.' },
    { m: 1865, name: 'Into town', text: 'A long left onto the shore and back onto main street.' }
  ],
  build: ['Everything A needs (log-cabin town, the waterfall, timber trestles)', 'The ford: the water splash and waterfall exist, but the waterfall needs to be the real one from the gorge']
};
