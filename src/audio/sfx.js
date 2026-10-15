import { clamp } from '../core/math.js';
import { RATE, SOUNDS, synth } from './synth.js';

// Playing the sound library (synth.js) into the scene. Each sound is placed: given where it happened, it's quieter
// and duller (high end lost) with distance from the listener (the player's car), panned across the stereo field by
// where it is on screen, and a little of it goes to a room (a short generated reverb) so blasts and crashes have
// space round them. Takes rotate and each play is pitched a few percent differently, so a burst of gunfire or a
// pile-up never sounds like one sample repeating. Voices are capped per sound and overall. Buffers are made in the
// background a few at a time after the audio starts (any not ready yet are made on first use).
const MAXD = 170, REF = 14;
export const SFX = {
  ctx: null, out: null, room: null, buf: {}, take: {}, live: {}, n: 0, L: { x: 0, z: 0, rx: 1, rz: 0 },
  init(ctx, out) {
    this.ctx = ctx; this.out = out;
    // the room: a convolver with a decaying noise burst (stereo, darker as it fades)
    const sr = ctx.sampleRate, len = Math.round(sr * 1.8), ir = ctx.createBuffer(2, len, sr);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); let lp = 0; for (let i = 0; i < len; i++) { const t = i / sr, k = 0.25 + 0.7 * Math.exp(-t * 2.5); lp += (Math.random() * 2 - 1 - lp) * k; d[i] = lp * Math.exp(-t * 3.2) * (i < sr * 0.01 ? i / (sr * 0.01) : 1); } }
    const cv = ctx.createConvolver(); cv.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.55; cv.connect(rg); rg.connect(out); this.room = cv;
    const queue = SOUNDS.filter(k => !['cheer', 'collapse', 'bigboom'].includes(k)).concat(['bigboom', 'collapse', 'cheer']), next = () => { const k = queue.shift(); if (!k) return; this.get(k); setTimeout(next, 30); }; setTimeout(next, 200);
  },
  get(name) {
    if (!this.buf[name]) { const sr = Math.round(this.ctx.sampleRate * (RATE[name] || 1)); this.buf[name] = synth(name, sr).map(a => { const b = this.ctx.createBuffer(1, a.length, sr); b.getChannelData(0).set(a); return b; }); }
    return this.buf[name];
  },
  /** Where the listener is and which way is screen-right (from the camera), each frame. */
  listen(x, z, rx, rz) { const l = Math.hypot(rx, rz) || 1; Object.assign(this.L, { x, z, rx: rx / l, rz: rz / l }); },
  /**
   * Play `name`: { at: {x, z} (else right here), vol, rate (pitch), wet (room send), jitter (pitch spread),
   * lp (a cutoff on top), max (voices of this sound at once), delay (s) }. Returns the voice, or null if it's too far
   * off or the voices are full.
   */
  play(name, o = {}) {
    if (!this.ctx || !SOUNDS.includes(name)) return null;
    const ctx = this.ctx, at = o.at, d = at ? Math.hypot(at.x - this.L.x, at.z - this.L.z) : 0;
    if (d > MAXD) return null;
    const live = this.live[name] = (this.live[name] || 0), cap = o.max || 5; if (live >= cap || this.n >= 40) return null;
    const takes = this.get(name), k = this.take[name] = ((this.take[name] || 0) + 1) % takes.length;
    const t = ctx.currentTime + (o.delay || 0), src = ctx.createBufferSource(); src.buffer = takes[k];
    src.playbackRate.value = (o.rate || 1) * (1 + ((Math.random() - 0.5) * 2) * (o.jitter ?? 0.06));
    const g = ctx.createGain(), fall = at ? (REF / (REF + Math.max(0, d - 3))) ** 1.25 : 1; g.gain.value = (o.vol ?? 1) * fall;
    let node = src;
    const cut = Math.min(o.lp || 20000, at ? 20000 * Math.exp(-d / 45) + 700 : 20000);   // the air dulls far-off sounds
    if (cut < 19000) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cut; node.connect(f); node = f; }
    node.connect(g);
    let pan = null; if (at && ctx.createStereoPanner) { pan = ctx.createStereoPanner(); pan.pan.value = clamp(((at.x - this.L.x) * this.L.rx + (at.z - this.L.z) * this.L.rz) / (d + 6), -0.85, 0.85); g.connect(pan); pan.connect(this.out); } else g.connect(this.out);
    const wet = (o.wet ?? 0.15) * (at ? 0.6 + 0.4 * Math.min(1, d / 60) : 1); if (wet > 0) { const w = ctx.createGain(); w.gain.value = wet; g.connect(w); w.connect(this.room); }
    this.live[name]++; this.n++;
    src.onended = () => { this.live[name]--; this.n--; try { g.disconnect(); if (pan) pan.disconnect(); } catch (e) { /* gone */ } };
    src.start(t);
    return { src, g };
  },
  /** A looping sound (fire, steam) whose level the caller sets each frame: loop(name).set(level, at). */
  loop(name, vol = 1) {
    if (!this.ctx) return { set() {} };
    const ctx = this.ctx, src = ctx.createBufferSource(); src.buffer = this.get(name)[0]; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 0; const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    src.connect(g); if (pan) { g.connect(pan); pan.connect(this.out); } else g.connect(this.out); src.start();
    return {
      set: (level, at) => {
        let v = level * vol, p = 0;
        if (at) { const d = Math.hypot(at.x - this.L.x, at.z - this.L.z); v *= (REF / (REF + Math.max(0, d - 3))) ** 1.25; p = clamp(((at.x - this.L.x) * this.L.rx + (at.z - this.L.z) * this.L.rz) / (d + 6), -0.85, 0.85); }
        g.gain.setTargetAtTime(v, ctx.currentTime, 0.08); if (pan) pan.pan.setTargetAtTime(p, ctx.currentTime, 0.08);
      }
    };
  }
};
