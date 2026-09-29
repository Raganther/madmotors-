import { describe, expect, it } from 'vitest';
import PACKS from '../src/assets/gen/index.js';
import MANIFEST from '../src/assets/gen/manifest.json';
import { VEHICLES } from '../src/data/vehicles.js';
import { CAR_HL, CAR_HW } from '../src/core/constants.js';

// The contract between the Blender lab (blender/, `npm run assets`) and the game: every pack the manifest lists is
// in the bundle, decodes to sane geometry, fits its budget and, for a car, fits the hitbox and names the parts the
// game's damage and animation hooks look for (render/assets/cars.js).
const buf = s => Buffer.from(s, 'base64');
const tris = parts => parts.reduce((a, p) => a + buf(p.idx).length / 6, 0);
const BUDGET = { cars: { hi: 9000, lo: 4500, kb: 260 } };

describe('Blender asset packs', () => {
  it('the bundle holds exactly the manifest', () => {
    expect(Object.keys(PACKS).sort()).toEqual(Object.keys(MANIFEST).sort());
  });
  for (const [id, pack] of Object.entries(PACKS)) describe(id, () => {
    const man = MANIFEST[id], fam = man.family;
    it('decodes: indices in range, unit normals, both levels', () => {
      expect(pack.id).toBe(id); expect(pack.hi.length).toBeGreaterThan(0); expect(pack.lo.length).toBeGreaterThan(0);
      for (const p of [...pack.hi, ...pack.lo]) {
        const n = buf(p.pos).length / 6, I = new Uint16Array(new Uint8Array(buf(p.idx)).buffer), N = new Int8Array(new Uint8Array(buf(p.nor)).buffer);
        expect(buf(p.nor).length / 3).toBe(n); expect(I.length % 3).toBe(0);
        expect(Math.max(...I)).toBeLessThan(n);
        for (let k = 0; k < N.length; k += 3 * 17) expect(Math.hypot(N[k], N[k + 1], N[k + 2]) / 127).toBeCloseTo(1, 1);
        if (p.col) expect(buf(p.col).length / 3).toBe(n);
        expect(p.at).toHaveLength(3);
      }
      // the far level names the same parts (a far body the game can't match would never be swapped in)
      const hi = new Set(pack.hi.map(p => p.name)); for (const p of pack.lo) expect(hi, p.name).toContain(p.name);
    });
    it('within budget, matching the manifest', () => {
      const b = BUDGET[fam]; expect(b).toBeTruthy();
      expect(tris(pack.hi)).toBe(man.hiTris); expect(man.hiTris).toBeLessThanOrEqual(b.hi);
      expect(man.loTris).toBeLessThanOrEqual(b.lo); expect(man.loTris).toBeLessThan(man.hiTris);
      expect(man.kb).toBeLessThanOrEqual(b.kb);
    });
    if (fam === 'cars') it('a car: fits its hitbox, sits on its wheels, names its damage parts', () => {
      const model = id.slice(4), vs = VEHICLES.filter(v => v.model === model); expect(vs.length).toBeGreaterThan(0);
      const m = pack.meta, names = new Set(pack.hi.map(p => p.name));
      for (const v of vs) { expect(man.max[0]).toBeLessThanOrEqual((v.hw || CAR_HW) + 0.35); expect(-man.min[0]).toBeLessThanOrEqual((v.hw || CAR_HW) + 0.35); expect(Math.max(man.max[2], -man.min[2])).toBeLessThanOrEqual((v.hl || CAR_HL) + 0.35); }
      expect(man.min[1]).toBeGreaterThanOrEqual(0);
      expect(m.wheels.length).toBeGreaterThanOrEqual(2);
      for (const w of m.wheels) expect(w.length).toBe(4);
      for (const n of [...(m.dent || []), m.bumper, m.cabin, ...(m.struts || [])].filter(Boolean)) expect(names, n).toContain(n);
      expect(m.dent.length).toBeGreaterThan(0);
      expect(pack.hi.some(p => p.mat === 'lamp')).toBe(true); expect(pack.hi.some(p => p.mat === 'tail')).toBe(true);
      expect(pack.hi.some(p => p.name === m.cabin && p.mat === 'glass')).toBe(true);
    });
  });
});
