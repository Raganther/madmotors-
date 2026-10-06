// The Workshop (?workshop, the menu's Workshop button; ui/workshop.js): one place to try any part of the game without
// the career or a race around it. Each tab opens on its own link, ?workshop=<id>. Tabs whose `phase` is set arrive with
// that roadmap phase (docs/ROADMAP.md) and show as coming soon.
import { loop } from './sandboxes/index.js';

export const WORKSHOP_TABS = [
  { id: 'cars', name: 'Cars', blurb: 'Every car and asset on a turntable: Classic and Blender, near and far detail, paint, dents, notes to Claude' },
  { id: 'crash', name: 'Crash test', blurb: 'Any car into a parked car, an oncoming one or the wall, at the speed you pick. Damage per zone, slow motion, repair', live: true },
  { id: 'weapons', name: 'Weapons range', blurb: 'Pick any weapon, fire it at dummies or at rivals driving the loop, and see what each hit costs them', live: true },
  { id: 'elements', name: 'Track elements', blurb: 'A small loop per track element (jumps, bridges, mud, ferry, gates...) with the debug readout' },
  { id: 'destruct', name: 'Destruction yard', blurb: 'Drive any car into fences, walls and barriers and see what breaks', phase: 'F3' },
  { id: 'kit', name: 'Scenery kit', blurb: 'Towns, farms and yards from the kit pieces and style packs, on an empty lot', phase: 'F4' },
];

/** The live tabs' ground: a flat loop with straights of 300 m and 270 m, Armco both sides, and eight laps (the Workshop never shows results). */
export const WORKSHOP_STAGE = loop('workshop', 'the Workshop: two long flat straights (300 m and 270 m) for crash tests and the weapons range', {
  bottom: [['s', 300, 0, { far: -5, near: -5, rampF: 4, rampN: 4 }]], right: [['s', 40, 0]], top: [['s', 270, 0]], left: [['s', 20, 0]]
}, { name: 'Workshop', laps: 8, trees: { density: 0.0015, pine: 0.4 }, rocks: 0, bushes: 0.001 });
