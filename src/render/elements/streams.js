import { lerp } from '../../core/math.js';
import { waterGrid, waterMaterial } from '../water.js';

// Mountain streams (core/elements/streams.js): a water sheet down each channel, every 2.5 m, at the stream's level
// there, so it runs downhill and pours over wherever the level steps. Like the river's (river.js), the sheet is wider
// than the water and render/water.js fades it out where the bank rises through it.
export function addStreams(group, tr, terr) {
  for (const st of tr.streams || []) {
    const P = st.pts, hw = st.width / 2 + 6, STEP = 2.5, line = [];
    for (let k = 0; k < P.length - 1; k++) {
      const [ax, az, ah] = P[k], [bx, bz, bh] = P[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.max(1, Math.ceil(L / STEP)), dx = (bx - ax) / L, dz = (bz - az) / L;
      for (let q = 0; q < n; q++) line.push([lerp(ax, bx, q / n), lerp(az, bz, q / n), lerp(ah, bh, q / n), dx, dz]);
    }
    const [lx, lz, lh] = P[P.length - 1]; line.push([lx, lz, lh, line[line.length - 1][3], line[line.length - 1][4]]);
    const C = Math.ceil(2 * hw / STEP) + 1;
    const m = waterGrid(line.length, C, (r, c) => { const [x, z, y, dx, dz] = line[r], o = -hw + c * 2 * hw / (C - 1), wx = x - dz * o, wz = z + dx * o; return [wx, y, wz, terr.at(wx, wz)]; }, waterMaterial({ color: st.color || 0x4A86A8, alpha: 0.9 }));
    if (m) group.add(m);
  }
}
