// Upgrade parts (F5): what a car is built from beyond its stock body. Seven slots, three levels each; every level is a
// part you can see on the car (render/parts.js fits it at the car's anchors: bonnet, boot, roof, nose, sides, wheels).
// A slot's `fx` gives the multipliers on the vehicle's handling at level L (1..3), keyed like data/vehicles.js `veh`
// (accel, top, grip, off, im, and tough / ram, which default to 1). Tyres come in kinds (a sidegrade, swapped free
// in the garage): road tyres grip on tarmac, gravel tyres trade a little of that for pace on loose ground.
// A car's build is { eng, tyr, sus, arm, aero, ram, cage: level, tyrKind: 'road' | 'gravel' } (missing = 0 / road),
// the same object the career keeps per car (with its paint), so career saves from before F5 load unchanged.
import { costCurve } from './prices.js';

export const PART_MAX = 3;
export const TYRE_KINDS = {
  road: { name: 'Road', blurb: 'Grip in the corners', fx: L => ({ grip: 1 + 0.03 * L }) },
  gravel: { name: 'Gravel', blurb: 'Knobbly: pace on gravel, mud and snow, a little less bite on tarmac', fx: L => ({ grip: 1 + 0.01 * L, off: 1 + 0.03 * L }) },
};
/** The slots, in garage order. price: per level (data/prices.js: each level COST_GROW times the last); looks: what each level fits to the car. */
export const SLOTS = [
  { id: 'eng', name: 'Engine', blurb: 'Acceleration and top speed', price: costCurve(1500), fx: L => ({ accel: 1 + 0.03 * L, top: 1 + 0.015 * L }), looks: ['Bonnet scoop', 'Big scoop and side pipes', 'Supercharger'] },
  { id: 'tyr', name: 'Tyres', blurb: 'Grip, or pace on the loose with gravel tyres', price: costCurve(1500), kinds: TYRE_KINDS, looks: ['Wider tyres', 'Wider still', 'Fat tyres'] },
  { id: 'sus', name: 'Suspension', blurb: 'Pace on gravel, mud and snow', price: costCurve(1500), fx: L => ({ off: 1 + 0.04 * L }), looks: ['Lifted, long springs', 'More lift', 'Long-travel coilovers'] },
  { id: 'arm', name: 'Armour', blurb: 'Heavier: shove rivals, get shoved less', price: costCurve(1500), fx: L => ({ im: 1 - 0.08 * L }), looks: ['Sill plates', 'Door plates', 'Full plating and window mesh'] },
  { id: 'aero', name: 'Aero', blurb: 'Downforce: grip for a little top speed', price: costCurve(1250), fx: L => ({ grip: 1 + 0.02 * L, top: 1 - 0.005 * L }), looks: ['Lip spoiler', 'Wing', 'Big wing and splitter'] },
  { id: 'ram', name: 'Ram bar', blurb: 'Hit harder: smash fences, gates and walls', price: costCurve(1000), fx: L => ({ ram: 1 + 0.2 * L }), looks: ['Nudge bar', 'Bull bar', 'Plough'] },
  { id: 'cage', name: 'Roll cage', blurb: 'Tougher: every hit does less damage', price: costCurve(1250), fx: L => ({ tough: 1 + 0.12 * L }), looks: ['Roof hoop', 'Hoop and roof bars', 'Full cage and lamp pod'] },
];
export const SLOT_IDS = SLOTS.map(s => s.id);
export const slotById = id => SLOTS.find(s => s.id === id);
/** Slot `s`'s multipliers at level L in build b (tyres by the kind fitted). */
export const slotFx = (s, L, b = {}) => s.kinds ? (s.kinds[b.tyrKind] || s.kinds.road).fx(L) : s.fx(L);
/** Handling `veh` (stock, from data/vehicles.js) with build b fitted. */
export function buildVeh(veh, b) {
  const v = { ...veh }; if (!b) return v;
  for (const s of SLOTS) { const L = b[s.id] || 0; if (L) for (const [k, m] of Object.entries(slotFx(s, L, b))) v[k] = (v[k] ?? 1) * m; }
  return v;
}
/** Just the parts of an owned-car record (no paint), or null when nothing is fitted (stock). */
export function buildOf(own) {
  if (!own) return null;
  const b = {}; for (const id of SLOT_IDS) if (own[id]) b[id] = Math.min(PART_MAX, own[id] | 0);
  if (own.tyrKind && own.tyrKind !== 'road' && TYRE_KINDS[own.tyrKind]) b.tyrKind = own.tyrKind;
  return Object.keys(b).length ? b : null;
}
/** A short key for a build (thumbnail caches): '' when stock. */
export const buildKey = b => b ? SLOT_IDS.map(id => b[id] || 0).join('') + (b.tyrKind ? b.tyrKind[0] : '') : '';
