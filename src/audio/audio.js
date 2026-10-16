import { clamp } from '../core/math.js';
import { carWear } from '../core/sim/damage.js';
import { WPN, roadPos } from '../core/features/weapons.js';
import { G } from '../game.js';
import { wallFx } from '../render/effects/impacts.js';
import { engineHz, playerEngine, rivalEngine } from './engine.js';
import { Music, SONGS } from './music.js';
import { SFX } from './sfx.js';

// ---------- audio ----------
// Three buses into one master (and a compressor that keeps a pile-up from clipping): the engines and road noise, the
// effects (sfx.js: the designed sounds, placed in the scene) and the music (music.js). Their levels are the Sound
// settings (menu: Sound), kept in this browser. M mutes everything.
const SETTINGS = 'downhill-rush-sound', DEF = { fx: 0.9, eng: 0.8, mus: 0.55, on: true, liked: [], only: false, next: 0 };
const load = () => { try { return { ...DEF, ...JSON.parse(localStorage.getItem(SETTINGS) || '{}') }; } catch (e) { return { ...DEF }; } };
// what a collision sounds like, by what was hit: [sound, pitch, level] layers (pitch drops as the hit gets heavier)
const HIT = {
  car: v => v < 0.35 ? [['knock', 1, 0.8]] : [['crunch', 1.05, 0.9], ['knock', 0.9, 0.5], ...(v > 0.75 ? [['glass', 1, 0.45]] : [])],
  metal: v => [['crunch', 0.85, 0.8], ['crack', 1, 0.3 * v]],
  rail: v => [['rail', 1, 0.75], ['knock', 0.8, 0.5], ...(v > 0.6 ? [['crunch', 1.1, 0.4]] : [])],
  stone: v => [['thud', 1.2, 0.8], ['crack', 1, 0.5], ['knock', 0.7, 0.4 * v]],
  wood: () => [['wood', 1, 0.85], ['thud', 1.3, 0.3]],
  hay: () => [['rustle', 0.8, 0.8], ['thud', 1.5, 0.3]],
  rubber: () => [['rubber', 1, 0.9]], tyre: () => [['rubber', 1.2, 0.7]],
  bricks: v => [['rubble', 1, 0.9], ['crunch', 0.75, 0.3 + 0.3 * v]],
  glass: () => [['glass', 1, 0.8]]
};
export const AudioSys = {
  ctx: null, on: true, set: load(),
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const ctx = this.ctx = new AC(); this.on = this.set.on;
      const m = this.master = ctx.createGain(); m.gain.value = this.on ? 0.6 : 0;
      const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.004; comp.release.value = 0.25;   // glue: crashes don't clip, the engine sits under them
      m.connect(comp); comp.connect(ctx.destination);
      const bus = v => { const g = ctx.createGain(); g.gain.value = v; g.connect(m); return g; };
      this.engBus = bus(this.set.eng); this.fxBus = bus(this.set.fx); this.musBus = bus(this.set.mus * 0.5);
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
      const e = this.engBus;
      this.eng = playerEngine(ctx, e, buf); this.rivals = [0, 1, 2].map(() => rivalEngine(ctx, e)); this.lastThr = 0; this.popT = 0;
      const loopNoise = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q; const gg = ctx.createGain(); gg.gain.value = 0; s.connect(fl); fl.connect(gg); gg.connect(e); s.start(); return gg; };
      this.skidG = loopNoise('bandpass', 1300, 1.2); this.rumbG = loopNoise('lowpass', 350, 0.7); this.scrG = loopNoise('bandpass', 3200, 4);
      SFX.init(ctx, this.fxBus); Music.init(ctx, this.musBus);
      this.fireL = SFX.loop('fire', 0.8); this.hissL = SFX.loop('hiss', 0.25);
      if (this.wantSong !== undefined) Music.play(this.wantSong);
    } catch (e) { this.ctx = null; }
  },
  setv(p, v) { if (this.ctx) p.setTargetAtTime(v, this.ctx.currentTime, 0.05); },
  /** The rivals' engines: the three nearest (within 70 m) each get a voice, quieter with distance, panned across the
   *  screen, and pitched up closing in / down going away (an exaggerated Doppler, so a pass is heard). */
  others(P, cars, camDir) {
    const near = (cars || []).filter(o => o !== P && !o.finished && o.wreckT <= 0).map(o => ({ o, d: Math.hypot(o.x - P.x, o.z - P.z) })).filter(e => e.d < 70).sort((a, b) => a.d - b.d).slice(0, 3);
    const rx = camDir ? camDir[2] : 1, rz = camDir ? -camDir[0] : -1, rl = Math.hypot(rx, rz) || 1;
    this.rivals.forEach((v, k) => {
      const e = near[k]; if (!e) { v.set(45, 0, 0, 0); return; }
      const o = e.o, dx = o.x - P.x, dz = o.z - P.z, sp = Math.max(0, o.vf), thr = o.inp.throttle;
      const closing = -((o.vx - P.vx) * dx + (o.vz - P.vz) * dz) / (e.d || 1), dop = 1 + clamp(closing / 343 * 2.5, -0.18, 0.18);
      v.set(engineHz(sp, thr, o.boost > 0) * dop * (0.94 + k * 0.05), thr, 0.1 * clamp(1 - e.d / 70, 0, 1) ** 1.5, (dx * rx + dz * rz) / rl / 30);
    });
  },
  /** Each frame: the engines, road noise, the listener for placed sounds, the missile lock's beeping, fires near
   *  you and a wrecked engine's steam (R: the race, for the fires). */
  update(c, mode, cars, camDir, R) {
    if (!this.ctx) return;
    if (!c || mode === 'off') { if (this.trainG) this.setv(this.trainG.gain, 0); if (this.roarG) this.setv(this.roarG.gain, 0); this.eng.set(45, 0, 0); for (const v of this.rivals) v.set(45, 0, 0, 0); this.setv(this.skidG.gain, 0); this.setv(this.rumbG.gain, 0); this.setv(this.scrG.gain, 0); this.fireL.set(0); this.hissL.set(0); return; }
    const thr = c.inp.throttle;
    if (camDir) SFX.listen(c.x, c.z, camDir[2], -camDir[0]); else SFX.listen(c.x, c.z, 1, 0);
    this.others(c, cars, camDir);
    if (mode === 'rev') { this.eng.set(40 + thr * 70, thr, 0.1 + thr * 0.045); return; }
    const sp = Math.max(0, c.vf), wear = c.dmg ? carWear(c) : 0, f = engineHz(sp, thr, c.boost > 0) * (1 - wear * 0.04 * Math.random());
    this.eng.set(f, thr, 0.1 + thr * 0.045);
    // lifting off at high revs: a few pops and crackles from the exhaust; a battered engine misfires under load
    if (this.lastThr > 0.6 && thr < 0.1 && f > 75 && c.onGround) this.popT = 0.5;
    this.lastThr = thr;
    if (this.popT > 0) { this.popT -= 1 / 60; if (Math.random() < 0.14) this.burst(0.12 + Math.random() * 0.1, 'lowpass', 700 + Math.random() * 500, 0.05); }
    if (wear > 0.45 && thr > 0.3 && Math.random() < (wear - 0.4) * 0.12) this.burst(0.18, 'lowpass', 500, 0.07);
    this.hissL.set(clamp((wear - 0.35) * 2, 0, 1) + (c.wreckT > 0 ? 1 : 0));
    const sl = c.onGround && c.surface !== 'grass' ? clamp((Math.abs(c.vr) - 3.5) / 8, 0, 1) : 0;
    this.setv(this.skidG.gain, c.surface === 'tarmac' ? sl * 0.22 : sl * 0.08);
    this.setv(this.rumbG.gain, c.onGround && c.surface !== 'tarmac' ? clamp(sp / 40, 0, 1) * 0.4 : 0);
    this.setv(this.scrG.gain, c.scrape ? clamp(c.scrape.sp / 30, 0.2, 1) * (wallFx(c.scrape.w).sparks ? 0.35 : 0.12) : 0);
    // the missile's lock building: beeps quicker as it closes, a steady pip once locked
    const w = c.wpn;
    if (w && w.item === 'missile' && w.lockTgt >= 0) { this.lockT = (this.lockT || 0) - 1 / 60; if (this.lockT <= 0) { const k = w.lockK || 0; this.lockT = k >= 1 ? 0.12 : 0.32 - 0.24 * k; this.tone(k >= 1 ? 1760 : 1100 + 500 * k, 0.05, k >= 1 ? 0.05 : 0.035, 'square'); } }
    else this.lockT = 0;
    // fires: the nearest burning slick
    let fire = 0, at = null;
    const tr = G.world && G.world.tr;
    if (R && R.wpn && tr) for (const o of R.wpn.slicks) if (o.fire > 0) { const p = roadPos(tr, o.s, o.lat, 0), d = Math.hypot(p.x - c.x, p.z - c.z); if (d < 80 && (!at || d < Math.hypot(at.x - c.x, at.z - c.z))) { fire = clamp(o.fire, 0, 1); at = p; } }
    this.fireL.set(fire, at);
    // mortar shells: each whistles down onto where it'll land, the last 1.6 s of its flight
    if (R && R.wpn && tr) for (const sh of R.wpn.shells) if (!sh.heard && !(sh.wait > 0) && sh.t > WPN.MORTAR_FLIGHT - 1.6) { sh.heard = true; SFX.play('whistle', { at: roadPos(tr, sh.s, sh.lat, 0), vol: 0.7, jitter: 0.04, wet: 0.2 }); }
  },
  // ---- one-shots ----
  /** A designed sound (sfx.js) on the effects bus: at { x, z } in the world, or here. */
  sfx(name, o) { if (this.ctx) return SFX.play(name, o); return null; },
  beep(freq, dur) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'square'; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3500; o.connect(lp); lp.connect(g); g.connect(this.fxBus); o.start(t); o.stop(t + dur + 0.05); },
  burst(vol, type, freq, dur, sweep) { if (!this.ctx) return; const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur); const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(this.fxBus); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05); },
  thud(v, at) { this.sfx('thud', { vol: clamp(v, 0.1, 1), at, rate: 1.1 - clamp(v, 0, 1) * 0.25, wet: 0.08 }); },
  whoosh(v) { this.burst(0.25 * (v || 1), 'bandpass', 400, 0.5, 2400); },
  tone(freq, dur, vol, type, bend) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type || 'triangle'; o.frequency.setValueAtTime(freq, t); if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.fxBus); o.start(t); o.stop(t + dur + 0.05); },
  /** A collision: `kind` what was hit (HIT), v how hard (0..1), at where (else here). */
  crash(kind, v, at) {
    if (!this.ctx) return;
    const layers = (HIT[kind] || HIT.metal)(v), w = clamp(v, 0.05, 1);
    for (const [name, rate, lv] of layers) this.sfx(name, { at, vol: lv * (0.25 + 0.75 * w), rate: rate * (1.12 - w * 0.25), wet: 0.12 + w * 0.12, max: 4 });
  },
  /** An explosion: size 'small' | 'mid' | 'big'. */
  boom(at, size = 'mid', vol = 1) { this.sfx(size === 'big' ? 'bigboom' : size === 'small' ? 'smallboom' : 'boom', { at, vol, wet: 0.35, jitter: 0.08, max: 4 }); },
  bell() { if (!this.ctx) return; this.bellHi = !this.bellHi; this.tone(this.bellHi ? 1480 : 1180, 0.22, 0.06, 'triangle', 0.97); },
  trainHorn() { if (!this.ctx) return; for (const f of [233, 294]) this.tone(f, 1.1, 0.07, 'sawtooth', 0.97); },
  trainRumble(level) {
    if (!this.ctx) return;
    if (!this.trainG) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140; this.trainG = this.ctx.createGain(); this.trainG.gain.value = 0; s.connect(f); f.connect(this.trainG); this.trainG.connect(this.engBus); s.start(); }
    this.setv(this.trainG.gain, level * level * 0.6);
  },
  // a waterfall's roar, by how close the player is (0..1)
  roar(level) {
    if (!this.ctx) return;
    if (!this.roarG) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; this.roarG = this.ctx.createGain(); this.roarG.gain.value = 0; s.connect(f); f.connect(this.roarG); this.roarG.connect(this.engBus); s.start(); }
    this.setv(this.roarG.gain, level * level * 0.32);
  },
  moo(v) { if (!this.ctx) return; this.tone(150, 0.55, 0.1 * v, 'sawtooth', 0.72); this.tone(152, 0.5, 0.06 * v, 'triangle', 0.7); },
  horn(pitch) { if (!this.ctx) return; for (const f of [392, 494]) this.tone(f * pitch, 0.45, 0.07, 'square', 0.98); },
  /** The menu's buttons: a soft click. */
  click() { this.sfx('click', { vol: 0.5, jitter: 0.04, wet: 0 }); },
  // ---- music and settings ----
  /** Which song plays ('menu' / 'race' / null); remembered until the audio is allowed to start. */
  music(name) {
    if (name === 'race' && this.wantSong !== 'race') {   // a new race: the next track in turn (of the liked ones, if that's the setting)
      const pool = this.set.only && this.set.liked.length ? SONGS.map((s, i) => i).filter(i => this.set.liked.includes(SONGS[i].name)) : SONGS.map((s, i) => i);
      Music.idx = pool[this.set.next % pool.length]; this.set.next = (this.set.next + 1) % pool.length; this.save();
    }
    this.wantSong = name; if (this.ctx) Music.play(name);
  },
  /** The race track playing (or next to): its number, the song, and whether it's liked. */
  track() { const i = Music.idx, s = SONGS[i]; return { i, n: SONGS.length, song: s, liked: this.set.liked.includes(s.name) }; },
  /** Change the race track by `dir` (1 next, -1 back); it plays at once if a race track is playing. */
  musicNext(dir) { Music.idx = (Music.idx + dir + SONGS.length) % SONGS.length; if (this.wantSong === 'race' && this.ctx) Music.play('race'); return this.track(); },
  /** Heart / un-heart a race track (song number i, or the current one). */
  like(i = Music.idx) { const n = SONGS[i].name, L = this.set.liked; if (L.includes(n)) L.splice(L.indexOf(n), 1); else L.push(n); this.save(); return L.includes(n); },
  /** Play song i in the menu (the Sound panel's list), or go back to the menu theme (null). */
  preview(i) { this.init(); if (i === null) { this.music('menu'); return; } Music.idx = i; this.wantSong = 'preview'; Music.play(i); },
  musicIntensity(k) { Music.intensity = k; },
  musicPause(on) { Music.pause(on); },
  stinger(kind) { Music.stinger(kind); },
  /** Set a level: 'fx' | 'eng' | 'mus' (0..1). */
  level(k, v) {
    this.set[k] = v; this.save();
    if (!this.ctx) return; const b = k === 'fx' ? this.fxBus : k === 'eng' ? this.engBus : this.musBus; this.setv(b.gain, k === 'mus' ? v * 0.5 : v);
  },
  save() { try { localStorage.setItem(SETTINGS, JSON.stringify(this.set)); } catch (e) { /* private window: fine */ } },
  toggle() { this.on = !this.on; this.set.on = this.on; this.save(); if (this.master) this.master.gain.value = this.on ? 0.6 : 0; }
};
