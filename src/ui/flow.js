import { G } from '../game.js';
import { AudioSys } from '../audio/audio.js';
import { clamp } from '../core/math.js';
import { createRace, ranking } from '../core/sim/race.js';
import { screenOffset } from '../core/sim/view.js';
import { CP, SD } from '../core/modes/showdown.js';
import { DEFAULT_RIVALS, MAX_RIVALS, raceDefs } from '../data/cars.js';
import { vehicleById } from '../data/vehicles.js';
import { STAGES } from '../data/stages/index.js';
import { updateCamera } from '../render/camera.js';
import { clearDebris } from '../render/effects/debris.js';
import { clearSparks } from '../render/effects/sparks.js';
import { emit } from '../render/effects/particles.js';
import { carCrashFx, dustRing, impactFx, sparks } from '../render/effects/impacts.js';
import { clearProps } from '../render/effects/props.js';
import { shockwave } from '../render/effects/rings.js';
import { clearSkids } from '../render/effects/skids.js';
import { camera, renderer, scene } from '../render/renderer.js';
import { resetDirt } from '../render/effects/dirt.js';
import { bulletHitFx, missileBlast, missilePuff, mountKick, oilDropFx, pickupFx, pulseFx } from '../render/weapons.js';
import { landDust } from '../render/effects/carfx.js';
import { carVis, setRoster, dentFx, repairCarVis, sdBoomFx, sdSpawnFx, takedownFx, visOf, wreckFx } from '../render/vehicles.js';
import { resetBarrierVis } from '../render/world/barriers.js';
import { buildWorld, trackOf } from '../render/world/index.js';
import { elementHook } from '../render/elements/index.js';
import { $, isTouch } from './dom.js';
import { fmt, ordinal } from './format.js';
import { callout, drawProfile } from './hud.js';
import { best, saveBest, saveMode, saveRivals, saveWeapons } from './storage.js';

export let race = null, pausedFrom = null, selected = 0;
G.world = null; G.state = 'menu';
G.accumulator = 0; G.lastT = 0; G.countdown = 0; G.lastBeep = 4; G.goTimer = 0; G.attractS = 0; G.viewH = 46;
export let resultsShown = false, racesStarted = 0, newBest = false;
G.resultsTick = 0; G.hudTick = 0; G.profileTick = 0; G.hintTimer = 0;
export function newRace() {
  const defs = raceDefs(vehicleById(G.vehicle), G.mode !== 'race' ? DEFAULT_RIVALS : G.rivals); setRoster(defs);                        // the line-up, with the player's pick
  const r = createRace(G.world.W, defs, { mode: G.mode, weapons: G.weapons }); clearProps(); resetBarrierVis(); carVis.forEach(v => { repairCarVis(v); resetDirt(v); });   // repaired and washed
  elementHook('newRace', r);
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
        case 'land':   // bigger jumps kick up more dust; long ones throw a second ring of grit and jolt the camera
          if (e.air > 0.25) { const k = Math.min(1, (e.air - 0.25) / 0.6), dirt = G.world.stage.colors.dirt; dustRing(c, 12 + Math.round(k * 14), landDust(c), 5 + k * 5, 1.1 + k * 0.6); if (e.air > 0.5 && near) dustRing(c, 10, dirt, 9, 0.8); }
          if (e.imp > 15 && c.surface === 'tarmac' && near) sparks(c.x, c.y - 0.5, c.z, Math.round(e.imp * 0.8), c.vx / (Math.hypot(c.vx, c.vz) + 1), c.vz / (Math.hypot(c.vx, c.vz) + 1));   // bottoming out
          if (c.isPlayer && e.air > 0.2) { AudioSys.thud(e.imp / 22); if (e.air > 0.4) G.shake = Math.min(1.2, G.shake + e.imp / 40); }
          break;
        case 'bigair': if (c.isPlayer) { callout('Big air!'); AudioSys.whoosh(); } break;
        case 'drift': if (c.isPlayer) { callout(e.amt > 1.6 ? 'Mega drift!' : 'Drift boost!'); AudioSys.whoosh(); } else if (near) AudioSys.whoosh(0.35); break;
        case 'respawn': if (c.isPlayer) callout('Back on track'); break;
        case 'dent': dentFx(c, e); break;
        case 'wreck': if (!c.destroyed) wreckFx(c, c.isPlayer, near); break;
        case 'hazard': { const d = e.i - race.player.pr.i; if (d > 0 && d < 260) callout(e.kind === 'cows' ? 'Cows on the road!' : 'Oil ahead!'); break; }
        case 'cowhit': dustRing(e, 14, 0xC9B79C, 6, 1.3); for (let k = 0; k < 8; k++) emit(e.x, e.y + 1, e.z, (Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.9, 0.5, k % 2 ? 0xF4F1EA : 0x22201E, 12);
          if (c.isPlayer || near) AudioSys.moo(c.isPlayer ? 1 : 0.5); if (c.isPlayer) { callout('Moo!'); G.shake = Math.min(1.2, G.shake + 0.6); AudioSys.thud(0.6); } break;
        case 'oil': for (let k = 0; k < 10; k++) emit(e.x, e.y + 0.2, e.z, (Math.random() - 0.5) * 5, 1 + Math.random() * 2, (Math.random() - 0.5) * 5, 0.6, 0.5, 0x151218, 10); if (c.isPlayer) callout('Oil slick!'); break;
        case 'fell': if (c.isPlayer) { callout('Into the gorge!'); AudioSys.tone(500, 0.6, 0.08, 'triangle', 0.4); } break;
        case 'boostpad': if (c.isPlayer) AudioSys.whoosh(0.6); break;
        case 'ferry-board': callout('All aboard!'); AudioSys.bell(); break;
        case 'ferry-depart': { const pi = race.cars.indexOf(race.player); AudioSys.horn(0.55); if (e.aboard.includes(pi)) callout('Ferry departing!'); else if (e.left.includes(pi)) callout('Missed the ferry!'); break; }
        case 'ferry-arrive': if (race.ferries.some(f => f.pOn)) { callout('Go go go!'); AudioSys.bell(); } break;
        case 'draw-warn': case 'draw-rise': {                                           // the drawbridge ahead is going up
          const tr = G.world.tr, N0 = tr.loopN || tr.N, d = ((e.i - race.player.pr.s % N0) % N0 + N0) % N0;
          if (e.t === 'draw-warn' && d < 300) callout('Bridge going up!'); else if (e.t === 'draw-rise' && d < 110) callout('Jump it!');
          break;
        }
        case 'splash': dustRing(c, 18, 0xE6F2FF, 7, 1.4); if (c.isPlayer) callout('Splash!'); break;
        case 'destroyed': takedownFx(c, e, e.by.isPlayer, near); break;
        case 'takedown': if (c.isPlayer) { callout(e.kind === 'truck' ? 'Truck takedown!' : 'Takedown!'); AudioSys.whoosh(); } break;
        case 'rockhit': sparks(e.x, e.y, e.z, 14); if (c.isPlayer || near) AudioSys.crash('metal', clamp(e.v / 20, 0.2, 0.9) * (c.isPlayer ? 1 : 0.5)); if (c.isPlayer) G.shake = Math.min(1.4, G.shake + 0.8); break;
        case 'trainhit': sparks(e.x, e.y, e.z, 45); shockwave(e.x, e.y, e.z, 9, 0xFFFFFF); if (c.isPlayer) { G.shake = 1.8; callout('Hit by a train!'); } if (c.isPlayer || near) AudioSys.crash('metal', c.isPlayer ? 1 : 0.5); break;
        case 'repair': { const v = visOf(c); if (v) repairCarVis(v); break; }
        case 'horn': if (Math.hypot(c.x - race.player.x, c.z - race.player.z) < 70) AudioSys.horn(c.def.kind === 'truck' ? 0.75 : 1); break;
        case 'lap': if (c.isPlayer) { callout(e.n === G.world.tr.laps ? 'Final lap!' : 'Lap ' + e.n); AudioSys.beep(660, 0.2); } break;
        case 'sd-boom': sdBoom(e); for (const k of e.losers) { const b = race.cars[k]; sdBoomFx(b, b.isPlayer || onScreen(b)); } break;
        case 'sd-crown': sdCrown(e); break;
        case 'cp-point': cpPoint(e); break;
        case 'pickup': pickupFx(e); if (c.isPlayer) { callout(ITEM_NAME[e.item] + '!'); AudioSys.tone(660, 0.12, 0.07, 'triangle', 1.6); AudioSys.tone(990, 0.16, 0.05, 'triangle', 1.3); } else if (near) AudioSys.tone(520, 0.08, 0.03, 'triangle', 1.5); break;
        case 'use': mountKick(visOf(c)); useFx(c, e.item, near); break;
        case 'shot': if (near) AudioSys.burst(c.isPlayer ? 0.1 : 0.05, 'highpass', 2200, 0.05); break;
        case 'bullet-hit': bulletHitFx(e); if (c.isPlayer) { G.shake = Math.min(1, G.shake + 0.12); if (G.calloutTimer <= 0) callout('Taking fire!'); } break;
        case 'oil-hit': if (c.isPlayer) callout('Oil!'); else if (race.cars[e.from] === race.player && G.calloutTimer <= 0) callout(`${c.name} hit your oil!`); break;
        case 'pulse-hit': if (c.isPlayer) { callout('Shockwave! Engine out!'); G.shake = Math.min(1.4, G.shake + 0.7); } break;
        case 'harpoon-hit': { const by = race.cars[e.from]; if (c.isPlayer) callout(`Harpooned by ${by.name}!`); else if (by === race.player) callout(`Hooked ${c.name}!`); if (near) AudioSys.crash('metal', 0.4); break; }
        case 'missile-lock': if (c.isPlayer) { callout(`${race.cars[e.from].name} fired a missile at you!`); AudioSys.beep(1500, 0.1); AudioSys.tone(1200, 0.25, 0.05, 'square', 1.2); } break;
        case 'missile-hit': missileBlast(e); if (near) { AudioSys.crash('car', 1); AudioSys.burst(0.7, 'lowpass', 140, 0.7); } if (c.isPlayer) { G.shake = Math.min(1.6, G.shake + 1.1); callout('Hit by a missile!'); } else if (race.cars[e.from] === race.player) callout(`Direct hit on ${c.name}!`); break;
        case 'missile-fizzle': missilePuff(e); break;
        case 'door': if (near) AudioSys.burst(0.12, 'bandpass', 1500, 0.12); break;
        case 'door-hit': sparks(e.x, e.y, e.z, 8); if (near) AudioSys.crash('metal', 0.55); { const by = race.cars[e.by]; if (c.isPlayer) { G.shake = Math.min(1.2, G.shake + 0.5); callout(`Door slam from ${by.name}!`); } else if (by === race.player) callout(`Slammed ${c.name}!`); } break;
        case 'cp-miss': callout('Nobody through the gate'); break;
        case 'sd-streak': if (c.isPlayer) { callout(`Crown streak ×${e.mult}!`); AudioSys.tone(880, 0.1, 0.07, 'triangle', 1.3); } break;
        case 'sd-spawn': sdSpawnFx(c); if (c.isPlayer) { callout(e.slot === 'front' ? 'Back in, ahead!' : e.slot === 'beside' ? 'Back in, alongside!' : 'Back in, behind!'); AudioSys.tone(440, 0.25, 0.08, 'triangle', 2); } break;
        case 'sd-over': { G.sdOverAt = race.time; const w = race.cars[e.winner]; callout(w.isPlayer ? `You win the ${MODE_NAME[G.mode]}!` : `${w.name} wins the ${MODE_NAME[G.mode]}`); AudioSys.beep(w.isPlayer ? 988 : 330, 0.4); break; }
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
function onScreen(c) { const v = race.sd.view, f = race.sd.focus; if (!v || !f) return false; const [sx, sy] = screenOffset(c.x, c.y, c.z, f, race.camDir); return Math.abs(sx) < v.hw && Math.abs(sy) < v.hh; }
// Showdown crown events: stragglers blowing up (and paying crown time to the holder), the crown changing hands
function sdBoom(e) {
  const pi = race.cars.indexOf(race.player), i = e.losers.indexOf(pi), fmtS = v => (Math.round(v * 10) / 10) + 's';
  if (i >= 0) { callout(e.amts[i] > 0 ? `Boom! −${fmtS(e.amts[i])} crown time` : 'Boom!'); AudioSys.tone(520, 0.3, 0.08, 'triangle', 0.5); }
  else if (e.to === pi) { const got = e.amts.reduce((a, b) => a + b, 0); callout(got > 0 ? `Boom! +${fmtS(got)} crown time` : `${race.cars[e.losers[0]].name} blew up!`); AudioSys.tone(660, 0.12, 0.08, 'triangle', 1.5); }
  else callout(`${race.cars[e.losers[0]].name} blew up!`);
}
// a checkpoint gate taken: the scorer, and how the match stands (deuce, advantage)
function cpPoint(e) {
  const me = e.to === race.cars.indexOf(race.player), who = race.cars[e.to].name, pts = e.pts + (e.pts === 1 ? ' point' : ' points');
  const call = e.state === 'advantage' ? (me ? 'Advantage you!' : `Advantage ${who}`) : e.state === 'deuce' ? 'Deuce!' : '';
  if (e.state !== 'win') callout(call ? (me ? `Checkpoint! ${call}` : call) : me ? `Checkpoint! ${pts}` : `${who} takes the gate`);
  AudioSys.tone(me ? 988 : 587, 0.16, 0.08, 'triangle', me ? 1.5 : 0.8);
}
export const ITEM_NAME = { missile: 'Homing missile', gun: 'Machine gun', oil: 'Oil slick', pulse: 'Shockwave', harpoon: 'Harpoon' };
// firing: the effect and sound for each weapon
function useFx(c, item, near) {
  const v = near ? 1 : 0.4;
  if (item === 'missile') { AudioSys.whoosh(c.isPlayer ? 1.2 : 0.6 * v); if (c.isPlayer) AudioSys.tone(220, 0.35, 0.08, 'sawtooth', 2.2); }
  else if (item === 'oil') { oilDropFx(c); if (near) AudioSys.burst(0.2, 'lowpass', 500, 0.25); }
  else if (item === 'pulse') { pulseFx(c); AudioSys.burst(0.5 * v, 'lowpass', 160, 0.6); AudioSys.tone(180, 0.5, 0.08 * v, 'sine', 3); }
  else if (item === 'harpoon') { AudioSys.tone(900, 0.2, 0.06 * v, 'triangle', 0.4); AudioSys.burst(0.15 * v, 'bandpass', 1800, 0.15); }
}
function sdCrown(e) {
  const pi = race.cars.indexOf(race.player), to = race.cars[e.to];
  if (e.to === pi) { callout('You take the crown!'); AudioSys.tone(784, 0.14, 0.08, 'triangle', 1.5); }
  else if (e.from === pi) { callout(`Crown stolen by ${to.name}!`); AudioSys.tone(520, 0.3, 0.08, 'triangle', 0.5); }
  else callout(`${to.name} takes the crown`);
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
  const S = race.sd, name = MODE_NAME[G.mode] || 'Showdown';
  $('res-title').innerHTML = `<span class="chip" style="background:#${w.def.color.toString(16).padStart(6, '0')}"></span>` + (won ? `You won the ${name}` : `${w.name} won the ${name}`);
  const nb = S.booms.reduce((a, b) => a + b, 0), ns = S.steals.reduce((a, b) => a + b, 0), ng = S.points.reduce((a, b) => a + b, 0), pl = (n, a) => `${n} ${a}${n === 1 ? '' : 's'}`;
  $('res-stage').textContent = `Stage ${G.world.idx + 1}: ${G.world.stage.name} · ` + (S.kind === 'crown' ? `${pl(ns, 'crown steal')}, ${pl(nb, 'blow-up')}` : `${pl(ng, 'gate')} scored, ${pl(nb, 'blow-up')}`);
  $('res-best').textContent = S.kind === 'crown' ? `Showdown: hold the lead to bank crown time; first to ${SD.TARGET}s wins` : `${name}: first through each gate scores; first to ${CP.TARGET[S.kind]}, two clear`;
  $('next-btn').textContent = G.world.idx < STAGES.length - 1 ? 'Next stage' : 'Back to stage 1';
  updateResultsTable(); $('next-btn').focus();
}
export function updateResultsTable() {
  if (race.sd && race.sd.kind !== 'crown') {
    const S = race.sd, order = race.cars.map((c, k) => ({ c, k, l: S.points[k] })).sort((a, b) => b.l - a.l || b.c.progress - a.c.progress);
    $('res-table').innerHTML = order.map(({ c, k, l }, i) => `<tr class="${c.isPlayer ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td><span class="chip" style="background:#${c.def.color.toString(16).padStart(6, '0')}"></span>${c.name}<span class="rs">blew up ${S.booms[k]}×</span></td><td class="rt">${l} ${l === 1 ? 'pt' : 'pts'}</td></tr>`).join('');
    return;
  }
  if (race.sd) {
    const S = race.sd, order = race.cars.map((c, k) => ({ c, k, l: S.crown[k] })).sort((a, b) => b.l - a.l || b.c.progress - a.c.progress);
    $('res-table').innerHTML = order.map(({ c, k, l }, i) => `<tr class="${c.isPlayer ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td><span class="chip" style="background:#${c.def.color.toString(16).padStart(6, '0')}"></span>${c.name}<span class="rs">stole the crown ${S.steals[k]}× · blew up ${S.booms[k]}×</span></td><td class="rt">${l.toFixed(1)}s</td></tr>`).join('');
    return;
  }
  const order = ranking(race);
  $('res-table').innerHTML = order.map((c, i) => `<tr class="${c.isPlayer ? 'me' : ''}"><td class="rp">${ordinal(i + 1)}</td><td><span class="chip" style="background:#${c.def.color.toString(16).padStart(6, '0')}"></span>${c.name}</td><td class="rt">${c.finished ? fmt(c.finishTime) : 'Still racing'}</td></tr>`).join('');
}
export let pendingBuild = null;
export function selectStage(i, cb) {
  selected = i;
  document.querySelectorAll('.stage').forEach((b, k) => b.setAttribute('aria-pressed', k === i ? 'true' : 'false'));
  $('race-btn').textContent = MODE_BTN[G.mode] + STAGES[i].name;
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
    race = newRace(); clearSkids(); clearDebris(); clearSparks(); G.shake = 0; G.slowmo = 0;
    G.state = 'countdown'; G.countdown = 3.2; G.lastBeep = 4; G.goTimer = 0; resultsShown = false; newBest = false; G.standingsKey = ''; G.sdKey = ''; G.sdTick = 0; $('edge').className = '';
    $('menu').hidden = true; $('garage').hidden = true; $('results').hidden = true; $('pause').hidden = true; $('hud').hidden = false; $('touch').hidden = !isTouch;
    $('stage-name').textContent = `Stage ${idx + 1}: ${STAGES[idx].name}`;
    racesStarted++; G.hintTimer = racesStarted <= 2 ? 7 : 0;
    $('hint').textContent = isTouch ? G.steer === 'wheel' ? 'Point the wheel where to go. Slide Gas down to drift' : 'Slide Gas down to drift, back up to boost' : 'Hold Space through a corner to drift, then let go for a boost';
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
const MODE_BTN = { race: 'Race ', showdown: 'Showdown: ', deuce: 'Deuce: ', tiebreak: 'Tiebreak: ' };
export const MODE_NAME = { showdown: 'Showdown', deuce: 'Deuce', tiebreak: 'Tiebreak' };
const MODE_DESC = {
  race: () => G.rivals === 1 ? 'Beat your rival to the line.' : `Beat ${G.rivals} rivals to the line${G.rivals > 3 ? ', starting from the back of the grid' : ''}.`,
  showdown: 'King of the Hill: the leader wears the crown and banks crown time. Pass clearly to steal it; slipstream helps, and a runaway leader meets cows and oil. Fall off the screen and you blow up, paying the holder 2 s. First to 60 s of crown time wins.',
  deuce: 'Checkpoints, first to 4. A gate stands on one side of the road: be first through it to score. Win by two, like tennis: 3-3 is deuce. Fall off the screen and you blow up and rejoin behind the leader.',
  tiebreak: 'Checkpoints, first to 7, win by two. Longer, and every gate counts. Fall off the screen and you blow up and rejoin behind the leader.',
};
export function setMode(m) {
  G.mode = m; saveMode(m);
  document.querySelectorAll('.mode-btn').forEach(b => b.setAttribute('aria-pressed', b.dataset.mode === m ? 'true' : 'false'));
  $('mode-desc').textContent = typeof MODE_DESC[m] === 'function' ? MODE_DESC[m]() : MODE_DESC[m];
  $('race-btn').textContent = MODE_BTN[m] + STAGES[selected].name;
  $('rivals').hidden = m !== 'race';
}
/** Weapons on or off (menu), for every mode. */
export function setWeapons(on) { G.weapons = on; saveWeapons(on); $('wpn-btn').textContent = 'Weapons: ' + (on ? 'On' : 'Off'); }
/** The Race field size (menu stepper): 1..MAX_RIVALS AI cars. */
export function setRivals(n) {
  G.rivals = Math.max(1, Math.min(MAX_RIVALS, n)); saveRivals(G.rivals);
  if (G.mode === 'race') $('mode-desc').textContent = MODE_DESC.race();
  $('rivals-n').textContent = String(G.rivals); $('rivals-less').disabled = G.rivals <= 1; $('rivals-more').disabled = G.rivals >= MAX_RIVALS;
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
  requestAnimationFrame(() => document.querySelectorAll('.st-prof').forEach((cv, i) => drawProfile(cv, trackOf(i), null, 2)));
}
// Physics runs at a fixed 120 Hz; cars are drawn between the last two physics states so motion stays smooth at any refresh rate.
G.renderAlpha = 1;
export function savePrev() { for (const list of [race.cars, race.traffic, race.parked]) for (const c of list) { c.px = c.x; c.py = c.y; c.pz = c.z; c.pyaw = c.yaw; } }
