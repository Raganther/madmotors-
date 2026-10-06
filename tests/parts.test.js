import { describe, expect, it } from 'vitest';
import { PART_MAX, SLOTS, TYRE_KINDS, buildKey, buildOf, buildVeh, slotFx } from '../src/data/parts.js';
import { VEHICLES } from '../src/data/vehicles.js';

describe('upgrade parts (data/parts.js)', () => {
  it('every slot has three levels: a price and a look for each, effects that grow with the level', () => {
    for (const s of SLOTS) {
      expect(s.price.length, s.id).toBe(PART_MAX); expect(s.looks.length, s.id).toBe(PART_MAX);
      expect(s.price.every((p, i) => !i || p > s.price[i - 1]), s.id).toBe(true);
      for (const k of s.kinds ? Object.keys(s.kinds) : [null]) {
        const fx = L => slotFx(s, L, { tyrKind: k }), keys = Object.keys(fx(1));
        for (const key of keys) expect(Math.abs(fx(3)[key] - 1), `${s.id} ${key}`).toBeGreaterThan(Math.abs(fx(1)[key] - 1));
      }
    }
  });
  it('a build multiplies stock handling, and stock is untouched', () => {
    for (const v of VEHICLES) {
      const veh = v.veh || { accel: 1, top: 1, grip: 1, off: 1, im: 1 };
      expect(buildVeh(veh, null)).toEqual(veh);
      const full = buildVeh(veh, Object.fromEntries(SLOTS.map(s => [s.id, PART_MAX])));
      expect(full.accel).toBeCloseTo(veh.accel * 1.09); expect(full.tough).toBeCloseTo((veh.tough || 1) * 1.36); expect(full.ram).toBeCloseTo((veh.ram || 1) * 1.6);
      for (const k of ['accel', 'top', 'grip', 'off', 'im']) expect(Number.isFinite(full[k]), `${v.id} ${k}`).toBe(true);
    }
  });
  it('builds come from owned-car records (paint and junk dropped) and key the thumbnails', () => {
    expect(buildOf({ paint: 3 })).toBe(null); expect(buildOf(null)).toBe(null);
    expect(buildOf({ eng: 2, paint: 1, tyrKind: 'road', cage: 9 })).toEqual({ eng: 2, cage: 3 });
    expect(buildOf({ tyr: 1, tyrKind: 'gravel' })).toEqual({ tyr: 1, tyrKind: 'gravel' });
    expect(buildKey(null)).toBe(''); expect(buildKey({ tyr: 1, tyrKind: 'gravel' })).not.toBe(buildKey({ tyr: 1 }));
    expect(Object.keys(TYRE_KINDS)).toEqual(['road', 'gravel']);
  });
});
