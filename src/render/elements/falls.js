import * as THREE from 'three';
import { canvasTex, radialTex } from '../geometry.js';

// waterfall ('falls' section tag): a curtain of water leaping off the cliff lip on the up-screen side, arcing high over
// the road and crashing down on the bank on the camera side, fed by a stream along the cliff top, with spray where it
// lands. The streaks scroll down the curtain (update); it's see-through, so a car underneath stays visible.
const FALL = { W: 16, LIP: 17, TOP: 26, DROP: 0.0413, SPREAD: 0.22 };
let tex = null, mists = [];
export function addFalls(group, tr, terr) {
  mists = []; if (!tr.falls || !tr.falls.length) return;
  if (!tex) {
    tex = canvasTex(64, 256, (g, w, h) => {
      g.fillStyle = 'rgba(150,200,235,0.5)'; g.fillRect(0, 0, w, h);
      let s = 3; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
      for (let k = 0; k < 90; k++) { const x = r() * w, y = r() * h, l = 20 + r() * 70; g.fillStyle = `rgba(255,255,255,${0.35 + r() * 0.6})`; g.fillRect(x, y, 1 + r() * 2.5, l); if (y + l > h) g.fillRect(x, y - h, 1 + r() * 2.5, l); }
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: 0xE8F6FF, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  const foam = new THREE.MeshBasicMaterial({ color: 0xF4FBFF, transparent: true, opacity: 0.6, depthWrite: false });
  const mistTex = radialTex([[0, 'rgba(255,255,255,0.85)'], [0.5, 'rgba(240,248,255,0.35)'], [1, 'rgba(240,248,255,0)']]);
  for (const f of tr.falls) {
    const i = f.i, th = tr.th[i], far = (-Math.cos(th) * -Math.SQRT1_2 + Math.sin(th) * -Math.SQRT1_2) > 0 ? 1 : -1;   // which side of the road is up-screen
    const H = tr.H[i], at = (lat, u) => [tr.xs[i] + tr.rx[i] * lat + tr.tx[i] * u, tr.zs[i] + tr.rz[i] * lat + tr.tz[i] * u];
    // the path of the water, x metres out from the lip (a stream along the cliff top first), until it's under the ground
    const path = [];
    for (let x = -30; x < 70; x += x < 0 ? 5 : 1.25) {
      const lat = far * (FALL.LIP - x), y = H + FALL.TOP + 0.3 - FALL.DROP * Math.max(0, x) ** 2, [px, pz] = at(lat, 0);
      path.push({ lat, y, x }); if (x > 0 && y < terr.at(px, pz) - 1.5) break;
    }
    const pos = [], uv = [], idx = [], C = 7; let v = 0;
    path.forEach((p, k) => {
      if (k) v += Math.hypot(p.lat - path[k - 1].lat, p.y - path[k - 1].y) / 9;
      const wide = FALL.W * (p.x < 0 ? 0.55 : 1 + FALL.SPREAD * Math.min(1, p.x / 25));
      for (let c = 0; c < C; c++) { const u = (c / (C - 1) - 0.5) * wide, [x, z] = at(p.lat, u); pos.push(x, p.y, z); uv.push(c / (C - 1) * 2, -v); }
      if (k) for (let c = 0; c < C - 1; c++) { const a = (k - 1) * C + c, b = a + C; idx.push(a, b, a + 1, a + 1, b, b + 1); }
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    const m = new THREE.Mesh(g, mat); m.renderOrder = 2; group.add(m);
    // a churning pool of foam and spray where it lands, and a little spray at the lip
    const land = path[path.length - 1];
    for (const [r, o, dl] of [[7.5, 0.3, 0], [4.5, 0.45, far * 2]]) {
      const [x, z] = at(land.lat + dl, 0), p = new THREE.Mesh(new THREE.CircleGeometry(r, 18).rotateX(-Math.PI / 2), foam);
      p.scale.set(FALL.W / 2 / r * (1 + FALL.SPREAD), 1, 1); p.rotation.y = th; p.position.set(x, Math.max(land.y, terr.at(x, z)) + 0.25 + o, z); p.renderOrder = 1; group.add(p);
    }
    for (let k = 0; k < 5; k++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.5 }));
      const [x, z] = at(land.lat + far * (k - 2) * 1.5, (k - 2) * 4);
      s.position.set(x, Math.max(land.y, terr.at(x, z)) + 2 + k % 2 * 2, z); s.scale.setScalar(9 + k * 1.3); s.userData = { k, y0: s.position.y }; group.add(s); mists.push(s);
    }
    const [mx, mz] = at(far * FALL.LIP, 0), top = new THREE.Sprite(new THREE.SpriteMaterial({ map: mistTex, transparent: true, depthWrite: false, opacity: 0.35 }));
    top.position.set(mx, H + FALL.TOP + 1, mz); top.scale.setScalar(8); top.userData = { k: 7, y0: top.position.y }; group.add(top); mists.push(top);
  }
}
// the streaks run down the curtain; the spray billows
export function updateFalls(dt, now) {
  if (!mists.length) return;
  tex.offset.y += dt * 1.8;
  for (const s of mists) { const k = s.userData.k; s.material.opacity = (k === 7 ? 0.3 : 0.45) + 0.15 * Math.sin(now * 2.3 + k * 1.7); s.position.y = s.userData.y0 + 0.6 * Math.sin(now * 1.1 + k); }
}
