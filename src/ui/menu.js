import { G } from '../game.js';
import { $ } from './dom.js';
import { selectStage, selected } from './flow.js';
import { startTitle, stopTitle } from './title.js';
import { AudioSys } from '../audio/audio.js';
import { safeBoot } from '../render/renderer.js';
import { drawOutlines } from './tracks.js';

// The menu's screens: the title (the logo and Start over the action scene, ui/title.js), the main menu (what to play,
// the tools, the settings) and Quick Race (mode, field, car and the track cards, ui/tracks.js). G.screen says which.
const SCREENS = { title: 'title-screen', main: 'main-menu', quick: 'quick-menu' };
export function showScreen(name) {
  const was = G.screen; G.screen = name; if (name !== 'title' || !safeBoot) $('game').hidden = false;   // (hidden behind the title in safe mode)
  for (const [n, id] of Object.entries(SCREENS)) $(id).hidden = n !== name;
  if (name === 'title' && !G.title && !safeBoot) startTitle();                     // the action scene behind the logo (not after a graphics reset)
  if (name === 'quick') { stopTitle(); selectStage(selected); drawOutlines(); $('race-btn').focus(); }   // the picked track behind the list
  if (name === 'main' && was === 'title') $('quick-btn').focus();
}
export function wireMenu() {
  G.onMenuScreen = name => { G.screen = name; for (const [n, id] of Object.entries(SCREENS)) $(id).hidden = n !== name; if (name === 'quick') drawOutlines(); };   // after a race (flow.js toMenu)
  const start = () => { AudioSys.init(); showScreen('main'); };
  $('start-btn').addEventListener('click', start);
  addEventListener('keydown', e => { if (G.state === 'menu' && G.screen === 'title' && !e.repeat && !['Tab', 'Shift', 'Alt', 'Control', 'Meta'].includes(e.key)) { e.preventDefault(); start(); } });
  $('quick-btn').addEventListener('click', () => showScreen('quick'));
  $('quick-back').addEventListener('click', () => showScreen('main'));
  $('title-back').addEventListener('click', () => showScreen('title'));
}
