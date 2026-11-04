// Stages still being designed: not in the stage list (so no golden entries, no menu card) until one is chosen.
// Tools take them as draft:<name> (`npm run layout -- draft:timberline-1`, terrain, sandbox, shot), the game as
// ?draft=<name>, and `npm run trackview` puts them side by side in a 3D viewer you can turn on a phone. A draft module
// exports its stage and a `design` (title, story, the beats of the lap by metre, what it needs building) for the viewer.
import * as timberline1 from './timberline-1.js';
import * as timberline2 from './timberline-2.js';
import * as canyonRun from './canyon-run.js';
import * as mesaSpiral from './mesa-spiral.js';
import * as waterfallSteps from './waterfall-steps.js';
import * as damLakes from './dam-lakes.js';
import * as theKnot from './the-knot.js';
import * as ridgeRunner from './ridge-runner.js';
import * as islandLake from './island-lake.js';
import * as crater from './crater.js';
import * as theWall from './the-wall.js';
import * as seaCliffs from './sea-cliffs.js';
import * as archipelago from './archipelago.js';

const LIST = { 'timberline-1': timberline1, 'timberline-2': timberline2, 'canyon-run': canyonRun, 'mesa-spiral': mesaSpiral, 'waterfall-steps': waterfallSteps, 'dam-lakes': damLakes, 'the-knot': theKnot,
  'ridge-runner': ridgeRunner, 'island-lake': islandLake, crater, 'the-wall': theWall, 'sea-cliffs': seaCliffs, archipelago };
export const DRAFTS = Object.fromEntries(Object.entries(LIST).map(([k, m]) => [k, m.default]));
export const DESIGNS = Object.fromEntries(Object.entries(LIST).map(([k, m]) => [k, m.design]));
