// Ground ('gorge' stages): the terrain either side of each section. far = up-screen side, near = camera side, in
// metres relative to the road (negative = a drop), reached over rampF / rampN metres (small = sheer). Rock faces and
// guard rails along drops follow from it (core/track/circuit.js).
export const element = {
  name: 'ground', onBranch: true,
  about: 'terrain height either side of the road',
  tags: { far: 'ground up-screen of the road (m, + up)', near: 'ground on the camera side (m)', rampF: 'metres to reach `far`', rampN: 'metres to reach `near`' },
  channels: { far: tg => tg.far ?? 0, near: tg => tg.near ?? 0, rampF: tg => tg.rampF ?? 20, rampN: tg => tg.rampN ?? 20 }
};
