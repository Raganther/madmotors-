export const HALF = 6, WALL = HALF + 2.3, CAR_R = 1.25, CAR_HIT = 2.9, CAR_HW = 1.0, CAR_HL = 1.78, CAR_I = 3.2;
export const PHYS = { ENGINE: 24, DRAG: 0.019, BRAKE: 46, REVERSE: 14, BOOST: 17, G: 38, GS: 34, STEER: 2.5, HB_LAT: 9 };
export const SURF = {
  tarmac: { engine: 1, latMax: 31, grip: 10, drag: 0 },
  gravel: { engine: 0.95, latMax: 25, grip: 7, drag: 0.02 },
  grass: { engine: 0.6, latMax: 15, grip: 5, drag: 0.35 }
};
export const STEP = 1 / 120;
