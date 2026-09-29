# Car family: every racer's body, modelled from a design (below) with the shared car kit. A design gives the body
# (width, bonnet/deck and underside heights along the car, how square it is), the glasshouse, the wheels (arches are
# cut round them) and its extras. Each car packs to src/assets/gen/car-<model>.js with a near (hi) and a far (lo)
# level and meta the game's builder reads (render/assets/cars.js): wheels, which parts dent, the bumper, the wing,
# the cabin glass, and parts a rig animates. The hitbox is the game's: keep inside x +-1.25, z +-2.2.
import math, bpy
from kit import *

def body(keys, zs, n=6, tumble=0.1, ring=24, sub=2, name='body', wtop=None):
    """keys: W (half width), TOP (bonnet/deck height), BOT (underside) as [(z, v)] from the nose back."""
    def sec(z):
        w, top, bot = lerp_keys(keys['W'], z), lerp_keys(keys['TOP'], z), lerp_keys(keys['BOT'], z)
        return superellipse(w, (top + bot) / 2, (top - bot) / 2, n, tumble, None if wtop is None else lerp_keys(wtop, z))
    o = loft(name, [(z, sec(z)) for z in zs], ring, ['paint', 'trim']); smooth(o, sub); return o
def arches(o, wheels, gap=0.05, depth=0.9):
    for x, z, r, wd in wheels:
        c = cyl('_cut', r + gap, depth, (math.copysign(abs(x) + 0.1, x), r, z), 'x', 'trim', verts=40); cut(o, c)
def sill(o, y=0.42):
    """Dark underside and sills below height y."""
    by_faces(o, lambda c, n: 'trim' if c[1] < y else None)
def glasshouse(zs, base, roof, wb, wt, name='cabin', roof_z=None, sub=1, roof_paint=True):
    """A cabin: at each z, base height `base`, roof height roof(z), half widths wb(z) at the base and wt(z) at the top."""
    def sec(z):
        b, r, w0, w1 = base, lerp_keys(roof, z), lerp_keys(wb, z), lerp_keys(wt, z)
        return poly_section([(-w0, b - 0.05), (-w0 * 0.99, b + 0.08), (-w1, r - 0.07), (-w1 * 0.8, r), (w1 * 0.8, r), (w1, r - 0.07), (w0 * 0.99, b + 0.08), (w0, b - 0.05)])
    o = loft(name, [(z, sec(z)) for z in zs], 8, ['glass']); smooth(o, sub)
    if roof_paint:
        z0, z1 = roof_z
        by_faces(o, lambda c, n: 'paint' if (c[1] > lerp_keys(roof, c[2]) - 0.06 and abs(c[0]) < lerp_keys(wt, c[2]) * 0.82 and z1 < c[2] < z0) else None)
    shade(o); return o
def stripes(target, xs, spans, width=0.2, lift=0.006, step=0.06, name='stripes'):
    """Decals ray-cast onto `target`'s top: at each x centre, along each (z0, z1) span."""
    from mathutils.bvhtree import BVHTree
    import bmesh
    tree = BVHTree.FromObject(target, bpy.context.evaluated_depsgraph_get())
    def surf(x, z):
        h = tree.ray_cast(Vector(B(x, 4, z)), Vector((0, 0, -1))); return h[0].z + lift if h[0] else None
    sb = bmesh.new()
    for cx in xs:
        for z0, z1 in spans:
            n = max(2, int(abs(z1 - z0) / step)); prev = None
            for k in range(n + 1):
                z = z0 + (z1 - z0) * k / n; ys = [surf(cx - width / 2, z), surf(cx + width / 2, z)]
                if None in ys: prev = None; continue
                row = [sb.verts.new(B(cx - width / 2, ys[0], z)), sb.verts.new(B(cx + width / 2, ys[1], z))]
                if prev: sb.faces.new((prev[0], prev[1], row[1], row[0]))
                prev = row
    for f in sb.faces:
        f.normal_update()
        if f.normal.z < 0: f.normal_flip()
    o = obj(name, sb, ['accent']); shade(o); return o
def lamps(xs, y, z, r=0.1, name='lamp'):
    return [cyl(f'{name}{k}', r, 0.1, (x, y, z), 'z', 'lamp', 24) for k, x in enumerate(xs)]
def tails(xs, y, z, w=0.5, h=0.1):
    return [rbox(f'tail{k}', (w, h, 0.05), (x, y, z), 'tail', 0.02) for k, x in enumerate(xs)]
def preview_wheels(wheels):
    out = []
    for x, z, r, wd in wheels:
        out.append(cyl('_tyre', r, wd, (x, r, z), 'x', 'tyre', 32)); out.append(cyl('_hub', r * 0.6, wd + 0.02, (x, r, z), 'x', 'hub', 24))
    return out
def lo_copy(o, ratio):
    """The far level: a copy decimated to `ratio` (small parts stay as they are)."""
    c = o.copy(); c.data = o.data.copy(); bpy.context.collection.objects.link(c); decimate(c, ratio); c.name = o.name + '_lo'; c['part'] = o.name; return c
def finish(model, parts, wheels, roles, lo_ratio=0.3, extra_meta=None):
    """Pack a car: `parts` are the game's meshes (render-only wheels excluded). The far level decimates the big ones."""
    big = [o for o in parts if len(o.data.polygons) > 400]
    lo = [lo_copy(o, lo_ratio) if o in big else o for o in parts]
    hide([o for o in lo if o not in parts])
    meta = { 'wheels': wheels, **roles, **(extra_meta or {}) }
    st = pack('car-' + model, 'cars', { 'hi': parts, 'lo': lo }, meta)
    for o in lo:
        if o not in parts: bpy.data.objects.remove(o)
    return st

# ---------------------------------------------------------------------------------------------------------------------
# Designs. Each is a function building the car's objects in the current (reset) scene and returning finish(...).
DESIGNS = {}
def design(fn): DESIGNS[fn.__name__] = fn; return fn

@design
def coupe():
    """Muscle Coupe: long bonnet, fastback, flared arches over fat rear tyres, twin stripes, scoop, ducktail."""
    W = [(0.94, 1.22, 0.4, 0.3), (-0.94, 1.22, 0.4, 0.3), (1.02, -1.12, 0.46, 0.48), (-1.02, -1.12, 0.46, 0.48)]
    b = body({ 'W': [(1.86, 0.88), (1.7, 0.97), (1.45, 1.03), (1.22, 1.05), (0.95, 1.02), (0.5, 0.97), (0.0, 0.97), (-0.5, 0.99), (-0.75, 1.06), (-1.12, 1.13), (-1.45, 1.08), (-1.7, 1.0), (-1.86, 0.94)],
               'TOP': [(1.86, 0.78), (1.74, 0.88), (1.4, 0.95), (0.4, 0.99), (0.1, 1.0), (-1.2, 1.03), (-1.7, 1.03), (-1.86, 0.96)],
               'BOT': [(1.86, 0.46), (1.5, 0.36), (0.0, 0.30), (-1.5, 0.36), (-1.86, 0.48)] },
             [1.86, 1.82, 1.72, 1.55, 1.35, 1.1, 0.8, 0.5, 0.2, -0.2, -0.5, -0.75, -0.95, -1.12, -1.3, -1.5, -1.68, -1.8, -1.86])
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.33, 0.33), ((1.8, 0.36), (-1.24, -1.84)))
    roof = [(0.32, 1.0), (0.05, 1.28), (-0.25, 1.44), (-0.8, 1.45), (-1.15, 1.25), (-1.45, 1.04)]
    cab = glasshouse([0.34, 0.31, 0.2, 0.05, -0.12, -0.25, -0.4, -0.55, -0.7, -0.8, -0.95, -1.15, -1.3, -1.42, -1.46], 0.99, roof,
                     [(0.32, 0.82), (-0.5, 0.86), (-1.45, 0.84)], [(0.32, 0.76), (-0.25, 0.68), (-0.8, 0.68), (-1.45, 0.76)], roof_z=(-0.15, -1.0))
    parts = [b, s, cab, rbox('bumper', (1.96, 0.15, 0.16), (0, 0.56, 1.86), 'chrome', 0.06), rbox('rbumper', (1.94, 0.14, 0.14), (0, 0.56, -1.87), 'chrome', 0.06),
             rbox('wing', (1.72, 0.06, 0.34), (0, 1.07, -1.72), 'paint', 0.025, rot=(0.35, 0, 0)), rbox('scoop', (0.46, 0.12, 0.72), (0, 1.03, 0.72), 'paint', 0.05),
             rbox('scoopmouth', (0.36, 0.07, 0.04), (0, 1.04, 1.08), 'trim', 0.01), rbox('grille', (0.9, 0.16, 0.05), (0, 0.76, 1.84), 'trim', 0.02)]
    parts += lamps((-0.72, -0.42, 0.42, 0.72), 0.8, 1.8) + tails((-0.58, 0.58), 0.86, -1.85)
    parts += [rbox(f'exh{k}', (0.12, 0.1, 0.24), (s_ * 0.5, 0.4, -1.84), 'chrome', 0.04) for k, s_ in enumerate((-1, 1))]
    preview_wheels(W)
    return finish('coupe', parts, W, { 'dent': ['body', 'scoop', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.62, 1.47, -0.55] })
