// Loads the simulation core straight out of a single-file build of the game (the pre-refactor index.html).
import fs from 'node:fs';
export function loadLegacyCore(file) {
  const src = fs.readFileSync(file, 'utf8');
  const code = src.slice(src.indexOf('// ==CORE START=='), src.indexOf('// ==CORE END=='));
  return new Function(code + '\nreturn { STAGES, buildTrack, buildTerrain, createRace, raceStep, stepCar, dispatchTrain, wallAt, HALF, WALL };')();
}
