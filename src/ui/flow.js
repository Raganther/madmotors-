import { G } from '../game.js';
import { AudioSys } from '../audio/audio.js';
import { clamp } from '../core/math.js';
import { createRace, ranking } from '../core/sim/race.js';
import { screenOffset } from '../core/sim/view.js';
import { CAR_DEFS } from '../data/cars.js';
import { STAGES } from '../data/stages/index.js';
import { updateCamera } from '../render/camera.js';
import { clearDebris } from '../render/effects/debris.js';
import { carCrashFx, dustRing, impactFx, sparks } from '../render/effects/impacts.js';
import { clearProps } from '../render/effects/props.js';
import { shockwave } from '../render/effects/rings.js';
import { clearSkids } from '../render/effects/skids.js';
import { camera, renderer, scene } from '../render/renderer.js';
import { carVis, dentFx, repairCarVis, sdBoomFx, sdSpawnFx, visOf, wreckFx } from '../render/vehicles.js';
import { resetBarrierVis } from '../render/world/barriers.js';
import { TRACKS, buildWorld } from '../render/world/index.js';
import { featureHook } from '../render/features.js';
import { $, isTouch } from './dom.js';
import { fmt, ordinal } from './format.js';
import { callout, drawProfile } from './hud.js';
import { best, saveBest, saveMode } from './storage.js';

export let race = null, pausedFrom = null, selected = 0;
G.world = null; G.state = 'menu';
G.accumulator = 0; G.lastT = 0; G.countdown = 0; G.lastBeep = 4; G.goTimer = 0; G.attractS = 0; G.viewH = 46;
export let resultsShown = false, racesStarted = 0, newBest = false;
G.resultsTick = 0; G.hudTick = 0; G.profileTick = 0; G.hintTimer = 0;
export function newRace() {
  const r = createRace(G.world.W, CAR_DEFS, { mode: G.mode }); clearProps(); resetBarrierVis(); carVis.forEach(repairCarVis);
  featureHook('newRace', r);
  return r;
}
// ---------- flow ----------
export function handleEvents() {
  for (const c of race.cars.concat(race.traffic, race.parked || [])) {
    for (const e of c.events) {
      const near = Math.hypot(c.x - race.player.x, c.z - race.player.z) < 40;
      switch (e.t) {
        case 'hit': impactFx(c, e, c.isPlayer, near); break;
        case 'smash': impactFx(c, e, c.isPlayer, near); if (c.isPlayer && e.v > 9 && G.calloutTimer <= 0) callout('Smash!'); break;
        case 'bump': carCrashFx(e, e.a.isPlayer || e.b.isPlayer, near); break;
        case 'land': if (e.air > 0.25) dustRing(c, 12, c.surface === 'tarmac' ? 0xDADADA : 0xD8C29A); if (c.isPlayer && e.air > 0.2) AudioSys.thud(e.imp / 22); break;
        case 'bigair': if (c.isPlayer) { callout('Big air!'); AudioSys.whoosh(); } break;
        case 'drift': if (c.isPlayer) { callout(e.amt > 1.6 ? 'Mega drift!' : 'Drift boost!'); AudioSys.whoosh(); } else if (near) AudioSys.whoosh(0.35); break;
        case 'respawn': if (c.isPlayer) callout('Back on track'); break;
        case 'dent': dentFx(c, e); break;
        case 'wreck': wreckFx(c, c.isPlayer, near); break;
        case 'rockhit': sparks(e.x, e.y, e.z, 14); if (c.isPlayer || near) AudioSys.crash('metal', clamp(e.v / 20, 0.2, 0.9) * (c.isPlayer ? 1 : 0.5)); if (c.isPlayer) G.shake = Math.min(1.4, G.shake + 0.8); break;
        case 'trainhit': sparks(e.x, e.y, e.z, 45); shockwave(e.x, e.y, e.z, 9, 0xFFFFFF); if (c.isPlayer) { G.shake = 1.8; callout('Hit by a train!'); } if (c.isPlayer || near) AudioSys.crash('metal', c.isPlayer ? 1 : 0.5); break;
        case 'repair': { const v = visOf(c); if (v) repairCarVis(v); break; }
        case 'horn': if (Math.hypot(c.x - race.player.x, c.z - race.player.z) < 70) AudioSys.horn(c.def.kind === 'truck' ? 0.75 : 1); break;
        case 'lap': if (c.isPlayer) { callout(e.n === G.world.tr.laps ? 'Final lap!' : 'Lap ' + e.n); AudioSys.beep(660, 0.2); } break;
        case 'sd-round': sdRound(e); if (e.boom) for (const k of e.losers) { const b = race.cars[k]; sdBoomFx(b, b.isPlayer || onScreen(b)); } break;
        case 'sd-spawn': sdSpawnFx(c); if (c.isPlayer) { callout(e.slot === 'front' ? 'Back in, ahead!' : e.slot === 'beside' ? 'Back in, alongside!' : 'Back in, behind!'); AudioSys.tone(440, 0.25, 0.08, 'triangle', 2); } break;
        case 'sd-over': { G.sdOverAt = race.time; const w = race.cars[e.winner]; callout(w.isPlayer ? 'You win the Showdown!' : w.name + ' wins the Showdown'); AudioSys.beep(w.isPlayer ? 988 : 330, 0.4); break; }
        case 'finish':
          if (c.isPlayer) {
            callout(ordinal(c.place) + ' place!'); AudioSys.beep(880, 0.35);
            newBest = !best[G.world.idx] || c.finishTime < best[G.world.idx];
            if (newBest) { best[G.world.idx] = c.finishTime; saveBest(); refreshBest(); }
          }
          break;
      }
    }
    c.events.length = 0;
  }
}
/** Is a car inside the current Showdown view? */
function onScreen(c) { const v = race.sd.view, f = race.sd.focus; if (!v || !f) return false; const [sx, sy] = screenOffset(c.x, c.y, c.z, f); return Math.abs(sx) < v.hw && Math.abs(sy) < v.hh; }
// a round of Showdown: the leader took a light from each car that dropped off the screen (blown up, or left behind in a breakaway)
function sdRound(e) {
  const P = race.player, pi = race.cars.indexOf(P), w = race.cars[e.winner], n = e.losers.length;
  if (e.boom) {
    const lost = e.losers.includes(pi);
    callout(lost ? 'Boom! You lose a light' : e.winner === pi ? (n > 1 ? `Boom! You take ${n} lights` : 'Boom! You take a light') : `${race.cars[e.losers[0]].name} blew up!`);
    if (lost) AudioSys.tone(520, 0.3, 0.08, 'triangle', 0.5); else if (e.winner === pi) AudioSys.tone(660, 0.12, 0.08, 'triangle', 1.5);
  } else if (e.winner === pi) { callout(n > 1 ? `Breakaway! +${n} lights` : 'Breakaway! +1 light'); AudioSys.tone(660, 0.12, 0.08, 'triangle', 1.5); }
  else { callout(`${w.name} breaks away!`); if (e.losers.includes(pi)) AudioSys.tone(520, 0.3, 0.08, 'triangle', 0.5); }
}
export function showResults() {
  if (race.sd) return showShowdownResults();
  resultsShown = true; $('results').hidden = false; $('touch').hidden = true;
  const P = race.player;
  $('res-title').textContent = 'You finished ' + ordinal(P.place);
  $('res-stage').textContent = `Stage ${G.world.idx + 1}: ${G.world.stage.name}`;
  $('res-best').textContent = newBest ? 'New best time on this stage' : 'Best time ' + fmt(best[G.world.idx]);
  $('next-btn').textContent = G.world.idx < STAGES.length - 1 ? 'Next stage' : 'Back to stage 1';
  updateResultsTable();
  $('next-btn').focus();
}
function showShowdownResults() {
  resultsShown = true; $('results').hidden = false; $('touch').hidden = true;
  const w = race.cars[race.sd.winner], won = w === race.player;
  $('res-title').innerHTML = `<span class="chip" style="background:#${w.def.color.toString(16).padStart(6, '0')}"></span>` + (won ? 'You won the Showdown' : w.name + ' won the Showdown');
  $('res-stage').textContent = `Stage ${G.world.idx + 1}: ${G.world.stage.name}, ${race.sd.rounds} ${race.sd.rounds === 1 ? 'round' : 'rounds'}`;
  $('res-best').textContent = 'Showdown: lose the pack off the screen to blow them up and take their lights';
  $('next-btn').textContent = G.world.idx < STAGES.length - 1 ? 'Next stage' : 'Back to stage 1';
  updateResultsTable(); $('next-btn').focus();
}
export function updateResultsTable() {
  if (race.sd) {
    const S = race.sd, order = race.cars.map((c, k) => ({ c, k, l: S.lights[k] })).sort((a, b) => b.l - a.l || b.c.progress - a.c.progress);
    $('res-table').innerHTML = order.map(({ c, k, l }, i) => `<tr class="${c.isPlayer ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td><span class="chip" style="background:#${c.def.color.toString(16).padStart(6, '0')}"></span>${c.name}<span class="rs">took ${S.taken[k]} · blew up ${S.booms[k]}×</span></td><td class="rt">${l + (l === 1 ? ' light' : ' lights')}</td></tr>`).join('');
    return;
  }
  const order = ranking(race);
  $('res-table').innerHTML = order.map((c, i) => `<tr class="${c.isPlayer ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td><span class="chip" style="background:#${c.def.color.toString(16).padStart(6, '0')}"></span>${c.name}</td><td class="rt">${c.finished ? fmt(c.finishTime) : 'Still racing'}</td></tr>`).join('');
}
export let pendingBuild = null;
export function selectStage(i, cb) {
  selected = i;
  document.querySelectorAll('.stage').forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
  $('race-btn').textContent = (G.mode === 'showdown' ? 'Showdown: ' : 'Race ') + STAGES[i].name;
  if (G.world && G.world.idx === i) { cb && cb(); return; }
  $('loading-text').textContent = 'Building ' + STAGES[i].name; $('loading').hidden = false;
  clearTimeout(pendingBuild);
  pendingBuild = setTimeout(() => {
    try { buildWorld(i); renderer.compile(scene, camera); } catch (e) { console.error(e); window.__bootError(e.message + ' (while building ' + STAGES[i].name + ')'); return; } race = newRace(); G.attractS = 0; updateCamera(0, true);
    $('loading').hidden = true; cb && cb();
  }, 40);
}
export function startRace(idx) {
  AudioSys.init();
  selectStage(idx, () => {
    race = newRace(); clearSkids(); clearDebris(); G.shake = 0; G.slowmo = 0;
    G.state = 'countdown'; G.countdown = 3.2; G.lastBeep = 4; G.goTimer = 0; resultsShown = false; newBest = false; G.standingsKey = ''; G.sdKey = ''; G.sdTick = 0; $('edge').className = '';
    $('menu').hidden = true; $('results').hidden = true; $('pause').hidden = true; $('hud').hidden = false; $('touch').hidden = !isTouch;
    $('stage-name').textContent = `Stage ${idx + 1}: ${STAGES[idx].name}`;
    racesStarted++; G.hintTimer = racesStarted <= 2 ? 7 : 0;
    $('hint').textContent = isTouch ? 'Slide Gas down to drift, back up to boost' : 'Hold Space through a corner to drift, then let go for a boost';
    updateCamera(0, true);
  });
}
export function toMenu() {
  G.state = 'menu'; $('hud').hidden = true; $('results').hidden = true; $('pause').hidden = true; $('touch').hidden = true; $('menu').hidden = false; $('countdown').hidden = true;
  race = newRace(); clearSkids(); AudioSys.update(null, 'off'); updateCamera(0, true); $('race-btn').focus();
}
export function togglePause() {
  if (G.state === 'countdown' || G.state === 'racing') { if (resultsShown) return; pausedFrom = G.state; G.state = 'paused'; $('pause').hidden = false; AudioSys.update(null, 'off'); $('resume-btn').focus(); }
  else if (G.state === 'paused') { G.state = pausedFrom; $('pause').hidden = true; G.lastT = performance.now() / 1000; }
}
export function refreshBest() { STAGES.forEach((s, i) => { const el = $('best-' + i); if (el) el.textContent = best[i] ? 'Best ' + fmt(best[i]) : 'Not raced yet'; }); }
const MODE_DESC = {
  race: 'Beat three rivals to the line.',
  showdown: 'Head to head: the camera follows the leader. The camera zooms out to keep up; fall too far behind and you blow up, handing the leader one of your lights. Everyone starts with 4; first to 10 wins.'
};
export function setMode(m) {
  G.mode = m; saveMode(m);
  document.querySelectorAll('.mode-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m ? 'true' : 'false'));
  $('mode-desc').textContent = MODE_DESC[m];
  $('race-btn').textContent = (m === 'showdown' ? 'Showdown: ' : 'Race ') + STAGES[selected].name;
}
export function buildStageList() {
  const ol = $('stage-list'); ol.innerHTML = '';
  STAGES.forEach((s, i) => {
    const li = document.createElement('li'), b = document.createElement('button');
    b.className = 'stage'; b.type = 'button'; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<span class="st-num">${i + 1}</span><span class="st-text"><span class="st-name">${s.name}</span><span class="st-meta">${s.laps ? `Circuit, ${s.laps} laps` : s.surface === 'gravel' ? 'Gravel' : 'Tarmac'}. ${s.blurb}</span><span class="st-best" id="best-${i}"></span></span><canvas class="st-prof" aria-hidden="true"></canvas>`;
    b.addEventListener('click', () => selectStage(i));
    li.appendChild(b); ol.appendChild(li);
  });
  refreshBest();
  requestAnimationFrame(() => document.querySelectorAll('.st-prof').forEach((cv, i) => drawProfile(cv, TRACKS[i], null, 2)));
}
// Physics runs at a fixed 120 Hz; cars are drawn between the last two physics states so motion stays smooth at any refresh rate.
G.renderAlpha = 1;
export function savePrev() { for (const list of [race.cars, race.traffic, race.parked]) for (const c of list) { c.px = c.x; c.py = c.y; c.pz = c.z; c.pyaw = c.yaw; } }
