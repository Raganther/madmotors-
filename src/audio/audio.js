import { clamp } from '../core/math.js';
import { wallFx } from '../render/effects/impacts.js';
import { $ } from '../ui/dom.js';

// ---------- audio ----------
export const AudioSys = {
  ctx: null, on: true,
  init() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    try {
      const ctx = this.ctx = new AC(); const m = this.master = ctx.createGain(); m.gain.value = this.on ? 0.5 : 0; m.connect(ctx.destination);
      const f = this.engF = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 700; f.Q.value = 3;
      const g = this.engG = ctx.createGain(); g.gain.value = 0; f.connect(g); g.connect(m);
      this.o1 = ctx.createOscillator(); this.o1.type = 'sawtooth'; this.o1.frequency.value = 60; this.o1.connect(f);
      this.o2 = ctx.createOscillator(); this.o2.type = 'square'; this.o2.frequency.value = 30; const g2 = ctx.createGain(); g2.gain.value = 0.45; this.o2.connect(g2); g2.connect(f);
      this.o1.start(); this.o2.start();
      const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate), d = buf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; this.noise = buf;
      const loopNoise = (type, freq, q) => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = freq; fl.Q.value = q; const gg = ctx.createGain(); gg.gain.value = 0; s.connect(fl); fl.connect(gg); gg.connect(m); s.start(); return gg; };
      this.skidG = loopNoise('bandpass', 1300, 1.2); this.rumbG = loopNoise('lowpass', 350, 0.7); this.scrG = loopNoise('bandpass', 3200, 4);
    } catch (e) { this.ctx = null; }
  },
  set(p, v) { if (this.ctx) p.setTargetAtTime(v, this.ctx.currentTime, 0.05); },
  update(c, mode) {
    if (!this.ctx) return;
    if (!c || mode === 'off') { if (this.trainG) this.set(this.trainG.gain, 0); if (this.roarG) this.set(this.roarG.gain, 0); this.set(this.engG.gain, 0); this.set(this.skidG.gain, 0); this.set(this.rumbG.gain, 0); this.set(this.scrG.gain, 0); return; }
    const thr = c.inp.throttle;
    if (mode === 'rev') { const f = 55 + thr * 110; this.set(this.o1.frequency, f); this.set(this.o2.frequency, f / 2); this.set(this.engF.frequency, 500 + thr * 900); this.set(this.engG.gain, 0.08 + thr * 0.06); return; }
    const sp = Math.max(0, c.vf), edges = [0, 11, 19, 27, 35, 44, 60]; let gi = 0; while (gi < edges.length - 2 && sp > edges[gi + 1]) gi++;
    const frac = clamp((sp - edges[gi]) / (edges[gi + 1] - edges[gi]), 0, 1), f = 55 + frac * 85 + gi * 7 + thr * 10 + (c.boost > 0 ? 12 : 0);
    this.set(this.o1.frequency, f); this.set(this.o2.frequency, f / 2); this.set(this.engF.frequency, 420 + thr * 900 + frac * 300); this.set(this.engG.gain, 0.08 + thr * 0.07);
    const sl = c.onGround && c.surface !== 'grass' ? clamp((Math.abs(c.vr) - 3.5) / 8, 0, 1) : 0;
    this.set(this.skidG.gain, c.surface === 'tarmac' ? sl * 0.22 : sl * 0.08);
    this.set(this.rumbG.gain, c.onGround && c.surface !== 'tarmac' ? clamp(sp / 40, 0, 1) * 0.4 : 0);
    this.set(this.scrG.gain, c.scrape ? clamp(c.scrape.sp / 30, 0.2, 1) * (wallFx(c.scrape.w).sparks ? 0.35 : 0.12) : 0);
  },
  beep(freq, dur) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = 'square'; o.frequency.value = freq; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05); },
  burst(vol, type, freq, dur, sweep) { if (!this.ctx) return; const t = this.ctx.currentTime, s = this.ctx.createBufferSource(); s.buffer = this.noise; const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); if (sweep) f.frequency.exponentialRampToValueAtTime(sweep, t + dur); const g = this.ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t + dur + 0.05); },
  thud(v) { this.burst(clamp(v, 0.05, 1) * 0.6, 'lowpass', 220, 0.25); },
  whoosh(v) { this.burst(0.25 * (v || 1), 'bandpass', 400, 0.5, 2400); },
  tone(freq, dur, vol, type, bend) { if (!this.ctx) return; const t = this.ctx.currentTime, o = this.ctx.createOscillator(), g = this.ctx.createGain(); o.type = type || 'triangle'; o.frequency.setValueAtTime(freq, t); if (bend) o.frequency.exponentialRampToValueAtTime(freq * bend, t + dur); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05); },
  crash(kind, v) {
    if (!this.ctx) return;
    this.burst(0.5 * v, 'lowpass', 180, 0.3);
    if (kind === 'metal') { this.burst(0.35 * v, 'bandpass', 2600, 0.35); this.tone(420 + Math.random() * 180, 0.5, 0.12 * v, 'square', 0.7); this.tone(1130 + Math.random() * 200, 0.3, 0.06 * v, 'triangle', 0.8); }
    else if (kind === 'wood') { this.burst(0.4 * v, 'bandpass', 900, 0.18); this.tone(180, 0.12, 0.12 * v, 'triangle', 0.6); }
    else if (kind === 'hay') { this.burst(0.3 * v, 'highpass', 1800, 0.4); }
    else if (kind === 'car') { this.burst(0.45 * v, 'bandpass', 1100, 0.22); this.tone(260, 0.25, 0.1 * v, 'square', 0.55); if (v > 0.6) this.burst(0.2 * v, 'highpass', 5000, 0.25); }
    else { this.burst(0.35 * v, 'bandpass', 500, 0.2); }
  },
  bell() { if (!this.ctx) return; this.bellHi = !this.bellHi; this.tone(this.bellHi ? 1480 : 1180, 0.22, 0.06, 'triangle', 0.97); },
  trainHorn() { if (!this.ctx) return; for (const f of [233, 294]) this.tone(f, 1.1, 0.07, 'sawtooth', 0.97); },
  trainRumble(level) {
    if (!this.ctx) return;
    if (!this.trainG) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 140; this.trainG = this.ctx.createGain(); this.trainG.gain.value = 0; s.connect(f); f.connect(this.trainG); this.trainG.connect(this.master); s.start(); }
    this.set(this.trainG.gain, level * level * 0.6);
  },
  // a waterfall's roar, by how close the player is (0..1)
  roar(level) {
    if (!this.ctx) return;
    if (!this.roarG) { const s = this.ctx.createBufferSource(); s.buffer = this.noise; s.loop = true; const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 650; this.roarG = this.ctx.createGain(); this.roarG.gain.value = 0; s.connect(f); f.connect(this.roarG); this.roarG.connect(this.master); s.start(); }
    this.set(this.roarG.gain, level * level * 0.32);
  },
  moo(v) { if (!this.ctx) return; this.tone(150, 0.55, 0.1 * v, 'sawtooth', 0.72); this.tone(152, 0.5, 0.06 * v, 'triangle', 0.7); },
  horn(pitch) { if (!this.ctx) return; for (const f of [392, 494]) this.tone(f * pitch, 0.45, 0.07, 'square', 0.98); },
  toggle() { this.on = !this.on; if (this.master) this.master.gain.value = this.on ? 0.5 : 0; $('mute-btn').textContent = this.on ? 'Sound on' : 'Sound off'; }
};
