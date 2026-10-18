import { G } from '../game.js';
import { STEP } from '../core/constants.js';
import { raceStep } from '../core/sim/race.js';
import { respawn } from '../core/sim/car.js';
import { raceDefs } from '../data/cars.js';
import { vehicleById } from '../data/vehicles.js';
import { STAGES } from '../data/stages/index.js';
import { handleEvents, race, savePrev, selectStage, titleRace } from './flow.js';

// The title screen's action scene, played by the game itself: a pack of cars sent at the leap between the mesas on
// Mesa Leap; as the leader takes off the clock drops to slow motion and a car behind fires a homing missile after it.
// Filmed from beside the run-up, looking along it and up at them in the air, the camera drifting a little; when they're gone it starts again. Runs while the
// title (and the main menu over it) is up; Quick Race builds the stage you pick instead.
const SHOT = { stage: 'Mesa Leap', lip: 293, lead: 'monster', rivals: 5, loop: 8.5 };
// where the camera stands (samples along from the lip, metres to the side and up from the lip's height) and what it
// looks at; G.titleTune overrides any of them (for trying angles from the console)
const CAM = { along: -10, side: 12, up: 2.5, lookAlong: 14, lookSide: -3, lookUp: 4.5, fov: 42 };
let T = null;
/** The title's world: build Mesa Leap (if it isn't up) and start the scene. */
export function startTitle(cb) {
  const idx = STAGES.findIndex(s => s.name === SHOT.stage); if (idx < 0) { cb && cb(); return; }
  selectStage(idx, () => { begin(); cb && cb(); });
}
export function stopTitle() { T = null; G.title = false; G.titleCam = null; }
function begin() {
  titleRace(raceDefs(vehicleById(SHOT.lead), SHOT.rivals));
  T = { t: 0, acc: 0, fired: false, cam: 0 }; G.title = true; place();
}
// line the pack up on the run to the lip at racing speed, two abreast, the lead car (the monster truck) out front
function place() {
  const W = G.world.W, tr = W.tr;
  race.cars.forEach((c, k) => {
    const order = c.isPlayer ? 0 : k + 1, i = SHOT.lip - 34 - order * 6, lat = order % 2 ? -2.2 : 2.2;
    c.ai.lane = lat; c.lastGood = i + 10; respawn(c, W); c.respawns = 0; c.ghost = 0;
    const v = Math.max(28, tr.vmax[i] || 30); c.vx = tr.tx[i] * v; c.vz = tr.tz[i] * v;
    c.wpn.item = null; c.wpn.uses = 0;
  });
  for (const c of race.cars) c.events.length = 0;
  T.t = 0; T.fired = false; savePrev();
}
/** One frame of the scene (main.js, while the title is up). */
export function titleStep(dt) {
  if (!T || !race || !G.world) return;
  const tr = G.world.tr, W = G.world.W, lead = race.cars.reduce((a, c) => c.progress > a.progress ? c : a, race.cars[0]);
  const near = lead.progress - SHOT.lip, slow = near > -6 && near < 34 ? 0.28 : 1;   // the leap in slow motion
  T.t += dt * slow; T.acc += dt * slow; let n = 0;
  while (T.acc >= STEP && n < 12) { savePrev(); raceStep(race, STEP, W); T.acc -= STEP; n++; }
  G.renderAlpha = T.acc / STEP; handleEvents();
  // the missile: the car right behind the leader locks on and fires as the leader leaves the lip
  if (!T.fired && near > -2) {
    const chaser = race.cars.filter(c => c !== lead).reduce((a, c) => c.progress > a.progress ? c : a);
    const w = chaser.wpn; w.item = 'missile'; w.uses = 1; w.lockTgt = race.cars.indexOf(lead); w.lockK = 1; chaser.inp.fire = true; T.fired = true;
  }
  if (T.t > SHOT.loop || near > 95) place();
  // the camera: beside the run-up, looking along it past the lip and up at the cars in the air; drifting sideways
  T.cam += dt; const C = { ...CAM, ...(G.titleTune || {}) }, L = SHOT.lip, i = L + C.along, j = L + C.lookAlong, side = C.side + Math.sin(T.cam * 0.25) * 2.5, up = C.up + Math.sin(T.cam * 0.17) * 0.6;
  G.titleCam = { fov: C.fov, pos: [tr.xs[i] + tr.rx[i] * side, tr.H[L] + up, tr.zs[i] + tr.rz[i] * side], look: [tr.xs[j] + tr.rx[j] * C.lookSide, tr.H[L] + C.lookUp, tr.zs[j] + tr.rz[j] * C.lookSide] };
}
