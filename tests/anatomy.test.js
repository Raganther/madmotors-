// Car anatomy (data/anatomy.js): which panels a hit lands on in the core, and the cutter that makes the panels
// (render/anatomy.js cutGeometry, pure geometry: no WebGL needed).
import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import { damageCar } from '../src/core/sim/damage.js';
import { PANELS } from '../src/data/anatomy.js';
import { cutGeometry } from '../src/render/anatomy.js';

const car = () => ({ x: 0, z: 0, yaw: 0, hw: 1, hl: 2, dmg: { f: 0, b: 0, l: 0, r: 0 }, panels: {}, events: [], wreckT: 0, wrecks: 0 });
const area = g => { const p = g.attributes.position, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(); let s = 0; for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); s += b.sub(a).cross(c.sub(a)).length() / 2; } return s; };

describe('anatomy', () => {
  it('a hard nose-on hit bends, opens and tears off the bonnet, the steps riding on the dent event', () => {
    const c = car(), steps = [];
    for (let k = 0; k < 4; k++) { damageCar(c, 0, 2, 20, 1, 0, -1); for (const e of c.events) if (e.panels) steps.push(...e.panels); c.events.length = 0; }
    expect(steps.filter(([id]) => id === 'bonnet').map(([, s]) => s)).toEqual([0, 1, 2]);
    expect(c.panels.boot || 0).toBe(0);
  });
  it('a side hit near the nose lands on the door and spills onto the bonnet', () => {
    const c = car(); damageCar(c, 1, 0.9, 15, 1, -1, 0);   // the car's left is +x
    expect(c.panels.doorL).toBeGreaterThan(0); expect(c.panels.bonnet).toBeGreaterThan(0); expect(c.panels.bonnet).toBeLessThan(c.panels.doorL);
  });
  it('every panel has rising steps', () => { for (const p of PANELS) expect(p.steps[0] < p.steps[1] && p.steps[1] < p.steps[2]).toBe(true); });
  it('cutting a box keeps every bit of its surface and sorts it into cells', () => {
    const g = new THREE.BoxGeometry(2, 1, 4).toNonIndexed(), cell = (x, y, z) => z > 1 && y > 0 ? 'bonnet' : Math.abs(x) > 0.6 ? 'door' : 'shell';
    const parts = cutGeometry(g, [0, 0, 0], [[2, 1], [1, 0], [0, 0.6], [0, -0.6]], cell);
    expect(Object.keys(parts).sort()).toEqual(['bonnet', 'door', 'shell']);
    expect(Object.values(parts).reduce((s, p) => s + area(p), 0)).toBeCloseTo(area(g), 5);
    for (const p of Object.values(parts)) expect(p.attributes.uv.count).toBe(p.attributes.position.count);
  });
});
