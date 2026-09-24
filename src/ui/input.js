import { G } from '../game.js';
import { AudioSys } from '../audio/audio.js';
import { clamp } from '../core/math.js';
import { respawn } from '../core/sim/car.js';
import { $ } from './dom.js';
import { race, selected, startRace, togglePause } from './flow.js';

// ---------- input ----------
export const keys = {}, touch = { left: false, right: false, gas: false, brake: false, hb: false };
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
document.querySelectorAll('#touch button').forEach(b => {
  const k = b.dataset.k;
  b.addEventListener('pointerdown', e => { e.preventDefault(); touch[k] = true; try { b.setPointerCapture(e.pointerId); } catch (_) { } b.classList.add('on'); });
  const up = () => { touch[k] = false; b.classList.remove('on'); };
  b.addEventListener('pointerup', up); b.addEventListener('pointercancel', up); b.addEventListener('lostpointercapture', up);
});
export function readInput(dt) {
  const P = race.player, gp = navigator.getGamepads ? [...navigator.getGamepads()].find(g => g) : null;
  let st = (keys.ArrowRight || keys.KeyD || touch.right ? 1 : 0) - (keys.ArrowLeft || keys.KeyA || touch.left ? 1 : 0);
  let thr = keys.ArrowUp || keys.KeyW || touch.gas ? 1 : 0, brk = keys.ArrowDown || keys.KeyS || touch.brake ? 1 : 0, hb = keys.Space || touch.hb ? 1 : 0;
  if (gp) {
    const ax = gp.axes[0] || 0; if (Math.abs(ax) > 0.15) st = ax;
    if (gp.buttons[7]) thr = Math.max(thr, gp.buttons[7].value); if (gp.buttons[6]) brk = Math.max(brk, gp.buttons[6].value);
    if (gp.buttons[0] && gp.buttons[0].pressed) hb = 1;
  }
  const cur = P.inp.steer;
  if (gp && Math.abs(st) > 0 && Math.abs(st) < 1) P.inp.steer = st;
  else if (st !== 0) P.inp.steer = cur + clamp(st - cur, -dt * 7, dt * 7);
  else P.inp.steer = cur + clamp(-cur, -dt * 10, dt * 10);
  P.inp.throttle = thr; P.inp.brake = brk; P.inp.handbrake = hb;
}
