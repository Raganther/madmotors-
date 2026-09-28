import * as THREE from 'three';
import { G } from '../../game.js';
import { GATE, OPEN } from '../../core/elements/open.js';
import { canvasTex } from '../geometry.js';
import { withCutaway } from '../materials.js';
import { race } from '../../ui/flow.js';

// Open country (core/elements/open.js): the gates and the streams; the forest, rocks and bushes are the ordinary
// scenery (track/obstacles.js placeOpen). A gate is two tall striped posts with pennants and a numbered banner between
// them, standing on the ground; the player's next one glows and bobs, the ones already taken for this lap go grey.
// Over the player's car an arrow points the way to the next gate (red once it's been missed).
let gates = [], arrow = null, trOf = null;
const banner = n => canvasTex(256, 64, (g, w, h) => {
  g.fillStyle = '#1C2340'; g.fillRect(0, 0, w, h); g.fillStyle = '#FFC72C'; g.fillRect(0, 0, w, 6); g.fillRect(0, h - 6, w, 6);
  g.fillStyle = '#FFFFFF'; g.font = 'bold 40px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(`GATE ${n}`, w / 2, h / 2 + 2);
});
export function addOpen(group, tr, terr) {
  gates = []; arrow = null; trOf = tr;
  if (tr.gates) {
    const N = tr.loopN || tr.N, stripe = canvasTex(8, 64, (g, w, h) => { for (let y = 0; y < h; y += 16) { g.fillStyle = '#E0402F'; g.fillRect(0, y, w, 8); g.fillStyle = '#F4F4F0'; g.fillRect(0, y + 8, w, 8); } });
    const postM = withCutaway(new THREE.MeshLambertMaterial({ map: stripe })), flagM = new THREE.MeshLambertMaterial({ color: 0xFFC72C, side: THREE.DoubleSide });
    tr.gates.forEach((i, n) => {
      if (i >= tr.startIdx + N) return;
      const root = new THREE.Group(), hw = GATE.W / 2, y0 = [-1, 1].map(s => terr.at(tr.xs[i] + tr.rx[i] * s * hw, tr.zs[i] + tr.rz[i] * s * hw));
      for (const [k, s] of [[0, -1], [1, 1]]) {
        const p = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 6, 10), postM); p.position.set(s * hw, y0[k] - tr.H[i] + 3, 0); p.castShadow = true; root.add(p);
        const f = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.8), flagM); f.position.set(s * hw + 0.7 * -s, y0[k] - tr.H[i] + 5.6, 0); f.rotation.y = Math.PI / 2; root.add(f);
      }
      const top = Math.max(...y0) - tr.H[i] + 5.2, bm = new THREE.MeshBasicMaterial({ map: banner(n + 1), side: THREE.DoubleSide, transparent: true });
      const b = new THREE.Mesh(new THREE.PlaneGeometry(GATE.W - 0.6, 1.5), bm); b.position.y = top; root.add(b);
      const glow = new THREE.Mesh(new THREE.RingGeometry(hw - 0.8, hw + 0.8, 40, 1, 0, Math.PI).rotateX(-Math.PI / 2), new THREE.MeshBasicMaterial({ color: 0xFFC72C, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide }));
      glow.position.y = Math.min(...y0) - tr.H[i] + 0.3; root.add(glow);
      root.position.set(tr.xs[i], tr.H[i], tr.zs[i]); root.rotation.y = tr.th[i]; group.add(root);
      gates.push({ root, b, bm, glow, flags: root.children.filter(o => o.material === flagM), base: tr.bi(i), top, n });
    });
    // the way to the next gate: a flat chevron that floats over the player's car
    const sh = new THREE.Shape(); sh.moveTo(0, 1.6); sh.lineTo(1.3, -0.4); sh.lineTo(0.45, -0.4); sh.lineTo(0.45, -1.4); sh.lineTo(-0.45, -1.4); sh.lineTo(-0.45, -0.4); sh.lineTo(-1.3, -0.4); sh.closePath();
    arrow = new THREE.Mesh(new THREE.ShapeGeometry(sh).rotateX(-Math.PI / 2).rotateY(Math.PI), new THREE.MeshBasicMaterial({ color: 0xFFC72C, transparent: true, opacity: 0.9, depthTest: false }));
    arrow.renderOrder = 9; arrow.visible = false; group.add(arrow);
  }
  // streams: a band of moving water across the leg, its banks the ground rising out of it either side
  if (tr.open) {
    const N = tr.loopN || tr.N, pos = [], idx = [], W = 80;
    for (let i = 0; i < N; i++) {
      if (tr.open[tr.bi(i)] !== OPEN.stream) continue;
      for (const k of [i - 2, i + 3]) { const b = pos.length / 3; for (const o of [-W, W]) pos.push(tr.xs[k] + tr.rx[k] * o, tr.H[i] - 0.35, tr.zs[k] + tr.rz[k] * o); if (k === i + 3) idx.push(b - 2, b, b - 1, b - 1, b, b + 1); }
    }
    if (pos.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
      const m = new THREE.Mesh(g, withCutaway(new THREE.MeshLambertMaterial({ color: 0x4F8DBA, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }), false, { cut: false, cloud: true, water: true }));
      m.renderOrder = 1; group.add(m);
    }
  }
}
const _v = new THREE.Vector3();
export function updateOpen(dt, now) {
  if (!gates.length || !race || !G.world || G.world.tr !== trOf) { if (arrow) arrow.visible = false; return; }
  const tr = trOf, P = race.player, k = P.gateK || 0, next = k < tr.gates.length ? tr.bi(tr.gates[k]) : -1;
  // gates this lap already taken: every gate numbered below the next one's
  const nextN = next >= 0 ? gates.findIndex(g => g.base === next) : gates.length;
  for (const g of gates) {
    const isNext = g.base === next, done = g.n < nextN && k > 0 && next >= 0 || next < 0;
    g.bm.color.setHex(done ? 0x777777 : 0xFFFFFF);
    g.glow.material.opacity = isNext ? 0.35 + 0.25 * Math.sin(now * 5) : 0;
    g.b.position.y = g.top + (isNext ? Math.sin(now * 3) * 0.2 : 0);
    for (const f of g.flags) f.rotation.x = Math.sin(now * 6 + g.n) * 0.25;
  }
  if (!arrow) return;
  const gi = next >= 0 ? tr.gates[k] : -1;
  if (gi < 0 || G.state !== 'racing' && G.state !== 'countdown') { arrow.visible = false; return; }
  const gx = tr.xs[gi], gz = tr.zs[gi], d = Math.hypot(gx - P.x, gz - P.z);
  arrow.visible = d > 18 || P.gateMiss;
  _v.set(P.dx ?? P.x, (P.dy ?? P.y) + 3.4 + Math.sin(now * 4) * 0.12, P.dz ?? P.z);
  arrow.position.copy(_v); arrow.rotation.y = Math.atan2(gx - P.x, gz - P.z);
  arrow.material.color.setHex(P.gateMiss ? 0xE0402F : 0xFFC72C);
}
