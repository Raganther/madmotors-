import './debug.js';
import { G } from './game.js';
import { $, isTouch } from './ui/dom.js';
import { loadMode, loadSteer } from './ui/storage.js';
import { AudioSys } from './audio/audio.js';
import { STEP } from './core/constants.js';
import { respawn } from './core/sim/car.js';
import { raceStep } from './core/sim/race.js';
import { STAGES } from './data/stages/index.js';
import { updateCamera } from './render/camera.js';
import { initDebris, updateDebris } from './render/effects/debris.js';
import { initParticles, updateParticles } from './render/effects/particles.js';
import { initProps, updateProps } from './render/effects/props.js';
import { initRings, updateRings } from './render/effects/rings.js';
import { initSkids } from './render/effects/skids.js';
import { CUT, FX } from './render/materials.js';
import { contextLost, cycleQuality, initRenderer, perfSample, renderFrame, renderer } from './render/renderer.js';
import { initCars, updateCarVisuals } from './render/vehicles.js';
import { featureHook } from './render/features.js';
import { applyBarrierChanges } from './render/world/barriers.js';
import { updateFans } from './render/world/scenery.js';
import { setMode, buildStageList, handleEvents, race, resultsShown, savePrev, selectStage, selected, showResults, startRace, toMenu, togglePause, updateResultsTable } from './ui/flow.js';
import { updateHUD } from './ui/hud.js';
import { readInput, setSteer } from './ui/input.js';

export function frame(t) {
  requestAnimationFrame(frame);
  const now = t / 1000, rawDt = Math.max(0, now - G.lastT), dt = Math.min(0.1, rawDt); G.lastT = now;
  if (!G.world || !race) return;
  G.renderAlpha = 1; FX.time.value = now;
  perfSample(rawDt);
  if (G.state === 'countdown') {
    readInput(dt); G.countdown -= dt;
    const n = Math.ceil(G.countdown - 0.2);
    if (n < G.lastBeep && n >= 1) { G.lastBeep = n; AudioSys.beep(440, 0.15); }
    $('countdown').hidden = false; $('countdown').textContent = n >= 1 ? n : 'Go!';
    AudioSys.update(race.player, 'rev');
    if (G.countdown <= 0.2) { G.state = 'racing'; race.phase = 'racing'; AudioSys.beep(880, 0.3); G.goTimer = 0.8; G.accumulator = 0; }
  } else if (G.state === 'racing') {
    if (!race.player.finished) readInput(dt);
    let simDt = dt; if (G.slowmo > 0) { G.slowmo -= dt; simDt = dt * 0.35; }
    G.accumulator += simDt; let n = 0;
    while (G.accumulator >= STEP && n < 12) { savePrev(); raceStep(race, STEP, G.world.W); G.accumulator -= STEP; n++; }
    if (n === 12) G.accumulator = 0;
    G.renderAlpha = G.accumulator / STEP;
    handleEvents(); applyBarrierChanges();
    AudioSys.update(race.player, 'drive');
    if (G.goTimer > 0) { G.goTimer -= dt; if (G.goTimer <= 0) $('countdown').hidden = true; }
    if (race.player.finished && !resultsShown && race.time - race.player.finishTime > 1.6) showResults();
    if (race.sd && race.sd.phase === 'over' && !resultsShown && race.time - G.sdOverAt > 1.8) showResults();
    if (resultsShown) { G.resultsTick -= dt; if (G.resultsTick <= 0) { G.resultsTick = 0.5; updateResultsTable(); } }
  }
  if (G.calloutTimer > 0) { G.calloutTimer -= dt; if (G.calloutTimer <= 0) $('callout').hidden = true; }
  if (G.hintTimer > 0 && G.state !== 'paused') { G.hintTimer -= dt; $('hint').hidden = G.hintTimer <= 0; } else if (G.hintTimer <= 0) $('hint').hidden = true;
  if (race && G.state !== 'menu') { const P = race.player; CUT.car.value.set(P.x, P.y, P.z); const cov = G.world.cover[P.pr.i % G.world.cover.length] ? 8.5 : 0; CUT.r.value += ((G.state === 'paused' ? CUT.r.value : cov) - CUT.r.value) * Math.min(1, dt * 6); } else CUT.r.value = 0;
  if (G.state !== 'paused') { const fxDt = G.slowmo > 0 ? dt * 0.35 : dt; updateDebris(fxDt); updateProps(fxDt); updateRings(fxDt); updateCarVisuals(dt, now); featureHook('update', dt, now, fxDt); updateParticles(fxDt); updateFans(now); updateCamera(dt, false); }
  updateHUD(dt);
  if (!contextLost) renderFrame();
}
export function wireUI() {
  $('race-btn').addEventListener('click', () => {
    if (!renderer || !G.world) { $('loading').hidden = false; return; }
    startRace(selected);
  });
  $('resume-btn').addEventListener('click', togglePause);
  $('restart-btn').addEventListener('click', () => { $('pause').hidden = true; startRace(G.world.idx); });
  $('quit-btn').addEventListener('click', toMenu);
  $('again-btn').addEventListener('click', () => startRace(G.world.idx));
  $('next-btn').addEventListener('click', () => startRace((G.world.idx + 1) % STAGES.length));
  $('menu-btn').addEventListener('click', toMenu);
  $('pause-btn').addEventListener('click', togglePause);
  $('reset-btn').addEventListener('click', () => { if (G.state === 'racing' && !race.player.finished) respawn(race.player, G.world.W); });
  $('mute-btn').addEventListener('click', () => { AudioSys.init(); AudioSys.toggle(); });
  document.querySelectorAll('.mode-btn').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
  $('gfx-btn').addEventListener('click', () => { if (renderer) cycleQuality(); });
  for (const b of document.querySelectorAll('.steer-btn')) b.addEventListener('click', () => setSteer(G.steer === 'wheel' ? 'arrows' : 'wheel'));
}
export async function boot() {
  let step = 'setting up the menu';
  try {
    wireUI(); buildStageList(); setMode(loadMode());
    setSteer(loadSteer()); for (const b of document.querySelectorAll('.steer-btn')) b.hidden = !isTouch;   // steering choice only matters with touch controls
    if (isTouch) { document.documentElement.classList.add('touch'); $('time-block').insertBefore($('speed-block'), $('time-block').querySelector('.hud-btns')); }   // keep the speedo clear of the thumb controls
    $('race-btn').textContent = 'Race ' + STAGES[0].name;
    step = 'starting WebGL'; initRenderer(); initParticles(); initSkids(); initDebris(); initRings(); initProps();
    step = 'loading fonts';
    try { await Promise.race([document.fonts ? document.fonts.load('40px Bungee') : null, new Promise(r => setTimeout(r, 1200))]); } catch (e) { }
    step = 'building the cars'; initCars(); featureHook('init');
    step = 'building the first stage';
    selectStage(0);
    requestAnimationFrame(frame);
  } catch (e) {
    console.error(e); window.__bootError((e && e.message ? e.message : String(e)) + ' (while ' + step + ')');
  }
}
boot();
