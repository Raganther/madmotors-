import * as THREE from 'three';
import { buildCarModel } from './carmodels.js';
import { disposeGroup } from './geometry.js';

// Garage pictures: each vehicle rendered once, three-quarter view on a plain floor, into a small offscreen renderer
// of its own (so the game's renderer and canvas are untouched). Cached as data URLs.
const cache = new Map(); let R = null;
export function vehicleThumb(v, w = 240, h = 150) {
  const key = v.id + w; if (cache.has(key)) return cache.get(key);
  if (!R) { R = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); R.setPixelRatio(1); }
  R.setSize(w, h);
  const scene = new THREE.Scene(), root = new THREE.Group(), body = new THREE.Group(); root.add(body); scene.add(root);
  scene.add(new THREE.HemisphereLight(0xEAF2FF, 0x3A3F52, 0.9));
  const sun = new THREE.DirectionalLight(0xFFF3DE, 0.85); sun.position.set(4, 8, 5); scene.add(sun);
  const m = buildCarModel({ ...v, num: 7 }, root, body);
  if (m.anim) m.anim({}, { inp: { throttle: 0.7 }, boost: 0 }, 0.4);
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
  const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 100), d = Math.max(size.x, size.y, size.z) * 2.35;
  cam.position.set(c.x + d * 0.62, c.y + d * 0.42, c.z + d * 0.66); cam.lookAt(c.x, c.y - size.y * 0.05, c.z);
  R.setClearColor(0x000000, 0); R.render(scene, cam);
  const url = R.domElement.toDataURL('image/png');
  disposeGroup(scene); cache.set(key, url); return url;
}
