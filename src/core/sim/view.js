import { CAM_DIR } from '../constants.js';

// The camera's screen axes, built the way three.js' lookAt does with world up = +y:
// right = normalize(up × dir), screenUp = dir × right.
const [dx, dy, dz] = CAM_DIR;
const RL = Math.hypot(dz, dx), RIGHT = [dz / RL, 0, -dx / RL];
const UP = [dy * RIGHT[2] - dz * RIGHT[1], dz * RIGHT[0] - dx * RIGHT[2], dx * RIGHT[1] - dy * RIGHT[0]];

/** Where a world point sits on screen relative to the camera's focus: [right, up] in metres. */
export function screenOffset(x, y, z, f) {
  const ex = x - f.x, ey = y - f.y, ez = z - f.z;
  return [ex * RIGHT[0] + ey * RIGHT[1] + ez * RIGHT[2], ex * UP[0] + ey * UP[1] + ez * UP[2]];
}
