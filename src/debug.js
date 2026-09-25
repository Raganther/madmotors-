// Handle for automated browser tests (tests/e2e/smoke.mjs) and console poking. Not used by the game itself.
import { G } from './game.js';
import * as core from './core/index.js';
import * as flow from './ui/flow.js';
import { camera, renderFrame, applyQuality } from './render/renderer.js';
import { CUT } from './render/materials.js';
import { carVis, updateCarVisuals } from './render/vehicles.js';
import { updateCamera } from './render/camera.js';
import { updateHUD } from './ui/hud.js';
import { updateTrainsVis } from './render/trains.js';
import { applyBarrierChanges } from './render/world/barriers.js';
import { elementHook } from './render/elements/index.js';
import { updateParticles } from './render/effects/particles.js';

window.__dr = {
  G, core, flow, CUT, get race() { return flow.race; },
  // advance the simulation by `secs` without the real-time loop, then draw one frame
  step(secs) {
    const R = flow.race, W = G.world.W;
    for (let n = 0; n < secs * 120; n++) { flow.savePrev(); core.raceStep(R, core.STEP, W); if (n % 2 === 0) { flow.handleEvents(); applyBarrierChanges(); } }
    G.renderAlpha = 1; updateCarVisuals(1 / 60, 0); elementHook('update', 1 / 60, performance.now() / 1000, 1 / 60); updateParticles(1 / 60); updateTrainsVis(); updateCamera(1 / 60, true); G.hudTick = 0; G.profileTick = 0; updateHUD(1 / 60); renderFrame();
  },
  applyQuality, renderFrame, carVis, get camera() { return camera; }
};
