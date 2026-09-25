import * as THREE from 'three';
import { G } from '../game.js';
import { FX, getCrackTex, makeCloudTex } from './materials.js';
import { $, isTouchDevice } from '../ui/dom.js';

export let contextLost = false;
export let renderer, scene, camera, sun, hemi;
// ---------- graphics quality ----------
// Auto scales the render resolution with the frame rate; the fixed levels trade sharpness and shadow detail for speed.
export const QUALITY = {
  auto: { label: 'Auto', pr: 2, shadow: 1536, dyn: true, post: true },
  high: { label: 'High', pr: 2, shadow: 2048, post: true },
  medium: { label: 'Medium', pr: 1.25, shadow: 1536, post: false },
  low: { label: 'Low', pr: 0.85, shadow: 1024, post: false }
};
export const Q_ORDER = ['auto', 'high', 'medium', 'low'];
export let autoPost = !isTouchDevice(), quality = 'auto', dynPR = Math.min(devicePixelRatio || 1, isTouchDevice() ? 1.25 : 1.5), perfAcc = 0, perfN = 0, perfGood = 0, perfCool = 0;
try { const q = localStorage.getItem('downhill-rush-quality'); if (QUALITY[q]) quality = q; } catch (e) { }
export function applyQuality() {
  const Q = QUALITY[quality], dpr = devicePixelRatio || 1;
  const pr = Q.dyn ? dynPR : Math.min(dpr, Q.pr);
  if (Math.abs(renderer.getPixelRatio() - pr) > 0.01) renderer.setPixelRatio(pr);
  if (sun.shadow.mapSize.x !== Q.shadow) { sun.shadow.mapSize.set(Q.shadow, Q.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
  FX.grain.value = quality === 'low' ? 0 : 1;                                        // surface detail off on Low
  const b = $('gfx-btn'); if (b) b.textContent = 'Graphics: ' + Q.label;
}
export function cycleQuality() {
  quality = Q_ORDER[(Q_ORDER.indexOf(quality) + 1) % Q_ORDER.length];
  try { localStorage.setItem('downhill-rush-quality', quality); } catch (e) { }
  applyQuality();
}
// average frame time over ~1.5 s: drop resolution when it runs slow, creep back up when it's comfortably smooth
export function perfSample(dt) {
  if (!QUALITY[quality].dyn || G.state !== 'racing' || dt > 0.25) return;
  perfAcc += dt; perfN++; if (perfCool > 0) perfCool -= dt;
  if (perfAcc < 1.5) return;
  const avg = perfAcc / perfN; perfAcc = 0; perfN = 0;
  if (perfCool > 0) return;
  const maxPR = Math.min(devicePixelRatio || 1, 2);
  if (avg > 1 / 50 && autoPost) { autoPost = false; perfGood = 0; perfCool = 1.5; }      // the screen effect goes first
  else if (avg > 1 / 50 && dynPR > 0.6) { dynPR = Math.max(0.6, dynPR - 0.15); perfGood = 0; perfCool = 1.5; applyQuality(); }
  else if (avg < 1 / 57) { if (++perfGood >= 3 && dynPR < maxPR) { dynPR = Math.min(maxPR, dynPR + 0.1); perfGood = 0; perfCool = 1.5; applyQuality(); } }
  else perfGood = 0;
}
// ---------- screen effects: tilt-shift miniature focus, colour grade, vignette ----------
export let post = null;
export const grade = { rgb: new THREE.Vector3(1, 1, 1), sat: 1.1 };
export function setGrade(Lt) { grade.rgb.set(...Lt.grade); grade.sat = Lt.sat; }
export function postWanted() { const Q = QUALITY[quality]; return Q.post && (!Q.dyn || autoPost); }
export function initPost() {
  const opts = { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, format: THREE.RGBAFormat };
  const gl2 = renderer.capabilities.isWebGL2, rt = gl2 ? new THREE.WebGLMultisampleRenderTarget(4, 4, opts) : new THREE.WebGLRenderTarget(4, 4, opts);
  if (gl2) rt.samples = 4;
  const mat = new THREE.ShaderMaterial({
    uniforms: { tDiffuse: { value: rt.texture }, uRes: { value: new THREE.Vector2(4, 4) }, uGrade: { value: grade.rgb }, uSat: { value: 1.1 }, uBlur: { value: 1 } },
    vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uRes; uniform vec3 uGrade; uniform float uSat; uniform float uBlur; varying vec2 vUv;
      void main() {
        // blur grows away from a horizontal focus band a little below centre, where the car sits
        float band = smoothstep(0.16, 0.48, abs(vUv.y - 0.44));
        vec2 px = uBlur * band * 3.2 / uRes;
        vec3 c = texture2D(tDiffuse, vUv).rgb;
        if (band > 0.01) {
          vec3 acc = c;
          acc += texture2D(tDiffuse, vUv + px * vec2( 1.0,  0.0)).rgb; acc += texture2D(tDiffuse, vUv + px * vec2(-1.0,  0.0)).rgb;
          acc += texture2D(tDiffuse, vUv + px * vec2( 0.0,  1.0)).rgb; acc += texture2D(tDiffuse, vUv + px * vec2( 0.0, -1.0)).rgb;
          acc += texture2D(tDiffuse, vUv + px * vec2( 0.7,  0.7)).rgb; acc += texture2D(tDiffuse, vUv + px * vec2(-0.7,  0.7)).rgb;
          acc += texture2D(tDiffuse, vUv + px * vec2( 0.7, -0.7)).rgb; acc += texture2D(tDiffuse, vUv + px * vec2(-0.7, -0.7)).rgb;
          acc += texture2D(tDiffuse, vUv + px * vec2( 1.9,  0.5)).rgb; acc += texture2D(tDiffuse, vUv + px * vec2(-1.9, -0.5)).rgb;
          acc += texture2D(tDiffuse, vUv + px * vec2( 0.5, -1.9)).rgb; acc += texture2D(tDiffuse, vUv + px * vec2(-0.5,  1.9)).rgb;
          c = acc / 13.0;
        }
        c *= uGrade;
        float l = dot(c, vec3(0.299, 0.587, 0.114));
        c = mix(vec3(l), c, uSat);
        c = (c - 0.5) * 1.06 + 0.5;
        vec2 d = (vUv - vec2(0.5, 0.47)) * vec2(1.0, 1.25);
        c *= 1.0 - 0.22 * smoothstep(0.18, 0.62, length(d));
        gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
      }`,
    depthTest: false, depthWrite: false
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat); quad.frustumCulled = false;
  const pscene = new THREE.Scene(); pscene.add(quad);
  post = { rt, mat, pscene, pcam: new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1), size: new THREE.Vector2() };
}
export function renderFrame() {
  if (!postWanted()) { renderer.render(scene, camera); return; }
  if (!post) initPost();
  renderer.getDrawingBufferSize(post.size);
  if (post.rt.width !== post.size.x || post.rt.height !== post.size.y) { post.rt.setSize(post.size.x, post.size.y); post.mat.uniforms.uRes.value.copy(post.size); }
  post.mat.uniforms.uSat.value = grade.sat; post.mat.uniforms.uBlur.value = renderer.getPixelRatio();
  renderer.setRenderTarget(post.rt); renderer.render(scene, camera);
  renderer.setRenderTarget(null); renderer.render(post.pscene, post.pcam);
}
// ---------- renderer ----------
export function createGLContext() {
  let reason = '';
  const attempts = [
    ['webgl2', { antialias: (devicePixelRatio || 1) < 1.5, powerPreference: 'low-power' }], ['webgl2', { antialias: false, failIfMajorPerformanceCaveat: false, powerPreference: 'default' }],
    ['webgl', { antialias: true }], ['webgl', { antialias: false, failIfMajorPerformanceCaveat: false }], ['experimental-webgl', {}]
  ];
  for (const [type, attrs] of attempts) {
    const cv = document.createElement('canvas');
    cv.addEventListener('webglcontextcreationerror', e => { if (e.statusMessage) reason = e.statusMessage; }, false);
    let ctx = null;
    try { ctx = cv.getContext(type, Object.assign({ alpha: false, stencil: false, depth: true }, attrs)); } catch (e) { reason = e.message; }
    if (ctx) return { canvas: cv, context: ctx, aa: !!attrs.antialias };
  }
  if (/Disabled|BindToCurrentSequence/i.test(reason)) throw new Error('Chrome has switched off 3D graphics after a graphics crash. Quit Chrome completely with Cmd+Q (closing the window is not enough), reopen it, and load this page again. Safari will also work.');
  throw new Error('your browser blocked WebGL' + (reason ? ' (' + reason + ')' : '') + '. Quit the browser completely, reopen it, and check that hardware acceleration is on.');
}
export function initRenderer() {
  const gl = createGLContext();
  renderer = new THREE.WebGLRenderer({ canvas: gl.canvas, context: gl.context, antialias: gl.aa });
  gl.canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); contextLost = true; $('loading').hidden = false; $('loading-text').textContent = 'Graphics reset, recovering…'; });
  gl.canvas.addEventListener('webglcontextrestored', () => { try { sessionStorage.setItem('dr-recovered', '1'); } catch (_) { } location.reload(); });
  renderer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFShadowMap;
  $('game').appendChild(renderer.domElement);
  scene = new THREE.Scene(); scene.background = new THREE.Color(0xBFE3F2); scene.fog = new THREE.Fog(0xBFE3F2, 330, 620);
  camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 1, 900);
  hemi = new THREE.HemisphereLight(0xE8F4FF, 0x6B7A4A, 0.62); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xFFF1DC, 0.9); sun.castShadow = true;
  sun.shadow.mapSize.set(1536, 1536); const sc = sun.shadow.camera; sc.left = -75; sc.right = 75; sc.top = 75; sc.bottom = -75; sc.near = 1; sc.far = 260;
  sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.04; scene.add(sun); scene.add(sun.target);
  addEventListener('resize', () => renderer.setSize(innerWidth, innerHeight));
  FX.cloud.value = makeCloudTex();
  applyQuality();
  // the cracked-windscreen material only appears mid-race; keep one in the scene so its shader is compiled up front
  const warm = new THREE.Mesh(new THREE.BoxGeometry(0.01, 0.01, 0.01), new THREE.MeshLambertMaterial({ map: getCrackTex() })); warm.visible = false; scene.add(warm);
}
