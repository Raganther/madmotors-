import * as THREE from 'three';
import { G } from '../game.js';
import { ITEMS, missilePos, roadPos, WPN, drumPos } from '../core/features/weapons.js';
import { emit } from './effects/particles.js';
import { debris } from './effects/debris.js';
import { shockwave } from './effects/rings.js';
import { canvasTex, mergeAll } from './geometry.js';
import { HALF } from '../core/constants.js';
import { scene } from './renderer.js';
import { race } from '../ui/flow.js';

// Weapons visuals (core/features/weapons.js): weapon crates on the road, missiles in flight, tracer rounds, oil
// slicks, the harpoon and its line, blasts and puffs. The weapon mounts that rise out of the cars' roofs are
// makeMount / updateMount, driven from render/vehicles.js.
const L = c => new THREE.MeshLambertMaterial({ color: c }), B = c => new THREE.MeshBasicMaterial({ color: c });
const box = (w, h, d, m, x = 0, y = 0, z = 0) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); return b; };
const cyl = (r, l, m, x = 0, y = 0, z = 0) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, l, 10).rotateX(Math.PI / 2), m); c.position.set(x, y, z); return c; };
let drumPool = [], minePool = [], jetPool = [], cementPool = [], stripPool = [], missiles = [], crates = [], slickPool = [], hookPool = [], tracers = null, tracerMat = null, flashes = [], smokes = [], domes = [], streaks = [], targetRing = null, reticle = null, shellPool = [], markPool = [], craterPool = [], scorches = [], later = [], sci = 0, fi = 0, si = 0, di = 0;
const MAXB = 80, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0);
export function initWeaponVis() {
  const white = L(0xF2F2EE), red = L(0xD8203A);
  missiles = [];
  // a missile: white body with a black band, a red ogive nose and red tail fins, small canards behind the nose, a dark
  // nozzle; behind it a flickering flame cone, a white-hot core and an orange glow
  const ogive = new THREE.LatheGeometry([0, 0.3, 0.42, 0.52, 0.6].map(y => new THREE.Vector2(0.16 * Math.sqrt(1 - (y / 0.6) ** 1.6) + 0.001, y)), 12).rotateX(Math.PI / 2), black = L(0x22252B), steel = L(0x8E969E);
  for (let k = 0; k < 16; k++) {
    const g = new THREE.Group();
    g.add(cyl(0.16, 1.3, white)); g.add(cyl(0.165, 0.12, black, 0, 0, 0.32)); g.add(cyl(0.165, 0.06, red, 0, 0, -0.2));
    const nose = new THREE.Mesh(ogive, red); nose.position.z = 0.65; g.add(nose);
    for (let f = 0; f < 4; f++) { const fin = box(0.03, 0.36, 0.34, red, 0, 0, -0.5); fin.rotation.z = f * Math.PI / 2 + Math.PI / 4; fin.translateY(0.22); g.add(fin); const can = box(0.02, 0.14, 0.12, black, 0, 0, 0.42); can.rotation.z = f * Math.PI / 2 + Math.PI / 4; can.translateY(0.2); g.add(can); }
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.14, 10).rotateX(Math.PI / 2).translate(0, 0, -0.71), steel));
    const fl = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.9, 8).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFB03A, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); fl.position.z = -1.2; g.add(fl);
    const core = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.45, 6).rotateX(-Math.PI / 2), B(0xFFF6D8)); core.position.z = -0.98; g.add(core);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xFFB45A, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); glow.scale.set(1.6, 1.6, 1); glow.position.z = -1.0; g.add(glow);
    g.scale.setScalar(2.3); g.visible = false; scene.add(g); missiles.push({ g, fl, glow, id: -1, last: null });
  }
  // crates: a plank crate bound in steel at every edge, a glowing yellow "?" on each face, floating and turning over a
  // pulsing ring, with a soft glow round it so it shows from far up the road
  const q = canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#8F5E2E'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 4; k++) { g.fillStyle = k % 2 ? '#80522A' : '#9A6534'; g.fillRect(0, k * h / 4, w, h / 4 - 2); g.fillStyle = 'rgba(40,24,10,0.5)'; g.fillRect(0, (k + 1) * h / 4 - 3, w, 3); }
    g.strokeStyle = 'rgba(60,38,16,0.35)'; g.lineWidth = 1; for (let k = 0; k < 14; k++) { const y = Math.random() * h; g.beginPath(); g.moveTo(0, y); g.bezierCurveTo(w * 0.3, y + 3, w * 0.6, y - 3, w, y + 1); g.stroke(); }
    g.fillStyle = '#FFC72C'; g.shadowColor = '#FFE27A'; g.shadowBlur = 12; g.font = 'bold 84px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('?', w / 2, h / 2 + 4); g.shadowBlur = 0; g.lineWidth = 4; g.strokeStyle = '#7A4A10'; g.strokeText('?', w / 2, h / 2 + 4);
  });
  const cm = new THREE.MeshLambertMaterial({ map: q, emissive: 0x4A3010 }), ring = new THREE.MeshBasicMaterial({ color: 0xFFC72C, transparent: true, opacity: 0.45, depthWrite: false });
  const edges = []; for (const [ax, ay] of [[0, 1], [0, 2], [1, 2]]) for (const a of [-1, 1]) for (const b2 of [-1, 1]) { const p = [0, 0, 0]; p[ax] = a * 0.9; p[ay] = b2 * 0.9; const sz = [0.16, 0.16, 0.16]; sz[3 - ax - ay] = 1.92; edges.push(new THREE.BoxGeometry(...sz).translate(...p)); }
  const edgeG = mergeAll(edges), edgeM = L(0x5E6670);
  crates = [];
  for (let k = 0; k < 40; k++) {
    const g = new THREE.Group(), b = new THREE.Group(), body = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), cm); body.castShadow = true; b.add(body, new THREE.Mesh(edgeG, edgeM)); g.add(b);
    const r = new THREE.Mesh(new THREE.RingGeometry(1.4, 2.0, 24).rotateX(-Math.PI / 2), ring); r.position.y = -1.3; g.add(r);
    const gl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xFFC72C, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0.35 })); gl.scale.set(4.2, 4.2, 1); g.add(gl);
    g.visible = false; scene.add(g); crates.push({ g, b, r });
  }
  // scorch marks: where a missile or a blast hit, a black smudge on the road that fades over half a minute
  const scTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(10,8,6,0.85)'); gr.addColorStop(0.5, 'rgba(25,20,16,0.55)'); gr.addColorStop(1, 'rgba(30,26,22,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let k = 0; k < 9; k++) { const a = k / 9 * 6.28; g.strokeStyle = 'rgba(12,10,8,0.5)'; g.lineWidth = 2; g.beginPath(); g.moveTo(w / 2, h / 2); g.lineTo(w / 2 + Math.cos(a) * w * 0.48, h / 2 + Math.sin(a) * h * 0.48); g.stroke(); } });
  scorches = []; for (let k = 0; k < 20; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: scTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); m.renderOrder = 2; m.visible = false; scene.add(m); scorches.push({ m, t: 99 }); }
  // tracer rounds: stretched glowing bars, all in one instanced mesh
  // thin hot streaks (a round's travel in a frame or so), glowing yellow-orange so they aren't road paint; over kerbs and walls
  tracerMat = new THREE.MeshBasicMaterial({ color: 0xFFD27A, depthTest: false, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
  tracers = new THREE.InstancedMesh(new THREE.BoxGeometry(0.11, 0.11, 3.2), tracerMat, MAXB); tracers.count = 0; tracers.frustumCulled = false; tracers.renderOrder = 8; scene.add(tracers);
  // oil slicks: a dark glossy splat with a rainbow sheen
  const oilTex = canvasTex(128, 128, (g, w, h) => {
    const blob = (rr0, jag) => { g.beginPath(); for (let a = 0; a <= 24; a++) { const t = a / 24 * Math.PI * 2, rr = rr0 * (0.8 + jag * Math.sin(a * 2.7) + 0.06 * Math.cos(a * 5.3)); g.lineTo(w / 2 + Math.cos(t) * rr, h / 2 + Math.sin(t) * rr); } g.fill(); };
    const rim = g.createRadialGradient(w / 2, h / 2, w * 0.3, w / 2, h / 2, w / 2); rim.addColorStop(0, 'rgba(120,70,190,0.85)'); rim.addColorStop(0.45, 'rgba(40,170,160,0.75)'); rim.addColorStop(0.8, 'rgba(210,190,70,0.55)'); rim.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rim; blob(w / 2, 0.18);                                                               // a rainbow rim: petrol on the road
    const core = g.createRadialGradient(w * 0.45, h * 0.45, 2, w / 2, h / 2, w * 0.4); core.addColorStop(0, 'rgba(40,36,52,1)'); core.addColorStop(1, 'rgba(8,8,12,0.97)');
    g.fillStyle = core; blob(w * 0.38, 0.14);
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.ellipse(w * 0.4, h * 0.36, w * 0.14, h * 0.04, -0.6, 0, Math.PI * 2); g.fill();   // the gloss
  });
  slickPool = [];
  for (let k = 0; k < 24; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(WPN.OIL_R * 2.6, WPN.OIL_R * 2.6).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: oilTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); m.renderOrder = 2; m.visible = false; scene.add(m); slickPool.push(m); }
  // harpoon: a steel spear with a barbed head, and its line back to the car that fired it
  hookPool = [];
  for (let k = 0; k < 8; k++) {
    const g = new THREE.Group(); g.add(cyl(0.07, 1.4, L(0x9AA3AD))); const head = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 6).rotateX(Math.PI / 2), L(0x3A3F46)); head.position.z = 0.9; g.add(head);
    for (const s of [-1, 1]) { const barb = box(0.05, 0.05, 0.4, L(0x3A3F46), s * 0.15, 0, 0.6); barb.rotation.y = -s * 0.6; g.add(barb); }
    g.scale.setScalar(1.6); g.visible = false; scene.add(g);
    const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), new THREE.LineBasicMaterial({ color: 0x2A2A2A })); line.frustumCulled = false; line.visible = false; scene.add(line);
    hookPool.push({ g, line });
  }
  // wet cement: a grey splat with darker ridges (F6 signature: the mixer)
  const cemTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, w * 0.2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(150,148,140,1)'); gr.addColorStop(0.75, 'rgba(126,124,118,0.95)'); gr.addColorStop(1, 'rgba(110,108,100,0)');
    g.fillStyle = gr; g.beginPath(); for (let a = 0; a <= 20; a++) { const t = a / 20 * Math.PI * 2, r = w * 0.48 * (0.82 + 0.12 * Math.sin(a * 3.1)); g.lineTo(w / 2 + Math.cos(t) * r, h / 2 + Math.sin(t) * r); } g.fill();
    g.strokeStyle = 'rgba(90,88,84,0.6)'; g.lineWidth = 3; for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(w / 2, h / 2, 10 + k * 9, k, k + 2.2); g.stroke(); }
  });
  cementPool = [];
  for (let k = 0; k < 48; k++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(WPN.CEMENT_R * 2.3, WPN.CEMENT_R * 2.3).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: cemTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3 })); m.renderOrder = 2; m.visible = false; scene.add(m); cementPool.push(m); }
  // stinger: a black strip right across the road with a row of steel spikes (the police car's)
  const spikes = []; for (let k = 0; k < 40; k++) spikes.push(new THREE.ConeGeometry(0.07, 0.22, 4).translate((k / 39 - 0.5) * HALF * 2, 0.13, (k % 2) * 0.12 - 0.06));
  const stripG = mergeAll([new THREE.BoxGeometry(HALF * 2 + 0.6, 0.06, 0.42).translate(0, 0.03, 0), ...spikes]);
  // the water cannon's jet: a pale cone of water from the nozzle, flickering, as long as the jet reaches
  const jetTex = canvasTex(8, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.7)'); gr.addColorStop(1, 'rgba(255,255,255,1)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });   // fades out where the jet breaks up
  const jetG = new THREE.CylinderGeometry(0.9, 0.16, 1, 12, 1, true).rotateX(Math.PI / 2).translate(0, 0, 0.5);
  jetPool = []; for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(jetG, new THREE.MeshBasicMaterial({ color: 0xCFEAFF, map: jetTex, transparent: true, opacity: 0.5, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; scene.add(m); jetPool.push(m); }
  stripPool = []; for (let k = 0; k < 6; k++) { const m = new THREE.Mesh(stripG, L(0x22252B)); m.visible = false; scene.add(m); stripPool.push(m); }
  // oil drums: a steel drum, two rolling ribs, a yellow hazard band and a black top, tumbling end over end
  drumPool = [];
  const drumG = mergeAll([new THREE.CylinderGeometry(0.42, 0.42, 1.0, 14), new THREE.TorusGeometry(0.43, 0.035, 5, 14).rotateX(Math.PI / 2).translate(0, 0.22, 0), new THREE.TorusGeometry(0.43, 0.035, 5, 14).rotateX(Math.PI / 2).translate(0, -0.22, 0)]);
  for (let k = 0; k < 12; k++) {
    const g = new THREE.Group(), body = new THREE.Mesh(drumG, L(0x2A3A52)); body.castShadow = true; g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.425, 0.425, 0.16, 14, 1, true), L(0xFFC72C)); g.add(band);
    const lid = new THREE.Mesh(new THREE.CircleGeometry(0.4, 14).rotateX(-Math.PI / 2), L(0x111114)); lid.position.y = 0.505; g.add(lid);
    g.scale.setScalar(1.35); g.visible = false; scene.add(g); drumPool.push({ g });
  }
  // proximity mines: a squat olive disc with a hazard band, three prongs and a light that blinks faster once armed
  minePool = [];
  for (let k = 0; k < 16; k++) {
    const g = new THREE.Group(), body = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.72, 0.28, 14), L(0x4B5A3A)); body.position.y = 0.14; body.castShadow = true; g.add(body);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.735, 0.735, 0.08, 14, 1, true), L(0xFFC72C)); band.position.y = 0.1; g.add(band);
    for (let a = 0; a < 3; a++) { const pr = box(0.06, 0.22, 0.06, L(0x2A2E33), Math.cos(a * 2.09) * 0.3, 0.38, Math.sin(a * 2.09) * 0.3); g.add(pr); }
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), B(0xFF2A2A)); lamp.position.y = 0.34; g.add(lamp);
    g.scale.setScalar(1.3); g.visible = false; scene.add(g); minePool.push({ g, lamp });
  }
  // fireballs and flashes (additive glow sprites), smoke puffs (soft grey sprites), shockwave domes, and the red ring
  // under a car a missile is homing on
  const smokeTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.9)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  flashes = []; smokes = []; domes = [];
  // a fireball: white-hot middle, orange body, soft edge; tinted by the flash colour (white = fire)
  const fireTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,252,235,1)'); gr.addColorStop(0.3, 'rgba(255,214,110,1)'); gr.addColorStop(0.62, 'rgba(255,120,30,0.85)'); gr.addColorStop(1, 'rgba(255,60,10,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
  for (let k = 0; k < 24; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, depthWrite: false, transparent: true })); sp.renderOrder = 6; sp.visible = false; scene.add(sp); flashes.push({ sp, t: 1, life: 1, size: 1 }); }
  for (let k = 0; k < 64; k++) { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, depthWrite: false, transparent: true })); sp.visible = false; scene.add(sp); smokes.push({ sp, t: 1, life: 1, size: 1, vy: 0 }); }
  for (let k = 0; k < 4; k++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0x6EC8FF, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })); m.visible = false; scene.add(m); domes.push({ m, t: 1, size: 1 }); }
  targetRing = new THREE.Mesh(new THREE.RingGeometry(2.1, 2.6, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFF2A2A, transparent: true, opacity: 0.8, depthWrite: false, depthTest: false }));
  targetRing.renderOrder = 9; targetRing.visible = false; scene.add(targetRing);
  // the missile's lock (core lockedOn): four corner brackets on the car in your sights, closing in and turning as the
  // lock builds, then red and still when it's locked
  reticle = new THREE.Group(); reticle.mat = new THREE.MeshBasicMaterial({ color: 0xFFD23A, transparent: true, opacity: 0.95, depthWrite: false, depthTest: false });
  for (let q = 0; q < 4; q++) { const k = new THREE.Group(); k.add(box(0.7, 0.06, 0.16, reticle.mat, 0.65, 0, 1), box(0.16, 0.06, 0.7, reticle.mat, 1, 0, 0.65)); k.children.forEach(m => { m.renderOrder = 9; }); k.rotation.y = q * Math.PI / 2; reticle.add(k); }   // an L at each corner
  reticle.dot = new THREE.Mesh(new THREE.RingGeometry(0.25, 0.42, 16).rotateX(-Math.PI / 2), reticle.mat); reticle.dot.renderOrder = 9; reticle.add(reticle.dot);
  reticle.visible = false; scene.add(reticle);
  // mortar shells: an olive shell with a red band and tail fins, lobbed along an arc; where each will land, a ring on
  // the road filling in as it falls
  const olive = L(0x56603F), band = L(0xC23A2A);
  shellPool = [];
  for (let k = 0; k < 9; k++) {
    const g = new THREE.Group(); g.add(cyl(0.22, 0.9, olive)); const nose = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), olive); nose.position.z = 0.45; g.add(nose);
    g.add(cyl(0.225, 0.12, band, 0, 0, 0.2)); for (let f = 0; f < 4; f++) { const fin = box(0.03, 0.3, 0.26, L(0x3C4430), 0, 0, -0.5); fin.rotation.z = f * Math.PI / 2 + Math.PI / 4; fin.translateY(0.2); g.add(fin); }
    g.scale.setScalar(2.2); g.visible = false; scene.add(g);
    const mark = new THREE.Group(), mm = new THREE.MeshBasicMaterial({ color: 0xFF3A2A, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false });
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 40).rotateX(-Math.PI / 2), mm), fill = new THREE.Mesh(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFF3A2A, transparent: true, opacity: 0.28, depthWrite: false, depthTest: false }));
    const cross = mergeAll([new THREE.PlaneGeometry(0.08, 0.7).rotateX(-Math.PI / 2), new THREE.PlaneGeometry(0.7, 0.08).rotateX(-Math.PI / 2)]); mark.add(ring, fill, new THREE.Mesh(cross, mm));
    mark.children.forEach(m => { m.renderOrder = 9; }); mark.fill = fill; mark.visible = false; scene.add(mark);
    shellPool.push({ g, id: -1 }); markPool.push(mark);
  }
  // craters: a scorched bowl in the road (a dark decal, cracks running out) inside a rim of broken road and dirt
  const crTex = canvasTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(18,15,12,0.98)'); gr.addColorStop(0.45, 'rgba(42,34,27,0.95)'); gr.addColorStop(0.72, 'rgba(70,58,44,0.8)'); gr.addColorStop(1, 'rgba(40,34,28,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
    g.strokeStyle = 'rgba(15,12,10,0.8)'; g.lineWidth = 2; for (let k = 0; k < 11; k++) { const a = k / 11 * Math.PI * 2 + Math.sin(k * 7) * 0.3; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * w * 0.3, h / 2 + Math.sin(a) * h * 0.3); g.lineTo(w / 2 + Math.cos(a + 0.12) * w * 0.42, h / 2 + Math.sin(a + 0.12) * h * 0.42); g.lineTo(w / 2 + Math.cos(a - 0.05) * w * 0.49, h / 2 + Math.sin(a - 0.05) * h * 0.49); g.stroke(); }
    for (let k = 0; k < 40; k++) { const a = Math.random() * Math.PI * 2, r = w * (0.2 + Math.random() * 0.28); g.fillStyle = Math.random() < 0.5 ? 'rgba(90,84,76,0.9)' : 'rgba(30,26,22,0.9)'; g.fillRect(w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r, 2 + Math.random() * 3, 2 + Math.random() * 3); }
  });
  const rimG = new THREE.TorusGeometry(1, 0.2, 5, 18).rotateX(Math.PI / 2).scale(1, 0.55, 1), lumps = [];
  for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.3; lumps.push(new THREE.DodecahedronGeometry(0.16 + (k % 3) * 0.05, 0).translate(Math.cos(a) * 1.15, 0.06, Math.sin(a) * 1.15)); }
  const lumpG = mergeAll(lumps);
  craterPool = [];
  for (let k = 0; k < 16; k++) {
    const g = new THREE.Group(), dec = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 2.6).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ map: crTex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }));
    dec.renderOrder = 2; g.add(dec); const rim = new THREE.Mesh(rimG, L(0x4E4438)); rim.receiveShadow = true; g.add(rim); const lu = new THREE.Mesh(lumpG, L(0x6A625A)); lu.castShadow = true; g.add(lu);
    g.visible = false; scene.add(g); craterPool.push(g);
  }
}
const glowTex = () => G.glowTex || (G.glowTex = canvasTex(64, 64, (g, w, h) => { const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.45)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); }));
/** A glowing flash that swells and fades: fireballs, muzzle flashes, hits. */
export function flash(x, y, z, size, color, life = 0.35) { const f = flashes[fi]; fi = (fi + 1) % flashes.length; if (!f) return; f.sp.position.set(x, y, z); f.sp.material.color.set(color); f.t = 0; f.life = life; f.size = size; f.sp.visible = true; }
/** A soft smoke puff that rises, swells and thins out. */
export function smoke(x, y, z, size, color, life = 1.6, vy = 1.5) { const f = smokes[si]; si = (si + 1) % smokes.length; if (!f) return; f.sp.position.set(x, y, z); f.sp.material.color.set(color); f.t = 0; f.life = life; f.size = size; f.vy = vy; f.sp.visible = true; }
function dome(x, y, z, size, color) { const d = domes[di]; di = (di + 1) % domes.length; if (!d) return; d.m.position.set(x, y, z); d.m.material.color.set(color); d.t = 0; d.size = size; d.m.visible = true; }
function updateFx(dt) {
  if (later.length) { for (const l of later) l.t -= dt; const due = later.filter(l => l.t <= 0); later = later.filter(l => l.t > 0); due.forEach(l => l.fn()); }   // billowing blasts: their later puffs
  for (const k of scorches) { if (k.t > 30) continue; k.t += dt; k.m.material.opacity = Math.min(1, (30 - k.t) / 8); if (k.t > 30) k.m.visible = false; }
  for (const f of flashes) { if (f.t >= f.life) continue; f.t += dt; const k = Math.min(1, f.t / f.life), sc = f.size * (0.5 + 0.8 * Math.sqrt(k)); f.sp.scale.set(sc, sc, 1); f.sp.material.opacity = k < 0.4 ? 1 : 1 - (k - 0.4) / 0.6; if (k >= 1) f.sp.visible = false; }
  for (const f of smokes) { if (f.t >= f.life) continue; f.t += dt; const k = Math.min(1, f.t / f.life), sc = f.size * (0.6 + 0.9 * k); f.sp.position.y += f.vy * dt * (1 - k); f.sp.scale.set(sc, sc, 1); f.sp.material.opacity = 0.85 * (1 - k) * Math.min(1, f.t * 8); if (k >= 1) f.sp.visible = false; }
  for (const d of domes) { if (d.t >= 1) continue; d.t += dt / 0.45; const k = Math.min(1, d.t), e = 1 - Math.pow(1 - k, 3); d.m.scale.set(d.size * (0.15 + e), d.size * (0.15 + e) * 0.45, d.size * (0.15 + e)); d.m.material.opacity = 0.45 * (1 - k); if (k >= 1) d.m.visible = false; }
}
function place(g, tr, s, lat, up, prev) {
  const p = roadPos(tr, s, lat, up), n = roadPos(tr, s + 1, lat, up);
  g.position.set(p.x, p.y, p.z); g.rotation.set(0, Math.atan2(n.x - p.x, n.z - p.z), 0); return p;
}
export function updateWeaponVis(dt, now) {
  if (G.state !== 'paused') updateFx(dt);
  const tr = G.world && G.world.tr, R = race, S = R && R.wpn, on = tr && G.state !== 'menu';
  if (targetRing) targetRing.visible = false;
  if (reticle) reticle.visible = false;
  for (const p of shellPool) p.g.visible = false; for (const m of markPool) m.visible = false; for (const g of craterPool) g.visible = false;
  for (const p of missiles) p.g.visible = false; for (const c of crates) c.g.visible = false; for (const m of slickPool) m.visible = false; for (const m of cementPool) m.visible = false; for (const m of jetPool) m.visible = false; for (const m of stripPool) m.visible = false; for (const m of minePool) m.g.visible = false; for (const d of drumPool) d.g.visible = false; for (const h of hookPool) { h.g.visible = false; h.line.visible = false; }
  if (tracers) tracers.count = 0;
  if (!on || !R) return;
  const P = R.player, pw = P && P.wpn;
  if (reticle && pw && pw.item === 'missile' && pw.lockTgt >= 0 && R.cars[pw.lockTgt]) {
    const T = R.cars[pw.lockTgt], k = pw.lockK || 0, locked = k >= 1, sz = Math.max(T.hl || 2.2, 2.2) * 1.3;   // corners just outside the car
    reticle.visible = true; reticle.position.set(T.dx ?? T.x, (T.dy ?? T.y) + 0.4, T.dz ?? T.z);
    reticle.rotation.y = locked ? T.yaw : T.yaw + (1 - k) * 2.4 + now * 3 * (1 - k);
    reticle.scale.setScalar(sz * (locked ? 1 + 0.08 * Math.sin(now * 20) : 2.2 - 1.2 * k));
    reticle.mat.color.setHex(locked ? (Math.sin(now * 20) > 0 ? 0xFF2A2A : 0xFFFFFF) : 0xFFD23A);   // locked: flashing red and white, so it shows on any car
    reticle.dot.visible = locked;
  }
  (R.missiles || []).forEach((m, k) => {
    const p = missiles[k % missiles.length], pos = missilePos(tr, m);
    const dx = p.id === m.id && p.last ? pos.x - p.last.x : tr.tx[pos.i], dz = p.id === m.id && p.last ? pos.z - p.last.z : tr.tz[pos.i];
    p.g.visible = true; p.g.position.set(pos.x, pos.y, pos.z); p.g.rotation.set(0, Math.atan2(dx, dz), 0);
    p.fl.scale.set(1, 1, 0.8 + 0.4 * Math.sin(now * 60 + k)); const gs = 1.4 + 0.5 * Math.sin(now * 47 + k); p.glow.scale.set(gs, gs, 1);
    const T = R.cars[m.tgt]; if (T && k === 0 && targetRing) { targetRing.visible = true; targetRing.position.set(T.dx ?? T.x, (T.dy ?? T.y) + 0.15, T.dz ?? T.z); const pul = 1 + 0.15 * Math.sin(now * 18); targetRing.scale.set(pul, 1, pul); }   // who it's after
    if (G.state === 'racing' && p.id === m.id && p.last) {                                   // exhaust: a smoke trail (a puff every 50 ms) and sparks
      const bx = pos.x - Math.sin(p.g.rotation.y) * 2.6, bz = pos.z - Math.cos(p.g.rotation.y) * 2.6;
      if ((p.puffT = (p.puffT || 0) - dt) <= 0) { p.puffT = 0.03; smoke(bx, pos.y, bz, 1.3 + Math.random() * 0.6, 0xEDEDE8, 1.2, 0.3); }
      emit(bx, pos.y, bz, (Math.random() - 0.5) * 1.5, 0.8 + Math.random(), (Math.random() - 0.5) * 1.5, 0.35, 0.4, 0xFFB03A, -0.5);
    }
    p.id = m.id; p.last = pos;
  });
  if (!S) return;
  // mortar shells on their arcs, the rings where they'll come down, and the craters they've left
  (S.shells || []).forEach((sh, j) => {
    if (j >= shellPool.length) return;
    const land = roadPos(tr, sh.s, sh.lat, 0), mk = markPool[j], u = sh.wait > 0 ? 0 : Math.min(1, sh.t / WPN.MORTAR_FLIGHT);
    mk.visible = true; mk.position.set(land.x, land.y + 0.12, land.z); mk.scale.setScalar(sh.r); mk.fill.scale.setScalar(Math.max(0.02, u)); mk.rotation.y = now * 0.8;
    if (sh.wait > 0) return;
    const H = Math.max(16, Math.hypot(land.x - sh.x0, land.z - sh.z0) * 0.3), at = v => [sh.x0 + (land.x - sh.x0) * v, sh.y0 + (land.y - sh.y0) * v + H * 4 * v * (1 - v), sh.z0 + (land.z - sh.z0) * v];
    const [x, y, z] = at(u), [x2, y2, z2] = at(Math.min(1, u + 0.02)), p = shellPool[j];
    p.g.visible = true; p.g.position.set(x, y, z); p.g.lookAt(x2 + (x2 - x) * 10, y2 + (y2 - y) * 10, z2 + (z2 - z) * 10);
    if (G.state === 'racing' && (p.puffT = (p.puffT || 0) - dt) <= 0) { p.puffT = 0.04; smoke(x, y, z, 1.1, 0xD8D8D0, 0.7, 0.2); }
  });
  (S.craters || []).forEach((k, j) => {
    const g = craterPool[j % craterPool.length], f = Math.min(1, k.t * 12); g.visible = true;
    g.position.set(k.x, k.y + 0.05, k.z); g.rotation.y = k.id * 2.3; g.scale.set(k.r * f, k.r * (0.7 + 0.3 * f), k.r * f);
  });
  S.crates.forEach((k, j) => { const c = crates[j % crates.length]; place(c.g, tr, k.s, k.lat, 1.3 + Math.sin(now * 2.5 + k.id) * 0.2); c.g.visible = true; c.b.rotation.set(now * 0.9 + k.id, now * 1.3, 0); c.r.material.opacity = 0.3 + 0.2 * Math.sin(now * 4 + k.id); });
  let nb = 0;
  for (const b of S.bullets) {
    if (nb >= MAXB) break;
    const sp = Math.hypot(b.vx, b.vz) || 1, back = Math.min(1.6, b.t * sp / 2);            // tail behind the round, never back past the gun
    _q.setFromAxisAngle(_y, Math.atan2(b.vx, b.vz)); _m.compose(_p.set(b.x - b.vx / sp * back, b.y, b.z - b.vz / sp * back), _q, _s.set(1, 1, back / 1.6)); tracers.setMatrixAt(nb++, _m);
  }
  streaks = streaks.filter(k => (k.t -= dt) > 0);                                   // rounds that hit within a frame or two: gun to target
  for (const k of streaks) {
    if (nb >= MAXB) break;
    const dx = k.b.x - k.a.x, dy = k.b.y - k.a.y, dz = k.b.z - k.a.z, L = Math.hypot(dx, dy, dz);
    _q.setFromAxisAngle(_y, Math.atan2(dx, dz)); _m.compose(_p.set((k.a.x + k.b.x) / 2, (k.a.y + k.b.y) / 2, (k.a.z + k.b.z) / 2), _q, _s.set(1, 1, L / 3.2)); tracers.setMatrixAt(nb++, _m);
  }
  tracers.count = nb;
  if (tracers.count) tracers.instanceMatrix.needsUpdate = true;
  S.slicks.forEach((o, j) => { const m = slickPool[j % slickPool.length], p = roadPos(tr, o.s, o.lat, 0.1); m.position.set(p.x, p.y, p.z); m.rotation.y = o.id; m.visible = true; const k = Math.min(1, o.t * 4) * (1 - (o.hits || 0) * 0.18); m.scale.setScalar(Math.max(0.3, k)); });
  (S.cement || []).forEach((o, j) => { const m = cementPool[j % cementPool.length], p = roadPos(tr, o.s, o.lat, 0.09); m.position.set(p.x, p.y, p.z); m.rotation.y = o.id * 1.7; m.visible = true; const k = Math.min(1, o.t * 5) * (o.t > WPN.CEMENT_LIFE - 2 ? (WPN.CEMENT_LIFE - o.t) / 2 : 1); m.scale.setScalar(Math.max(0.05, k)); });
  (S.drums || []).forEach((o, j) => { const v = drumPool[j % drumPool.length], p = drumPos(tr, o); v.g.visible = true; v.g.position.set(p.x, p.y, p.z); v.g.rotation.set(Math.PI / 2 + o.t * (6 + o.vs * 0.25), tr.th[p.i] + (o.id % 2 ? 0.4 : -0.4), 0); });   // tumbling end over end
  // mines dropped off the back fall and settle (drop); the light blinks faster once armed
  (S.mines || []).forEach((o, j) => { const v = minePool[j % minePool.length], drop = Math.max(0, 1 - o.t / 0.3); v.g.position.set(o.x, o.y + 0.02 + 1.1 * drop * drop, o.z); v.g.rotation.y = o.id; v.g.visible = true; v.lamp.visible = o.t < WPN.MINE_ARM ? Math.floor(now * 3) % 2 === 0 : Math.floor(now * 9) % 2 === 0; });
  (S.strips || []).forEach((o, j) => { const m = stripPool[j % stripPool.length], p = roadPos(tr, o.s, 0, 0.02); m.position.set(p.x, p.y, p.z); m.rotation.y = tr.th[p.i]; m.visible = true; });
  // the jets and tunes playing right now: the fire engine's water, the ice cream van's notes
  let nj = 0;
  for (const c of R.cars) {   // the jets (drawn even when paused)
    const w = c.wpn; if (!w || !(w.waterT > 0) || nj >= jetPool.length) continue;
    const m = jetPool[nj++], fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), L = WPN.WATER_R * (0.85 + 0.1 * Math.sin(now * 23 + nj));
    m.visible = true; m.position.set((c.dx ?? c.x) + fx * (c.hl + 0.3), (c.dy ?? c.y) + 1.5, (c.dz ?? c.z) + fz * (c.hl + 0.3)); m.rotation.set(-0.06, c.yaw, 0); m.scale.set(1 + 0.15 * Math.sin(now * 31), 1, L); m.material.opacity = 0.35 + 0.15 * Math.sin(now * 17);
  }
  if (G.state === 'racing') for (const c of R.cars) {
    const w = c.wpn; if (!w) continue;
    if (w.waterT > 0) { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), x = (c.dx ?? c.x) + fx * (c.hl + 0.4), y = (c.dy ?? c.y) + 1.7, z = (c.dz ?? c.z) + fz * (c.hl + 0.4);
      for (let k = 0; k < 6; k++) { const a = (Math.random() - 0.5) * WPN.WATER_CONE * 0.8, sp = 26 + Math.random() * 10, dx = Math.sin(c.yaw + a), dz = Math.cos(c.yaw + a); emit(x, y, z, c.vx + dx * sp, 1.5 + Math.random() * 2, c.vz + dz * sp, 0.7, 0.9 + Math.random() * 0.6, k % 3 ? 0xCFE8FF : 0xFFFFFF, -9, 'solid'); } }
    if (w.jingleT > 0 && Math.random() < dt * 9) { const a = Math.random() * Math.PI * 2; emit((c.dx ?? c.x) + Math.cos(a) * 1.2, (c.dy ?? c.y) + 2.6, (c.dz ?? c.z) + Math.sin(a) * 1.2, Math.cos(a) * 2, 2.5, Math.sin(a) * 2, 1.2, 0.45, [0xF46FAE, 0xFFD21F, 0x8FD3FF][Math.floor(Math.random() * 3)], 1, 'solid'); }
    if (w.jingleT > 0 && Math.floor(w.jingleT * 2) !== w.ringK) { w.ringK = Math.floor(w.jingleT * 2); shockwave(c.x, c.y, c.z, (w.jingleR || WPN.JINGLE_R) * 0.9, 0xF6B8D0); }
  }
  S.hooks.forEach((h, j) => {
    const v = hookPool[j % hookPool.length], A = R.cars[h.from], T = h.to >= 0 ? R.cars[h.to] : null;
    const p = h.tow && T ? { x: T.dx ?? T.x, y: (T.dy ?? T.y) + 0.9, z: T.dz ?? T.z } : place(v.g, tr, h.s, h.lat, 1.0);
    if (h.tow && T) { v.g.position.set(p.x, p.y, p.z); v.g.rotation.set(0, T.yaw + Math.PI, 0); }
    v.g.visible = true; v.line.visible = true;
    const a = v.line.geometry.attributes.position; a.setXYZ(0, A.dx ?? A.x, (A.dy ?? A.y) + 1.3, A.dz ?? A.z); a.setXYZ(1, p.x, p.y, p.z); a.needsUpdate = true;
  });
}
/** A missile hitting a car: fireball, smoke, sparks and bits, a shock ring. */
/** A scorch mark on the ground at (x, y, z), r metres across, fading over half a minute. */
export function scorch(x, y, z, r) { const k = scorches[sci]; sci = (sci + 1) % scorches.length; if (!k) return; k.m.position.set(x, y + 0.06, z); k.m.scale.set(r, 1, r); k.m.rotation.y = Math.random() * 6.28; k.m.visible = true; k.t = 0; }
/** A fireball that keeps billowing: a few more flashes and puffs over the next quarter second, rising. */
function billow(x, y, z, size) { for (let q = 1; q <= 4; q++) later.push({ t: q * 0.06, fn: () => { flash(x + (Math.random() - 0.5) * size * 0.4, y + q * size * 0.12, z + (Math.random() - 0.5) * size * 0.4, size * (0.9 - q * 0.12), q < 3 ? 0xFFFFFF : 0xFFC080, 0.5); smoke(x, y + q * size * 0.15, z, size * 0.5, 0x3A3632, 2.2, 2.5); } }); }
export function missileBlast(e) {
  billow(e.x, e.y + 1, e.z, 9); scorch(e.x, (G.world && G.world.terr ? G.world.terr.at(e.x, e.z) : e.y - 1.1), e.z, 5);
  shockwave(e.x, e.y - 1, e.z, 9, 0xFF7A2E); flash(e.x, e.y + 1.5, e.z, 13, 0xFFFFFF, 0.5); flash(e.x, e.y + 2.2, e.z, 8, 0xFFFFFF, 0.8);
  for (let k = 0; k < 6; k++) smoke(e.x + (Math.random() - 0.5) * 3, e.y + 1 + Math.random() * 1.5, e.z + (Math.random() - 0.5) * 3, 4 + Math.random() * 3, k < 2 ? 0x7A5A48 : 0x4A4A4A, 1.6 + Math.random() * 0.8, 2 + Math.random() * 1.5);
  for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 7; emit(e.x, e.y, e.z, Math.cos(a) * s, 2 + Math.random() * 6, Math.sin(a) * s, 0.4 + Math.random() * 0.4, 1.2 + Math.random(), Math.random() < 0.5 ? 0xFFB03A : 0xFF5A1E, -2); }
  for (let k = 0; k < 8; k++) emit(e.x + (Math.random() - 0.5) * 2, e.y + Math.random(), e.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 3, 2 + Math.random() * 3, (Math.random() - 0.5) * 3, 1.2 + Math.random() * 0.8, 1.6 + Math.random(), Math.random() < 0.5 ? 0x4A4A4A : 0x6E6E6E, -1.2);
  for (let k = 0; k < 8; k++) debris(e.x, e.y, e.z, (Math.random() - 0.5) * 12, 4 + Math.random() * 6, (Math.random() - 0.5) * 12, 0x2A2A2A, 0.2, 0.08, 0.3, 1.4);
}
/** An oil drum hitting the road: a clang, a scuff of dust and a spark or two. */
export function drumBounceFx(e) { for (let k = 0; k < 6; k++) emit(e.x, e.y + 0.2, e.z, (Math.random() - 0.5) * 3, 0.6 + Math.random(), (Math.random() - 0.5) * 3, 0.5, 0.6, 0x9A9488, -2); }
/** An oil drum bursting: black oil thrown out in a ring, bits of drum; on a car, a whoomph of flame too. */
export function drumBurstFx(e) {
  const r = (e.r || WPN.OIL_R) * 0.9;
  for (let k = 0; k < 34; k++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6; emit(e.x, e.y + 0.4, e.z, Math.cos(a) * s, 1.5 + Math.random() * 4, Math.sin(a) * s, 0.6 + Math.random() * 0.3, 0.3 + Math.random() * 0.3, k % 4 ? 0x0C0C10 : 0x3A2E48, -9, 'solid'); }
  for (let k = 0; k < 5; k++) debris(e.x, e.y + 0.4, e.z, (Math.random() - 0.5) * 9, 3 + Math.random() * 5, (Math.random() - 0.5) * 9, k % 2 ? 0x2A3A52 : 0xFFC72C, 0.35, 0.05, 0.3, 1.6);
  shockwave(e.x, e.y + 0.05, e.z, r, 0x1A1820);
  if (e.onCar) { flash(e.x, e.y + 1.2, e.z, 6, 0xFFFFFF, 0.35); for (let k = 0; k < 3; k++) smoke(e.x + (Math.random() - 0.5) * 2, e.y + 1, e.z + (Math.random() - 0.5) * 2, 3, 0x2A2A2E, 1.4, 1.6); }
}
/** A mine going off: a ground-hugging fireball, dirt thrown up, a shock ring. */
export function mineBlast(e) {
  const r = e.r || WPN.MINE_BLAST; shockwave(e.x, e.y + 0.1, e.z, r * 1.6, 0xFF8A3A); flash(e.x, e.y + 0.8, e.z, r * 2.2, 0xFFFFFF, 0.45);
  for (let k = 0; k < 5; k++) smoke(e.x + (Math.random() - 0.5) * 2, e.y + 0.6 + Math.random(), e.z + (Math.random() - 0.5) * 2, 3 + Math.random() * 2.5, k < 2 ? 0x6E5A44 : 0x4A4A4A, 1.4 + Math.random() * 0.6, 1.8);
  for (let k = 0; k < 18; k++) { const a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 8; emit(e.x, e.y + 0.3, e.z, Math.cos(a) * s, 4 + Math.random() * 7, Math.sin(a) * s, 0.7, 0.5, k % 3 ? 0x5E4A36 : 0xFF9A3A, -9, 'solid'); }
}
/** A mortar shell landing: a fireball, a column of dirt and broken road thrown up, a ring of dust rolling out. */
export function mortarBlast(e) {
  const r = e.r || WPN.MORTAR_R;
  billow(e.x, e.y + 1.5, e.z, r * 1.8); scorch(e.x, e.y, e.z, r * 2.2);
  shockwave(e.x, e.y + 0.2, e.z, r * 1.7, 0xFF8A3A); shockwave(e.x, e.y + 0.4, e.z, r * 1.1, 0xC9A26A); flash(e.x, e.y + 2, e.z, r * 2.6, 0xFFFFFF, 0.55); flash(e.x, e.y + 4, e.z, r * 1.5, 0xFFE0A0, 0.9);
  for (let k = 0; k < 9; k++) smoke(e.x + (Math.random() - 0.5) * r, e.y + 1 + Math.random() * 3, e.z + (Math.random() - 0.5) * r, 4 + Math.random() * 4, k < 4 ? 0x5E4E40 : 0x3E3A36, 2 + Math.random(), 2.5 + Math.random() * 2);
  for (let k = 0; k < 26; k++) { const a = Math.random() * Math.PI * 2, s = 2 + Math.random() * 6; emit(e.x, e.y + 0.3, e.z, Math.cos(a) * s, 8 + Math.random() * 10, Math.sin(a) * s, 0.8 + Math.random() * 0.6, 0.35 + Math.random() * 0.3, Math.random() < 0.6 ? 0x6E5A44 : 0x3A342E, -9, 'solid'); }
  for (let k = 0; k < 16; k++) { const a = Math.random() * Math.PI * 2, s = 3 + Math.random() * 8; emit(e.x, e.y + 1, e.z, Math.cos(a) * s, 3 + Math.random() * 6, Math.sin(a) * s, 0.4 + Math.random() * 0.4, 1.4 + Math.random(), Math.random() < 0.5 ? 0xFFB03A : 0xFF5A1E, -2); }
  for (let k = 0; k < 12; k++) debris(e.x, e.y + 0.3, e.z, (Math.random() - 0.5) * 14, 6 + Math.random() * 8, (Math.random() - 0.5) * 14, k % 2 ? 0x55514C : 0x6E5A44, 0.3 + Math.random() * 0.3, 0.12, 0.3 + Math.random() * 0.2, 1.8);
}
/** The mortar firing: a flash and a puff of smoke out of the tube on the roof. */
export function mortarLaunchFx(c) { flash(c.x, c.y + 2.6, c.z, 3, 0xFFE0A0, 0.2); for (let k = 0; k < 5; k++) smoke(c.x + (Math.random() - 0.5), c.y + 2.6, c.z + (Math.random() - 0.5), 1.6, 0xE0DED8, 1, 3); }
/** A car bouncing through a crater: grit and dust kicked up. */
export function craterHitFx(e) { for (let k = 0; k < 10; k++) emit(e.x, e.y + 0.3, e.z, (Math.random() - 0.5) * 5, 2 + Math.random() * 3, (Math.random() - 0.5) * 5, 0.6, 0.3, 0x5E544A, -9, 'solid'); smoke(e.x, e.y + 0.6, e.z, 2.5, 0x9C8E7C, 1, 1); }
export function missilePuff(e) { flash(e.x, e.y, e.z, 4, 0xFFFFFF, 0.3); for (let k = 0; k < 10; k++) emit(e.x, e.y, e.z, (Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3, 0.8, 1.2, 0x9A9A9A, -0.8); }
export function pickupFx(e) { shockwave(e.x, e.y, e.z, 3.5, 0xFFC72C); for (let k = 0; k < 14; k++) emit(e.x, e.y + 1.2, e.z, (Math.random() - 0.5) * 6, 3 + Math.random() * 4, (Math.random() - 0.5) * 6, 0.5, 0.5, k % 2 ? 0xFFC72C : 0x8A5A2B, -3, 'solid'); }
export function pulseFx(c) { const PR = (c.wpn && c.wpn.pulseR) || WPN.PULSE_R; dome(c.x, c.y, c.z, PR, 0x6EC8FF); flash(c.x, c.y + 1, c.z, 7, 0x9ADCFF, 0.3); shockwave(c.x, c.y, c.z, PR, 0x6EC8FF); shockwave(c.x, c.y + 0.5, c.z, PR * 0.6, 0xCFEFFF); for (let k = 0; k < 30; k++) { const a = k / 30 * Math.PI * 2; emit(c.x, c.y + 0.8, c.z, Math.cos(a) * 16, 0.5, Math.sin(a) * 16, 0.4, 0.6, 0x9ADCFF, 0); } }
export function oilDropFx(c) { const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw); for (let k = 0; k < 10; k++) emit(c.x - fx * 2.2, c.y + 0.5, c.z - fz * 2.2, (Math.random() - 0.5) * 2, 1 + Math.random() * 2, (Math.random() - 0.5) * 2, 0.5, 0.4, 0x1A1820, -9, 'solid'); }
/** A round leaving the gun: a bright star at the muzzle, a puff of smoke, and a brass casing kicked out of the side. */
export function muzzleFx(c) {
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw), x = (c.dx ?? c.x) + fx * (c.hl + 0.9), y = (c.dy ?? c.y) + 1.35, z = (c.dz ?? c.z) + fz * (c.hl + 0.9);
  flash(x, y, z, 1.5 + Math.random() * 0.6, 0xFFE9B0, 0.07);
  if (Math.random() < 0.4) smoke(x, y, z, 0.7, 0xD8D8D8, 0.35, 0.25);
  if (Math.random() < 0.6) { const s = Math.random() < 0.5 ? 1 : -1; debris(c.x - fz * s * 0.3, y - 0.1, c.z + fx * s * 0.3, c.vx - fz * s * (2 + Math.random() * 2), 2 + Math.random() * 2, c.vz + fx * s * (2 + Math.random() * 2), 0xD4A13A, 0.06, 0.06, 0.16, 0.8, c.pr.i); }
}
export function bulletHitFx(e, from) {
  if (from) streaks.push({ a: { x: from.dx ?? from.x, y: (from.dy ?? from.y) + 1.4, z: from.dz ?? from.z }, b: { x: e.x, y: e.y + 0.8, z: e.z }, t: 0.09 }); flash(e.x, e.y + 0.4, e.z, 1.6, 0xFFFFFF, 0.12); for (let k = 0; k < 6; k++) emit(e.x, e.y, e.z, (Math.random() - 0.5) * 6, 1 + Math.random() * 3, (Math.random() - 0.5) * 6, 0.25, 0.25, 0xFFD27A, -4); }

/** The monster truck landing on its crush: a dust ring, the ground shaking, bits flying. */
export function crushFx(e) {
  shockwave(e.x, e.y, e.z, e.r || WPN.CRUSH_R, 0xC9A26A); shockwave(e.x, e.y + 0.3, e.z, (e.r || WPN.CRUSH_R) * 0.6, 0xE8D5B0);
  for (let k = 0; k < 8; k++) smoke(e.x + (Math.random() - 0.5) * 5, e.y + 0.5, e.z + (Math.random() - 0.5) * 5, 3 + Math.random() * 2, 0xB79C78, 1.4, 1);
  for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; emit(e.x, e.y + 0.3, e.z, Math.cos(a) * 11, 2 + Math.random() * 3, Math.sin(a) * 11, 0.5, 0.6, 0x8A7356, -9, 'solid'); }
}
/** A shield taking a hit (gear): a blue bubble round the car. */
export function shieldFx(c) { dome(c.x, c.y, c.z, 3.4, 0x7FD4FF); flash(c.x, c.y + 1, c.z, 4, 0xBFE8FF, 0.25); }
/** Flares (gear): hot sparks fired up and back, drawing the missile off. */
export function flaresFx(c) {
  const fx = Math.sin(c.yaw), fz = Math.cos(c.yaw);
  for (let k = 0; k < 10; k++) { const s = k % 2 ? 1 : -1; emit(c.x - fx, c.y + 1.6, c.z - fz, c.vx * 0.6 - fx * 6 - fz * s * (3 + k), 7 + Math.random() * 3, c.vz * 0.6 - fz * 6 + fx * s * (3 + k), 1.4, 0.6, k % 3 ? 0xFFE08A : 0xFFFFFF, 6, 'solid'); }
  flash(c.x, c.y + 2, c.z, 5, 0xFFE08A, 0.3);
}
/** A stinger puncture or a car bogging down in cement. */
export function stingerFx(e) { flash(e.x, e.y + 0.4, e.z, 2, 0xFFFFFF, 0.12); for (let k = 0; k < 10; k++) emit(e.x, e.y + 0.3, e.z, (Math.random() - 0.5) * 6, 1 + Math.random() * 2, (Math.random() - 0.5) * 6, 0.6, 0.3, 0x2A2A2A, -9, 'solid'); }

// ---------- weapon mounts on the cars ----------
// Every car has a mount under its roof: when it's holding a weapon, that weapon's module rises out of the roof
// (missile pod, twin guns, oil drum, pulse coil, harpoon gun); firing kicks it back, and once the weapon is spent the
// mount sinks away again. Built the first time a car picks something up.
function module(item) {
  const g = new THREE.Group(), dark = L(0x2E333B), steel = L(0x9AA3AD), yel = L(0xFFC72C), red = L(0xD8203A);
  if (item === 'missile') {   // a launcher: a base and a frame with two rails, a missile on each (white, red nose and fins)
    const wht = L(0xF2F2EE); g.add(box(0.9, 0.16, 1.0, dark)); g.add(box(0.12, 0.3, 0.5, dark, 0, 0.18, -0.1));
    for (const s of [-1, 1]) { g.add(box(0.08, 0.05, 1.2, steel, s * 0.24, 0.3, 0.1)); g.add(cyl(0.11, 1.0, wht, s * 0.24, 0.42, 0.15)); const tip = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.3, 8).rotateX(Math.PI / 2), red); tip.position.set(s * 0.24, 0.42, 0.8); g.add(tip); for (const f of [-1, 1]) g.add(box(0.02, 0.2, 0.18, red, s * 0.24 + f * 0.12, 0.42, -0.28)); }
    g.rotation.x = -0.15;
  }
  else if (item === 'gun') {   // a rotary gun: six barrels round a spinning rotor, a shroud and front ring, an ammo box on the side
    g.add(box(0.5, 0.34, 0.62, dark)); g.add(box(0.26, 0.26, 0.4, L(0x4B5A3A), 0.36, -0.02, -0.05));
    const rotor = new THREE.Group(); rotor.position.set(0, 0.04, 0.3); g.add(rotor);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2; rotor.add(cyl(0.035, 1.05, steel, Math.cos(a) * 0.09, Math.sin(a) * 0.09, 0.5)); }
    rotor.add(cyl(0.15, 0.3, dark, 0, 0, 0.12)); const ring = new THREE.Mesh(new THREE.TorusGeometry(0.12, 0.025, 6, 14), dark); ring.position.z = 0.9; rotor.add(ring);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xFFD27A, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); fl.scale.set(1.3, 1.3, 1); fl.position.set(0, 0.04, 1.45); fl.visible = false; g.add(fl);
    g.userData.flash = fl; g.userData.rotor = rotor;
  }
  else if (item === 'oil') { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.8, 12).rotateZ(Math.PI / 2), L(0x1C1C22)); g.add(d); g.add(box(0.82, 0.1, 0.72, yel)); g.add(cyl(0.07, 0.5, steel, 0, -0.1, -0.5)); g.position.z = -0.4; }
  else if (item === 'pulse') { const t = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.09, 8, 20).rotateX(Math.PI / 2), steel); g.add(t); const core = new THREE.Mesh(new THREE.SphereGeometry(0.26, 12, 8), new THREE.MeshBasicMaterial({ color: 0x6EC8FF })); core.position.y = 0.2; g.add(core); g.add(cyl(0.05, 0.5, steel, 0, 0.05, 0).rotateX(Math.PI / 2)); g.userData.core = core; }
  else if (item === 'harpoon') { g.add(box(0.36, 0.32, 0.5, dark)); g.add(cyl(0.12, 1.2, steel, 0, 0.06, 0.4)); const head = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.38, 6).rotateX(Math.PI / 2), L(0x3A3F46)); head.position.set(0, 0.06, 1.12); g.add(head); g.userData.head = head; }
  else if (item === 'mortar') { g.add(box(0.8, 0.12, 0.8, dark)); const tube = new THREE.Group(); tube.add(cyl(0.2, 1.1, L(0x56603F), 0, 0, 0.3)); tube.add(cyl(0.23, 0.14, steel, 0, 0, 0.85)); tube.add(box(0.1, 0.5, 0.1, steel, 0, -0.18, 0.05)); tube.rotation.x = -0.9; tube.position.y = 0.25; g.add(tube); }   // a tube cocked up at the sky
  else if (item === 'water') { g.add(cyl(0.3, 0.3, red, 0, 0, -0.1)); g.add(cyl(0.11, 1.3, steel, 0, 0.05, 0.6)); const tip = cyl(0.16, 0.18, L(0xC9A23A), 0, 0.05, 1.28); g.add(tip); g.rotation.x = -0.12; }
  else if (item === 'cement') { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 0.8, 10).rotateX(Math.PI / 2 - 0.5), L(0x8A8C90)); d.position.z = -0.5; g.add(d); g.add(box(0.3, 0.06, 0.7, L(0x6B6E73), 0, -0.2, -1.0)); }
  else if (item === 'stinger') { g.add(box(1.1, 0.16, 0.36, L(0x22252B))); for (let k = 0; k < 5; k++) g.add(box(0.2, 0.17, 0.37, yel, -0.44 + k * 0.22, 0.005, 0)); g.position.z = -0.5; }
  else if (item === 'crush') { for (let k = 0; k < 3; k++) { const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.06, 6, 14).rotateX(Math.PI / 2), red); t.position.y = k * 0.14; g.add(t); } }
  else if (item === 'mine') { g.add(box(0.9, 0.12, 0.8, dark)); for (const s of [-1, 1]) { const d = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.34, 0.16, 12), L(0x4B5A3A)); d.position.set(s * 0.22, 0.14, 0); g.add(d); const lp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 4), B(0xFF2A2A)); lp.position.set(s * 0.22, 0.26, 0); g.add(lp); } g.position.z = -0.45; }
  else if (item === 'jingle') { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.34, 0.6, 12, 1, true).rotateX(-Math.PI / 2), L(0xF6B8D0)); horn.position.z = 0.3; g.add(horn); g.add(cyl(0.12, 0.4, steel, 0, 0, -0.1)); g.userData.core = horn; }
  g.traverse(o => { if (o.isMesh) o.castShadow = true; });
  return g;
}
export function makeMount(v) {
  // roof height: the body's visible meshes, measured with the car put back at the origin
  const p0 = v.root.position.clone(), q0 = v.root.quaternion.clone(); v.root.position.set(0, 0, 0); v.root.quaternion.identity(); v.root.updateMatrixWorld(true);
  const bb = new THREE.Box3(), tmp = new THREE.Box3();
  v.body.traverse(o => { if (o.isMesh && o.visible && o.geometry && !o.material.transparent) { o.geometry.computeBoundingBox(); tmp.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld); bb.union(tmp); } });
  // the roof anchor: the top of the cabin, over its middle (a wing or a roll cage's lamps stand clear of it)
  const cb = v.cabin && new THREE.Box3().setFromObject(v.cabin), roof = cb && !cb.isEmpty() ? Math.max(cb.max.y, bb.isEmpty() ? 0 : bb.min.y + 0.8) : bb.isEmpty() ? 1.2 : bb.max.y;
  v.root.position.copy(p0); v.root.quaternion.copy(q0); v.root.updateMatrixWorld(true);
  const g = new THREE.Group(); g.position.set(0, roof - 0.05, cb && !cb.isEmpty() ? (cb.min.z + cb.max.z) / 2 : 0); v.body.add(g);
  const mods = {}; for (const it of ITEMS) { const m = module(it); m.visible = false; g.add(m); mods[it] = m; }
  return { g, mods, up: 0, held: null, kick: 0 };
}
export function updateMount(c, v, dt, now) {
  const w = c.wpn, want = w.item || (w.gunT > 0 ? 'gun' : w.waterT > 0 ? 'water' : w.jingleT > 0 ? 'jingle' : w.cementT > 0 ? 'cement' : null);
  if (!want && !v.mount) return;
  if (!v.mount) v.mount = makeMount(v);
  const M = v.mount;
  if (want && want !== M.held) { if (M.held) M.mods[M.held].visible = false; M.held = want; M.up = 0; M.mods[want].visible = true; }
  M.up += ((want ? 1 : 0) - M.up) * Math.min(1, dt * (want ? 7 : 5));
  M.kick *= Math.exp(-dt * 9);
  const m = M.held && M.mods[M.held]; if (!m) return;
  m.visible = M.up > 0.03; m.position.y = (M.up - 1) * 0.6 + 0.1; m.scale.setScalar((0.3 + 0.7 * M.up) * 1.5);   // a size that reads from the race camera
  m.position.z = (M.held === 'oil' ? -0.4 : 0) - M.kick * 0.35; m.rotation.x = (M.held === 'missile' ? -0.18 : 0) - M.kick * 0.25;   // recoil
  if (m.userData.flash) { const on = w.gunT > 0 && Math.floor(now * 30) % 2 === 0, f = m.userData.flash; f.visible = on; if (on) { const k = 0.9 + Math.random() * 0.9; f.scale.set(k, k, 1); f.material.rotation = Math.random() * 6.3; } }
  if (m.userData.rotor) {   // spins up while firing and winds down after; the gun shakes as it fires
    M.spin = (M.spin || 0) + ((w.gunT > 0 ? 38 : 0) - (M.spin || 0)) * Math.min(1, dt * (w.gunT > 0 ? 10 : 2)); m.userData.rotor.rotation.z += M.spin * dt;
    if (w.gunT > 0) { m.position.z -= Math.random() * 0.06; m.rotation.x += (Math.random() - 0.5) * 0.04; }
  }
  if (m.userData.core) m.userData.core.scale.setScalar(1 + 0.25 * Math.sin(now * 12));
  if (m.userData.head) m.userData.head.visible = !!w.item;
  if (!want && M.up < 0.03) M.held = null;
}
export function mountKick(v) { if (v && v.mount) v.mount.kick = 1; }
