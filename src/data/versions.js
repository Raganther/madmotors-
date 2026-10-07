// Track versions (G6): a night or a wet version of any stage, made from the stage itself, not drawn again. A version
// keeps the road, the seed and every set piece; it changes the light and the colours, and adds the weather element's
// options (core/elements/weather.js: wet grip, rain, night). stages/index.js lists the versions that are raced (VERSIONED).
const mix = (a, b, t) => { const c = k => Math.round(((a >> k) & 255) * (1 - t) + ((b >> k) & 255) * t); return (c(16) << 16) | (c(8) << 8) | c(0); };
const dark = (c, t) => mix(c, 0x000000, t);
export const VERSIONS = {
  night: {
    name: 'Night', suffix: 'at Night', blurb: 'after dark: moonlight, headlights and tail lights',
    make: s => ({
      night: true,
      light: { sun: 0x9DB2FF, sunI: 0.34, sky: 0x2A3A66, ground: 0x10131C, hemiI: 0.42, cloud: 0, grade: [0.9, 0.96, 1.12], sat: 0.85 },
      colors: { ...s.colors, sky: 0x0D1428, grassA: dark(s.colors.grassA, 0.25), grassB: dark(s.colors.grassB, 0.25) },
      snowfall: s.snowfall,
    }),
  },
  rain: {
    name: 'Rain', suffix: 'in the Rain', blurb: 'a wet road: less grip, earlier braking',
    make: s => ({
      wet: 1, rain: 1, snowfall: 0,
      light: { ...s.light, sun: mix(s.light.sun, 0xB8C4D4, 0.6), sunI: s.light.sunI * 0.62, sky: mix(s.light.sky, 0x8E99A8, 0.6), hemiI: s.light.hemiI * 0.9, cloud: 0.6, grade: [0.97, 1.0, 1.04], sat: (s.light.sat || 1) * 0.85, haze: undefined },
      colors: { ...s.colors, sky: mix(s.colors.sky, 0x8A94A2, 0.65), road: dark(s.colors.road, 0.28), ...(s.colors.dirtRoad ? { dirtRoad: dark(s.colors.dirtRoad, 0.25) } : {}) },
    }),
  },
};
export const VERSION_IDS = Object.keys(VERSIONS);
/** Stage s in version v ('night' | 'rain'): a new stage named "<name> at Night" / "<name> in the Rain". */
export function versionOf(s, v) {
  const V = VERSIONS[v]; if (!V) throw new Error('no track version ' + v);
  const out = { ...s, ...V.make(s), name: `${s.name} ${V.suffix}`, blurb: `${s.blurb}. ${V.name}: ${V.blurb}`, base: s.name, version: v };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  if (out.light.haze === undefined) delete out.light.haze;
  return out;
}
