// Stages still being designed: not in the stage list (so no golden entries, no menu card) until one is chosen.
// Tools take them as draft:<name> (`npm run layout -- draft:timberline-a`, terrain, sandbox, shot), the game as
// ?draft=<name>, and `npm run trackview` puts them side by side in a 3D viewer you can turn on a phone. A draft module
// exports its stage and a `design` (title, story, the beats of the lap by metre, what it needs building) for the viewer.
import timberlineA, { design as timberlineADesign } from './timberline-a.js';
import timberlineB, { design as timberlineBDesign } from './timberline-b.js';
import timberlineC, { design as timberlineCDesign } from './timberline-c.js';

export const DRAFTS = { 'timberline-a': timberlineA, 'timberline-b': timberlineB, 'timberline-c': timberlineC };
export const DESIGNS = { 'timberline-a': timberlineADesign, 'timberline-b': timberlineBDesign, 'timberline-c': timberlineCDesign };
