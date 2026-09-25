// Shared mutable game state: anything more than one module writes lives here instead of in loose globals.
export const G = {
  shake: undefined,
  parkVis: undefined,
  fanChunks: undefined,
  world: undefined,
  glowTex: undefined,
  blobTex: undefined,
  slowmo: undefined,
  attractS: undefined,
  viewH: undefined,
  hudTick: undefined,
  profileTick: undefined,
  standingsKey: undefined,
  lastT: undefined,
  renderAlpha: undefined,
  countdown: undefined,
  lastBeep: undefined,
  state: undefined,
  goTimer: undefined,
  accumulator: undefined,
  resultsTick: undefined,
  calloutTimer: undefined,
  hintTimer: undefined,
};
G.mode = 'race';        // 'race' | 'showdown' | 'deuce' | 'tiebreak' (chosen in the menu)
G.steer = 'wheel';      // touch steering: 'wheel' | 'arrows' (menu / pause setting)
G.camMode = 'classic'; G.camZoom = 'normal';   // camera settings (render/camera.js CAM_MODES / CAM_ZOOMS)
G.vehicle = 'coupe';    // the player's vehicle (data/vehicles.js; the menu's garage)
G.rivals = 3;           // how many AI cars a Race has (menu; data/cars.js MAX_RIVALS). Showdown always has three
G.camDir = null;        // where the camera looks from, [x, y, z] (set each frame by the camera)
G.sdOverAt = 0;
G.sdTick = 0;        // next Showdown danger tick (race time)
