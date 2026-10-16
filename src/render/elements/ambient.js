import * as THREE from 'three';
import { G } from '../../game.js';
import { race } from '../../ui/flow.js';
import { camT } from '../camera.js';
import { radialTex } from '../geometry.js';
import { quality } from '../renderer.js';

// Life round the track, looks only (every stage, off on Graphics: Low): a TV helicopter pacing the race leader off to
// one side with its shadow sliding over the ground below, and flocks of birds wheeling over the scenery on fine days
// (not at night, in the rain, in the snow or in a derby arena).
const L = c => new THREE.MeshLambertMaterial({ color: c });
let heli = null, shadow = null, birds = null, flocks = [], terrAt = null;
const H = { up: 24, side: 26, back: 6 }, _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _e = new THREE.Euler();
function makeHeli() {
  const g = new THREE.Group(), white = L(0xF2F2EE), red = L(0xD8203A), dark = L(0x2B2F3A), glass = new THREE.MeshLambertMaterial({ color: 0x253450 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10).scale(1.1, 1.0, 1.8), white); g.add(body);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.85, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2).scale(1.1, 0.9, 1.0), glass); nose.position.set(0, 0.15, 1.1); g.add(nose);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.25, 0.25, 2.6), red); stripe.position.y = -0.2; g.add(stripe);
  const boom = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.32, 4.2, 8).rotateX(Math.PI / 2), white); boom.position.set(0, 0.3, -3.6); g.add(boom);
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.1, 0.8), red); fin.position.set(0, 0.8, -5.5); g.add(fin);
  for (const s of [-1, 1]) { const skid = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 3.2), dark); skid.position.set(s * 0.9, -1.25, 0); g.add(skid); }
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.6, 6), dark); mast.position.y = 1.2; g.add(mast);
  const rotor = new THREE.Group(); rotor.position.y = 1.5; g.add(rotor);
  for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.04, 5.4), dark); b.position.z = 2.7; const arm = new THREE.Group(); arm.rotation.y = k * Math.PI / 2; arm.add(b); rotor.add(arm); }
  const tail = new THREE.Group(); tail.position.set(0.2, 0.8, -5.5); g.add(tail);
  for (let k = 0; k < 2; k++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.04, 1.4, 0.16), dark); b.rotation.x = k * Math.PI / 2; tail.add(b); }
  g.userData = { rotor, tail }; g.scale.setScalar(1.15); g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return g;
}
export function addAmbient(group, terr, stage) {
  terrAt = terr ? (x, z) => terr.at(x, z) : () => 0;
  heli = makeHeli(); heli.visible = false; group.add(heli);
  shadow = new THREE.Mesh(new THREE.CircleGeometry(4.5, 20).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ map: radialTex([[0, 'rgba(0,0,0,0.45)'], [0.6, 'rgba(0,0,0,0.25)'], [1, 'rgba(0,0,0,0)']]), transparent: true, depthWrite: false }));
  shadow.renderOrder = 2; shadow.visible = false; group.add(shadow);
  heli.userData.pos = null;
  // birds: little dark Vs in one instanced mesh, a few flocks circling points that follow the camera at a distance
  birds = null; flocks = [];
  if (stage.night || stage.rain || stage.snowfall || stage.arena) return;
  const wing = new THREE.BufferGeometry(); wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.25, -0.9, 0.18, -0.15, 0, 0, -0.1, 0, 0, 0.25, 0, 0, -0.1, 0.9, 0.18, -0.15], 3)); wing.computeVertexNormals();
  const n = 3 * 9; birds = new THREE.InstancedMesh(wing, new THREE.MeshBasicMaterial({ color: 0x2A2A30, side: THREE.DoubleSide }), n); birds.frustumCulled = false; group.add(birds);
  let s = 17; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let f = 0; f < 3; f++) flocks.push({ ang: r() * 6.28, off: [(r() - 0.5) * 120, (r() - 0.5) * 120], rad: 14 + r() * 10, h: 16 + r() * 8, sp: 0.25 + r() * 0.2, birds: Array.from({ length: 9 }, () => [(r() - 0.5) * 8, (r() - 0.5) * 3, (r() - 0.5) * 8, r() * 6.28]) });
}
export function updateAmbient(dt, now) {
  const on = quality !== 'low' && G.state !== 'menu';
  if (heli) {
    const R = race, lead = R && R.cars && R.cars.length > 1 ? R.cars.reduce((a, c) => (c.progress > a.progress ? c : a), R.cars[0]) : null;
    heli.visible = shadow.visible = !!(on && lead && !(R && R.derby));
    if (heli.visible) {
      const fx = Math.sin(lead.yaw), fz = Math.cos(lead.yaw), x = lead.x + fz * H.side - fx * H.back, z = lead.z - fx * H.side - fz * H.back;
      const want = new THREE.Vector3(x, terrAt(x, z) + H.up, z), P = heli.userData.pos || (heli.userData.pos = want.clone());
      const k = Math.min(1, dt * 1.6), vx = (want.x - P.x) * k, vz = (want.z - P.z) * k; P.x += vx; P.z += vz; P.y += (want.y - P.y) * k;
      heli.position.copy(P); const yaw = Math.atan2(lead.x - P.x, lead.z - P.z);                  // nose on the leader (the camera's at the front)
      heli.rotation.set(Math.min(0.3, Math.hypot(vx, vz) / Math.max(dt, 1e-3) * 0.01), yaw, Math.sin(now * 0.7) * 0.06);
      heli.userData.rotor.rotation.y = now * 30; heli.userData.tail.rotation.x = now * 40;
      shadow.position.set(P.x, terrAt(P.x, P.z) + 0.15, P.z);
    }
  }
  if (!birds) return;
  birds.visible = on; if (!on) return;
  let i = 0;
  for (const f of flocks) {
    f.ang += dt * f.sp; const cx = camT.x + f.off[0] + Math.cos(f.ang) * f.rad, cz = camT.z + f.off[1] + Math.sin(f.ang) * f.rad, cy = terrAt(cx, cz) + f.h, head = f.ang + Math.PI / 2;
    for (const [bx, by, bz, ph] of f.birds) {
      const flap = 0.35 + 0.65 * Math.abs(Math.sin(now * 7 + ph));
      _p.set(cx + bx + Math.sin(now + ph) * 0.6, cy + by + Math.sin(now * 1.3 + ph) * 0.4, cz + bz); _q.setFromEuler(_e.set(0, -head, 0)); _s.set(1.2, flap * 1.6, 1.2);
      birds.setMatrixAt(i++, _m.compose(_p, _q, _s));
    }
  }
  birds.instanceMatrix.needsUpdate = true;
}
