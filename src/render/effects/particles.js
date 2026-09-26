import * as THREE from 'three';
import { _c, _e, _m, _p, _q, _s } from '../geometry.js';
import { camera, pcamera, renderer, scene } from '../renderer.js';
import { G } from '../../game.js';

// ---------- particles ----------
// Two kinds. Soft: smoke, dust, spray, steam, flame: round, see-through puffs (one point sprite each, drawn in a single
// call) that swell as they fade, so a crowd of them reads as a haze rather than a pile of shapes. Solid: things with
// weight (mud clods, gravel, oil drops, tyre bits, embers): small tumbling low-poly lumps. emit() picks by gravity
// (heavy = solid) unless told. Soft puffs thin themselves out when the screen is already busy.
export const PMAX = 360, SMAX = 900;
export let pMesh, pIdx = 0;
export const pData = [];
export let pColorDirty = false;
let soft = null, sIdx = 0, sAlive = 0;
const sData = [], _size = new THREE.Vector2();
export function initParticles() {
  pMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.32, 0), new THREE.MeshLambertMaterial({ color: 0xffffff }), PMAX);
  pMesh.frustumCulled = false; pMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  _m.makeScale(0, 0, 0);
  for (let i = 0; i < PMAX; i++) { pData.push({ age: 1, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, g: 0 }); pMesh.setMatrixAt(i, _m); _c.set(0xffffff); pMesh.setColorAt(i, _c); }
  scene.add(pMesh);
  // soft puffs: a point per particle; size in metres, turned into pixels for whichever camera is drawing
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(SMAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aColor', new THREE.BufferAttribute(new Float32Array(SMAX * 3), 3).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(SMAX), 1).setUsage(THREE.DynamicDrawUsage));
  g.setAttribute('aAlpha', new THREE.BufferAttribute(new Float32Array(SMAX), 1).setUsage(THREE.DynamicDrawUsage));
  const mat = new THREE.ShaderMaterial({
    uniforms: { uScale: { value: 10 }, uPersp: { value: 0 } },
    vertexShader: `attribute vec3 aColor; attribute float aSize; attribute float aAlpha; uniform float uScale; uniform float uPersp; varying vec3 vCol; varying float vA;
      void main() { vCol = aColor; vA = aAlpha; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_Position = projectionMatrix * mv;
        gl_PointSize = aAlpha > 0.0 ? aSize * uScale / mix(1.0, max(0.5, -mv.z), uPersp) : 0.0; }`,
    fragmentShader: `varying vec3 vCol; varying float vA;
      void main() { vec2 d = gl_PointCoord - 0.5; float r = length(d) * 2.0; if (r > 1.0) discard;
        float a = vA * (1.0 - r * r) * (0.75 + 0.25 * (1.0 - r));   // soft round edge, a little denser in the middle
        gl_FragColor = vec4(vCol * (1.0 - 0.12 * r), a); }`,
    transparent: true, depthWrite: false
  });
  soft = new THREE.Points(g, mat); soft.frustumCulled = false; soft.renderOrder = 3; scene.add(soft);
  for (let i = 0; i < SMAX; i++) sData.push({ age: 1, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, s: 1, g: 0, a: 0.6 });
}
const SOFT_KEEP = 0.62;   // share of soft puffs actually made: each is bigger and see-through, so fewer carry the same look
/** A particle: position, velocity, life (s), size (m), colour, gravity (+ falls, - rises), kind 'soft' | 'solid'. */
export function emit(x, y, z, vx, vy, vz, life, size, color, grav, kind) {
  if ((kind || (grav >= 8 ? 'solid' : 'soft')) === 'soft') {
    if (!soft) return;
    const busy = sAlive > SMAX * 0.45 ? 0.5 : 1;                                      // a crowd already kicking things up: thin it
    if (Math.random() > SOFT_KEEP * busy) return;
    const i = sIdx; sIdx = (sIdx + 1) % SMAX; const p = sData[i];
    Object.assign(p, { age: 0, life: life * 1.25, x, y, z, vx, vy, vz, s: size, g: grav, a: color === 0xFFFFFF || color > 0xE8E8E8 ? 0.55 : 0.62 });
    _c.set(color); soft.geometry.attributes.aColor.setXYZ(i, _c.r, _c.g, _c.b);
    return;
  }
  const i = pIdx; pIdx = (pIdx + 1) % PMAX; const p = pData[i];
  Object.assign(p, { age: 0, life, x, y, z, vx, vy, vz, s: size, g: grav }); _c.set(color); pMesh.setColorAt(i, _c); pColorDirty = true;
}
export function updateParticles(dt) {
  for (let i = 0; i < PMAX; i++) {
    const p = pData[i]; if (p.age >= p.life) continue;
    p.age += dt;
    if (p.age >= p.life) { _m.makeScale(0, 0, 0); pMesh.setMatrixAt(i, _m); continue; }
    p.vy -= p.g * dt; const dr = Math.exp(-dt * 2.2); p.vx *= dr; p.vz *= dr;
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const t = p.age / p.life, s = p.s * Math.min(1, t * 8) * (1 - t) * (G.persp ? 0.6 : 1.1);   // sized for the high camera; up close they'd fill the screen
    _e.set(p.age * 3, p.age * 2, 0); _q.setFromEuler(_e); _p.set(p.x, p.y, p.z); _s.set(s, s, s); _m.compose(_p, _q, _s); pMesh.setMatrixAt(i, _m);
  }
  pMesh.instanceMatrix.needsUpdate = true; if (pColorDirty) { pMesh.instanceColor.needsUpdate = true; pColorDirty = false; }
  if (!soft) return;
  const A = soft.geometry.attributes, pos = A.position.array, sz = A.aSize.array, al = A.aAlpha.array; sAlive = 0;
  for (let i = 0; i < SMAX; i++) {
    const p = sData[i]; if (p.age >= p.life) { al[i] = 0; continue; }
    p.age += dt; if (p.age >= p.life) { al[i] = 0; continue; }
    sAlive++;
    p.vy -= p.g * 0.6 * dt; const dr = Math.exp(-dt * 2.6); p.vx *= dr; p.vz *= dr; p.vy *= Math.exp(-dt * 1.2);   // air drag: puffs drift and slow
    p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
    const t = p.age / p.life;
    pos[i * 3] = p.x; pos[i * 3 + 1] = p.y; pos[i * 3 + 2] = p.z;
    sz[i] = p.s * (0.9 + 1.3 * t) * (G.persp ? 0.55 : 1);                               // swells as it thins
    al[i] = p.a * Math.min(1, t * 10) * Math.pow(1 - t, 1.4);
  }
  A.position.needsUpdate = A.aSize.needsUpdate = A.aAlpha.needsUpdate = true; A.aColor.needsUpdate = true;
  // metres to pixels for the camera that's drawing: fixed for the top-down view, divided by depth for the perspective ones
  renderer.getDrawingBufferSize(_size); const U = soft.material.uniforms;
  if (G.persp) { U.uPersp.value = 1; U.uScale.value = _size.y / (2 * Math.tan(pcamera.fov * Math.PI / 360)); }
  else { U.uPersp.value = 0; U.uScale.value = _size.y / Math.max(1, camera.top - camera.bottom); }
}
