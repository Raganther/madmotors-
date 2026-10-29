import { AudioSys } from '../audio/audio.js';
import { SONGS } from '../audio/songs.js';
import { BREAKABLES } from '../data/breakables.js';
import { G } from '../game.js';
import { race } from './flow.js';
import { $ } from './dom.js';

// What every race event sounds like (flow.js handleEvents calls this for each one). The sounds are placed where it
// happened (audio/sfx.js: quieter, duller and panned with distance from you), so this only decides which sound and
// how loud; collisions with walls and cars are render/effects/impacts.js (AudioSys.crash, by material).
const BRK = { crates: 'wood', fence: 'wood', picket: 'wood', yardgate: 'wood', bench: 'wood', gate: 'rail', hay: 'hay', hedge: 'hay', concrete: 'bricks', wall: 'bricks', railing: 'rail', chain: 'rail', post: 'metal', bin: 'metal', postbox: 'metal' };
let furnT = -9, tickT = -9, shieldT = -9;
const S = (name, o) => AudioSys.sfx(name, o);
export function eventSound(c, e, near) {
  const P = race.player, me = c.isPlayer, at = e.x !== undefined ? e : c, close = me || near, t = race.time;
  const dist = p => Math.hypot(p.x - P.x, p.z - P.z);
  switch (e.t) {
    case 'land': if (close && e.air > 0.2) AudioSys.thud(Math.min(1, e.imp / 22) * (me ? 1 : 0.6), c); break;
    case 'tree': if (close) { AudioSys.crash('wood', Math.min(1, e.v / 25), at); S('rustle', { at, vol: 0.6 }); } break;
    case 'bush': if (close) AudioSys.crash('hay', Math.min(1, e.v / 25) * (me ? 0.8 : 0.5), at); break;
    case 'oil': if (me) S('splash', { at: c, vol: 0.3, rate: 0.7 }); break;
    case 'splash': if (close) S('splash', { at: c, vol: me ? 0.9 : 0.6 }); break;
    case 'boostpad': if (me) { AudioSys.whoosh(0.6); S('zap', { vol: 0.25, rate: 2.2, wet: 0.05 }); } break;
    case 'break': if (close) AudioSys.crash(BRK[e.kind] || 'wood', Math.min(1, 0.5 + e.v / 40) * (me ? 1 : 0.6), at); if (close && BREAKABLES[e.kind] && BREAKABLES[e.kind].hp >= 7) S('rubble', { at, vol: 0.5, rate: 1.2 }); break;
    case 'wallbreak':   // through a building's wall: bricks (or boards) everywhere, and the odd window
      if (dist(at) < 70) { AudioSys.crash(e.mat === 'timber' ? 'wood' : 'bricks', Math.min(1, 0.55 + e.v / 50) * (me ? 1 : 0.7), at); if (Math.random() < 0.4) S('glass', { at, vol: 0.5 }); } break;
    case 'crack': if (close) S(e.mat === 'timber' ? 'wood' : 'crack', { at, vol: Math.min(0.8, 0.3 + e.v / 40) * (me ? 1 : 0.6) }); break;
    case 'plank': if (close) S('wood', { at, vol: me ? 0.7 : 0.4, rate: 0.85 }); break;
    case 'bayfall': if (dist(at) < 80) { S('rubble', { at, vol: 0.9, rate: 0.85, wet: 0.3 }); S('wood', { at, vol: 0.5, rate: 0.7 }); } break;
    case 'furniture': if (close && t - furnT > 0.12) { furnT = t; S('wood', { at, vol: Math.min(0.6, e.v / 30) * (me ? 1 : 0.5), rate: 1.2 }); } break;
    case 'collapse': if (dist(at) < 120) { S('collapse', { at, vol: 1, wet: 0.45, max: 2 }); S('crunch', { at, vol: 0.5, rate: 0.6 }); } break;   // a whole building coming down
    case 'takedown': if (me) { AudioSys.whoosh(); S('cheer', { vol: 0.35, wet: 0.2, max: 1 }); } break;
    case 'rockhit': if (close) AudioSys.crash('stone', Math.min(1, e.v / 20) * (me ? 1 : 0.6), at); break;
    case 'trainhit': if (close) { AudioSys.crash('metal', 1, at); S('rail', { at, vol: 0.8, rate: 0.6 }); AudioSys.boom(at, 'small', 0.6); } break;
    case 'hammer-hit': if (near) { AudioSys.crash('metal', 1, at); S('clang', { at, vol: 0.9, rate: 0.55 }); AudioSys.thud(1, at); } break;
    case 'dent':   // panels bending, swinging open or tearing off (the crash itself is the collision's sound)
      if (close && e.panels) { if (e.panels.some(p => p[1] === 2)) { S('clank', { at: c, vol: 0.6, rate: 0.6 }); S('rubble', { at: c, vol: 0.25, rate: 1.8 }); } else if (e.panels.some(p => p[1] === 1)) S('clank', { at: c, vol: 0.35, rate: 0.8 }); } break;
    case 'repair': if (me) S('chime', { vol: 0.25, rate: 0.75, wet: 0.1 }); break;
    case 'pickup': if (me) S('chime', { vol: 0.7, wet: 0.1 }); else if (near) S('chime', { at: c, vol: 0.3, rate: 0.9 }); break;
    case 'use': useSound(c, e.item, near); break;
    case 'shot': S('gunshot', { at: c, vol: me ? 0.55 : 0.45, max: 6, jitter: 0.1, wet: 0.08 }); break;
    case 'bullet-hit': if (dist(at) < 90 && t - tickT > 0.03) { tickT = t; S('tick', { at, vol: me ? 0.7 : 0.5, max: 4 }); if (Math.random() < 0.3) S('ricochet', { at, vol: 0.35, max: 2 }); } break;
    case 'oil-hit': if (close) S('splash', { at: c, vol: 0.35, rate: 0.6 }); break;
    case 'pulse-hit': if (close) AudioSys.crash('car', 0.3, c); break;
    case 'harpoon-hit': if (close) { AudioSys.crash('metal', 0.4, c); S('clank', { at: c, vol: 0.6 }); } break;
    case 'water-hit': if (close) S('splash', { at: c, vol: me ? 0.8 : 0.5, rate: 1.2 }); break;
    case 'cement-hit': if (close) S('splash', { at: c, vol: 0.6, rate: 0.45 }); break;
    case 'stinger-hit': if (close) S('puncture', { at: c, vol: me ? 0.9 : 0.6 }); break;
    case 'crush': if (dist(at) < 70) { AudioSys.thud(1, at); AudioSys.crash('car', 1, at); S('rubble', { at, vol: 0.4, rate: 0.7 }); } break;
    case 'defend': if (close) { if (e.item === 'shield') S('zap', { at: c, vol: 0.4, rate: 2.4, wet: 0.2 }); else if (e.item === 'flares') { S('rocket', { at: c, vol: 0.3, rate: 2 }); AudioSys.burst(0.2, 'bandpass', 3000, 0.3); } else if (e.item === 'smoke') AudioSys.burst(0.3, 'lowpass', 900, 0.6); else S('clank', { at: c, vol: 0.4, rate: 1.4 }); } break;
    case 'shield-hit': if (close && t - shieldT > 0.15) { shieldT = t; S('zap', { at, vol: 0.2, rate: 3 }); } break;
    case 'missile-hit': AudioSys.boom(at, 'mid'); if (close) AudioSys.crash('car', 0.9, at); break;
    case 'missile-fizzle': if (e.boom) AudioSys.boom(at, 'small'); else S('thud', { at, vol: 0.4, rate: 1.6 }); break;
    case 'mine-boom': AudioSys.boom(at, 'mid'); S('rubble', { at, vol: 0.35, rate: 1.4 }); break;
    case 'mine-hit': if (close) AudioSys.crash('car', 0.8, c); break;
    case 'mine-bounce': S('clank', { at, vol: 0.55, max: 4 }); break;
    case 'mine-settle': S('clank', { at, vol: 0.3, rate: 0.8 }); if (dist(at) < 40) AudioSys.tone(2100, 0.06, 0.03, 'square'); break;   // armed: a little pip
    case 'oil-fire': S('smallboom', { at, vol: 0.7, rate: 0.6, wet: 0.25 }); break;   // the slick going up: a whoomph (then the fire's own loop: audio.js)
    case 'fire-hit': if (close) { AudioSys.burst(0.3, 'highpass', 2000, 0.6); S('thud', { at: c, vol: 0.4 }); } break;
    case 'drum-bounce': S('clang', { at, vol: 0.6, max: 4 }); break;
    case 'drum-burst': S('splash', { at, vol: e.onCar ? 0.8 : 0.55, rate: 0.55 }); S('clang', { at, vol: 0.5, rate: 0.75 }); break;
    case 'drum-hit': if (close) AudioSys.crash('car', 0.7, c); break;
    case 'mortar-blast': AudioSys.boom(at, 'big'); S('rubble', { at, vol: 0.5, rate: 1.1 }); break;
    case 'mortar-hit': if (close) AudioSys.crash('car', 0.8, c); break;
    case 'crater-hit': if (close) { AudioSys.thud(0.8, c); AudioSys.crash('car', 0.3, c); } break;
    case 'door': if (close) S('knock', { at: c, vol: 0.3, rate: 1.5 }); break;
    case 'door-hit': if (close) AudioSys.crash('car', 0.6, at); break;
    case 'derby-out': if (dist(c) < 80) { AudioSys.boom(c, 'small'); AudioSys.crash('car', 1, c); } break;
    case 'derby-over': case 'sd-over': { const w = race.cars[e.winner]; AudioSys.stinger(w.isPlayer ? 'win' : 'lose'); if (w.isPlayer) S('cheer', { vol: 0.6, wet: 0.25, max: 1 }); break; }
    case 'lap': if (me && e.n === G.world.tr.laps) AudioSys.musicIntensity(1); break;   // the final lap: the music lifts
    case 'finish': if (me) { AudioSys.stinger(c.place <= 3 ? 'win' : 'lose'); if (c.place <= 3) S('cheer', { vol: 0.65, wet: 0.25, max: 1 }); } break;
  }
}
// firing a weapon
function useSound(c, item, near) {
  const at = c, v = c.isPlayer ? 1 : near ? 0.75 : 0.45;
  if (item === 'missile') S('rocket', { at, vol: 0.8 * v, wet: 0.2 });
  else if (item === 'oil') S('clang', { at, vol: 0.4 * v, rate: 1.3 });                       // the drum leaving its rack
  else if (item === 'pulse') S('zap', { at, vol: 0.9 * v, wet: 0.3 });
  else if (item === 'mortar') S('thoomp', { at, vol: 0.9 * v, wet: 0.25 });
  else if (item === 'harpoon') S('twang', { at, vol: 0.8 * v });
  else if (item === 'water') AudioSys.burst(0.4 * v, 'highpass', 1200, 2.4);
  else if (item === 'cement') AudioSys.burst(0.3 * v, 'lowpass', 300, 1.5);
  else if (item === 'stinger') { S('clank', { at, vol: 0.5 * v, rate: 0.7 }); S('clank', { at, vol: 0.4 * v, rate: 0.9, delay: 0.12 }); }
  else if (item === 'crush') { S('thoomp', { at, vol: 0.6 * v, rate: 0.7 }); AudioSys.whoosh(0.6 * v); }
  else if (item === 'mine') S('clank', { at, vol: 0.5 * v, rate: 1.1 });
  else if (item === 'gun') AudioSys.tone(200, 0.25, 0.04 * v, 'sawtooth', 2.5);   // the barrels spinning up
  else if (item === 'jingle') [784, 659, 698, 784, 880, 784, 659, 523].forEach((f, k) => setTimeout(() => AudioSys.tone(f, 0.22, 0.06 * v, 'triangle'), k * 240));   // the van's chimes
}

// the menu's Sound panel: a level for the effects, the engines and the music (kept in this browser), and mute; every
// button in the menus gives a soft click
export function wireSound() {
  const btn = $('mute-btn'), panel = $('snd-panel'), mute = () => { $('snd-mute').textContent = AudioSys.on ? 'Mute all (M)' : 'Unmute (M)'; btn.textContent = AudioSys.on ? 'Sound' : 'Sound: Off'; };
  btn.addEventListener('click', () => { AudioSys.init(); panel.hidden = !panel.hidden; btn.setAttribute('aria-expanded', String(!panel.hidden)); });
  for (const k of ['fx', 'eng', 'mus']) { const el = $('snd-' + k); el.value = AudioSys.set[k]; el.addEventListener('input', () => { AudioSys.init(); AudioSys.level(k, +el.value); if (k === 'fx') AudioSys.sfx('knock', { vol: 0.6 }); }); }
  $('snd-mute').addEventListener('click', () => { AudioSys.init(); AudioSys.toggle(); mute(); });
  addEventListener('keydown', e => { if (e.code === 'KeyM') setTimeout(mute); });
  mute();
  document.addEventListener('click', e => { const b = e.target.closest && e.target.closest('button'); if (b && AudioSys.ctx && !b.closest('#touch')) AudioSys.click(); }, true);
  // the race music: the HUD's tag (back, next, like) and keys ] [ L; the panel's list (play one, like it)
  $('mus-btn').addEventListener('click', () => { AudioSys.init(); showTrack(AudioSys.musicNext(1)); });
  $('mus-prev').addEventListener('click', () => showTrack(AudioSys.musicNext(-1)));
  $('mus-next').addEventListener('click', () => showTrack(AudioSys.musicNext(1)));
  $('mus-like').addEventListener('click', () => { AudioSys.like(); showTrack(AudioSys.track()); list(); });
  addEventListener('keydown', e => {
    if (e.target.closest && e.target.closest('input, textarea, select') || G.state === 'menu') return;
    if (e.code === 'BracketRight') showTrack(AudioSys.musicNext(1)); else if (e.code === 'BracketLeft') showTrack(AudioSys.musicNext(-1)); else if (e.code === 'KeyL') { AudioSys.like(); showTrack(AudioSys.track()); }
  });
  $('snd-only').value = AudioSys.set.only ? '1' : '0';
  $('snd-only').addEventListener('change', e => { AudioSys.set.only = e.target.value === '1'; AudioSys.set.next = 0; AudioSys.save(); });
  const list = () => {
    const playing = AudioSys.wantSong === 'preview' ? AudioSys.track().i : -1;
    $('snd-list').innerHTML = SONGS.map((sg, i) => `<div><button type="button" data-play="${i}" class="${i === playing ? 'playing' : ''}" aria-label="Play ${sg.name}">${i === playing ? '&#9632;' : '&#9654;'}</button><span>${i + 1}. ${sg.name}<br><small>${sg.style}</small></span><button type="button" data-like="${i}" class="${AudioSys.set.liked.includes(sg.name) ? 'on' : ''}" aria-label="Like ${sg.name}">${AudioSys.set.liked.includes(sg.name) ? '&#9829;' : '&#9825;'}</button></div>`).join('');
  };
  $('snd-list').addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.like) AudioSys.like(+b.dataset.like);
    else { const i = +b.dataset.play; AudioSys.preview(AudioSys.wantSong === 'preview' && AudioSys.track().i === i ? null : i); }
    list();
  });
  btn.addEventListener('click', () => { if (panel.hidden && AudioSys.wantSong === 'preview') { AudioSys.preview(null); } list(); });
  list();
  // the menu's theme starts with the first tap or key (browsers keep the sound off until then)
  const wake = () => { AudioSys.init(); if (AudioSys.wantSong === undefined) AudioSys.music('menu'); removeEventListener('pointerdown', wake); removeEventListener('keydown', wake); };
  addEventListener('pointerdown', wake); addEventListener('keydown', wake);
}

let tagT = 0;
/** Show the race track playing in the HUD for a few seconds: its number, name and style, and the heart. */
export function showTrack(tr) {
  if (!tr) return;
  $('mus-name').innerHTML = `${tr.i + 1}/${tr.n} ${tr.song.name}<small>${tr.song.style}</small>`;
  const lk = $('mus-like'); lk.classList.toggle('on', tr.liked); lk.innerHTML = tr.liked ? '&#9829;' : '&#9825;';
  $('mus-tag').hidden = false; clearTimeout(tagT); tagT = setTimeout(() => { $('mus-tag').hidden = true; }, 5000);
}
