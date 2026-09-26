import { G } from '../game.js';
import { VEHICLES, vehicleById } from '../data/vehicles.js';
import { vehicleThumb } from '../render/thumbs.js';
import { $ } from './dom.js';
import { STAGES } from '../data/stages/index.js';
import { saveStageVehicles, saveVehicle } from './storage.js';

// The garage: pick your vehicle (data/vehicles.js). A card per vehicle with its picture, what it's like and five
// stat bars against the standard car. The pick is remembered for the selected stage (G.stageCars, by stage name) and
// as the default for stages with no pick yet, since different vehicles shine on tarmac, gravel and snow.
const BARS = [['Speed', v => v.top], ['Acceleration', v => v.accel], ['Grip', v => v.grip], ['Off-road', v => v.off], ['Weight', v => 1 / v.im]];
const pct = (label, x) => label === 'Weight' ? Math.round(Math.min(100, Math.max(8, (x - 0.35) / 2.1 * 100))) : Math.round(Math.min(100, Math.max(8, 50 + (x - 1) * 200)));
const STD = { accel: 1, top: 1, grip: 1, off: 1, im: 1 };
function statsHTML(v) {
  const s = v.veh || STD;
  return BARS.map(([n, f]) => `<div class="gs"><span>${n}</span><i><b style="width:${pct(n, f(s))}%"></b></i></div>`).join('');
}
// how well a vehicle suits a stage, from its stats: loose surfaces (and dirt shortcuts) want off-road grip
const loose = st => st.surface !== 'tarmac';
const suit = (v, st) => { const s = v.veh || STD; return loose(st) ? s.off * 0.55 + s.grip * 0.25 + s.accel * 0.2 : s.top * 0.45 + s.grip * 0.35 + s.accel * 0.2; };
/** The vehicles that suit stage i best (top three by suit). */
export function suited(i) { const st = STAGES[i]; return VEHICLES.slice().sort((a, b) => suit(b, st) - suit(a, st)).slice(0, 3).map(v => v.id); }
/** Show vehicle id as the current pick (menu button, garage cards) without saving anything. */
export function showVehicle(id) {
  const v = vehicleById(id); G.vehicle = v.id;
  $('veh-name').textContent = v.name;
  try { $('veh-thumb').src = vehicleThumb(v); } catch (e) { /* no WebGL for the picture: the name is enough */ }
  for (const b of document.querySelectorAll('.g-card')) b.setAttribute('aria-pressed', b.dataset.id === v.id ? 'true' : 'false');
}
/** Pick vehicle id for the selected stage (and as the default for stages with no pick). */
export function setVehicle(id) {
  showVehicle(id); saveVehicle(G.vehicle); G.defaultVehicle = G.vehicle;
  const st = STAGES[G.stageSel]; if (st) { G.stageCars[st.name] = G.vehicle; saveStageVehicles(G.stageCars); }
  if (G.onVehicle) G.onVehicle();
}
let built = false;
function build() {
  const grid = $('garage-grid'); built = true;
  for (const v of VEHICLES) {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'g-card'; b.dataset.id = v.id; b.setAttribute('aria-pressed', 'false');
    b.innerHTML = `<img alt="" width="240" height="150"><span class="g-name"></span><span class="g-suits">Suits this stage</span><span class="g-blurb"></span><span class="g-stats">${statsHTML(v)}</span>`;
    b.querySelector('.g-name').textContent = v.name; b.querySelector('.g-blurb').textContent = v.blurb;
    b.addEventListener('click', () => setVehicle(v.id));
    grid.appendChild(b);
  }
  // pictures one at a time so the garage opens straight away
  const imgs = [...grid.querySelectorAll('img')]; let k = 0;
  const next = () => { if (k >= imgs.length) return; try { imgs[k].src = vehicleThumb(VEHICLES[k]); } catch (e) { /* leave it blank */ } k++; setTimeout(next, 0); };
  next();
}
let returnTo = 'veh-btn';
/** Open the garage for the selected stage; `from` is the button to return focus to. */
export function openGarage(from = 'veh-btn') {
  if (!built) build(); showVehicle(G.vehicle); returnTo = typeof from === 'string' ? from : 'veh-btn';
  const st = STAGES[G.stageSel], good = suited(G.stageSel);
  $('garage-for').textContent = st ? `For ${st.name} (${st.surface === 'tarmac' ? 'tarmac' : st.surface}): your pick is remembered for this stage` : '';
  for (const b of document.querySelectorAll('.g-card')) b.classList.toggle('suits', good.includes(b.dataset.id));
  $('garage').hidden = false; $('garage-done').focus();
}
export function closeGarage() { $('garage').hidden = true; const b = $(returnTo); if (b) b.focus(); if (G.onGarageClose) G.onGarageClose(); }
