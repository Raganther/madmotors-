import * as THREE from 'three';
import { FX } from './materials.js';
import { SUN_Z } from './camera.js';

// The sky behind the cameras that look along the ground (behind the car, the title scene; the overhead view mostly sees
// ground): a dome round the camera, the stage's sky colour at the horizon going deeper overhead, a glow round the sun,
// and soft clouds drifting with the wind (the same noise as the cloud shadows on the ground: materials.js FX). It sits
// inside the camera's far plane, never fogged, drawn before everything else.
const U = { uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uSunCol: { value: new THREE.Color() }, uSun: { value: SUN_Z.clone() }, uCloudK: { value: 0.3 }, uNight: { value: 0 } };
let dome = null;
function make(scene) {
  const mat = new THREE.ShaderMaterial({
    uniforms: Object.assign(U, { uCloud: FX.cloud, uTime: FX.time, uWind: FX.wind }),
    vertexShader: 'varying vec3 vDir; void main() { vDir = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }',
    fragmentShader: `uniform vec3 uHorizon, uZenith, uSunCol, uSun; uniform float uCloudK, uNight, uTime; uniform sampler2D uCloud; uniform vec2 uWind; varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir); float h = max(d.y, 0.0);
        vec3 c = mix(uHorizon, uZenith, pow(h, 0.55));
        c = mix(c, uHorizon * 0.8, smoothstep(0.0, -0.25, d.y));                    // below the horizon: a haze, not black
        float s = max(dot(d, normalize(uSun)), 0.0);
        c += uSunCol * (pow(s, 6.0) * 0.18 + pow(s, 120.0) * 0.6) * (1.0 - uNight);    // the glow round the sun, and the sun
        // clouds: the noise laid on a flat layer overhead, thinning towards the horizon
        vec2 q = d.xz / max(d.y + 0.12, 0.05) * 0.35 + uWind * uTime * 0.0012;
        float n = texture2D(uCloud, q).r * 0.65 + texture2D(uCloud, q * 2.7 + 0.3).r * 0.35, cl = smoothstep(0.5, 0.78, n) * smoothstep(0.02, 0.25, d.y) * uCloudK;
        vec3 cloud = mix(vec3(1.0), uHorizon, 0.25) * (1.0 - uNight * 0.75) + uSunCol * pow(s, 4.0) * 0.15;
        c = mix(c, cloud, cl);
        // at night, stars
        vec3 sd = floor(d * 380.0); float st = fract(sin(dot(sd, vec3(12.9898, 78.233, 37.719))) * 43758.5453);
        c += vec3(0.9, 0.95, 1.0) * step(0.9975, st) * uNight * smoothstep(0.05, 0.3, d.y) * (1.0 - cl);
        gl_FragColor = vec4(c, 1.0);
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false
  });
  dome = new THREE.Mesh(new THREE.SphereGeometry(600, 32, 16), mat); dome.frustumCulled = false; dome.renderOrder = -10;
  dome.onBeforeRender = (r, s, cam) => dome.position.copy(cam.position);           // always centred on whoever is looking
  scene.add(dome);
}
/** The sky for a stage (render/world buildWorld). */
export function setSky(scene, stage) {
  if (!dome) make(scene);
  const L = stage.light, sky = new THREE.Color(stage.colors.sky), night = L.sunI < 0.6 || sky.getHSL({}).l < 0.25 ? 1 : 0;
  U.uHorizon.value.copy(sky).lerp(new THREE.Color(0xFFFFFF), night ? 0 : 0.18);
  U.uZenith.value.copy(sky).multiplyScalar(night ? 0.55 : 0.78).lerp(new THREE.Color(night ? 0x0A1028 : 0x4A86D0), night ? 0.5 : 0.35);
  U.uSunCol.value.set(L.sun || 0xFFFFFF); U.uCloudK.value = 0.35 + (L.cloud || 0.2) * 1.2; U.uNight.value = night;
}
