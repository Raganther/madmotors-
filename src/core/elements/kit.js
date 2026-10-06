// The world kit (core/kit/layout.js): stage `towns` lays towns out along the road from data/styles.js. The layout
// itself is built with the terrain (core/track/terrain.js, terr.kit) because it sits on the ground; its pieces are
// hit through the breakables feature and drawn by render/elements/kit.js. This element only owns the stage key.
import { STYLE_IDS } from '../../data/styles.js';
export const element = {
  name: 'kit',
  about: 'towns from the world kit: plots, houses, drives, gates, fences, side roads, street furniture',
  stageKeys: { towns: `towns along the road: [{ style: ${STYLE_IDS.join(' | ')}, at: metres from the start, len: metres, side: 'both' | 'left' | 'right', steep: m (default 3.2) }]` },
  track(ctx, out) { out.towns = ctx.stage.towns || null; },
  markers: tr => (tr.towns || []).map(t => ({ i: tr.loopN ? (tr.startIdx + Math.round(t.at)) % tr.loopN : tr.startIdx + Math.round(t.at), label: `${t.style} town ${t.len}m` }))
};
