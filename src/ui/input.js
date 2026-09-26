import { G } from '../game.js';
import { AudioSys } from '../audio/audio.js';
import { clamp, wrapAngle } from '../core/math.js';
import { groundDir } from '../core/sim/view.js';
import { respawn } from '../core/sim/car.js';
import { $ } from './dom.js';
import { closeGarage } from './garage.js';
import { closeLeagues } from './league.js';
import { toggleOverlay } from '../render/overlay.js';
import { saveCamera, saveSteer } from './storage.js';
import { CAM_MODES, CAM_ZOOMS } from '../render/camera.js';
import { race, selected, startRace, togglePause } from './flow.js';

// ---------- input ----------
export const keys = {}, touch = { dir: null, wheel: false, left: false, right: false, gas: false, brake: false, hb: false };
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyR' && G.state === 'racing' && race && !race.player.finished) respawn(race.player, G.world.W);
  if (e.code === 'Escape' && !$('garage').hidden) { closeGarage(); return; }
  if (e.code === 'Escape' && !$('league').hidden) { closeLeagues(); return; }
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') AudioSys.toggle();
  if (G.state === 'racing' && race && race.weapons) {                              // weapons: F fires what you're holding, Q (or E) swings a door
    if (e.code === 'KeyF') race.player.inp.fire = true;
    if (e.code === 'KeyQ' || e.code === 'KeyE') race.player.inp.door = 1;          // the side is picked for you: wherever a car is
  }
  if (e.code === 'KeyC' && G.state !== 'menu') setCamera(nextCamera());           // cycle the camera
  if (e.code === 'Backquote') toggleOverlay();                              // debug overlay (render/overlay.js)
  if (e.code === 'Enter' && G.state === 'menu' && $('loading').hidden && $('league').hidden && document.activeElement === document.body) startRace(selected);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// Touch: both thumbs stay on the glass. Each zone follows one finger (pointer capture); move() gets the drag from where it
// landed plus the event, and may return an [dx, dy] to slide that anchor along with the finger.
function thumbZone(zone, move, end) {
  let id = null, x0 = 0, y0 = 0;
  zone.addEventListener('pointerdown', e => { if (id !== null) return; e.preventDefault(); id = e.pointerId; x0 = e.clientX; y0 = e.clientY; try { zone.setPointerCapture(id); } catch (_) { } move(0, 0, e); });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const a = move(e.clientX - x0, e.clientY - y0, e); if (a) { x0 += a[0]; y0 += a[1]; }
  });
  const up = e => { if (e.pointerId !== id) return; id = null; end(); };
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up);
}
const wheel = $('wheel'), wheelG = $('wheel-g'), pedal = $('pedal'), DEAD = 14, SLIDE = 30;
// wheel: point-to-steer. The yellow marker follows the finger around the wheel's centre and the car turns to face
// that direction on screen (readInput), so "up" isn't special: point where you want to go.
// arrows (the other steering option): left or right of the gap between them; slide across without lifting
const arrows = $('arrows'), arrowEls = [...arrows.children];
function steerArrows(e) {
  const r = arrows.getBoundingClientRect(), d = e.clientX < r.left + r.width / 2 ? -1 : 1;
  touch.left = d < 0; touch.right = d > 0; arrowEls.forEach(el => el.classList.toggle('on', +el.dataset.d === d));
}
thumbZone($('steer-zone'), (_x, _y, e) => {
  if (G.steer === 'arrows') { steerArrows(e); return null; }
  const r = wheel.getBoundingClientRect(), dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
  touch.wheel = true; wheel.classList.add('on');
  if (Math.hypot(dx, dy) < DEAD) { touch.dir = null; return null; }   // thumb on the hub: hold straight
  touch.dir = [dx, -dy]; wheelG.setAttribute('transform', `rotate(${(Math.atan2(dx, -dy) * 180 / Math.PI).toFixed(1)})`);
  return null;
}, () => { touch.dir = null; touch.wheel = touch.left = touch.right = false; wheel.classList.remove('on'); wheelG.removeAttribute('transform'); arrowEls.forEach(el => el.classList.remove('on')); });
// touch weapons: fire what you're holding; the door swings on whichever side has a car (the core picks)
for (const [id, act] of [['wpn-fire', P => { P.inp.fire = true; }], ['wpn-door', P => { P.inp.door = 1; }]]) $(id).addEventListener('pointerdown', e => { e.preventDefault(); if (G.state === 'racing' && race && race.weapons) act(race.player); });
/** Camera mode and zoom (render/camera.js). Remembered between visits. */
export function setCamera(mode = G.camMode, zoom = G.camZoom) {
  G.camMode = mode in CAM_MODES ? mode : 'classic'; G.camZoom = zoom in CAM_ZOOMS ? zoom : 'normal'; saveCamera({ mode: G.camMode, zoom: G.camZoom });
  for (const b of document.querySelectorAll('.cam-btn')) b.textContent = 'Camera: ' + CAM_MODES[G.camMode].name;
  for (const b of document.querySelectorAll('.zoom-btn')) b.textContent = 'Zoom: ' + CAM_ZOOMS[G.camZoom].name;
}
const next = (obj, k) => { const ks = Object.keys(obj); return ks[(ks.indexOf(k) + 1) % ks.length]; };
export const nextCamera = () => next(CAM_MODES, G.camMode), nextZoom = () => next(CAM_ZOOMS, G.camZoom);
/** Touch steering: 'wheel' (point-to-steer) or 'arrows'. Remembered between visits. */
export function setSteer(m) {
  G.steer = m === 'arrows' ? 'arrows' : 'wheel'; saveSteer(G.steer);
  wheel.hidden = G.steer !== 'wheel'; arrows.hidden = G.steer !== 'arrows';
  for (const b of document.querySelectorAll('.steer-btn')) b.textContent = 'Steering: ' + (G.steer === 'wheel' ? 'Wheel' : 'Arrows');
}
// pedal: holding is gas; slide down to drift (gas stays on), slide left to brake/reverse. The anchor follows the finger
// up and right, so the slides are always measured from the thumb's resting spot.
thumbZone($('pedal-zone'), (dx, dy) => {
  const down = dy > SLIDE * (touch.hb ? 0.6 : 1), left = -dx > SLIDE * (touch.brake ? 0.6 : 1);
  touch.hb = down && dy >= -dx; touch.brake = left && !touch.hb; touch.gas = !touch.brake;
  pedal.classList.toggle('on', touch.gas && !touch.hb); pedal.classList.toggle('hb', touch.hb); pedal.classList.toggle('brk', touch.brake);
  return dx > 0 || dy < 0 ? [Math.max(0, dx), Math.min(0, dy)] : null;
}, () => { touch.gas = touch.brake = touch.hb = false; pedal.className = ''; });
export function readInput(dt) {
  const P = race.player, gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
  let st = (keys.ArrowRight || keys.KeyD || touch.right ? 1 : 0) - (keys.ArrowLeft || keys.KeyA || touch.left ? 1 : 0);
  let thr = keys.ArrowUp || keys.KeyW || touch.gas ? 1 : 0, brk = keys.ArrowDown || keys.KeyS || touch.brake ? 1 : 0, hb = keys.Space || touch.hb ? 1 : 0;
  if (gp) {
    const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.15) st = ax;
    if (gp.buttons[7]) thr = Math.max(thr, gp.buttons[7].value); if (gp.buttons[6]) brk = Math.max(brk, gp.buttons[6].value);
    if (gp.buttons[0] && gp.buttons[0].pressed) hb = 1;
    const pr = k => gp.buttons[k] && gp.buttons[k].pressed, was = G.gpPrev || [];                          // B: missile, LB / RB: doors
    if (race.weapons) { if (pr(1) && !was[1]) P.inp.fire = true; if ((pr(4) && !was[4]) || (pr(5) && !was[5])) P.inp.door = 1; }
    G.gpPrev = [0, 1, 2, 3, 4, 5].map(pr);
  }
  const cur = P.inp.steer;
  if (touch.wheel && !st) {   // point-to-steer: turn toward the screen direction the wheel points at (flipped when reversing)
    let want = 0;
    if (touch.dir) { const [gx, gz] = groundDir(touch.dir[0], touch.dir[1], G.camDir); want = clamp(-wrapAngle(Math.atan2(gx, gz) - P.yaw) * 2.4 * (P.vf < -1 ? -1 : 1), -1, 1); }
    P.inp.steer = cur + (want - cur) * Math.min(1, dt * 20);
  }
  else if (gp && Math.abs(st) > 0 && Math.abs(st) < 1) P.inp.steer = st;
  else if (st !== 0) P.inp.steer = cur + clamp(st - cur, -dt * 7, dt * 7);
  else P.inp.steer = cur + clamp(-cur, -dt * 10, dt * 10);
  P.inp.throttle = thr; P.inp.brake = brk; P.inp.handbrake = hb;
}
