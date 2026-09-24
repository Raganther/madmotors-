import { G } from '../game.js';
import { AudioSys } from '../audio/audio.js';
import { clamp } from '../core/math.js';
import { respawn } from '../core/sim/car.js';
import { $ } from './dom.js';
import { race, selected, startRace, togglePause } from './flow.js';

// ---------- input ----------
export const keys = {}, touch = { steer: 0, wheel: false, gas: false, brake: false, hb: false };
addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'KeyR' && G.state === 'racing' && race && !race.player.finished) respawn(race.player, G.world.W);
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyM') AudioSys.toggle();
  if (e.code === 'Enter' && G.state === 'menu' && $('loading').hidden && document.activeElement === document.body) startRace(selected);
});
addEventListener('keyup', e => { keys[e.code] = false; });
addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
// Touch: both thumbs stay on the glass. Each zone follows one finger (pointer capture) and reads the drag from where it landed;
// the anchor slides along with the finger past the limit, so reversing direction responds at once.
function thumbZone(zone, move, end) {
  let id = null, x0 = 0, y0 = 0;
  zone.addEventListener('pointerdown', e => { if (id !== null) return; e.preventDefault(); id = e.pointerId; x0 = e.clientX; y0 = e.clientY; try { zone.setPointerCapture(id); } catch (_) { } move(0, 0); });
  zone.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    const a = move(e.clientX - x0, e.clientY - y0); if (a) { x0 += a[0]; y0 += a[1]; }
  });
  const up = e => { if (e.pointerId !== id) return; id = null; end(); };
  zone.addEventListener('pointerup', up); zone.addEventListener('pointercancel', up); zone.addEventListener('lostpointercapture', up);
}
const wheel = $('wheel'), wheelG = $('wheel-g'), pedal = $('pedal'), WHEEL_R = 56, SLIDE = 30;
// wheel: drag sideways, full lock at WHEEL_R px; the drawn wheel turns up to 120 degrees
thumbZone($('steer-zone'), dx => {
  const over = Math.abs(dx) > WHEEL_R ? dx - Math.sign(dx) * WHEEL_R : 0;
  touch.steer = clamp(dx / WHEEL_R, -1, 1); touch.wheel = true; wheel.classList.add('on');
  wheelG.setAttribute('transform', `rotate(${(touch.steer * 120).toFixed(1)})`);
  return over ? [over, 0] : null;
}, () => { touch.steer = 0; touch.wheel = false; wheel.classList.remove('on'); wheelG.removeAttribute('transform'); });
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
  let st = (keys.ArrowRight || keys.KeyD ? 1 : 0) - (keys.ArrowLeft || keys.KeyA ? 1 : 0);
  let thr = keys.ArrowUp || keys.KeyW || touch.gas ? 1 : 0, brk = keys.ArrowDown || keys.KeyS || touch.brake ? 1 : 0, hb = keys.Space || touch.hb ? 1 : 0;
  if (gp) {
    const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.15) st = ax;
    if (gp.buttons[7]) thr = Math.max(thr, gp.buttons[7].value); if (gp.buttons[6]) brk = Math.max(brk, gp.buttons[6].value);
    if (gp.buttons[0] && gp.buttons[0].pressed) hb = 1;
  }
  const cur = P.inp.steer;
  if (touch.wheel && !st) P.inp.steer = cur + (touch.steer - cur) * Math.min(1, dt * 25);   // analog wheel, lightly smoothed
  else if (gp && Math.abs(st) > 0 && Math.abs(st) < 1) P.inp.steer = st;
  else if (st !== 0) P.inp.steer = cur + clamp(st - cur, -dt * 7, dt * 7);
  else P.inp.steer = cur + clamp(-cur, -dt * 10, dt * 10);
  P.inp.throttle = thr; P.inp.brake = brk; P.inp.handbrake = hb;
}
