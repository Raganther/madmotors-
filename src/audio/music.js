// The soundtrack, played live (no recordings): a little band of synths on a look-ahead scheduler. A drum kit (a
// falling sine kick, a noise snare with a body, hats), a filtered saw bass, a detuned saw lead through a dotted-eighth
// echo, pads and a square arpeggio, playing songs written below as chord progressions, bass and drum patterns and a
// lead line. The race theme is in A minor at 140 bpm (intro, the hook, a second hook, a bridge, a break) and on the
// final lap (intensity 1) the arpeggio, open hats and a lead doubled an octave up come in; the menu theme is the same
// hook slowed, on pads and a soft arpeggio. Stingers: a fanfare for a podium, a falling one otherwise.
const A4 = 440, hz = semi => A4 * Math.pow(2, semi / 12);
// chords as semitones from A4 (root first); the bass plays the root two octaves down
const CH = { Am: [0, 3, 7], F: [-4, 0, 3], C: [3, 7, 10], G: [-2, 2, 5], Dm: [-7, -4, 0], E: [-5, -1, 2], Em: [-5, -2, 2], Fmaj7: [-4, 0, 3, 7] };
// lead lines: [step (16ths) in the bar, semitone from A4, length in steps] per bar
const HOOK = [
  [[0, 7, 3], [3, 5, 1], [4, 3, 2], [6, 5, 2], [8, 7, 4], [12, 10, 2], [14, 12, 2]],
  [[0, 10, 3], [3, 7, 1], [4, 5, 2], [6, 3, 2], [8, 5, 6]],
  [[0, 7, 2], [2, 10, 2], [4, 15, 4], [8, 14, 2], [10, 10, 2], [12, 7, 4]],
  [[0, 5, 3], [3, 2, 1], [4, 5, 2], [6, 10, 2], [8, 5, 8]]
];
const HOOK2 = [
  [[0, 12, 2], [2, 10, 2], [4, 7, 2], [6, 10, 2], [8, 12, 3], [11, 15, 1], [12, 14, 4]],
  [[0, 12, 2], [2, 10, 2], [4, 8, 4], [8, 7, 2], [10, 5, 2], [12, 3, 4]],
  [[0, 7, 2], [2, 3, 2], [4, 7, 2], [6, 10, 2], [8, 15, 4], [12, 14, 2], [14, 12, 2]],
  [[0, 10, 4], [4, 14, 4], [8, 17, 8]]
];
const BRIDGE = [
  [[0, 12, 4], [4, 8, 2], [6, 7, 2], [8, 5, 8]],
  [[0, 3, 2], [2, 5, 2], [4, 8, 4], [8, 12, 4], [12, 15, 4]],
  [[0, 7, 8], [8, 12, 4], [12, 10, 4]],
  [[0, 11, 4], [4, 14, 4], [8, 19, 8]]
];
// the race: sections of four bars; `lead` the line, `arp` / `pad` / `drums` the layers
const RACE = { bpm: 140, loopFrom: 1, sections: [
  { chords: ['Am', 'F', 'C', 'G'], drums: 'intro', bass: 'pulse' },
  { chords: ['Am', 'F', 'C', 'G'], drums: 'drive', bass: 'drive', lead: HOOK },
  { chords: ['Am', 'F', 'C', 'G'], drums: 'drive', bass: 'drive', lead: HOOK2, arp: 1 },
  { chords: ['Dm', 'F', 'Am', 'E'], drums: 'drive', bass: 'drive', lead: BRIDGE, pad: 1 },
  { chords: ['Am', 'F', 'C', 'G'], drums: 'drive', bass: 'drive', lead: HOOK, arp: 1 },
  { chords: ['F', 'G', 'Em', 'Am'], drums: 'break', bass: 'pulse', pad: 1, arp: 1 }
] };
const MENU = { bpm: 96, loopFrom: 0, sections: [
  { chords: ['Am', 'Fmaj7', 'C', 'G'], drums: 'soft', bass: 'soft', pad: 1, arp: 1 },
  { chords: ['Am', 'Fmaj7', 'C', 'G'], drums: 'soft', bass: 'soft', pad: 1, arp: 1, lead: HOOK, soft: 1 },
  { chords: ['Dm', 'F', 'Am', 'E'], drums: 'soft', bass: 'soft', pad: 1, arp: 1, lead: BRIDGE, soft: 1 },
  { chords: ['Am', 'Fmaj7', 'C', 'G'], drums: 'none', bass: 'soft', pad: 1, arp: 1 }
] };
const SONGS = { race: RACE, menu: MENU };
// drum patterns over 16 steps: k kick, s snare, h hat, o open hat
const DRUMS = {
  intro: { k: [0, 4, 8, 12], h: [2, 6, 10, 14] },
  drive: { k: [0, 3, 8, 10], s: [4, 12], h: [0, 2, 4, 6, 8, 10, 12, 14], g: [15] },
  break: { k: [0, 8], s: [12], h: [0, 4, 8, 12] },
  soft: { k: [0, 10], s: [8], h: [4, 12] },
  none: {}
};

export const Music = {
  ctx: null, bus: null, song: null, name: null, step: 0, bar: 0, sec: 0, next: 0, timer: 0, intensity: 0,
  init(ctx, out) {
    this.ctx = ctx; this.bus = ctx.createGain(); this.bus.gain.value = 1;
    this.muffle = ctx.createBiquadFilter(); this.muffle.type = 'lowpass'; this.muffle.frequency.value = 20000;
    this.bus.connect(this.muffle); this.muffle.connect(out);
    // the lead's echo: a dotted eighth, darker each time round
    this.echo = ctx.createDelay(2); const fb = ctx.createGain(), lp = ctx.createBiquadFilter(), wet = ctx.createGain(); fb.gain.value = 0.32; lp.type = 'lowpass'; lp.frequency.value = 2400; wet.gain.value = 0.3;
    this.echo.connect(lp); lp.connect(fb); fb.connect(this.echo); lp.connect(wet); wet.connect(this.bus);
    const n = ctx.sampleRate, b = ctx.createBuffer(1, n, n), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; this.noise = b;
  },
  /** Start a song ('race' / 'menu'), or stop (null); a change fades the old one out first. */
  play(name) {
    if (!this.ctx || name === this.name) return;
    this.name = name; clearInterval(this.timer); this.timer = 0;
    const t = this.ctx.currentTime; this.bus.gain.cancelScheduledValues(t); this.bus.gain.setValueAtTime(this.bus.gain.value, t); this.bus.gain.linearRampToValueAtTime(0, t + 0.4);
    if (!name) return;
    const song = SONGS[name];
    setTimeout(() => {
      if (this.name !== name) return;
      this.song = song; this.sec = 0; this.bar = 0; this.step = 0; this.intensity = 0; this.next = this.ctx.currentTime + 0.1;
      this.echo.delayTime.value = 60 / song.bpm * 0.75;
      const g = this.bus.gain, now = this.ctx.currentTime; g.cancelScheduledValues(now); g.setValueAtTime(0, now); g.linearRampToValueAtTime(1, now + 0.6);
      this.timer = setInterval(() => this.tick(), 40); this.tick();
    }, 420);
  },
  /** Paused: the music goes muffled and quieter. */
  pause(on) { if (this.ctx) this.muffle.frequency.setTargetAtTime(on ? 600 : 20000, this.ctx.currentTime, 0.15); },
  tick() {
    const ctx = this.ctx, song = this.song; if (!song) return;
    const st = 60 / song.bpm / 4;
    if (this.next < ctx.currentTime - 0.2) this.next = ctx.currentTime + 0.05;   // the tab was asleep: pick up from now, don't pile notes up
    while (this.next < ctx.currentTime + 0.18) {
      this.note(song.sections[this.sec], this.bar, this.step, this.next, st);
      this.next += st; this.step++;
      if (this.step === 16) { this.step = 0; this.bar++; if (this.bar === 4) { this.bar = 0; this.sec++; if (this.sec >= song.sections.length) this.sec = song.loopFrom; } }
    }
  },
  // everything that plays on one 16th of a section
  note(S, bar, step, t, st) {
    const chord = CH[S.chords[bar]], hot = this.intensity > 0 && this.name === 'race', soft = this.name === 'menu';
    const D = DRUMS[S.drums] || {};
    if ((D.k || []).includes(step)) this.kick(t, soft ? 0.55 : 0.9);
    if ((D.s || []).includes(step)) this.snare(t, soft ? 0.25 : 0.55);
    if ((D.g || []).includes(step) && bar === 3) this.snare(t, 0.3);
    if ((D.h || []).includes(step) || (hot && S.drums === 'drive' && step % 2 === 1)) this.hat(t, step % 4 === 2 ? 0.22 : 0.13, hot && step % 8 === 6 ? 0.22 : 0.035);
    // bass: the root, driving 8ths (an octave jump on the off-beats) or a pulse on the beats
    const root = chord[0] - 24;
    if (S.bass === 'drive' && step % 2 === 0) this.bass(t, hz(root + (step % 4 === 2 ? 12 : 0) - 12), st * 1.8, 0.5);
    else if (S.bass === 'pulse' && step % 4 === 0) this.bass(t, hz(root - 12), st * 3.5, 0.45);
    else if (S.bass === 'soft' && (step === 0 || step === 8 || step === 14)) this.bass(t, hz(root - 12), st * (step === 14 ? 2 : 6), 0.35);
    if (S.pad && step === 0) this.pad(t, chord, st * 16, soft ? 0.09 : 0.07);
    if ((S.arp || hot) && step % (soft ? 2 : 1) === 0) { const k = (step / (soft ? 2 : 1)) % 4, notes = [...chord, chord[0] + 12]; this.arp(t, hz(notes[k] + 12), st * 0.9, soft ? 0.05 : 0.045); }
    if (S.lead) for (const [s, n, l] of S.lead[bar]) if (s === step) { this.lead(t, hz(n), st * l, soft ? 0.07 : 0.11, soft); if (hot) this.lead(t, hz(n + 12), st * l, 0.05, false); }
  },
  env(g, t, a, peak, d, end) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.setTargetAtTime(0.0001, t + a + d, end); },
  kick(t, v) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12); this.env(g, t, 0.003, v, 0.05, 0.08); o.connect(g); g.connect(this.bus); o.start(t); o.stop(t + 0.5); },
  snare(t, v) {
    const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 1400; const g = c.createGain(); this.env(g, t, 0.002, v, 0.02, 0.05);
    s.connect(f); f.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.5); s.stop(t + 0.3);
    const o = c.createOscillator(), og = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(200, t); o.frequency.exponentialRampToValueAtTime(150, t + 0.08); this.env(og, t, 0.002, v * 0.7, 0.01, 0.04); o.connect(og); og.connect(this.bus); o.start(t); o.stop(t + 0.25);
  },
  hat(t, v, len) { const c = this.ctx, s = c.createBufferSource(); s.buffer = this.noise; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500; const g = c.createGain(); this.env(g, t, 0.001, v, 0.005, len); s.connect(f); f.connect(g); g.connect(this.bus); s.start(t, Math.random() * 0.5); s.stop(t + len * 5 + 0.05); },
  bass(t, f, len, v) {
    const c = this.ctx, o = c.createOscillator(), o2 = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = f; o2.frequency.value = f / 2;
    lp.type = 'lowpass'; lp.Q.value = 5; lp.frequency.setValueAtTime(1400, t); lp.frequency.exponentialRampToValueAtTime(260, t + len);
    const g2 = c.createGain(); g2.gain.value = 0.5; o2.connect(g2); g2.connect(lp); o.connect(lp); lp.connect(g); g.connect(this.bus);
    this.env(g, t, 0.005, v, len * 0.6, 0.04); o.start(t); o2.start(t); o.stop(t + len + 0.3); o2.stop(t + len + 0.3);
  },
  lead(t, f, len, v, soft) {
    const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = soft ? 1600 : 3200; lp.Q.value = 1.5;
    for (const dt of [-7, 7]) { const o = c.createOscillator(); o.type = soft ? 'triangle' : 'sawtooth'; o.frequency.value = f; o.detune.value = dt; const vib = c.createOscillator(), vg = c.createGain(); vib.frequency.value = 5.5; vg.gain.setValueAtTime(0, t); vg.gain.linearRampToValueAtTime(f * 0.006, t + Math.min(len, 0.4)); vib.connect(vg); vg.connect(o.frequency); o.connect(lp); o.start(t); o.stop(t + len + 0.4); vib.start(t); vib.stop(t + len + 0.4); }
    lp.connect(g); g.connect(this.bus); g.connect(this.echo); this.env(g, t, 0.01, v, len * 0.85, 0.08);
  },
  pad(t, chord, len, v) {
    const c = this.ctx, lp = c.createBiquadFilter(), g = c.createGain(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(g); g.connect(this.bus);
    for (const n of chord) for (const dt of [-9, 9]) { const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n - 12); o.detune.value = dt; o.connect(lp); o.start(t); o.stop(t + len + 1); }
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(v, t + len * 0.3); g.gain.setTargetAtTime(0.0001, t + len * 0.85, 0.25);
  },
  arp(t, f, len, v) { const c = this.ctx, o = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain(); o.type = 'square'; o.frequency.value = f; lp.type = 'lowpass'; lp.frequency.value = 2600; o.connect(lp); lp.connect(g); g.connect(this.bus); g.connect(this.echo); this.env(g, t, 0.003, v, 0.02, len * 0.4); o.start(t); o.stop(t + len + 0.3); },
  /** A short phrase over whatever's playing: 'win' (a fanfare up) or 'lose' (falling away). */
  stinger(kind) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime + 0.05, seq = kind === 'win' ? [[0, 3], [0.14, 7], [0.28, 10], [0.42, 15], [0.62, 19]] : [[0, 7], [0.18, 5], [0.36, 3], [0.6, 2]];
    for (const [dt, n] of seq) this.lead(t + dt, hz(n), kind === 'win' && dt > 0.6 ? 0.9 : 0.22, 0.14, false);
    if (kind === 'win') { this.pad(t + 0.62, [3, 7, 10, 15], 1.4, 0.12); this.kick(t + 0.62, 0.8); }
  }
};
