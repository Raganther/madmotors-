import * as THREE from 'three';

// Shapes for the natural scenery (world/scenery.js instances them). Still low-poly and faceted, but each one has more
// facets than a bare primitive, a little irregularity (vertices nudged by a hash of where they sit, so shared corners
// stay together), soft facet normals (half way to smooth, so faces still read but light rolls over the form) and
// baked shading in the vertex colours: darker underneath and in the crevices, lighter on top. The instance colour
// multiplies it, so every tree still gets its own tint.
const hash = (x, y, z, s) => { const v = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 19.19) * 43758.5453; return v - Math.floor(v); };
function jitter(g, amt, seed, keepY = false) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), r = Math.round(x * 1e3) / 1e3, t = Math.round(y * 1e3) / 1e3, u = Math.round(z * 1e3) / 1e3;
    p.setXYZ(i, x + (hash(r, t, u, seed) - 0.5) * amt, keepY ? y : y + (hash(u, r, t, seed + 1) - 0.5) * amt, z + (hash(t, u, r, seed + 2) - 0.5) * amt);
  }
  return g;
}
// flat per-face normals blended with smooth ones (k = 0 faceted, 1 smooth)
function soften(g, k) {
  const n = g.index ? g.toNonIndexed() : g; n.computeVertexNormals();
  const p = n.attributes.position, fl = n.attributes.normal, acc = new Map(), key = i => Math.round(p.getX(i) * 1e3) + ',' + Math.round(p.getY(i) * 1e3) + ',' + Math.round(p.getZ(i) * 1e3);
  for (let i = 0; i < p.count; i++) { const kk = key(i); const a = acc.get(kk) || [0, 0, 0]; a[0] += fl.getX(i); a[1] += fl.getY(i); a[2] += fl.getZ(i); acc.set(kk, a); }
  for (let i = 0; i < p.count; i++) {
    const a = acc.get(key(i)), l = Math.hypot(a[0], a[1], a[2]) || 1;
    const x = fl.getX(i) * (1 - k) + a[0] / l * k, y = fl.getY(i) * (1 - k) + a[1] / l * k, z = fl.getZ(i) * (1 - k) + a[2] / l * k, m = Math.hypot(x, y, z) || 1;
    fl.setXYZ(i, x / m, y / m, z / m);
  }
  return n;
}
// vertex colours from a shade function of position and normal (grey unless it returns an [r, g, b])
function shade(g, f) {
  const p = g.attributes.position, n = g.attributes.normal, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const v = f(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i)); if (Array.isArray(v)) c.set(v, i * 3); else c[i * 3] = c[i * 3 + 1] = c[i * 3 + 2] = v; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
function mergeC(geos) {
  let n = 0; for (const g of geos) n += g.attributes.position.count;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), col = new Float32Array(n * 3); let o = 0;
  for (const g of geos) { pos.set(g.attributes.position.array, o * 3); nor.set(g.attributes.normal.array, o * 3); col.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry(); out.setAttribute('position', new THREE.BufferAttribute(pos, 3)); out.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); out.setAttribute('color', new THREE.BufferAttribute(col, 3)); return out;
}
const sm = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

export function trunk() {
  return shade(soften(jitter(new THREE.CylinderGeometry(0.13, 0.27, 2.0, 7, 2).translate(0, 1.0, 0), 0.05, 3, true), 0.6), (x, y) => 0.7 + 0.35 * sm(0, 1.6, y));
}
// three tiers of branches, each drooping a little at its rim and darker underneath and toward the trunk
const TIERS = [[1.85, 2.3, 2.1], [1.4, 2.0, 3.25], [0.95, 1.7, 4.35]];
export function pine() {
  return mergeC(TIERS.map(([r, h, y], n) => {
    const g = jitter(new THREE.ConeGeometry(r, h, 9, 1).translate(0, y, 0), 0.16, 10 + n);
    return shade(soften(g, 0.45), (x, yy, z, nx, ny) => { const rel = (yy - (y - h / 2)) / h, rim = Math.hypot(x, z) / r; return (0.62 + 0.45 * rel) * (ny < -0.2 ? 0.6 : 1) * (0.9 + 0.12 * rim); });
  }));
}
export function pineSnow() {
  return mergeC(TIERS.map(([r, h, y], n) => shade(soften(jitter(new THREE.ConeGeometry(r * 0.62, h * 0.55, 9, 1).translate(0, y + h * 0.24, 0), 0.08, 20 + n), 0.5), () => 1)));
}
// a round-topped tree: a cluster of lumpy balls, shaded like a canopy (dark underside, sunlit crown)
export function round() {
  const blobs = [[1.45, 0, 3.2, 0], [1.1, 0.75, 3.75, 0.35], [1.05, -0.65, 3.8, -0.45]];
  return mergeC(blobs.map(([r, x, y, z], n) => shade(soften(jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.16, 30 + n).translate(x, y, z), 0.55), (px, py, pz, nx, ny) => (0.58 + 0.5 * sm(2.2, 4.9, py)) * (0.85 + 0.2 * Math.max(0, ny)))));
}
export function bush() {
  const blobs = [[1, 0, 0, 0], [0.78, 0.65, -0.15, 0.25]];
  return mergeC(blobs.map(([r, x, y, z], n) => shade(soften(jitter(new THREE.IcosahedronGeometry(r, 1), r * 0.18, 40 + n).translate(x, y, z), 0.55), (px, py, pz, nx, ny) => 0.62 + 0.45 * sm(-0.8, 0.8, py) * (0.8 + 0.2 * Math.max(0, ny)))));
}
// rocks: three lumpy shapes, flat-bottomed; lighter on top, and on green stages a mossy tinge where they face the sky
export function rock(n, moss) {
  const g = jitter(new THREE.IcosahedronGeometry(1, 1), 0.34, 50 + n * 7), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) if (p.getY(i) < -0.35) p.setY(i, -0.35 - (p.getY(i) + 0.35) * 0.2);
  const m = moss !== null && moss !== undefined ? new THREE.Color(moss) : null, l = m ? (m.r + m.g + m.b) / 3 || 1 : 1;
  return shade(soften(g, 0.3), (x, y, z, nx, ny) => {
    const v = 0.62 + 0.42 * sm(-0.4, 0.8, y);
    if (!m || ny < 0.55) return v;
    const k = sm(0.55, 0.9, ny) * 0.55; return [v * (1 - k + k * m.r / l), v * (1 - k + k * m.g / l), v * (1 - k + k * m.b / l)];
  });
}
export function cactus() {
  const cyl = (r, h) => new THREE.CylinderGeometry(r, r, h, 8);
  const parts = [cyl(0.34, 3.6).translate(0, 1.8, 0), cyl(0.22, 0.9).rotateZ(Math.PI / 2).translate(0.55, 1.5, 0), cyl(0.22, 1.2).translate(0.95, 2.0, 0), cyl(0.2, 0.7).rotateZ(Math.PI / 2).translate(-0.45, 2.1, 0), cyl(0.2, 1.0).translate(-0.75, 2.55, 0)];
  return mergeC(parts.map(g => shade(soften(g, 0.5), (x, y, z, nx, ny) => (0.72 + 0.3 * sm(0, 3.4, y)) * (0.92 + 0.08 * Math.sin(Math.atan2(z, x) * 8))   /* ribs */)));
}
