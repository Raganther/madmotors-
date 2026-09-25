import { G } from '../game.js';
import { VEHICLES, vehicleById } from '../data/vehicles.js';
import { vehicleThumb } from '../render/thumbs.js';
import { $ } from './dom.js';
import { saveVehicle } from './storage.js';

// The garage: pick your vehicle (data/vehicles.js). A card per vehicle with its picture, what it's like and five
// stat bars against the standard car. Remembered between visits; the race line-up is built from it (data/cars.js).
const BARS = [['Speed', v => v.top], ['Acceleration', v => v.accel], ['Grip', v => v.grip], ['Off-road', v => v.off], ['Weight', v => 1 / v.im]];
const pct = (label, x) => label === 'Weight' ? Math.round(Math.min(100, Math.max(8, (x - 0.35) / 2.1 * 100))) : Math.round(Math.min(100, Math.max(8, 50 + (x - 1) * 200)));
const STD = { accel: 1, top: 1, grip: 1, off: 1, im: 1 };
function statsHTML(v) {
  const s = v.veh || STD;
  return BARS.map(([n, f]) => `<div class="gs"><span>${n}</span><i><b style="width:${pct(n, f(s))}%"></b></i></div>`).join('');
}
export function setVehicle(id) {
  const v = vehicleById(id); G.vehicle = v.id; saveVehicle(v.id);
  $('veh-name').textContent = v.name;
  try { $('veh-thumb').src = vehicleThumb(v); } catch (e) { /* no WebGL for the picture: the name is enough */ }
  for (const b of document.querySelectorAll('.g-card')) b.setAttribute('aria-pressed', b.dataset.id === v.id ? 'true' : 'false');
}
let built = false;
function build() {
  const grid = $('garage-grid'); built = true;
  for (const v of VEHICLES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g-card'; b.dataset.id = v.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<img alt="" width="240" height="150"><span class="g-name"></span><span class="g-blurb"></span><span class="g-stats">${statsHTML(v)}</span>`;
    b.querySelector('.g-name').textContent = v.name; b.querySelector('.g-blurb').textContent = v.blurb;
    b.addEventListener('click', () => setVehicle(v.id));
    grid.appendChild(b);
  }
  // pictures one at a time so the garage opens straight away
  const imgs = [...grid.querySelectorAll('img')]; let k = 0;
  const next = () => { if (k >= imgs.length) return; try { imgs[k].src = vehicleThumb(VEHICLES[k]); } catch (e) { /* leave it blank */ } k++; setTimeout(next, 0); };
  next();
}
export function openGarage() { if (!built) build(); setVehicle(G.vehicle); $('garage').hidden = false; $('garage-done').focus(); }
export function closeGarage() { $('garage').hidden = true; $('veh-btn').focus(); }
