import { buildLoop } from './circuit.js';
import { finishTrack, genPath, validPath } from './downhill.js';
import { validateStage } from '../elements/index.js';
import { prepareGround } from './ground.js';
import { editHouses } from './edits.js';

/** Build the road for a stage. @param {import('../types.js').Stage} stage @returns {import('../types.js').Track} */
export function buildTrack(stage) {
  prepareGround(stage);                                   // a described landscape (stage.ground hills, stage.drape): its grid and draped road
  validateStage(stage);                                   // unknown tags / options fail loudly instead of doing nothing
  if (stage.type === 'loop' || stage.type === 'pass' || stage.type === 'gorge') return withHouses(buildLoop(stage), stage);
  let seed = stage.seed;
  for (let attempt = 0; attempt < 80; attempt++, seed += 977) {
    const g = genPath(stage, seed);
    if (validPath(g)) return withHouses(finishTrack(stage, g, seed), stage);
  }
  throw new Error('Track generation failed for ' + stage.name);
}

// the Track Studio's placed buildings (core/track/edits.js) join the stage's own
function withHouses(tr, stage) { editHouses(tr, stage); return tr; }
