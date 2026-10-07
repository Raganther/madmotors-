// The Workshop (?workshop, the menu's Workshop button; ui/workshop.js): one place to try any part of the game without
// the career or a race around it. Each tab opens on its own link, ?workshop=<id>. Tabs whose `phase` is set arrive with
// that roadmap phase (docs/ROADMAP.md) and show as coming soon.
import { loop } from './sandboxes/index.js';

export const WORKSHOP_TABS = [
  { id: 'cars', name: 'Cars', blurb: 'Every car and asset on a turntable: Classic and Blender, near and far detail, paint, dents, notes to Claude' },
  { id: 'crash', name: 'Crash test', blurb: 'Any car into a parked car, an oncoming one or the wall, at the speed you pick. Damage per zone, slow motion, repair', live: true },
  { id: 'weapons', name: 'Weapons range', blurb: 'Pick any weapon, fire it at dummies or at rivals driving the loop, and see what each hit costs them', live: true },
  { id: 'elements', name: 'Track elements', blurb: 'A small loop per track element (jumps, bridges, mud, ferry, gates...) with the debug readout' },
  { id: 'destruct', name: 'Destruction yard', blurb: 'Any car into crates, hay, a fence, a farm gate or concrete blocks at a set speed: what breaks, what bounces, what it costs', live: true },
  { id: 'derby', name: 'Derby arena', blurb: 'A derby in any arena (scrapyard, mud pit, stadium) with any car against five rivals: drive it or watch the AI fight', live: true },
  { id: 'kit', name: 'Scenery kit', blurb: 'A town in each style (village, alpine, seaside, farm, desert, industrial) along the loop: drive or fly round it, smash its fences and gates', live: true },
];

/** The Destruction yard: one of each breakable (data/breakables.js) across the far straight, 50 m apart. */
export const YARD = ['crates', 'hay', 'fence', 'gate', 'concrete'], YARD_AT = 480;
/** The live tabs' ground: a flat loop with straights of 300 m and 270 m, Armco both sides, and eight laps (the Workshop never shows results). */
export const WORKSHOP_STAGE = loop('workshop', 'the Workshop: two long flat straights (300 m and 270 m) for crash tests and the weapons range', {
  bottom: [['s', 300, 0, { far: -5, near: -5, rampF: 4, rampN: 4 }]], right: [['s', 40, 0]], top: [['s', 270, 0]], left: [['s', 20, 0]]
}, { name: 'Workshop', laps: 8, trees: { density: 0.0015, pine: 0.4 }, rocks: 0, bushes: 0.001, props: YARD.map((kind, k) => ({ kind, at: YARD_AT + k * 50 })) });

/** The Scenery kit tab: the Workshop loop with a town in one style (data/styles.js) along both long straights. */
export const kitStage = style => loop('kit-' + style, `the world kit: a ${style} town along both straights`, {
  bottom: [['s', 300, 0]], right: [['s', 40, 0]], top: [['s', 270, 0]], left: [['s', 20, 0]]
}, { name: 'Kit: ' + style, laps: 8, trees: { density: 0.0025, pine: style === 'alpine' ? 0.8 : 0.3 }, rocks: 0.0006, bushes: 0.002, armco: false,
  towns: [{ style, at: 10, len: 270, side: 'both' }, { style, at: 410, len: 250, side: 'both' }] });
