// Car anatomy: the panels every car comes apart into, shared by the simulation (core/sim/damage.js: which panels a hit
// lands on and how battered each is) and the renderer (render/anatomy.js cuts each car's body shell into them, hinges
// them, and plays the steps). Physics still runs on the four damage zones; panels are what you see happen.
// A panel goes through its steps as its damage (0..1) passes each threshold: bend (pushed in, ajar), open (swung
// on its hinge, flapping), off (torn away). `zone` is the damage zone that hits it; `k` scales the hit; a side hit
// near the nose or the tail also catches the bonnet or the boot (SPILL of it, by how far forward or back it lands).
export const PANEL_STEPS = ['bend', 'open', 'off'];
export const PANELS = [
  { id: 'bonnet', zone: 'f', k: 1.3, hinge: 'rear', steps: [0.25, 0.55, 0.85] },
  { id: 'boot', zone: 'b', k: 1.3, hinge: 'front', steps: [0.25, 0.55, 0.85] },
  { id: 'doorL', zone: 'l', k: 1.4, hinge: 'front', steps: [0.25, 0.6, 0.9] },
  { id: 'doorR', zone: 'r', k: 1.4, hinge: 'front', steps: [0.25, 0.6, 0.9] },
];
export const SPILL = 0.6;
// Vehicles whose body has no closed shell to cut (open wheels, a frame, a drum): they dent and shed parts the old way.
// The e2e run checks every other vehicle gets its panels with both providers.
export const NO_PANELS = ['formula', 'hotrod', 'kart', 'rover', 'sidecar', 'mixer'];
