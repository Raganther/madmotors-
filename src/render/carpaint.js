import * as THREE from 'three';

// Car paint: the racers use physically based materials lit by a small generated sky (scene.environment, built per
// stage from its sky and ground colours plus a sun), so the paint picks up a sheen that slides over the body as it
// turns, glass reflects the sky, chrome gleams and tyres stay dull. Scenery keeps its matte materials (they ignore
// the environment). Every body part carries a vertex-colour occlusion term (baked in carmodels.js): undersides, the
// lower sills and the insides of arches sit darker, so the shapes read in depth; and each face is shaded toward its
// edges with a fine grain (panelTex), so the boxes read as panels rather than flat colour.
const KIND = {
  paint: { metalness: 0.15, roughness: 0.6, envMapIntensity: 0.4 },
  glass: { metalness: 0.5, roughness: 0.08, envMapIntensity: 0.9 },
  chrome: { metalness: 1.0, roughness: 0.2, envMapIntensity: 1.0 },
  rubber: { metalness: 0.0, roughness: 0.92, envMapIntensity: 0.15 },
  trim: { metalness: 0.2, roughness: 0.65, envMapIntensity: 0.35 }
};
// every face of a body part: darker toward its edges (reads as a bevelled, shaded panel) with a fine grain in the paint
let panel = null;
function panelTex() {
  if (panel) return panel;
  const N = 128, cv = document.createElement('canvas'); cv.width = cv.height = N; const g = cv.getContext('2d'), img = g.createImageData(N, N);
  let seed = 17; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const e = Math.min(x, y, N - 1 - x, N - 1 - y) / N, edge = e < 0.012 ? 0.62 : 1 - 0.2 * Math.max(0, 1 - e / 0.09) ** 2;
    const v = Math.round(255 * Math.min(1, edge * (0.965 + rnd() * 0.05))), q = (y * N + x) * 4;
    img.data[q] = img.data[q + 1] = img.data[q + 2] = v; img.data[q + 3] = 255;
  }
  g.putImageData(img, 0, 0); panel = new THREE.CanvasTexture(cv); panel.anisotropy = 4; return panel;
}
export function carMat(kind, color, extra = {}) { return new THREE.MeshStandardMaterial({ color, vertexColors: true, map: kind === 'rubber' ? null : panelTex(), ...KIND[kind], ...extra }); }
const gens = new WeakMap();
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
/** Bake the occlusion term into a body part's geometry (height oy above the ground where its origin sits). */
export function bakeAO(geo, oy) {
  if (geo.attributes.color) return geo;
  if (!geo.attributes.normal) geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, col = new Float32Array(p.count * 3);
  for (let k = 0; k < p.count; k++) {
    let f = 0.52 + 0.48 * smooth(0.1, 1.15, p.getY(k) + oy);
    if (n.getY(k) < -0.5) f *= 0.55; else if (n.getY(k) > 0.5) f = Math.min(1, f + 0.08);
    col[k * 3] = col[k * 3 + 1] = col[k * 3 + 2] = f;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3)); return geo;
}
/** Build the reflection environment for a stage: sky above, ground below, a bright sun, a soft horizon band. */
export function setCarEnvironment(renderer, scene, stage) {
  let st = gens.get(renderer); if (!st) gens.set(renderer, st = { pmrem: new THREE.PMREMGenerator(renderer), rt: null });
  const s = new THREE.Scene(), sky = new THREE.Color(stage.colors.sky), ground = new THREE.Color(stage.light.ground || 0x4A5040), top = sky.clone().multiplyScalar(0.8);
  const geo = new THREE.SphereGeometry(10, 32, 16), col = [], p = geo.attributes.position, c = new THREE.Color();
  for (let k = 0; k < p.count; k++) {
    const y = p.getY(k) / 10;
    if (y > 0.04) c.copy(sky).lerp(top, Math.min(1, y * 1.4)).multiplyScalar(0.85); else if (y > -0.04) c.copy(sky).multiplyScalar(0.95); else c.copy(ground).multiplyScalar(0.6);
    col.push(c.r, c.g, c.b);
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  s.add(new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
  const sun = new THREE.Mesh(new THREE.SphereGeometry(0.9, 12, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(stage.light.sun || 0xFFFFFF).multiplyScalar(3) }));
  sun.position.set(-5, 8.5, -2); s.add(sun);
  const rt = st.pmrem.fromScene(s, 0.02);
  if (st.rt) st.rt.dispose(); st.rt = rt; scene.environment = rt.texture;
  geo.dispose();
}
// ---------- close-up detail textures (canvas-drawn once, shared by every car) ----------
const texCache = {};
function canvasOnce(key, w, h, draw) {
  if (texCache[key]) return texCache[key];
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h; draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv); t.anisotropy = 4; return (texCache[key] = t);
}
/**
 * Tyre tread for the close-up wheel (carmodels.js nearWheel), laid out on its lathe: u runs round the tyre, v across
 * its profile, with the tread face between v0 and v1 and the shoulders either side. White = rubber, dark = grooves;
 * the same picture is the bump map, so the grooves sink in.
 */
export function treadTex(v0, v1) {
  return canvasOnce('tread' + v0 + v1, 512, 128, (g, W, H) => {
    g.fillStyle = '#fff'; g.fillRect(0, 0, W, H);
    const y = v => (1 - v) * H, t0 = y(v1), t1 = y(v0), mid = (t0 + t1) / 2, tw = t1 - t0, N = 36;
    g.fillStyle = '#3a3a3a';
    for (const f of [0.3, 0.7]) g.fillRect(0, t0 + tw * f - 1.5, W, 3);                  // two grooves round the tyre
    g.strokeStyle = '#3a3a3a'; g.lineWidth = 2.2;
    for (let k = 0; k < N; k++) {                                                          // chevron sipes across the face, blocks on the shoulders
      const x = k / N * W;
      g.beginPath(); g.moveTo(x, t0 - tw * 0.35); g.lineTo(x + 6, mid); g.lineTo(x, t1 + tw * 0.35); g.stroke();
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';                                                      // sidewall: a moulded ring
    for (const f of [0.1, 0.9]) g.fillRect(0, f * H - 1, W, 2);
  });
}
/** A grille: chrome surround, dark slats. */
export function grilleTex() {
  return canvasOnce('grille', 128, 64, (g, W, H) => {
    g.fillStyle = '#d8dbe0'; g.fillRect(0, 0, W, H);
    g.fillStyle = '#15171b'; g.fillRect(6, 6, W - 12, H - 12);
    g.fillStyle = '#8c9098'; for (let y = 10; y < H - 8; y += 7) g.fillRect(8, y, W - 16, 2.5);
    g.fillStyle = '#5a5e66'; for (let x = 16; x < W - 10; x += 16) g.fillRect(x, 8, 2, H - 16);
  });
}
/** Lamp lenses: a bright core in reflector rings (round lamps get the rings, square ones a grid of facets). */
export function lensTex() {
  return canvasOnce('lens', 64, 64, (g, W, H) => {
    const gr = g.createRadialGradient(W / 2, H / 2, 2, W / 2, H / 2, W / 2);
    gr.addColorStop(0, '#ffffff'); gr.addColorStop(0.5, '#e6e6e6'); gr.addColorStop(1, '#a8a8a8'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.strokeStyle = 'rgba(0,0,0,0.16)'; g.lineWidth = 1.5;
    for (let r = 8; r < W / 2; r += 7) { g.beginPath(); g.arc(W / 2, H / 2, r, 0, Math.PI * 2); g.stroke(); }
    g.strokeStyle = 'rgba(0,0,0,0.1)'; for (let x = 8; x < W; x += 8) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
  });
}
