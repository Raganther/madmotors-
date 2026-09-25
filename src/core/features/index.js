// Race features: optional systems a stage can switch on through its data. Each is a plain object with any of:
//   init(R, W)                       set up its state on the race object
//   vehicles(R)                      extra cars that take part in collisions and AI avoidance
//   move(R, W, dt, all, racing)      drive/step those cars (after the racers each step)
//   spawn(R, W, dt)                  add/remove things (after moving, before collisions)
//   after(R, W, dt)                  hazards that act on everyone (after collisions)
// Order matters for exact reproducibility (it fixes the order random numbers are drawn in): keep new ones at the end.
import { feature as traffic } from './traffic.js';
import { feature as trains } from './trains.js';
import { feature as parked } from './parked.js';
import { feature as rockfall } from './rockfall.js';
import { feature as hazards } from './hazards.js';
import { feature as ferry } from './ferry.js';
import { feature as drawbridge } from './drawbridge.js';
import { feature as mud } from './mud.js';

export const FEATURES = [traffic, trains, parked, rockfall, hazards, ferry, drawbridge, mud];
