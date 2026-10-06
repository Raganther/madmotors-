import * as THREE from 'three';
import { buildCarModel, setCarDetail } from './carmodels.js';
import { setCarEnvironment } from './carpaint.js';
import { disposeGroup } from './geometry.js';

// The career garage's turntable (ui/career.js, one car's upgrades): the car turning slowly on a workshop floor, in its
// own small renderer on its own canvas. fit(def) is a part being fitted: the jacks come up, the car rises on them, the
// new part is on when it's at the top (render/parts.js), and it drops back down onto its springs.
let R = null, scene, cam, holder, jacks, car = null, want = null, t0 = -1, a = -0.6, raf = 0, last = 0;
const UP = 0.32, SWAP = 0.4, DONE = 1.1;
function setup(canvas) {
  R = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }); R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); R.shadowMap.enabled = true;
  scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(30, canvas.width / canvas.height, 0.1, 100);
  scene.add(new THREE.HemisphereLight(0xEAF2FF, 0x3A3F52, 0.85));
  const sun = new THREE.DirectionalLight(0xFFF3DE, 0.85); sun.position.set(-4, 9, 3); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 }); scene.add(sun);
  const s0 = new THREE.Scene(); setCarEnvironment(R, s0, { colors: { sky: 0xBFE3F2 }, light: { ground: 0x4A5040, sun: 0xFFF3DE } }); scene.environment = s0.environment;
  const floor = new THREE.Mesh(new THREE.CircleGeometry(4.2, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8C8F94 })); floor.receiveShadow = true; scene.add(floor);
  holder = new THREE.Group(); scene.add(holder);
  // two trolley jacks, under the sills, hidden in the floor until a part goes on
  jacks = new THREE.Group(); const red = new THREE.MeshLambertMaterial({ color: 0xC8352A }), steel = new THREE.MeshLambertMaterial({ color: 0x6B7280 });
  for (const s of [-1, 1]) { const j = new THREE.Group(); j.add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.12, 0.7).translate(0, 0.06, 0), red)); j.add(new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, 1, 10).translate(0, -0.5, 0), steel)); j.position.set(s * 0.7, 0, 0); jacks.add(j); }
  holder.add(jacks);
}
function place(def) {
  if (car) { holder.remove(car.root); disposeGroup(car.root); }
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const m = buildCarModel({ ...def, num: 7 }, root, body); setCarDetail(m.lod, true); body.position.y = m.lift || 0;
  root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  if (m.anim) m.anim({}, { inp: { throttle: 0.3 }, boost: 0 }, 0.4);
  holder.add(root); car = { root, lift: m.lift || 0 };
  const box = new THREE.Box3().setFromObject(root), size = box.getSize(new THREE.Vector3()), d = Math.max(size.x, size.y, size.z) * 2.1;
  cam.position.set(d * 0.62, d * 0.5, d * 0.66); cam.lookAt(0, size.y * 0.35, 0);
  for (const j of jacks.children) j.position.x = Math.sign(j.position.x) * (size.x / 2 - 0.15);
}
function frame(t) {
  raf = 0; if (!R || !R.domElement.isConnected) { car = null; return; }   // the screen moved on: stop until shown again
  const dt = Math.min(0.1, (t - (last || t)) / 1000); last = t; a += dt * 0.35; holder.rotation.y = a;
  let up = 0;
  if (t0 >= 0) {
    const k = (t - t0) / 1000;
    if (k >= SWAP && want) { place(want); want = null; }
    up = k < SWAP ? Math.sin(k / SWAP * Math.PI / 2) : k < DONE ? Math.max(0, 1 - (k - SWAP) / (DONE - SWAP) * 1.25) + Math.sin((k - SWAP) * 18) * 0.06 * (1 - (k - SWAP) / (DONE - SWAP)) : 0;
    if (k >= DONE) { t0 = -1; up = 0; }
  }
  if (car) car.root.position.y = up * UP;
  for (const j of jacks.children) j.position.y = up > 0 ? up * UP + 0.02 : -0.3;
  R.render(scene, cam); raf = requestAnimationFrame(frame);
}
/** Show career car def on `canvas` (sizes it to its box); fit: play the fitting animation into the new def. */
export function showCar(canvas, def, fit = false) {
  if (!R || R.domElement !== canvas) { if (R) { R.dispose(); car = null; } setup(canvas); }
  const w = canvas.clientWidth || canvas.width, h = canvas.clientHeight || canvas.height; R.setSize(w, h, false); cam.aspect = w / h; cam.updateProjectionMatrix();
  if (fit && car) { want = def; t0 = performance.now(); } else place(def);
  if (!raf) { last = 0; raf = requestAnimationFrame(frame); }
}
