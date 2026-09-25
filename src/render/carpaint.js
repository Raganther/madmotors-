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
