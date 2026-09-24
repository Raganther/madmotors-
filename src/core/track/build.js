import { buildLoop } from './circuit.js';
import { finishTrack, genPath, validPath } from './downhill.js';
import { validateStage } from '../elements/index.js';

/** Build the road for a stage. @param {import('../types.js').Stage} stage @returns {import('../types.js').Track} */
export function buildTrack(stage) {
  validateStage(stage);                                   // unknown tags / options fail loudly instead of doing nothing
  if (stage.type === 'loop' || stage.type === 'pass' || stage.type === 'gorge') return buildLoop(stage);
  let seed = stage.seed;
  for (let attempt = 0; attempt < 80; attempt++, seed += 977) {
    const g = genPath(stage, seed);
    if (validPath(g)) return finishTrack(stage, g, seed);
  }
  throw new Error('Track generation failed for ' + stage.name);
}
