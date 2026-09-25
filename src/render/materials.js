import * as THREE from 'three';
import { G } from '../game.js';
import { TAU, clamp, lerp, mulberry32, smoothstep } from '../core/math.js';
import { canvasTex } from './geometry.js';

export const CUT = { car: { value: new THREE.Vector3() }, dir: { value: new THREE.Vector3(1, 1.3, 1).normalize() }, r: { value: 0 } };
// world effects shared by the scenery shaders: time for wind and the drifting cloud-shadow texture
export const FX = { time: { value: 0 }, cloud: { value: null }, cloudAmt: { value: 0.3 }, wind: { value: new THREE.Vector2(3.2, 1.6) },
  hazeCol: { value: new THREE.Color(0x9DB8D2) }, hazeTop: { value: 0 }, hazeRange: { value: 40 }, hazeAmt: { value: 0 },
  grain: { value: 1 } };   // grain: surface detail on/off (the Low graphics setting turns it off)
export function makeCloudTex() {
  // tileable value noise: a few octaves on wrapping grids
  const N = 128, data = new Float32Array(N * N), rnd = mulberry32(4242);
  for (const [G, amp] of [[4, 0.55], [8, 0.28], [16, 0.12], [32, 0.05]]) {
    const g = new Float32Array(G * G).map(() => rnd());
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const fx = x / N * G, fy = y / N * G, x0 = fx | 0, y0 = fy | 0, u = smoothstep(0, 1, fx - x0), v = smoothstep(0, 1, fy - y0);
      const at = (i, j) => g[((j % G) * G) + (i % G)];
      data[y * N + x] += amp * lerp(lerp(at(x0, y0), at(x0 + 1, y0), u), lerp(at(x0, y0 + 1), at(x0 + 1, y0 + 1), u), v);
    }
  }
  const t = canvasTex(N, N, (g2) => { const img = g2.createImageData(N, N); for (let i = 0; i < N * N; i++) { const v = clamp((data[i] - 0.5) * 3.2 + 0.5, 0, 1) * 255; img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v; img.data[i * 4 + 3] = 255; } g2.putImageData(img, 0, 0); });
  t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}
// opts: cut (see-through window over the player, default on), cloud (drifting cloud shadows), sway (foliage in the wind),
// grain (0..1: fine surface detail in world space, two scales of the tileable noise, so ground and road aren't flat colour)
export function withCutaway(mat, solidInside, opts = {}) {
  const cut = opts.cut !== false, cloud = !!opts.cloud, sway = opts.sway || 0, water = !!opts.water, grain = opts.grain || 0;
  if (solidInside) mat.side = THREE.DoubleSide;
  mat.onBeforeCompile = sh => {
    sh.uniforms.uCutCar = CUT.car; sh.uniforms.uCutDir = CUT.dir; sh.uniforms.uCutR = CUT.r;
    sh.uniforms.uTime = FX.time; sh.uniforms.uCloud = FX.cloud; sh.uniforms.uCloudAmt = FX.cloudAmt; sh.uniforms.uWind = FX.wind;
    sh.uniforms.uGrain = FX.grain; sh.uniforms.uHazeCol = FX.hazeCol; sh.uniforms.uHazeTop = FX.hazeTop; sh.uniforms.uHazeRange = FX.hazeRange; sh.uniforms.uHazeAmt = FX.hazeAmt;
    let vs = 'varying vec3 vCutW;\nuniform float uTime;\n' + sh.vertexShader;
    if (sway) vs = vs.replace('#include <begin_vertex>', `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec2 swO = instanceMatrix[3].xz;
      #else
        vec2 swO = vec2(0.0);
      #endif
      float swH = max(0.0, position.y - 0.8);
      float swP = uTime * 1.6 + swO.x * 0.11 + swO.y * 0.07;
      transformed.x += (sin(swP) + 0.35 * sin(swP * 2.3)) * swH * ${(0.035 * sway).toFixed(4)};
      transformed.z += cos(swP * 0.8) * swH * ${(0.025 * sway).toFixed(4)};`);
    sh.vertexShader = vs.replace('#include <project_vertex>', `#include <project_vertex>
      vec4 cutP = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        cutP = instanceMatrix * cutP;
      #endif
      vCutW = (modelMatrix * cutP).xyz;`);
    let fs = 'uniform vec3 uCutCar;\nuniform vec3 uCutDir;\nuniform float uCutR;\nuniform float uTime;\nuniform sampler2D uCloud;\nuniform float uCloudAmt;\nuniform vec2 uWind;\nuniform vec3 uHazeCol;\nuniform float uHazeTop;\nuniform float uHazeRange;\nuniform float uHazeAmt;\nuniform float uGrain;\nvarying vec3 vCutW;\n' + sh.fragmentShader;
    if (cut) fs = fs.replace('void main() {', `void main() {
      if (uCutR > 0.0) {
        vec3 cv = vCutW - uCutCar; float ct = dot(cv, uCutDir);
        if (ct > 1.5 && vCutW.y > uCutCar.y + 1.4) {
          float cp = length(cv - uCutDir * ct);
          float n = fract(sin(dot(floor(gl_FragCoord.xy), vec2(12.9898, 78.233))) * 43758.5453);
          if (cp < uCutR - 0.7 + n * 0.7) discard;
        }
      }`);
    if (cloud) fs = fs.replace('#include <fog_fragment>', `float cld = texture2D(uCloud, (vCutW.xz + uWind * uTime) / 260.0).r;
      gl_FragColor.rgb *= 1.0 - uCloudAmt * smoothstep(0.42, 0.72, cld);
      ${water ? `float rp = sin(vCutW.x * 0.33 + vCutW.z * 0.12 + uTime * 2.1) * sin(vCutW.z * 0.29 - vCutW.x * 0.08 - uTime * 1.7);
      gl_FragColor.rgb += vec3(0.75, 0.85, 0.95) * smoothstep(0.55, 0.95, rp) * 0.22;` : ''}
      gl_FragColor.rgb = mix(gl_FragColor.rgb, uHazeCol, clamp((uHazeTop - vCutW.y) / uHazeRange, 0.0, 1.0) * uHazeAmt);   // valley haze
      #include <fog_fragment>`);
    if (grain) fs = fs.replace('#include <color_fragment>', `#include <color_fragment>
      if (uGrain > 0.0) {
        // mostly the fine scale, a hint of the broad one, contrast softened: speckle, not stains
        float gr = texture2D(uCloud, vCutW.xz / 4.1).r * 0.25 + texture2D(uCloud, vCutW.xz / 0.8 + 0.37).r * 0.75;
        diffuseColor.rgb *= 1.0 + ${grain.toFixed(3)} * uGrain * clamp((gr - 0.5) * 1.1, -0.5, 0.5);
      }`);
    if (solidInside) fs = fs.replace('#include <color_fragment>', '#include <color_fragment>\n  if (!gl_FrontFacing) diffuseColor.rgb = vec3(0.23, 0.21, 0.19);');
    sh.fragmentShader = fs;
  };
  mat.customProgramCacheKey = () => 'wfx' + (solidInside ? 's' : '') + (cut ? 'c' : '') + (cloud ? 'k' : '') + (water ? 'w' : '') + sway + 'g' + grain;
  return mat;
}
export function bannerTex(text) {
  return canvasTex(512, 96, (g, w, h) => {
    g.fillStyle = '#1C2340'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 4; k++) for (let r = 0; r < 4; r++) { g.fillStyle = (k + r) % 2 ? '#fff' : '#1C2340'; g.fillRect(k * 16, r * 24, 16, 24); g.fillRect(w - 64 + k * 16, r * 24, 16, 24); }
    g.fillStyle = '#FFC72C'; let fs = 56; g.font = fs + 'px Bungee, Impact, sans-serif'; while (g.measureText(text).width > w - 150 && fs > 20) { fs -= 2; g.font = fs + 'px Bungee, Impact, sans-serif'; } g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, w / 2, h / 2 + 3);
  });
}
export function chevronTex(right) {
  return canvasTex(256, 104, (g, w, h) => {
    g.fillStyle = '#FFC72C'; g.fillRect(0, 0, w, h); g.fillStyle = '#1C2340'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
    for (let k = 0; k < 3; k++) {
      const x0 = 40 + k * 64; g.beginPath();
      if (right) { g.moveTo(x0, 18); g.lineTo(x0 + 34, h / 2); g.lineTo(x0, h - 18); g.lineTo(x0 + 18, h - 18); g.lineTo(x0 + 52, h / 2); g.lineTo(x0 + 18, 18); }
      else { g.moveTo(x0 + 52, 18); g.lineTo(x0 + 18, h / 2); g.lineTo(x0 + 52, h - 18); g.lineTo(x0 + 34, h - 18); g.lineTo(x0, h / 2); g.lineTo(x0 + 34, 18); }
      g.closePath(); g.fill();
    }
  });
}
// ---------- cars ----------
export function numberTex(n, bg, fg) {
  return canvasTex(128, 128, (g, w, h) => { g.fillStyle = bg; g.beginPath(); g.arc(64, 64, 60, 0, TAU); g.fill(); g.fillStyle = fg; g.font = '64px Bungee, Impact, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(n), 64, 70); });
}
// Matte paint for props and anything that isn't a vehicle; the racers and road cars use carpaint.js.
export function paintMat(c) { return new THREE.MeshLambertMaterial({ color: c }); }
export function glassMat() { return new THREE.MeshPhongMaterial({ color: 0x253450, specular: 0x3C465E, shininess: 70 }); }
G.glowTex = null; G.blobTex = null;
// ---------- car damage visuals ----------
export let crackTex = null;
export function getCrackTex() {
  if (crackTex) return crackTex;
  crackTex = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#253450'; g.fillRect(0, 0, w, h);
    const rnd = mulberry32(99); g.strokeStyle = 'rgba(225,240,255,0.85)'; g.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) {
      const cx = 30 + rnd() * 68, cy = 30 + rnd() * 68;
      for (let r = 0; r < 7; r++) { let x = cx, y = cy, a = rnd() * TAU; g.beginPath(); g.moveTo(x, y); for (let q = 0; q < 5; q++) { a += (rnd() - 0.5) * 0.9; x += Math.cos(a) * 11; y += Math.sin(a) * 11; g.lineTo(x, y); } g.stroke(); }
      g.beginPath(); g.arc(cx, cy, 6 + rnd() * 6, 0, TAU); g.stroke();
    }
  });
  return crackTex;
}
