// The Workshop (data/workshop.js, ui/workshop.js): its tabs, its loop, and the `hold` flag its test cars use.
import { describe, it, expect } from 'vitest';
import * as M from '../src/core/index.js';
import { WORKSHOP_STAGE, WORKSHOP_TABS } from '../src/data/workshop.js';
import { raceDefs } from '../src/data/cars.js';
import { vehicleById } from '../src/data/vehicles.js';

describe('workshop', () => {
  it('has unique tabs, the coming ones naming their roadmap phase', () => {
    expect(new Set(WORKSHOP_TABS.map(t => t.id)).size).toBe(WORKSHOP_TABS.length);
    for (const t of WORKSHOP_TABS) expect(t.phase === undefined || /^[FG]\d$/.test(t.phase)).toBe(true);
  });
  it('its loop validates, with Armco along the crash straight', () => {
    expect(() => M.validateStage(WORKSHOP_STAGE)).not.toThrow();
    const tr = M.buildTrack(WORKSHOP_STAGE);
    for (let i = tr.startIdx; i < tr.startIdx + 250; i += 10) { expect(tr.wallL[i]).toBeTruthy(); expect(tr.wallR[i]).toBeTruthy(); }
  });
  it('a held car stays parked, and one held at a speed keeps it', () => {
    const tr = M.buildTrack(WORKSHOP_STAGE), W = { tr, terr: M.buildTerrain(tr, WORKSHOP_STAGE), surf: WORKSHOP_STAGE.surface, armco: true };
    const R = M.createRace(W, raceDefs(vehicleById('coupe'), 1)); R.phase = 'racing';
    const [a, b] = R.cars; a.hold = true; b.hold = 20;
    for (let n = 0; n < 120 * 4; n++) M.raceStep(R, M.STEP, W);
    expect(Math.hypot(a.vx, a.vz)).toBeLessThan(0.5);
    expect(Math.abs(Math.hypot(b.vx, b.vz) - 20)).toBeLessThan(1.5);
  });
});
