import * as THREE from 'three';
import { G } from '../../game.js';
import { WALL } from '../../core/constants.js';
import { clamp } from '../../core/math.js';
import { BAR_P } from '../../core/sim/barriers.js';
import { spawnProp } from '../effects/props.js';
import { _e, _m, _p, _q, _s, addInstanced, flat } from '../geometry.js';

export let barVis = null;
export function addBarriers(group, tr, terr, stage) {
  const tyres = [], posts = [], rails = [], bales = [], NB = tr.loopN || tr.N, armco = !!(stage && stage.armco);
  for (let i = 0; i < NB; i++) for (const side of [-1, 1]) {
    const w = side < 0 ? tr.wallL[i] : tr.wallR[i]; if (!w) continue;
    const x = tr.xs[i] + tr.rx[i] * side * WALL, z = tr.zs[i] + tr.rz[i] * side * WALL, y = terr.at(x, z);
    const base = { s: side > 0 ? 1 : 0, p: (i / BAR_P) | 0, nx: tr.rx[i] * side, nz: tr.rz[i] * side, tx: tr.tx[i], tz: tr.tz[i] };
    if (w === 1) {
      const stripe = ((i / 3) | 0) % 5 === 0;
      tyres.push({ ...base, kind: 'tyre', x, y: y + 0.21, z, color: 0x232323 });
      tyres.push({ ...base, kind: 'tyre', x, y: y + 0.63, z, color: stripe ? (((i / 15) | 0) % 2 ? 0xE0402F : 0xF4F4F0) : 0x2A2A2A });
    } else if (w === 2 && i % 3 === 0) {
      posts.push({ ...base, kind: 'post', x, y: y + 0.6, z, color: armco ? 0x8D939C : 0x8A5E3B, dims: [0.2, 1.2, 0.2] });
      const j = tr.loopN ? (i + 3) % NB : i + 3;
      if (j < tr.N && (side < 0 ? tr.wallL[j] : tr.wallR[j]) === 2) {
        const x2 = tr.xs[j] + tr.rx[j] * side * WALL, z2 = tr.zs[j] + tr.rz[j] * side * WALL, y2 = terr.at(x2, z2);
        const len = Math.hypot(x2 - x, z2 - z), ry = Math.atan2(x2 - x, z2 - z), rxa = -Math.atan2(y2 - y, len);
        const rail = { ...base, kind: 'rail', a: [x, y, z], b: [x2, y2, z2], pa: base.p, pb: (j / BAR_P) | 0, x: (x + x2) / 2, z: (z + z2) / 2, ry, rx: rxa, sz: len };
        if (armco) rails.push({ ...rail, hh: 0.75, y: (y + y2) / 2 + 0.75, sx: 1.4, sy: 2.6, color: 0xCDD2D9, dims: [0.14, 0.364, len] });
        else for (const hh of [0.55, 1.0]) rails.push({ ...rail, hh, y: (y + y2) / 2 + hh, color: 0xC4935E, dims: [0.1, 0.14, len] });
      }
    } else if (w === 3 && i % 2 === 0) {
      bales.push({ ...base, kind: 'bale', x, y: y + 0.45, z, ry: tr.th[i], color: 0xE2C265, dims: [1.0, 0.9, 1.5] });
    }
  }
  const map = new Map(), all = [];
  const reg = chunks => {
    for (const { mesh, list } of chunks) {
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      list.forEach((it, j) => { it.mesh = mesh; it.j = j; it.on = true; all.push(it); const k = it.s * 1e6 + it.p; let a = map.get(k); if (!a) map.set(k, a = []); a.push(it); });
    }
  };
  reg(addInstanced(group, flat(new THREE.CylinderGeometry(0.55, 0.55, 0.42, 10)), new THREE.MeshLambertMaterial({ color: 0xffffff }), tyres, { cast: true }));
  reg(addInstanced(group, flat(new THREE.BoxGeometry(0.2, 1.2, 0.2)), new THREE.MeshLambertMaterial({ color: 0xffffff }), posts, { cast: true }));
  reg(addInstanced(group, flat(new THREE.BoxGeometry(0.1, 0.14, 1)), new THREE.MeshLambertMaterial({ color: 0xffffff }), rails, { cast: true }));
  reg(addInstanced(group, flat(new THREE.BoxGeometry(1.0, 0.9, 1.5)), new THREE.MeshLambertMaterial({ color: 0xffffff }), bales, { cast: true }));
  barVis = { map, all, armco, NPc: Math.ceil(NB / BAR_P), loop: !!tr.loopN };
}
// ---------- barrier damage visuals ----------
export const _up = new THREE.Vector3(0, 1, 0), _ax = new THREE.Vector3(), _qa = new THREE.Quaternion(), _qb = new THREE.Quaternion(), _mr = new THREE.Matrix4();
export function barWrap(q) { const n = barVis.NPc; return barVis.loop ? (q % n + n) % n : q; }
export function barItems(s, q) { return barVis.map.get(s * 1e6 + barWrap(q)) || []; }
// the item's current transform (bent armco leans out, rails follow their posts)
export function barItemXform(it) {
  const B = G.world.W.bar, bend = q => B ? B.bend[it.s][barWrap(q)] : 0;
  if (it.kind === 'rail') {
    const lean = (bb, hh) => { const th = bb * 0.55; return [bb * 0.5 + hh * Math.sin(th), hh * Math.cos(th)]; };
    const [oa, ha] = lean(bend(it.pa), it.hh), [ob, hb] = lean(bend(it.pb), it.hh);
    const ax = it.a[0] + it.nx * oa, ay = it.a[1] + ha, az = it.a[2] + it.nz * oa, bx = it.b[0] + it.nx * ob, by = it.b[1] + hb, bz = it.b[2] + it.nz * ob;
    const len = Math.hypot(bx - ax, bz - az);
    _e.set(-Math.atan2(by - ay, len), Math.atan2(bx - ax, bz - az), 0); _q.setFromEuler(_e);
    _p.set((ax + bx) / 2, (ay + by) / 2, (az + bz) / 2); _s.set(it.sx ?? 1, it.sy ?? 1, len);
  } else if (it.kind === 'post') {
    const bb = bend(it.p), th = bb * 0.55, off = bb * 0.5 + 0.6 * Math.sin(th);
    _ax.set(it.tx, 0, it.tz); _q.setFromAxisAngle(_ax, (it.s ? 1 : -1) * th);
    _p.set(it.x + it.nx * off, it.y - 0.6 + 0.6 * Math.cos(th), it.z + it.nz * off); _s.set(1, 1, 1);
  } else {
    _e.set(it.rx || 0, it.ry || 0, 0); _q.setFromEuler(_e); _p.set(it.x, it.y, it.z); _s.set(it.sx ?? 1, it.sy ?? 1, it.sz ?? 1);
  }
}
export function barRefresh(it) {
  if (it.on) { barItemXform(it); _m.compose(_p, _q, _s); } else _m.makeScale(0, 0, 0);
  it.mesh.setMatrixAt(it.j, _m); it.mesh.instanceMatrix.needsUpdate = true;
}
export function resetBarrierVis() { if (!barVis) return; for (const it of barVis.all) { it.on = true; barRefresh(it); } }
export const PROP_SND = { tyre: 'rubber', post: 'wood', rail: 'wood', bale: 'hay' };
export function knockOff(it, ch) {
  barItemXform(it); it.on = false; barRefresh(it);
  const pos = _p.clone(), quat = _q.clone(), k = clamp(ch.v / 20, 0.3, 1.4), r = () => Math.random() - 0.5;
  const out = 2 + Math.random() * 5 * k, carK = 0.35 + Math.random() * 0.5;
  const vx = ch.vx * carK + it.nx * out + r() * 4, vz = ch.vz * carK + it.nz * out + r() * 4, vy = (2 + Math.random() * 6) * k;
  const snd = barVis.armco && it.kind !== 'tyre' && it.kind !== 'bale' ? 'metal' : PROP_SND[it.kind];
  if (it.kind === 'tyre') spawnProp('tyre', pos, quat, null, it.color, vx, vy, vz, 10 * k, snd);
  else spawnProp('box', pos, quat, it.dims, it.color, vx, vy, vz, (it.kind === 'rail' ? 6 : 12) * k, snd);
}
export function postStands(it) {
  const B = G.world.W.bar, prev = barWrap(it.p - 1);
  return !B.broken[it.s][barWrap(it.p)] || (!B.broken[it.s][prev] && barItems(it.s, prev).some(x => x.kind === 'rail'));
}
export function applyBarrierChanges() {
  const B = G.world.W.bar; if (!B || !B.changes.length) return;
  for (const ch of B.changes) {
    if (!barVis) continue;
    if (ch.t === 'break') {
      for (const it of barItems(ch.s, ch.p)) if (it.on && it.kind !== 'post') knockOff(it, ch);
      for (const q of [ch.p, ch.p + 1]) for (const it of barItems(ch.s, q)) if (it.on && it.kind === 'post' && !postStands(it)) knockOff(it, ch);
    }
    for (let q = ch.p - 2; q <= ch.p + 2; q++) for (const it of barItems(ch.s, q)) if (it.on) barRefresh(it);
  }
  B.changes.length = 0;
}
