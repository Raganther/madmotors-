// Timberline B, "Over itself": a figure of eight. Out of town and north over the falls (low trestle), on under the high
// trestle, up the mountain to a hairpin, then back west across the high trestle over the road you came up, along the
// ridge, and down the west side in a stack of switchbacks into town.
import { LOOK } from './timberline.js';

export default { ...LOOK, name: 'Timberline B', blurb: 'A figure of eight: over the falls, up the mountain, back over your own road', laps: 2,
  drape: { lift: [[580, 635, 18], [1255, 1320, 21]] },   // the low trestle over the falls; the high trestle over the climb
  towns: [{ style: 'alpine', at: 10, len: 260 }],
  segs: [
    ['s', 290, 0, {}],                     // main street
    ['a', 60, 90, 0, {}],
    ['s', 360, 0, {}],                     // north: over the falls, then under the high trestle
    ['a', 40, -90, 0, {}],
    ['s', 150, 0, {}],                     // east up the mountain
    ['a', 45, -180, 0, {}],                // the top hairpin
    ['s', 200, 0, {}],                     // back west, out onto the high trestle over the climb
    ['s', 220, 0, {}], ['a', 140, 20, 0, {}], ['a', 140, -20, 0, {}],   // the ridge road
    ['s', { toA: -190 }, 0, {}],
    ['a', 32, 180, 0, {}],                 // switchback stack down the west side: hairpin...
    ['s', 90, 0, {}],
    ['a', 32, -180, 0, {}],                // ...hairpin...
    ['s', 60, 0, {}],
    ['a', 50, 90, 0, {}],                  // ...and down through the trees
    ['s', { toB: 60 }, 0, {}],
    ['a', 60, 90, 0, {}],
    ['s', { toA: 0 }, 0, {}]
  ] };
export const design = {
  title: 'Over itself',
  story: 'A figure of eight with the most going on, about 85 s a lap: the road climbs out under a high trestle, then comes back across that trestle over your own road. It finishes with a stack of switchbacks down the west side.',
  beats: [
    { m: 60, name: 'Main street', text: 'Start in the log town on the lake shore; sawmill at the east end.' },
    { m: 570, name: 'The low trestle', text: 'North over the creek at the lip of the falls.' },
    { m: 658, name: 'Under the high trestle', text: 'Straight on between the legs of the tall trestle you will cross in a minute, about 12 m overhead.' },
    { m: 995, name: 'The top hairpin', text: 'Up the mountain to a wide right-hand hairpin, the highest point of the lap.' },
    { m: 1254, name: 'Over the high trestle', text: 'Back west on the tall timber trestle, over the road you just came up: the signature moment.' },
    { m: 1505, name: 'The ridge road', text: 'A sweeping run along the ridge above the lake.' },
    { m: 1850, name: 'The switchbacks', text: 'Two tight hairpins stacked down the west slope through the forest: the technical bit.' },
    { m: 2470, name: 'Into town', text: 'Down to the shore and left onto main street.' }
  ],
  build: ['Everything A needs (log-cabin town, the waterfall, timber trestles)', 'A tall trestle the lower road runs between the legs of (the bridge supports already keep clear of roads below)']
};
