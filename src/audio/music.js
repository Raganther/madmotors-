import { mulberry32 } from '../core/math.js';
import { SONGS } from './songs.js';

// The soundtrack, played live (no recordings): a band of synths on a look-ahead scheduler, playing the songs in
// songs.js (twenty race tracks, each a style) and the menu theme. Each song is four-bar sections: an intro (no lead),
// the verse with its melody, the verse again with a second melody, the bridge on the B chords, the verse, and a
// break with the drums cut back; then round again from the verse (a song with `lift` goes up a step each time
// round). On the final lap (intensity 1) the hats double and the lead is doubled an octave up. Stingers: a fanfare
// for a podium, a falling phrase otherwise.
const hz = semi => 440 * Math.pow(2, semi / 12);
const ROOT = { A: 0, B: 2, C: 3, D: 5, E: 7, F: 8, G: 10 };
const QUAL = { '': [0, 4, 7], m: [0, 3, 7], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], 5: [0, 7, 12], sus4: [0, 5, 7], dim: [0, 3, 6], add9: [0, 4, 7, 14] };
/** A chord name (Am, F#m7, Bb, C5, Gsus4...) as semitones from A4, the root between F#3 and B4. */
export function chordOf(name) {
  const m = /^([A-G])([#b]?)(.*)$/.exec(name); let r = ROOT[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
  while (r > 2) r -= 12; while (r < -9) r += 12;
  return (QUAL[m[3]] || QUAL['']).map(i => r + i);
}
// the rhythms a generated melody's bars are drawn from: [step, length] per note, by feel
const FEEL = {
  drive: [[[0, 2], [2, 2], [4, 2], [6, 2], [8, 3], [11, 1], [12, 4]], [[0, 3], [3, 3], [6, 2], [8, 2], [10, 2], [12, 4]], [[0, 2], [2, 1], [3, 1], [4, 4], [8, 2], [10, 2], [12, 2], [14, 2]], [[0, 4], [4, 2], [6, 2], [8, 4], [12, 4]]],
  sparse: [[[0, 6], [6, 2], [8, 8]], [[0, 4], [4, 4], [8, 8]], [[0, 8], [8, 4], [12, 4]], [[0, 3], [3, 5], [8, 8]]],
  sync: [[[0, 3], [3, 3], [6, 2], [10, 2], [12, 3]], [[2, 2], [4, 3], [7, 3], [10, 2], [12, 2], [14, 2]], [[0, 2], [3, 2], [6, 3], [9, 1], [10, 4]], [[0, 3], [3, 1], [4, 2], [7, 3], [10, 6]]],
  busy: [[[0, 1], [1, 1], [2, 2], [4, 1], [5, 1], [6, 2], [8, 1], [9, 1], [10, 2], [12, 2], [14, 2]], [[0, 2], [2, 1], [3, 1], [4, 2], [6, 1], [7, 1], [8, 2], [10, 2], [12, 1], [13, 1], [14, 2]], [[0, 2], [2, 2], [4, 1], [5, 1], [6, 2], [8, 4], [12, 2], [14, 2]]],
  lazy: [[[0, 4], [6, 2], [8, 6]], [[2, 4], [6, 2], [8, 8]], [[0, 3], [4, 4], [10, 6]], [[0, 6], [8, 2], [10, 6]]]
};
/**
 * A melody for four bars over `chords` (semitone lists): two bars of motif, bar 3 answering bar 1 (its shape moved
 * to the new chord), bar 4 coming home. Notes on the beat are chord tones, the rest step through the scale, leaps
 * no more than a fifth. Returns [[step, semitone, length], ...] per bar.
 */
export function melody(song, chords, rnd, feel = 'drive') {
  const lo = song.key - 3, hi = song.key + 17, pcs = song.scale.map(s => (((s + song.key) % 12) + 12) % 12);
  const notes = []; for (let n = lo; n <= hi; n++) if (pcs.includes(((n % 12) + 12) % 12)) notes.push(n);
  const near = (p, set) => set.reduce((b, n) => Math.abs(n - p) < Math.abs(b - p) ? n : b, set[0]);
  const tones = ch => notes.filter(n => ch.some(c => (((c - n) % 12) + 12) % 12 === 0));
  const cells = FEEL[feel] || FEEL.drive, r1 = cells[(rnd() * cells.length) | 0], r2 = cells[(rnd() * cells.length) | 0];
  let p = near(song.key + 7, notes);
  const fresh = (cell, ch, home) => cell.map(([s, l], k) => {
    if (s % 4 === 0 || k === 0) { let ts = tones(ch).filter(n => Math.abs(n - p) <= 8); if (ts.length > 1 && rnd() < 0.8) ts = ts.filter(n => n !== p); const c = ts.length ? ts.sort((a, b) => Math.abs(a - p) - Math.abs(b - p))[Math.min(ts.length - 1, (rnd() * 2.2) | 0)] : near(p, notes); p = c; }   // a chord tone, mostly a move
    else { const i = notes.indexOf(near(p, notes)), dir = p > song.key + 12 ? -1 : p < song.key + 2 ? 1 : (rnd() < 0.5 ? -1 : 1); p = notes[Math.max(0, Math.min(notes.length - 1, i + dir * (rnd() < 0.7 ? 1 : 2)))]; }
    if (home && k === cell.length - 1) { const roots = tones(ch).filter(n => (((n - ch[0]) % 12) + 12) % 12 === 0); if (roots.length) p = near(p, roots); }   // the last note: the chord's root
    return [s, p, l];
  });
  const b1 = fresh(r1, chords[0]), b2 = fresh(r2, chords[1]);
  const shift = chords[2][0] - chords[0][0], b3 = b1.map(([s, n, l]) => { const q = n + (Math.abs(shift) > 6 ? shift - 12 * Math.sign(shift) : shift); return [s, s % 4 === 0 ? near(q, tones(chords[2])) : near(q, notes), l]; });
  p = b3[b3.length - 1][1];
  const end = r2.map(([s, l], k, a) => [s, k === a.length - 1 ? 16 - s : l]), b4 = fresh(end, chords[3], true);
  return [b1, b2, b3, b4];
}
const MENU = { name: 'Menu theme', bpm: 96, key: 0, scale: [0, 2, 3, 5, 7, 8, 10], A: ['Am', 'Fmaj7', 'C', 'G'], B: ['Dm', 'F', 'Am', 'E'],
  drums: { kit: 'acoustic', k: 'x---------x-----', s: '--------x-------', h: '----x-------x---', half: {}, soft: 1 }, bass: { pat: 'r-------r-----r-', wave: 'tri', cut: 700 },
  comp: [{ type: 'pad', wave: 'saw', cut: 900 }, { type: 'arp', arp: 'up', rate: 2, wave: 'square', cut: 2000, vol: 0.8 }], lead: { wave: 'tri', echo: 0.35, vib: 0.006, feel: 'sparse', cut: 1600 } };
// each song's level, so they sit at much the same loudness (measured by an analyser on the music bus)
const LEVEL = { 'Lo-fi Cruise': 2.6, 'Jazz Hatchback': 2, 'Drum & Bass Overdrive': 1.25, 'Chiptune Rally': 1.2, 'Breakbeat Canyon': 1.2, 'Arcade Turbo': 1.15, 'Metal Mayhem': 0.5, 'Desert Heat': 0.65,
  'Trance Summit': 0.65, 'House Lap': 0.7, 'Big Beat Smash': 0.68, 'Dubstep Demolition': 0.7, 'Garage Punk': 0.8, 'Surf Panic': 0.85, 'Funk Wheels': 0.85, 'Spaghetti Showdown': 0.85 };
const SECTIONS = [['intro', 'A'], ['A', 'A'], ['A2', 'A'], ['B', 'B'], ['A', 'A'], ['break', 'A']];
const curve = k => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * k) / Math.tanh(k); } return c; };

export const Music = {
  ctx: null, bus: null, song: null, name: null, idx: 0, intensity: 0, timer: 0,
  init(ctx, out) {
    this.ctx = ctx; this.bus = ctx.createGain(); this.bus.gain.value = 0;
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000;
    this.bus.connect(this.muffle); this.muffle.connect(out);
    // an echo (the lead's and the arpeggio's), darker each time round
    this.echo = ctx.createDelay(2); const fb = ctx.createGain(), lp = ctx.createBiquadFilter(); this.wet = ctx.createGain(); fb.gain.value = 0.32; lp.type = 'lowpass'; lp.frequency.value = 2400; this.wet.gain.value = 0.3;
    this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo); lp.connect(this.wet); this.wet.connect(this.bus);
    // drive: power chords, a distorted bass or lead go through this
    this.drive = ctx.createWaveShaper(); this.drive.curve = curve(6); this.drive.oversample = '2x'; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 3800; const dg = ctx.createGain(); dg.gain.value = 0.35; this.drive.connect(dl); dl.connect(dg); dg.connect(this.bus);
    const n = ctx.sampleRate, b = ctx.createBuffer(1, n, n), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noise = b;
    const cb = ctx.createBuffer(1, n * 2, n), cd = cb.getChannelData(0); for (let i = 0; i < cd.length; i++) cd[i] = Math.random() < 0.0007 ? (Math.random() - 0.5) * 1.6 : (Math.random() - 0.5) * 0.02; this.crackBuf = cb;
  },
  /** 'race' (the chosen race track: `idx`), 'menu', a song number (a preview), or null (stop). */
  play(name) {
    if (!this.ctx) return;
    const song = name === 'menu' ? MENU : name === 'race' ? SONGS[this.idx] : typeof name === 'number' ? SONGS[name] : null, key = song ? song.name : null;
    if (key === this.name) return;
    this.name = key; clearInterval(this.timer); this.timer = 0;
    const t = this.ctx.currentTime, g = this.bus.gain; g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(0, t + 0.35);
    if (this.crackle) { const c = this.crackle; setTimeout(() => { try { c.stop(); } catch (e) { /* stopped */ } }, 400); this.crackle = null; }
    if (!song) return;
    setTimeout(() => { if (this.name === key) this.start(song); }, 380);
  },
  start(song) {
    const ctx = this.ctx, rnd = mulberry32([...song.name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) | 0, 17));
    const A = song.A.map(chordOf), B = song.B.map(chordOf), L = song.lead, line = L.line;
    this.lines = { A: line ? line.A : melody(song, A, rnd, L.feel), A2: line ? line.A2 : melody(song, A, rnd, L.feel), B: line ? line.B : melody(song, B, rnd, L.feel) };
    this.song = song; this.chords = { A, B }; this.sec = 0; this.bar = 0; this.step = 0; this.pass = 0; this.intensity = 0; this.next = ctx.currentTime + 0.08; this.lastLead = 0;
    this.st = 60 / song.bpm / 4; this.echo.delayTime.value = this.st * 3;
    const g = this.bus.gain, now = ctx.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(0, now); g.linearRampToValueAtTime(LEVEL[song.name] || 1, now + 0.5);
    if (song.crackle) { const s = ctx.createBufferSource(); s.buffer = this.crackBuf; s.loop = true; const cg = ctx.createGain(); cg.gain.value = 0.25; s.connect(cg); cg.connect(this.bus); s.start(); this.crackle = s; }
    this.timer = setInterval(() => this.tick(), 40); this.tick();
  },
  /** Paused: the music goes muffled. */
  pause(on) { if (this.ctx) this.muffle.frequency.setTargetAtTime(on ? 600 : 20000, this.ctx.currentTime, 0.15); },
  tick() {
    const ctx = this.ctx, song = this.song; if (!song) return;
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.05;   // the tab was asleep: pick up from now, don't pile notes up
    while (this.next < ctx.currentTime + 0.18) {
      const odd = this.step % 2 === 1, t = this.next + (odd ? (song.swing || 0) * this.st : 0);
      this.note(t);
      this.next += this.st; this.step++;
      if (this.step === 16) { this.step = 0; this.bar++; if (this.bar === 4) { this.bar = 0; this.sec++; if (this.sec >= SECTIONS.length) { this.sec = 1; this.pass++; } } }
    }
  },
  // everything that plays on one 16th
  note(t) {
    const song = this.song, [kind, ch] = SECTIONS[this.sec], step = this.step, bar = this.bar, up = song.lift && this.pass % 2 ? song.lift : 0;
    const chords = this.chords[ch], chord = chords[bar].map(n => n + up), nextChord = chords[(bar + 1) % 4].map(n => n + up), hot = this.intensity > 0 && song !== MENU;
    const Dk = song.drums, D = kind === 'break' ? (Dk.half || {}) : kind === 'intro' ? { k: Dk.k, h: Dk.h, c: Dk.c, t: Dk.t } : Dk, at = (p, s) => p && p[s] !== '-' && p[s] !== undefined ? (p[s] === 'X' ? 1.25 : 1) : 0, soft = Dk.soft ? 0.55 : 1;
    let v;
    if ((v = at(D.k, step))) this.kick(t, 0.9 * v * soft, Dk.kit);
    if ((v = at(D.s, step))) this.snare(t, 0.5 * v * soft, Dk.kit, Dk.big);
    if ((v = at(D.c, step))) this.clap(t, 0.45 * v * soft);
    if ((v = at(D.t, step))) this.tom(t, 0.4 * v * soft, Dk.kit);
    if ((v = at(D.r, step))) this.ride(t, 0.16 * v);
    if ((v = at(D.o, step))) this.hat(t, 0.16 * soft, 0.2, Dk.kit);
    if (at(D.h, step) || (hot && kind !== 'break' && step % 2 === 1)) this.hat(t, (step % 4 === 2 ? 0.2 : 0.13) * soft, 0.035, Dk.kit);
    if (bar === 3 && step >= 12 && kind === 'B' && step % 2 === 0) this.snare(t, 0.25 + (step - 12) * 0.06, Dk.kit);   // a fill into the verse
    this.bassStep(t, chord, nextChord, step, kind);
    for (const C of [].concat(song.comp)) this.compStep(t, C, chord, step);
    if (kind !== 'intro' && kind !== 'break') { const line = this.lines[kind][bar]; for (const [s, n, l] of line) if (s === step) { this.lead(t, n + up, l * this.st, false); if (hot) this.lead(t, n + up + 12, l * this.st, true); } }
  },
  bassStep(t, chord, nextChord, step, kind) {
    const B = this.song.bass, pat = B.pat, c = pat[step]; if (!c || c === '-' || c === '.') return;
    let len = 1; while (pat[step + len] === '.') len++;
    const root = chord[0] - 24 + (B.oct || 0) * 12, n = c === 'o' ? root + 12 : c === 'f' ? root + 7 : c === '7' ? root + 10 : c === 'w' ? (nextChord[0] - 24 + (B.oct || 0) * 12) + (step % 8 < 4 ? -1 : 2) : root;
    this.bass(t, hz(n), len * this.st * 0.92, kind === 'intro' ? 0.4 : 0.5, B);
  },
  compStep(t, C, chord, step) {
    const st = this.st, ty = C.type, v = C.vol || 1;
    if (ty === 'pad' && step === 0) this.pad(t, chord, st * 16, 0.08 * v, C);
    else if ((ty === 'stab' || ty === 'skank' || ty === 'keys' || ty === 'power') && C.pat && C.pat[step] === 'x') this.stab(t, chord, ty, v, C);
    else if (ty === 'arp' && step % (C.rate || 1) === 0) {
      const tones = [...chord, chord[0] + 12], k = step / (C.rate || 1), n = tones.length;
      const i = C.arp === 'updown' ? [0, 1, 2, 3, 2, 1][k % 6] % n : C.arp === 'oct' ? (k % 2 ? n - 1 : 0) + 0 * k : C.arp === 'rand' ? ((k * 7 + this.bar * 3) % n) : k % n;
      const note = C.arp === 'oct' ? chord[(k >> 1) % chord.length] + (k % 2 ? 12 : 0) : tones[i];
      this.arp(t, hz(note + 12 + (C.oct || 0) * 12), st * 0.9, 0.045 * v, C);
    }
  },
  out(dist) { return dist ? this.drive : this.bus; },
  env(g, t, a, peak, d, end) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a); g.gain.setTargetAtTime(0.0001, t + a + d, end); },
  osc(type, f, t, stop) { const o = this.ctx.createOscillator(); o.type = type; o.frequency.value = f; o.start(t); o.stop(stop); return o; },
  // ---- drums ----
  kick(t, v, kit) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = kit === 'chip' ? 'square' : 'sine';
    o.frequency.setValueAtTime(kit === 'chip' ? 220 : 150, t); o.frequency.exponentialRampToValueAtTime(kit === '808' ? 38 : 45, t + (kit === '808' ? 0.25 : 0.12));
    this.env(g, t, 0.003, v * (kit === 'chip' ? 0.5 : 1), kit === '808' ? 0.15 : 0.05, kit === '808' ? 0.25 : 0.08); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 1);
  },
  snare(t, v, kit, big) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = kit === 'chip' ? 'bandpass' : 'highpass'; f.frequency.value = kit === 'chip' ? 3000 : 1400; const g = c.createGain(); this.env(g, t, 0.002, v, 0.02, big ? 0.14 : 0.05);
    s.connect(f); f.connect(g); g.connect(this.bus); if (big) g.connect(this.echo); s.start(t, Math.random() * 0.5); s.stop(t + 0.8);
    if (kit === 'chip') return;
    const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08); this.env(og, t, 0.002, v * 0.7, 0.01, 0.04); o.connect(og); og.connect(this.bus); o.start(t); o.stop(t + 0.25);
  },
  clap(t, v) { for (let k = 0; k < 3; k++) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 1.5; const g = c.createGain(); this.env(g, t + k * 0.011, 0.001, v * (k === 2 ? 1 : 0.6), 0.005, k === 2 ? 0.06 : 0.008); s.connect(f); f.connect(g); g.connect(this.bus); s.start(t + k * 0.011, Math.random() * 0.5); s.stop(t + 0.4); } },
  tom(t, v, kit) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(), f0 = kit === '808' ? 260 : 140; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + 0.15); this.env(g, t, 0.002, v, 0.03, 0.08); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.5); },
  hat(t, v, len, kit) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = kit === 'chip' ? 9000 : 7500; const g = c.createGain(); this.env(g, t, 0.001, v, 0.005, len); s.connect(f); f.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.5); s.stop(t + len * 5 + 0.05); },
  ride(t, v) { const c = this.ctx, f = c.createBiquadFilter(), g = c.createGain(); f.type = 'highpass'; f.frequency.value = 5000; f.connect(g); g.connect(this.bus); for (const m of [1, 1.342, 1.783, 2.413]) { const o = c.createOscillator(); o.type = 'square'; o.frequency.value = 440 * m; o.connect(f); o.start(t); o.stop(t + 0.6); } this.env(g, t, 0.002, v, 0.02, 0.18); },
  // ---- bass ----
  bass(t, f, len, v, B) {
    const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(), wave = { tri: 'triangle', sine: 'sine', square: 'square' }[B.wave] || 'sawtooth', cut = B.cut || 1000;
    lp.type = 'lowpass'; lp.Q.value = B.q ?? 2;
    const accent = B.acid ? (Math.random() < 0.35 ? 1.6 : 1) : 1, top = cut + (B.env ?? cut * 0.6) * accent;
    lp.frequency.setValueAtTime(top, t); lp.frequency.exponentialRampToValueAtTime(Math.max(60, cut * 0.5), t + Math.max(0.06, B.acid ? 0.12 : len));
    if (B.wob) { const lfo = c.createOscillator(), lg = c.createGain(); lfo.type = 'sine'; lfo.frequency.value = 1 / (B.wob * this.st); lg.gain.value = cut * 1.6; lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t); lfo.stop(t + len + 0.3); lp.frequency.cancelScheduledValues(t); lp.frequency.setValueAtTime(cut * 1.8, t); }
    for (const dt of B.det ? [-B.det, B.det] : [0]) { const o = this.osc(wave, f, t, t + len + 0.3); o.detune.value = dt; o.connect(lp); }
    if (wave !== 'sine' && !B.wob) { const sub = this.osc('sine', f, t, t + len + 0.3), sg = c.createGain(); sg.gain.value = 0.5; sub.connect(sg); sg.connect(g); }
    lp.connect(g); g.connect(this.out(B.dist)); this.env(g, t, 0.005, v * accent * (B.dist ? 1.4 : 1), len * 0.7, 0.04);
  },
  // ---- the chords ----
  pad(t, chord, len, v, C) {
    const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = C.cut || 900; lp.connect(g); g.connect(this.bus);
    const dets = C.sup ? [-18, -7, 0, 7, 18] : [-9, 9];
    for (const n of chord) for (const dt of dets) { const o = this.osc(C.wave === 'tri' ? 'triangle' : 'sawtooth', hz(n - 12), t, t + len + 1); o.detune.value = dt; o.connect(lp); }
    const vv = v * (C.sup ? 0.7 : 1);
    if (C.gate) { g.gain.setValueAtTime(0, t); for (let k = 0; k < 16; k++) { const s = t + k * this.st; g.gain.setValueAtTime(vv * (k % 4 === 3 ? 0.2 : 1), s); g.gain.setValueAtTime(0.0001, s + this.st * 0.7); } g.gain.setValueAtTime(0.0001, t + len); }
    else { g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vv, t + len * 0.3); g.gain.setTargetAtTime(0.0001, t + len * 0.85, 0.25); }
  },
  stab(t, chord, ty, v, C) {
    const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = C.cut || 2000; lp.connect(g);
    if (ty === 'power') { const r = chord[0] - 12; for (const n of [r, r + 7, r + 12]) this.osc('sawtooth', hz(n), t, t + 0.4).connect(lp); g.connect(this.drive); this.env(g, t, 0.003, 0.5 * v, 0.06, 0.05); return; }
    const notes = ty === 'skank' ? chord.map(n => n + 12) : chord, wave = ty === 'keys' ? 'triangle' : C.wave === 'saw' ? 'sawtooth' : 'square';
    for (const n of notes) { const o = this.osc(wave, hz(n), t, t + 0.8); o.connect(lp); if (ty === 'keys') { const o2 = this.osc('sine', hz(n + 12), t, t + 0.8), g2 = c.createGain(); g2.gain.value = 0.3; o2.connect(g2); g2.connect(lp); } }
    g.connect(this.bus); if (ty === 'keys') g.connect(this.echo);
    const vol = (ty === 'keys' ? 0.08 : ty === 'skank' ? 0.05 : 0.06) * v; this.env(g, t, 0.003, vol, ty === 'keys' ? 0.05 : 0.02, ty === 'keys' ? 0.25 : ty === 'skank' ? 0.03 : 0.07);
  },
  arp(t, f, len, v, C) { const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = C.cut || 2600; this.osc(C.wave === 'tri' ? 'triangle' : 'square', f, t, t + len + 0.3).connect(lp); lp.connect(g); g.connect(this.bus); g.connect(this.echo); this.env(g, t, 0.003, v, 0.02, len * 0.4); },
  // ---- the lead ----
  lead(t, semi, len, dbl) {
    const L = this.song.lead, c = this.ctx, f = hz(semi + (L.oct || 0) * 12), lp = c.createBiquadFilter(), g = c.createGain();
    lp.type = 'lowpass'; lp.frequency.value = L.cut || 3200; lp.Q.value = 1.2;
    const wave = { tri: 'triangle', sine: 'sine', square: 'square', pulse: 'square' }[L.wave] || 'sawtooth', v = (dbl ? 0.045 : 0.1) * (L.wave === 'sine' || L.wave === 'tri' ? 1.4 : 1) * (L.dist ? 0.8 : 1);
    if (L.brass) { lp.frequency.setValueAtTime(500, t); lp.frequency.linearRampToValueAtTime(L.cut || 2200, t + 0.08); }
    for (const dt of L.det ? [-L.det, L.det] : [0]) {
      const o = this.osc(wave, f, t, t + len + 0.4); o.detune.value = dt;
      if (L.glide && this.lastLead && !dbl) { o.frequency.setValueAtTime(this.lastLead, t); o.frequency.exponentialRampToValueAtTime(f, t + L.glide); }
      if (L.vib) { const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * L.vib, t + Math.min(len, 0.35)); vib.connect(vg); vg.connect(o.frequency); vib.start(t); vib.stop(t + len + 0.4); }
      o.connect(lp);
    }
    if (!dbl) this.lastLead = f;
    lp.connect(g); g.connect(this.out(L.dist)); if (L.echo) { const e = c.createGain(); e.gain.value = L.echo * 1.5; g.connect(e); e.connect(this.echo); }
    if (L.trem) { const n = Math.max(1, Math.round(len / this.st)); g.gain.setValueAtTime(0.0001, t); for (let k = 0; k < n; k++) { const s = t + k * this.st; g.gain.setValueAtTime(v, s); g.gain.setTargetAtTime(0.0001, s + 0.01, this.st * 0.35); } return; }
    if (L.vibes) { g.gain.setValueAtTime(v * 1.2, t); g.gain.setTargetAtTime(0.0001, t + 0.02, Math.min(0.5, len * 0.6)); return; }
    this.env(g, t, 0.01, v, len * 0.85, 0.08);
  },
  /** A short phrase over whatever's playing: 'win' (a fanfare up) or 'lose' (falling away). */
  stinger(kind) {
    if (!this.ctx) return;
    const save = this.song, t = this.ctx.currentTime + 0.05, seq = kind === 'win' ? [[0, 3], [0.14, 7], [0.28, 10], [0.42, 15], [0.62, 19]] : [[0, 7], [0.18, 5], [0.36, 3], [0.6, 2]];
    this.song = { lead: { wave: 'saw', det: 7, echo: 0.3, vib: 0.006 } };
    for (const [dt, n] of seq) this.lead(t + dt, n, kind === 'win' && dt > 0.6 ? 0.9 : 0.22, false);
    if (kind === 'win') { this.pad(t + 0.62, [3, 7, 10, 15], 1.4, 0.12, { cut: 1400 }); this.kick(t + 0.62, 0.8); }
    this.song = save;
  }
};
export { SONGS };
