import { buildLoop } from './circuit.js';
import { finishTrack, genPath, validPath } from './downhill.js';

export function buildTrack(stage) {
  if (stage.type === 'loop' || stage.type === 'pass' || stage.type === 'gorge') return buildLoop(stage);
  let seed = stage.seed;
  for (let attempt = 0; attempt < 80; attempt++, seed += 977) {
    const g = genPath(stage, seed);
    if (validPath(g)) return finishTrack(stage, g, seed);
  }
  throw new Error('Track generation failed for ' + stage.name);
}
