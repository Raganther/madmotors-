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
G.vehicle = 'coupe';    // the player's vehicle for the selected stage (data/vehicles.js; the menu's garage)
G.defaultVehicle = 'coupe';   // the last pick: used on stages with no pick of their own
G.stageCars = {};       // stage name -> vehicle id picked for it (ui/garage.js)
G.stageSel = 0;         // the stage selected in the menu (ui/flow.js selectStage)
G.onVehicle = null;     // called after a garage pick (the stage list shows the pick)
G.onGarageClose = null; // called when the garage closes (the league screen comes back)
G.league = null;        // the league run being raced (ui/league.js), or null
G.weapons = true;       // missiles and door bashing (menu: Weapons on/off; core/features/weapons.js)
G.rivals = 3;           // how many AI cars a Race has (menu; data/cars.js MAX_RIVALS). Showdown always has three
G.camDir = null;        // where the camera looks from, [x, y, z] (set each frame by the camera)
G.sdOverAt = 0;
G.sdTick = 0;        // next Showdown danger tick (race time)
