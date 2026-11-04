// Stages still being designed: not in the stage list (so no golden entries, no menu card) until one is chosen.
// Tools take them as draft:<name> (`npm run layout -- draft:timberline-1`, terrain, sandbox, shot), the game as
// ?draft=<name>, and `npm run trackview` puts them side by side in a 3D viewer you can turn on a phone. A draft module
// exports its stage and a `design` (title, story, the beats of the lap by metre, what it needs building) for the viewer.
import timberline1, { design as timberline1Design } from './timberline-1.js';
import timberline2, { design as timberline2Design } from './timberline-2.js';

export const DRAFTS = { 'timberline-1': timberline1, 'timberline-2': timberline2 };
export const DESIGNS = { 'timberline-1': timberline1Design, 'timberline-2': timberline2Design };
