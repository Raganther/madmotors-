import { CAM_DIR } from '../constants.js';

// The camera's screen axes for a view direction `dir` (from the focus toward the camera; default the classic
// camera), built the way three.js' lookAt does with world up = +y: right = normalize(up × dir), screenUp = dir × right.
// The renderer tells the race which way it's looking (R.camDir) so Showdown judges "on screen" by the real view.
function axes(dir) {
  const [dx, dy, dz] = dir, RL = Math.hypot(dz, dx), R = [dz / RL, 0, -dx / RL];
  return [R, [dy * R[2] - dz * R[1], dz * R[0] - dx * R[2], dx * R[1] - dy * R[0]]];
}
const CLASSIC = axes(CAM_DIR);
/** Where a world point sits on screen relative to the camera's focus: [right, up] in metres. */
export function screenOffset(x, y, z, f, dir) {
  const [R, U] = dir ? axes(dir) : CLASSIC, ex = x - f.x, ey = y - f.y, ez = z - f.z;
  return [ex * R[0] + ey * R[1] + ez * R[2], ex * U[0] + ey * U[1] + ez * U[2]];
}
/** Inverse for directions on the ground: the world (x, z) heading that shows on screen along [right, up]. */
export function groundDir(sx, sy, dir) {
  const [R, U] = dir ? axes(dir) : CLASSIC, det = R[0] * U[2] - R[2] * U[0];
  const gx = (sx * U[2] - sy * R[2]) / det, gz = (sy * R[0] - sx * U[0]) / det, l = Math.hypot(gx, gz) || 1;
  return [gx / l, gz / l];
}
