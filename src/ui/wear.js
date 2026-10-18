import { G } from '../game.js';
import { WEAR_OPT } from '../core/features/wear.js';
import { loadWear, saveWear } from './storage.js';

// The menu's Weather & wear panel: the parts of core/features/wear.js (ruts, rain) to switch on and off while we tune
// them, and how deep and how fast the ruts go. Kept in this browser; a race takes them from G.wearOpt when it starts (flow.js newRace).
const $ = id => document.getElementById(id);
const TOGGLES = [
  ['grooves', 'Grooves', 'the road surface sinks into its ruts'],
  ['feel', 'Feel the ruts', 'the wheels ride in them; they pull you in and scrub you crossing them'],
  ['rain', 'Rain makes it worse', 'a wet stage digs faster, and its worn gravel line turns to mud'],
  ['puddles', 'Puddles', 'water lying in deep ruts on a wet stage'],
  ['aiLines', 'AI drives the ruts', 'on gravel and snow too, not only in bogs'],
  ['shine', 'Wet shine', 'roads gleam in the rain'],
  ['spray', 'Tyre spray', 'cars throw up a mist on a wet road'],
  ['drying', 'Drying line', 'on wet tarmac the line dries out and grips again'],
  ['drops', 'Raindrops', 'drops splashing on the road'],
  ['standing', 'Standing water', 'along the edges and in dips: you aquaplane through it'],
];
export function wireWear() {
  const saved = loadWear(), o = G.wearOpt = { ...WEAR_OPT };
  for (const k of Object.keys(WEAR_OPT)) if (typeof saved[k] === typeof WEAR_OPT[k]) o[k] = saved[k];
  const btn = $('wear-btn'), panel = $('wear-panel');
  const show = () => {
    $('wear-opts').innerHTML = TOGGLES.map(([k, name, about]) => `<label><input type="checkbox" data-k="${k}"${o[k] ? ' checked' : ''}> ${name} <small>${about}</small></label>`).join('');
    for (const k of ['depth', 'rate']) { $('wear-' + k).value = o[k]; $('wear-' + k + '-v').textContent = o[k].toFixed(1) + '×'; }
    const changed = Object.keys(WEAR_OPT).some(k => o[k] !== WEAR_OPT[k]); btn.textContent = changed ? 'Weather & wear: custom' : 'Weather & wear';
  };
  const set = (k, v) => { o[k] = v; saveWear(o); show(); };
  btn.addEventListener('click', () => { panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); });
  $('wear-opts').addEventListener('change', e => { const k = e.target.dataset.k; if (k) set(k, e.target.checked); });
  for (const k of ['depth', 'rate']) $('wear-' + k).addEventListener('input', e => set(k, +e.target.value));
  $('wear-reset').addEventListener('click', () => { Object.assign(o, WEAR_OPT); saveWear(o); show(); });
  show();
}
