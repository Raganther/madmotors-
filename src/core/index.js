// Public API of the simulation. Pure JavaScript: no three.js, no DOM, runs in Node for the tests.
export * from './math.js';
export * from './constants.js';
export * from './track/build.js';
export * from './track/downhill.js';
export * from './track/circuit.js';
export * from './track/rails.js';
export * from './track/terrain.js';
export * from './track/query.js';
export * from './sim/barriers.js';
export * from './sim/car.js';
export * from './sim/damage.js';
export * from './sim/ai.js';
export * from './sim/collide.js';
export * from './sim/race.js';
// (each feature module also exports its registry entry as `feature`; that's reached through FEATURES)
export { LANE, trafficControl, spawnTraffic, updateTraffic } from './features/traffic.js';
export { TRAIN_WARN, makeTrains, dispatchTrain, trainBoxes, trainStep, closedCrossingAhead } from './features/trains.js';
export { makeParked } from './features/parked.js';
export { rockStep } from './features/rockfall.js';
export { HZ, hzLeader } from './features/hazards.js';
export { ferryDeckAt, ferryTarget } from './features/ferry.js';
export { FERRY } from './elements/ferry.js';
export { STAGES } from '../data/stages/index.js';
export { FEATURES } from './features/index.js';
export * from './sim/view.js';
export * from './modes/showdown.js';
export * from './elements/index.js';
export { placeKicker, autoJumps, runs } from './elements/jump.js';
