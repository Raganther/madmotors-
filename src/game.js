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
G.mode = 'race';        // 'race' | 'showdown' (chosen in the menu)
G.steer = 'wheel';      // touch steering: 'wheel' | 'arrows' (menu / pause setting)
G.sdOverAt = 0;
G.sdTick = 0;        // next Showdown danger tick (race time)
