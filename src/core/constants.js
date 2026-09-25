export const HALF = 6, WALL = HALF + 2.3, CAR_R = 1.25, CAR_HIT = 2.9, CAR_HW = 1.0, CAR_HL = 1.78, CAR_I = 3.2;
export const PHYS = { ENGINE: 24, DRAG: 0.019, BRAKE: 46, REVERSE: 14, BOOST: 17, G: 38, GS: 34, STEER: 2.5, HB_LAT: 9, DRAFT: 7 };
export const SURF = {
  tarmac: { engine: 1, latMax: 31, grip: 10, drag: 0 },
  gravel: { engine: 0.95, latMax: 25, grip: 7, drag: 0.02 },
  grass: { engine: 0.6, latMax: 15, grip: 5, drag: 0.35 },
  mud: { engine: 0.8, latMax: 17, grip: 4.5, drag: 0.12 },       // the mud element's bogs
  ford: { engine: 0.75, latMax: 16, grip: 5, drag: 0.3 }         // and its water splash
};
export const STEP = 1 / 120;
// Direction from the ground towards the (orthographic) camera. The renderer builds its camera from this, and
// Showdown mode uses it to decide what is on screen, so both always agree.
export const CAM_DIR = (() => { const l = Math.hypot(1, 1.3, 1); return [1 / l, 1.3 / l, 1 / l]; })();
