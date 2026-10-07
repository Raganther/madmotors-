// Weather and time of day (G6 track versions: data/versions.js). Stage options:
//   wet: 0..1    a wet road: the tyres hold WET.GRIP less at 1 (sim/car.js), and the corner speeds the AI aims for come
//                down to match (speeds), so everyone brakes earlier
//   rain: 0..1   falling rain (looks only: render/elements/weather.js)
//   night: true  after dark: moonlight, headlight pools ahead of every car, glowing tail lights (looks only)
export const WET = { GRIP: 0.2 };
export const element = {
  name: 'weather',
  about: 'a wet road (less grip), rain and night',
  stageKeys: { wet: '0..1: a wet road, less grip (WET.GRIP at 1)', rain: '0..1: falling rain (looks only)', night: 'true: after dark (looks only)' },
  speeds(ctx) {
    const k = ctx.stage && ctx.stage.wet ? Math.sqrt(1 - WET.GRIP * ctx.stage.wet) : 1; if (k === 1) return;
    for (let i = 0; i < ctx.vmax0.length; i++) ctx.vmax0[i] *= k;   // grip-limited corner speed ~ sqrt(grip)
  },
  track(ctx, out) { out.wet = (ctx.stage && ctx.stage.wet) || 0; }
};
