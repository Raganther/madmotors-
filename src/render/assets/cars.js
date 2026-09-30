import * as THREE from 'three';
import { decodePack, playLoop } from './index.js';

// A racer built from its Blender pack (blender/cars.py): every part the pack names, in the car's colours, with both
// levels of detail (near / far: setCarDetail swaps them), and the damage hooks the game needs, from the pack's meta:
// meta.dent: parts that dent; bumper / wing / struts: parts that fall off; cabin: the glass that cracks; lamp and tail
// parts light up; number: the roof number [size, y, z, rx]; wheels: [x, z, r, width]; knobbly, hub, soft. Moving parts
// are animated by the car's rig (RIGS below), which finds them by name; each part sits at its pivot, so a rig only
// turns or shifts it.
const MATS = def => ({ paint: def.color, accent: def.accent });
export function buildBlenderCar(K, def, pack) {
  const H = decodePack(pack), m = H.meta, C = MATS(def), O = {};
  for (const name of Object.keys(H.hi)) for (const mat of Object.keys(H.hi[name])) {
    const hi = H.hi[name][mat], near = (m.near || []).includes(name), lo = hi.userData.loop || near ? hi : (H.lo[name] && H.lo[name][mat]) || hi;   // a looping part keeps its frames far off too
    const mesh = K.hd(lo, C[mat] ?? mat, hi, H.at[name]); (O[name] = O[name] || []).push(mesh); mesh.name = name;
    if (near) K.nearOnly(mesh);
    if (hi.userData.loop) { mesh.material = mesh.material.clone(); mesh.material.morphTargets = true; mesh.updateMorphTargets(); }
  }
  for (const n of m.dent || []) for (const mesh of O[n] || []) K.dentHD(mesh);
  const one = n => n && O[n] ? O[n][0] : null, byMat = mt => Object.values(O).flat().filter(x => x.userData.hdMat === mt);
  if (m.number) K.number(...m.number);
  const cabin = m.cabin && O[m.cabin] ? O[m.cabin].find(x => x.userData.hdMat === 'glass') || O[m.cabin][0] : null;
  const out = { bumper: one(m.bumper), wing: one(m.wing), struts: (m.struts || []).map(one).filter(Boolean), heads: byMat('lamp'), tails: byMat('tail'), cabin };
  if (m.soft) out.soft = m.soft;
  // a part made of several materials knocks off whole: its other meshes ride on the first
  for (const p of [out.bumper, out.wing, ...out.struts]) if (p) for (const x of O[p.name]) if (x !== p) { x.position.sub(p.position); p.add(x); }
  const rig = RIGS[def.model]; if (rig) { const r = rig(O, def, m); out.anim = r.anim; out.moving = r.moving; }
  const hub = m.hub === 'accent' ? def.accent : m.hub;
  return { ...out, ...K.wheels(m.wheels, { knobbly: !!m.knobbly, ...(hub !== undefined ? { hub } : {}) }) };
}
// Moving parts, by car: (parts by name, def, meta) -> { anim(v, c, now), moving: [meshes] } (moving parts are kept out
// of the static merge). The motions copy the Classic builders' anims in render/carmodels.js.
const all = (O, ...names) => names.flatMap(n => O[n] || []);
const blink = (list, a, b, on) => list.forEach(x => x.material.color.setHex(on ? a : b));
export const RIGS = {
  rocket(O, def, m) {
    // the flame is an effect, not a model: two cones out of the nozzle, longer with the throttle, blue on boost
    const flameM = new THREE.MeshBasicMaterial({ color: 0xFFB03A, transparent: true, opacity: 0.85, depthWrite: false }), coreM = new THREE.MeshBasicMaterial({ color: 0xFFF6C8 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.34, 1, 12).rotateX(-Math.PI / 2).translate(0, 0, -0.5), flameM), core = new THREE.Mesh(new THREE.ConeGeometry(0.18, 1, 8).rotateX(-Math.PI / 2).translate(0, 0, -0.5), coreM);
    const noz = O.wing[0]; flame.position.set(...m.nozzle); core.position.copy(flame.position); noz.parent.add(flame, core);
    return { moving: [], anim: (v, c, now) => { const k = c.boost > 0 ? 2.4 : 0.3 + (c.inp.throttle || 0) * 1.2, f = k * (0.85 + 0.3 * Math.sin(now * 60)); flame.scale.set(1, 1, f); core.scale.set(1, 1, f * 0.7); flameM.color.setHex(c.boost > 0 ? 0x6FD8FF : 0xFFB03A); flame.visible = core.visible = noz.visible; } };
  },
  hotrod(O) {
    const bl = all(O, 'blower'), p0 = bl.map(x => x.position.clone());
    return { moving: bl, anim: (v, c, now) => { const r = (c.inp.throttle || 0) * 0.025, dx = Math.sin(now * 70) * r, dy = Math.abs(Math.cos(now * 55)) * r; bl.forEach((x, k) => x.position.set(p0[k].x + dx, p0[k].y + dy, p0[k].z)); } };
  },
  police(O) {
    const red = all(O, 'lightred'), blue = all(O, 'lightblue');
    return { moving: [...red, ...blue], anim: (v, c, now) => { const on = Math.floor(now * 6) % 2; blink(red, 0xFF2020, 0x401010, on); blink(blue, 0x10183A, 0x3366FF, on); } };
  },
  icecream(O) { const cone = all(O, 'cone'); return { moving: cone, anim: (v, c, now) => cone.forEach(x => { x.rotation.y = now * 1.5; }) }; },
  firetruck(O) {
    const b = [all(O, 'beacon0'), all(O, 'beacon1')];
    return { moving: b.flat(), anim: (v, c, now) => b.forEach((l, k) => blink(l, 0x3366FF, 0x10183A, Math.floor(now * 5 + k) % 2)) };
  },
  rover(O) { const d = all(O, 'dish'); return { moving: d, anim: (v, c, now) => d.forEach(x => { x.rotation.y = Math.sin(now * 0.8) * 1.2; }) }; },
  hover(O) {
    const fan = all(O, 'fan'), rud = all(O, 'rudder');
    return { moving: [...fan, ...rud], anim: (v, c, now) => { fan.forEach(x => { x.rotation.z = now * (6 + (c.inp.throttle || 0) * 30); }); rud.forEach(x => { x.rotation.y = -(c.inp.steer || 0) * 0.5; }); } };
  },
  snowcat(O) { const b = all(O, 'beacon'); return { moving: b, anim: (v, c, now) => b.forEach(x => { x.rotation.y = now * 6; x.material.color.setHex(Math.floor(now * 3) % 2 ? 0xFFA020 : 0x7A4A10); }) }; },
  limo(O) { const f = all(O, 'flag'); return { moving: f, anim: (v, c, now) => f.forEach(x => { if (x.geometry.userData.loop) playLoop(x, now, 1 + Math.min(1, Math.hypot(c.vx || 0, c.vz || 0) / 30)); else x.rotation.y = Math.sin(now * 9) * 0.3; }) }; },   // the authored wave, faster with speed
  sidecar(O) {
    const pass = all(O, 'pass'), rider = all(O, 'rider'), x0 = pass.map(x => x.position.x);
    return { moving: [...pass, ...rider], anim: (v, c, now) => { const lean = c.inp.steer || 0; pass.forEach((x, k) => { x.position.x = x0[k] + lean * 0.45; x.rotation.z = -lean * 0.4; }); rider.forEach(x => { x.rotation.z = lean * 0.25; }); } };
  },
  mixer(O, def, m) {
    // the drum is modelled level along the car; it sits tilted (meta.drumTilt) and turns about its own axis
    const drum = all(O, 'drum'), tilt = new THREE.Group(); if (!drum.length) return {};
    tilt.position.copy(drum[0].position); tilt.rotation.x = m.drumTilt || 0; drum[0].parent.add(tilt);
    for (const x of drum) { x.position.set(0, 0, 0); tilt.add(x); }
    return { moving: drum, anim: (v, c, now) => drum.forEach(x => { x.rotation.z = now * 1.6; }) };
  }
};
