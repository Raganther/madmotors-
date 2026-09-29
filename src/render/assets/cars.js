import { decodePack } from './index.js';

// A racer built from its Blender pack (blender/cars.py): every part the pack names, in the car's colours, with both
// levels of detail (near / far: setCarDetail swaps them), and the damage hooks the game needs, from the pack's meta:
// meta.dent: parts that dent; bumper / wing: parts that fall off; cabin: the glass that cracks; lamp and tail parts
// light up; number: the roof number [size, y, z]; wheels: [x, z, r, width]; knobbly, hub, soft. Moving parts are
// animated by the car's rig (RIGS below), which finds them by name.
const MATS = def => ({ paint: def.color, accent: def.accent });
export function buildBlenderCar(K, def, pack) {
  const H = decodePack(pack), m = H.meta, C = MATS(def), O = {};
  for (const name of Object.keys(H.hi)) for (const mat of Object.keys(H.hi[name])) {
    const hi = H.hi[name][mat], lo = (H.lo[name] && H.lo[name][mat]) || hi;
    const mesh = K.hd(lo, C[mat] ?? mat, hi, H.at[name]); (O[name] = O[name] || []).push(mesh); mesh.name = name;
  }
  for (const n of m.dent || []) for (const mesh of O[n] || []) K.dentHD(mesh);
  const one = n => n && O[n] ? O[n][0] : null, byMat = mt => Object.values(O).flat().filter(x => x.userData.hdMat === mt);
  if (m.number) K.number(...m.number);
  const cabin = m.cabin && O[m.cabin] ? O[m.cabin].find(x => x.userData.hdMat === 'glass') || O[m.cabin][0] : null;
  const out = { bumper: one(m.bumper), wing: one(m.wing), struts: (m.struts || []).map(one).filter(Boolean), heads: byMat('lamp'), tails: byMat('tail'), cabin };
  if (m.soft) out.soft = m.soft;
  const rig = RIGS[def.model]; if (rig) out.anim = rig(O, def);
  return { ...out, ...K.wheels(m.wheels, { knobbly: !!m.knobbly, hub: m.hub === 'accent' ? def.accent : m.hub }) };
}
// Moving parts, by car: (parts by name, def) -> anim(v, c, now). Filled in with the cars that have them.
export const RIGS = {};
