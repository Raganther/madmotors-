import * as THREE from 'three';
import { radialTex } from '../geometry.js';
import { camT } from '../camera.js';
import { quality } from '../renderer.js';
import { carVis } from '../vehicles.js';

// Weather and time of day (core/elements/weather.js; the versions in data/versions.js). Rain: streaks falling
// slantwise through a box that follows the camera target (like snowfall; off on Graphics: Low). Night: a pool of
// headlight on the road ahead of every racer and a red glow behind, added to each car's root and only shown at night.
const BOX = { x: 110, y: 40, z: 110 }, MAX = 1400, DROP = 1.3;
let rain = null, off = null, night = false, poolM = null, tailM = null;
export function addWeather(group, stage) {
  rain = null; night = !!stage.night;
  const amt = stage.rain || 0; if (!amt) return;
  const n = Math.round(MAX * Math.min(1, amt)), p = new Float32Array(n * 6); off = new Float32Array(n * 4);
  let s = 77; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < n; k++) { off[k * 4] = r() * BOX.x; off[k * 4 + 1] = r() * BOX.y; off[k * 4 + 2] = r() * BOX.z; off[k * 4 + 3] = r(); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3));
  rain = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xCAD6E6, transparent: true, opacity: 0.42, depthWrite: false }));
  rain.frustumCulled = false; rain.renderOrder = 3; group.add(rain);
}
const wrap = (v, m) => ((v % m) + m) % m;
function pools(v) {
  if (!poolM) {
    poolM = new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,240,205,0.65)'], [0.55, 'rgba(255,232,190,0.26)'], [1, 'rgba(255,230,180,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    tailM = new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(255,60,40,0.7)'], [1, 'rgba(255,40,30,0)']]), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
  }
  const g = new THREE.Group(), head = new THREE.Mesh(new THREE.PlaneGeometry(7, 15), poolM), tail = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4), tailM);
  head.rotation.x = tail.rotation.x = -Math.PI / 2; head.position.set(0, 0.07, 9.5); tail.position.set(0, 0.07, -2.8); head.renderOrder = tail.renderOrder = 2;
  g.add(head, tail); v.root.add(g); return g;
}
export function updateWeather(dt, now) {
  for (const v of carVis) { if (night && !v.night) v.night = pools(v); if (v.night) v.night.visible = night; }
  if (!rain) return;
  rain.visible = quality !== 'low'; if (!rain.visible) return;
  const p = rain.geometry.attributes.position.array, n = p.length / 6;
  for (let k = 0; k < n; k++) {
    const ph = off[k * 4 + 3], fall = now * (26 + ph * 10);                        // fast, each drop its own speed
    const x = camT.x - BOX.x / 2 + wrap(off[k * 4] + fall * 0.18 - camT.x, BOX.x), y = camT.y - 6 + wrap(off[k * 4 + 1] - fall - camT.y, BOX.y), z = camT.z - BOX.z / 2 + wrap(off[k * 4 + 2] - camT.z, BOX.z);
    p[k * 6] = x; p[k * 6 + 1] = y; p[k * 6 + 2] = z; p[k * 6 + 3] = x - DROP * 0.18; p[k * 6 + 4] = y + DROP; p[k * 6 + 5] = z;
  }
  rain.geometry.attributes.position.needsUpdate = true;
}
