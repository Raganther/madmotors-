// Timberline A, "Round the lake": the simplest lap. Out of the logging town along the shore, north over the creek on a
// timber trestle at the lip of the falls, up beside the gorge to a hairpin, the long ridge road back west high over the
// lake, then down the west side through the forest and into town.
import { LOOK } from './timberline.js';

export default { ...LOOK, name: 'Timberline A', blurb: 'Round the lake: over the falls, a hairpin, the ridge road home', laps: 2,
  drape: { lift: [[580, 635, 18]] },   // the trestle: held across the gorge
  towns: [{ style: 'alpine', at: 10, len: 260 }],
  segs: [
    ['s', 290, 0, {}],                     // main street, east along the shore
    ['a', 60, 90, 0, {}],                  // left at the sawmill end of town
    ['s', 300, 0, {}],                     // north: the trestle over the gorge, right at the lip of the falls
    ['a', 40, -90, 0, {}],
    ['s', 130, 0, {}],                     // east, climbing along the gorge's north rim
    ['a', 35, 180, 0, {}],                 // the hairpin
    ['s', 250, 0, {}], ['a', 160, -16, 0, {}], ['a', 160, 16, 0, {}],   // the ridge road west, high over the lake...
    ['s', 230, 0, {}],                     // ...with a fast kink in it
    ['a', 70, 90, 0, {}],
    ['s', 60, 0, {}], ['a', 45, -60, 0, {}], ['a', 45, 120, 0, {}], ['a', 45, -60, 0, {}],   // down the west side: an S through the trees
    ['s', { toB: 60 }, 0, {}],
    ['a', 60, 90, 0, {}],                  // and left into town
    ['s', { toA: 0 }, 0, {}]
  ] };
export const design = {
  title: 'Round the lake',
  story: 'The simplest of the three: one flowing loop round the lake, about 70 s a lap. It shows off the lake and the falls, but only has one real set piece, the trestle.',
  beats: [
    { m: 60, name: 'Main street', text: 'Start in the log town on the lake shore, timber houses either side; the sawmill and log piles at the east end.' },
    { m: 570, name: 'The trestle at the falls', text: 'Straight north over the creek on a timber trestle, right at the lip of the falls, the lake below on the left.' },
    { m: 895, name: 'The hairpin', text: 'A short climb east along the gorge rim to a tight left hairpin in the trees.' },
    { m: 1225, name: 'The ridge road', text: 'The fast bit: a long run west high over the lake with a flat-out kink in the middle.' },
    { m: 1785, name: 'Down the west side', text: 'An S through dense forest, dropping back towards the water.' },
    { m: 2015, name: 'Into town', text: 'A long left onto the shore and back onto main street.' }
  ],
  build: ['A log-cabin town style (the alpine houses stand in for it here)', 'A real waterfall from the gorge into the lake (today\'s waterfall only arcs over a road)', 'Timber trestles for the bridges (today: steel bridge or stone viaduct)']
};
