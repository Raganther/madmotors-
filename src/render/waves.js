import * as THREE from 'three';
import { camT } from './camera.js';
import { quality } from './renderer.js';
import { race } from '../ui/flow.js';
import { G } from '../game.js';

// Water that answers the cars (render/water.js reads it): a wave grid N x N cells of CELL m that follows the camera,
// run as a simple wave equation. Each wheel in the water pushes the surface down where it is (more the faster it
// goes), so a car ploughs a trough with waves spreading off it and a wake behind; driving into the water drops a big
// dent all at once, a surge that runs out to the shore. The waves travel, reflect off nothing (the grid just fades at
// its border) and die away over a few seconds. The water material lifts its surface by the grid, moves its shoreline
// with it (a wave runs up the bank, then draws back) and froths where it's churned. Looks only: nothing in the race
// depends on it. Off on Graphics: Low (the water keeps its gentle lap).
const N = 128, CELL = 0.5, SIZE = N * CELL, RANGE = 0.4;
const C2 = 0.13, DAMP = 0.984, STEP = 1 / 60;                       // wave speed (Courant number squared) and fade per step
export const WAVE = { uWave: { value: null }, uWaveO: { value: new THREE.Vector3(0, 0, SIZE) }, uWaveOn: { value: 0 } };
let h = null, hp = null, tmp = null, data = null, tex = null, gx = 0, gz = 0, acc = 0, quiet = 0;
const inWater = new Map();
function init() {
  h = new Float32Array(N * N); hp = new Float32Array(N * N); tmp = new Float32Array(N * N); data = new Uint8Array(N * N * 4).fill(128);
  tex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat); tex.magFilter = tex.minFilter = THREE.LinearFilter; tex.needsUpdate = true; WAVE.uWave.value = tex;
}
/** A new race or stage: calm water. */
export function clearWaves() { if (!h) return; h.fill(0); hp.fill(0); data.fill(128); tex.needsUpdate = true; inWater.clear(); quiet = 0; }
// keep the grid centred on the camera: move it in whole cells, carrying the waves with it
function follow() {
  const nx = Math.round(camT.x / CELL) - N / 2, nz = Math.round(camT.z / CELL) - N / 2, dx = nx - gx, dz = nz - gz; if (!dx && !dz) return;
  for (const A of [h, hp]) {
    tmp.fill(0);
    if (Math.abs(dx) < N && Math.abs(dz) < N) for (let j = 0; j < N; j++) { const sj = j + dz; if (sj < 0 || sj >= N) continue; for (let i = 0; i < N; i++) { const si = i + dx; if (si >= 0 && si < N) tmp[j * N + i] = A[sj * N + si]; } }
    A.set(tmp);
  }
  gx = nx; gz = nz; WAVE.uWaveO.value.set(gx * CELL, gz * CELL, SIZE);
}
function push(x, z, amt, r = 1) {   // press the surface down round (x, z): a little disc, softer at its rim
  const i0 = Math.floor(x / CELL) - gx, j0 = Math.floor(z / CELL) - gz;
  for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) {
    const d = Math.hypot(i, j), I = i0 + i, J = j0 + j; if (d > r + 0.5 || I < 2 || J < 2 || I >= N - 2 || J >= N - 2) continue;
    const k = J * N + I; h[k] = Math.max(-RANGE, h[k] - amt * (1 - d / (r + 1)));
  }
}
// is car c in water (a splash, standing water, an open-country stream, a river)?
function wet(c, W) {
  if (!c.onGround) return false;
  if (c.surface === 'ford' || c.aqua > 0.1) return true;
  const rv = W.tr.river; return !!(rv && !rv.frozen && c.y < rv.level + 0.35);
}
export function updateWaves(dt) {
  const W = G.world && G.world.W;
  if (quality === 'low' || !W || !race) { WAVE.uWaveOn.value = 0; return; }
  if (!h) init(); WAVE.uWaveOn.value = 1; follow();
  let stirred = false;
  for (const c of race.cars) {
    const was = inWater.get(c), now = wet(c, W); inWater.set(c, now); if (!now) continue;
    const sp = Math.hypot(c.vx, c.vz), fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
    if (!was && sp > 4) { push(c.x + fx * 1.2, c.z + fz * 1.2, Math.min(0.35, 0.08 + sp * 0.012), 4); stirred = true; }   // in it goes: a surge
    if (sp < 1) continue;
    const k = Math.min(0.035, sp * 0.0016) * dt * 60;
    for (const [a, b] of [[1.15, 0.95], [1.15, -0.95], [-1.15, 0.95], [-1.15, -0.95]]) push(c.x + fx * a - fz * b, c.z + fz * a + fx * b, k, 1);   // each wheel ploughs
    stirred = true;
  }
  quiet = stirred ? 0 : quiet + dt; if (quiet > 6) return;               // all calm: nothing to run or send
  acc = Math.min(acc + dt, STEP * 4);
  while (acc >= STEP) {
    acc -= STEP;
    for (let j = 1; j < N - 1; j++) for (let i = 1; i < N - 1; i++) {
      const k = j * N + i, v = h[k], lap = h[k - 1] + h[k + 1] + h[k - N] + h[k + N] - 4 * v;
      hp[k] = (2 * v - hp[k] + C2 * lap) * DAMP;
    }
    const t = h; h = hp; hp = t;
  }
  for (let k = 0; k < N * N; k++) data[k * 4] = Math.max(0, Math.min(255, Math.round(128 + h[k] / RANGE * 127)));
  tex.needsUpdate = true;
}
/** Shader bits for a material that reads the waves (render/water.js): waveAt(world xz) in metres, 0 off the grid. */
export const WAVE_GLSL = `uniform sampler2D uWave; uniform vec3 uWaveO; uniform float uWaveOn;
float waveAt(vec2 p) { vec2 uv = (p - uWaveO.xy) / uWaveO.z; float edge = smoothstep(0.0, 0.08, uv.x) * smoothstep(1.0, 0.92, uv.x) * smoothstep(0.0, 0.08, uv.y) * smoothstep(1.0, 0.92, uv.y);
  return uWaveOn * edge * (texture2D(uWave, uv).r * 255.0 - 128.0) / 127.0 * ${RANGE.toFixed(2)}; }
`;
/** Are the waves running (so the old ripple rings can stand down)? */
export const wavesOn = () => WAVE.uWaveOn.value > 0;
