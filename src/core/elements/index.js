// Track elements: every reusable piece of a stage (bridge, tunnel, kicker, town...) lives in one module here, which
// owns what the piece does to the built track. Each element is a plain object with any of:
//   name, about                    id and one-line description (shown by the tools and the debug overlay)
//   tags: { tag: doc }             section tags it reads (['s', len, h, tags] / ['a', r, deg, h, tags])
//   stageKeys: { key: doc }        stage-level options it reads
//   channels: { name: tg => v }    per-sample values recorded from each section's tags (available as ctx.ch[name])
//   section(tg, i0, i1, marks)     section-level markers (samples i0..i1 of this section)
//   heights(ctx)                   after the road heights are smoothed (kickers, level crossings)
//   walls(ctx)                     after the base barriers (curves, drops); wallsLate after hairpins; wallsLast at the end
//   track(ctx, out)                fields to put on the built track
//   markers(tr) -> [{ i, label }]  where it is, for the layout map, the sandbox report and the debug overlay
//   onBranch                       true if it can be used on a branch (stage.branches; see core/track/route.js)
// Its visuals live in render/elements (the same name). Order matters: it fixes the order the track is built in.
import { element as ground } from './ground.js';
import { element as rails } from './rails.js';
import { element as jump } from './jump.js';
import { element as kick } from './kick.js';
import { element as bridge } from './bridge.js';
import { element as tunnel } from './tunnel.js';
import { element as town } from './town.js';
import { element as gallery } from './gallery.js';
import { element as rockfall } from './rockfall.js';
import { element as arch } from './arch.js';
import { element as gap } from './gap.js';
import { element as boost } from './boost.js';
import { element as ferry } from './ferry.js';
import { element as falls } from './falls.js';

export const ELEMENTS = [ground, rails, jump, kick, bridge, tunnel, town, gallery, rockfall, arch, gap, boost, ferry, falls];
export const elementPhase = (phase, ...args) => { for (const e of ELEMENTS) if (e[phase]) e[phase](...args); };

// stage options that belong to the stage itself rather than to an element
const BASE_KEYS = ['name', 'blurb', 'type', 'laps', 'seed', 'surface', 'hillAmp', 'armco', 'startHeading', 'light', 'colors', 'trees', 'rocks', 'bushes', 'cacti',
  'village', 'alpine', 'strata', 'river', 'segs', 'branches', 'traffic', 'plan', 'grade', 'carve', 'L', 'W'];
export const SECTION_TAGS = Object.fromEntries(ELEMENTS.flatMap(e => Object.entries(e.tags || {}).map(([t, d]) => [t, `${e.name}: ${d}`])));
export const STAGE_KEYS = new Set(BASE_KEYS.concat(ELEMENTS.flatMap(e => Object.keys(e.stageKeys || {}))));
/** Catch typos early: unknown section tags or stage options throw, listing what's allowed. */
export function validateStage(stage) {
  const bad = [];
  for (const k of Object.keys(stage)) if (!STAGE_KEYS.has(k)) bad.push(`stage option "${k}"`);
  (stage.segs || []).forEach((sg, n) => { const tg = (sg[0] === 's' ? sg[3] : sg[4]) || {}; for (const t of Object.keys(tg)) if (!(t in SECTION_TAGS)) bad.push(`section ${n} tag "${t}"`); });
  if (bad.length) throw new Error(`${stage.name}: unknown ${bad.join(', ')}. Section tags: ${Object.keys(SECTION_TAGS).join(', ')}`);
}
/** Every element's markers on a built track, sorted along the road. */
export function trackMarkers(tr) { return ELEMENTS.flatMap(e => (e.markers ? e.markers(tr) : []).map(m => ({ ...m, element: e.name }))).sort((a, b) => a.i - b.i); }
