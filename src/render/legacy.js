import * as THREE from 'three';

// The game's look was tuned on three.js r128. Current three.js manages colour (hex colours read as sRGB and converted
// to linear, the frame converted back on output) and lights in physical units. Every colour, light and shader here was
// tuned the old way, so: colour management off, the frame written as it is computed, and the lights scaled to what
// r128 drew for them (SUN for direct lights, SKY for hemisphere and ambient light; measured against r128 screenshots).
// Imported first in main.js, before anything makes a colour.
THREE.ColorManagement.enabled = false;
// r128 drew a see-through double-sided material in one pass; current three.js draws it twice (back faces, then front),
// which doubled the cost of the biggest scenery mesh. One pass for every material, as before.
Object.defineProperty(THREE.Material.prototype, 'forceSinglePass', { get: () => true, set: () => {}, configurable: true });
/** Multiply a direct (sun) light's intensity by this to get what r128 drew for it. */
export const SUN = 2;
/** Multiply a hemisphere or ambient light's intensity by this to get what r128 drew for it. */
export const SKY = 1;
/** A renderer that writes its colours the way r128 did. */
export function legacyRenderer(r) { r.outputColorSpace = THREE.LinearSRGBColorSpace; return r; }
