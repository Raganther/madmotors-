import { clamp } from '../core/math.js';

// Engine voices. Instead of a raw sawtooth (a harsh buzz), each engine is a harmonic spectrum shaped like a
// combustion engine: strong low firing harmonics falling away, a little odd/even imbalance for character, fixed
// phases so it isn't a pulse train. On top: the lumpy burble of individual firing pulses (the tone swelling at half
// the firing rate), a sub-octave rumble, intake/exhaust breath that opens with the throttle, and gentle saturation.
// A lowpass that opens with revs and load keeps the top soft. Rivals get a lighter version of the same voice.
let wave = null, subWave = null;
function engineWaves(ctx) {
  if (wave) return;
  const n = 28, re = new Float32Array(n), im = new Float32Array(n), re2 = new Float32Array(6), im2 = new Float32Array(6);
  let s = 11; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 1; k < n; k++) { const a = Math.pow(k, -1.15) * (k % 2 ? 1 : 0.7) * (k === 2 || k === 4 ? 1.4 : 1), ph = r() * Math.PI * 2; re[k] = a * Math.cos(ph); im[k] = a * Math.sin(ph); }
  re2[1] = 1; re2[2] = 0.25; re2[3] = 0.08;
  wave = ctx.createPeriodicWave(re, im); subWave = ctx.createPeriodicWave(re2, im2);
}
const curve = (() => { const c = new Float32Array(1024); for (let i = 0; i < 1024; i++) { const x = i / 511.5 - 1; c[i] = Math.tanh(x * 1.6) / Math.tanh(1.6); } return c; })();
/** The player's engine: set(f, load, vol) each frame, f the firing fundamental in Hz, load 0..1 (throttle). */
export function playerEngine(ctx, dest, noise) {
  engineWaves(ctx);
  const out = ctx.createGain(); out.gain.value = 0; out.connect(dest);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8; lp.frequency.value = 900; lp.connect(out);
  const body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = 180; body.Q.value = 0.9; body.gain.value = 4; body.connect(lp);   // chest
  const sat = ctx.createWaveShaper(); sat.curve = curve; sat.oversample = '2x'; sat.connect(body);
  const am = ctx.createGain(); am.gain.value = 0.75; am.connect(sat);                       // the burble rides on this
  const o1 = ctx.createOscillator(); o1.setPeriodicWave(wave); const g1 = ctx.createGain(); g1.gain.value = 0.55; o1.connect(g1); g1.connect(am);
  const o2 = ctx.createOscillator(); o2.setPeriodicWave(wave); o2.detune.value = 9; const g2 = ctx.createGain(); g2.gain.value = 0.3; o2.connect(g2); g2.connect(am);   // a second bank, slightly apart: width
  const sub = ctx.createOscillator(); sub.setPeriodicWave(subWave); const gs = ctx.createGain(); gs.gain.value = 0.5; sub.connect(gs); gs.connect(sat);
  const lfo = ctx.createOscillator(); lfo.type = 'sine'; const depth = ctx.createGain(); depth.gain.value = 0.22; lfo.connect(depth); depth.connect(am.gain);
  const br = ctx.createBufferSource(); br.buffer = noise; br.loop = true; const bf = ctx.createBiquadFilter(); bf.type = 'bandpass'; bf.Q.value = 1.1; const bg = ctx.createGain(); bg.gain.value = 0; br.connect(bf); bf.connect(bg); bg.connect(lp);
  for (const o of [o1, o2, sub, lfo, br]) o.start();
  const T = (p, v, k = 0.05) => p.setTargetAtTime(v, ctx.currentTime, k);
  return {
    set(f, load, vol) {
      T(o1.frequency, f); T(o2.frequency, f); T(sub.frequency, f / 2); T(lfo.frequency, f / 4);
      T(depth.gain, 0.12 + 0.18 * (1 - load));                                              // off throttle it burbles more
      T(lp.frequency, 380 + f * 3.2 + load * 900); T(bf.frequency, 600 + f * 6); T(bg.gain, 0.02 + load * 0.07);
      T(out.gain, vol, 0.08);
    }
  };
}
/** A rival's engine: lighter, panned, and the caller sets its level by distance. */
export function rivalEngine(ctx, dest) {
  engineWaves(ctx);
  const out = ctx.createGain(); out.gain.value = 0;
  const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null; if (pan) { out.connect(pan); pan.connect(dest); } else out.connect(dest);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.7; lp.connect(out);
  const am = ctx.createGain(); am.gain.value = 0.8; am.connect(lp);
  const o = ctx.createOscillator(); o.setPeriodicWave(wave); o.connect(am);
  const lfo = ctx.createOscillator(); const depth = ctx.createGain(); depth.gain.value = 0.2; lfo.connect(depth); depth.connect(am.gain);
  o.start(); lfo.start();
  const T = (p, v, k = 0.06) => p.setTargetAtTime(v, ctx.currentTime, k);
  return { set(f, load, vol, p) { T(o.frequency, f); T(lfo.frequency, f / 4); T(lp.frequency, 300 + f * 2.6 + load * 500); T(out.gain, vol, 0.1); if (pan) T(pan.pan, clamp(p, -0.9, 0.9)); } };
}
// engine fundamental from road speed through a six-speed box (a drop in pitch at each shift)
const EDGES = [0, 11, 19, 27, 35, 44, 60];
export function engineHz(sp, thr, boost) {
  let gi = 0; while (gi < EDGES.length - 2 && sp > EDGES[gi + 1]) gi++;
  const frac = clamp((sp - EDGES[gi]) / (EDGES[gi + 1] - EDGES[gi]), 0, 1);
  return 42 + frac * 62 + gi * 6 + thr * 6 + (boost ? 8 : 0);
}
