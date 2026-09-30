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
def glasshouse(zs, base, roof, wb, wt, name='cabin', roof_z=None, sub=1, roof_paint=True, roof_mat='paint'):
    """A cabin: at each z, base height `base`, roof height roof(z), half widths wb(z) at the base and wt(z) at the top."""
    def sec(z):
        b, r, w0, w1 = base, lerp_keys(roof, z), lerp_keys(wb, z), lerp_keys(wt, z)
        return poly_section([(-w0, b - 0.05), (-w0 * 0.99, b + 0.08), (-w1, r - 0.07), (-w1 * 0.8, r), (w1 * 0.8, r), (w1, r - 0.07), (w0 * 0.99, b + 0.08), (w0, b - 0.05)])
    o = loft(name, [(z, sec(z)) for z in zs], 8, ['glass']); smooth(o, sub)
    if roof_paint:
        z0, z1 = roof_z
        by_faces(o, lambda c, n: roof_mat if (abs(n[1]) > 0.7 and c[1] > lerp_keys(roof, c[2]) - 0.15 and abs(c[0]) < lerp_keys(wt, c[2]) * 0.9 and z1 < c[2] < z0) else None)
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
    """Round lamps facing forward (heads: every part of material 'lamp')."""
    return [cyl(f'{name}{k}', r, 0.1, (x, y, z), 'z', 'lamp', 24) for k, x in enumerate(xs)]
def tails(xs, y, z, w=0.5, h=0.1, name='tail'):
    return [rbox(f'{name}{k}', (w, h, 0.05), (x, y, z), 'tail', 0.02) for k, x in enumerate(xs)]
def rects(xs, y, z, w, h, name='head', m='lamp'):
    """Rectangular lamps (m = 'lamp' or 'tail')."""
    return [rbox(f'{name}{k}', (w, h, 0.05), (x, y, z), m, 0.015) for k, x in enumerate(xs)]
def tyre(name, r, wd, loc, axis='x', hub='hub'):
    """A spare or dummy tyre with its hub, one part."""
    return join(name, [cyl(name, r, wd, loc, axis, 'tyre', 24, bevel=r * 0.18), cyl(name + '_h', r * 0.55, wd + 0.02, loc, axis, hub, 16)])
def grille(w, h, y, z, name='grille'):
    """A dark grille with chrome slats."""
    g = rbox(name, (w, h, 0.05), (0, y, z), 'trim', 0.015); n = max(2, int(h / 0.07))
    return join(name, [g] + [rbox(f'{name}_s{k}', (w * 0.92, 0.018, 0.02), (0, y - h / 2 + h * (k + 0.5) / n, z + 0.03), 'chrome', 0) for k in range(n)])
def mirrors(x, y, z, name='mirror'):
    """Wing mirrors either side at (+-x, y, z): a painted housing with the glass facing back. Near detail only."""
    out = []
    for k, s_ in enumerate((-1, 1)):
        out.append(join(f'{name}{k}', [rbox(f'{name}{k}h', (0.16, 0.1, 0.1), (s_ * x, y, z), 'paint', 0.03, segs=2), rbox(f'{name}{k}g', (0.13, 0.07, 0.01), (s_ * x, y, z - 0.052), 'glass', 0),
                                        rbox(f'{name}{k}s', (0.1, 0.03, 0.04), (s_ * (x - 0.08), y - 0.03, z + 0.01), 'trim', 0)]))
    return out
def preview_wheels(wheels):
    out = []
    for x, z, r, wd in wheels:
        out.append(cyl('_tyre', r, wd, (x, r, z), 'x', 'tyre', 32)); out.append(cyl('_hub', r * 0.6, wd + 0.02, (x, r, z), 'x', 'hub', 24))
    return out
def lo_copy(o, ratio):
    """The far level: a copy decimated to `ratio` (small parts stay as they are)."""
    c = o.copy(); c.data = o.data.copy(); bpy.context.collection.objects.link(c); decimate(c, ratio); c.name = o.name + '_lo'; c['part'] = o.name; return c
def finish(model, parts, wheels, roles, lo_ratio=0.3, extra_meta=None):
    """Pack a car: `parts` are the game's meshes (render-only wheels excluded). Occlusion is baked into vertex colours
    first (the preview wheels shade the arches), then the far level decimates the big ones."""
    bake_ao([[o for o in parts if o.data.materials and o.data.materials[0].name not in ('lamp', 'tail') and not o.data.materials[0].name.startswith('glow')]],
            0.55, 0.9, occluders=[o for o in bpy.data.objects if o.name.startswith('_tyre') or o.name.startswith('_hub')])
    # the far level: big parts decimated to lo_ratio, middling ones (rounded boxes, spheres, tubes) halved
    near = {o.name for o in parts if o.name.startswith('mirror')}   # near-only detail (wing mirrors): no far version at all
    roles = { **roles, 'near': sorted(near) } if near else roles
    lo = [lo_copy(o, lo_ratio) if len(o.data.polygons) > 400 else lo_copy(o, 0.5) if len(o.data.polygons) > 120 else o for o in parts if o.name not in near]
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
    parts += mirrors(0.9, 1.05, 0.22)
    preview_wheels(W)
    return finish('coupe', parts, W, { 'dent': ['body', 'scoop', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.62, 1.47, -0.55] })

MIR = (-1, 1)
def four(x, zf, zr, rf, wf, rr=None, wr=None, xr=None):
    """The usual four wheels: [x, z, r, width] each side, front and rear."""
    rr, wr, xr = rr or rf, wr or wf, xr or x
    return [(x, zf, rf, wf), (-x, zf, rf, wf), (xr, zr, rr, wr), (-xr, zr, rr, wr)]

@design
def hatch():
    """Rally Hatch: short and square, upright glasshouse, four spotlights on a bar, stripes, roof rack and spare, mud flaps."""
    W = four(0.96, 1.1, -1.1, 0.42, 0.34)
    b = body({ 'W': [(1.64, 0.86), (1.5, 0.94), (1.2, 0.97), (-1.4, 0.97), (-1.64, 0.93)],
               'TOP': [(1.64, 0.86), (1.5, 1.02), (1.1, 1.08), (-1.5, 1.1), (-1.64, 1.02)],
               'BOT': [(1.64, 0.42), (1.4, 0.3), (-1.4, 0.3), (-1.64, 0.44)] },
             [1.64, 1.6, 1.5, 1.35, 1.1, 0.8, 0.5, 0.2, -0.2, -0.5, -0.8, -1.1, -1.35, -1.5, -1.6, -1.64], n=8, tumble=0.06)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.32, 0.32), ((1.58, 0.5),))
    cab = glasshouse([0.56, 0.5, 0.35, 0.1, -0.2, -0.5, -0.8, -1.1, -1.28, -1.36], 1.07, [(0.56, 1.1), (0.36, 1.68), (0.2, 1.74), (-1.25, 1.74), (-1.36, 1.2)],
                     [(0.56, 0.9), (-1.36, 0.9)], [(0.56, 0.8), (-1.36, 0.82)], roof_z=(0.3, -1.3))
    rack = join('rack', [rbox(f'rack{k}', (0.06, 0.06, 1.1), (s_ * 0.62, 1.8, -0.72), 'trim', 0.02) for k, s_ in enumerate(MIR)] + [rbox(f'rackx{k}', (1.3, 0.05, 0.05), (0, 1.8, z), 'trim', 0.02) for k, z in enumerate((-0.25, -1.2))])
    parts = [b, s, cab, rack, tyre('spare', 0.34, 0.2, (0, 1.93, -0.8), 'y'),
             rbox('bumper', (2.0, 0.26, 0.28), (0, 0.58, 1.72), 'accent', 0.08), rbox('rbumper', (1.96, 0.22, 0.2), (0, 0.55, -1.7), 'trim', 0.06),
             rbox('wing', (1.62, 0.07, 0.3), (0, 1.76, -1.36), 'accent', 0.025, rot=(0.25, 0, 0)), rbox('spotbar', (1.3, 0.1, 0.1), (0, 1.17, 1.42), 'trim', 0.03),
             grille(0.84, 0.2, 0.86, 1.64), join('flaps', [rbox(f'flap{k}', (0.36, 0.3, 0.04), (s_ * 0.95, 0.34, -1.6), 'tyre', 0.01) for k, s_ in enumerate(MIR)])]
    parts += lamps((-0.48, -0.16, 0.16, 0.48), 1.26, 1.47, 0.13, 'spot') + [join('spotcans', [cyl(f'can{k}', 0.15, 0.14, (x, 1.26, 1.4), 'z', 'chrome', 20) for k, x in enumerate((-0.48, -0.16, 0.16, 0.48))])]
    parts += rects((-0.64, 0.64), 0.88, 1.66, 0.34, 0.2) + tails((-0.66, 0.66), 0.92, -1.66, 0.36, 0.18)
    parts += mirrors(0.97, 1.13, 0.45)
    preview_wheels(W)
    return finish('hatch', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'struts': ['spare'], 'cabin': 'cabin', 'number': [0.72, 1.76, 0.0] })

@design
def wedge():
    """Group B Wedge: long low arrowhead, cockpit forward, louvred engine cover, side intakes, big wing on tall stands."""
    W = four(0.98, 1.25, -1.18, 0.38, 0.3, 0.42, 0.44, 1.0)
    b = body({ 'W': [(1.84, 0.6), (1.5, 0.8), (1.0, 0.92), (0.4, 0.98), (-0.55, 1.0), (-0.75, 1.04), (-1.84, 1.03)],
               'TOP': [(1.84, 0.5), (1.7, 0.62), (1.0, 0.76), (0.3, 0.88), (-1.84, 0.93)],
               'BOT': [(1.84, 0.4), (1.4, 0.26), (-1.6, 0.26), (-1.84, 0.34)] },
             [1.84, 1.8, 1.7, 1.5, 1.25, 1.0, 0.7, 0.4, 0.1, -0.2, -0.5, -0.65, -0.8, -1.0, -1.2, -1.4, -1.6, -1.75, -1.84], n=5, tumble=0.14)
    arches(b, W); sill(b, 0.36); decimate(b, 0.3); shade(b)
    cab = glasshouse([0.98, 0.9, 0.75, 0.55, 0.3, 0.05, -0.2, -0.4, -0.55, -0.62], 0.86, [(0.98, 0.86), (0.55, 1.2), (0.2, 1.31), (-0.35, 1.3), (-0.62, 1.0)],
                     [(0.98, 0.72), (-0.62, 0.76)], [(0.98, 0.5), (-0.62, 0.56)], roof_z=(0.2, -0.4))
    cover = rbox('cover', (1.5, 0.2, 1.1), (0, 1.0, -0.98), 'paint', 0.06)
    parts = [b, cab, cover, join('louvres', [rbox(f'lv{k}', (1.2, 0.03, 0.06), (0, 1.11, -1.2 - k * 0.1), 'trim', 0.01) for k in range(4)]),
             join('intakes', [rbox(f'in{k}', (0.1, 0.24, 0.7), (s_ * 0.98, 0.74, -0.4), 'trim', 0.03) for k, s_ in enumerate(MIR)]),
             stripes(b, (0,), ((1.8, 0.95),), 0.5, name='hoodstripe'),
             rbox('bumper', (1.36, 0.08, 0.36), (0, 0.36, 1.76), 'accent', 0.03), rbox('wing', (2.1, 0.08, 0.55), (0, 1.52, -1.6), 'accent', 0.03),
             rbox('strut0', (0.08, 0.5, 0.14), (-0.56, 1.22, -1.6), 'trim', 0.02), rbox('strut1', (0.08, 0.5, 0.14), (0.56, 1.22, -1.6), 'trim', 0.02)]
    parts += rects((-0.5, 0.5), 0.64, 1.73, 0.34, 0.07) + tails((-0.58, 0.58), 0.8, -1.86, 0.62, 0.12)
    parts += mirrors(0.8, 0.93, 0.8)
    preview_wheels(W)
    return finish('wedge', parts, W, { 'dent': ['body', 'cover', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'struts': ['strut0', 'strut1'], 'cabin': 'cabin', 'number': [0.66, 1.115, -0.8] })

@design
def buggy():
    """Trophy Buggy: open cockpit in a tube cage, knobbly wheels out at the corners, light bar, nudge bar, spare on the deck."""
    W = four(1.12, 1.2, -1.2, 0.5, 0.42)
    b = body({ 'W': [(1.9, 0.5), (1.6, 0.66), (1.2, 0.74), (-1.0, 0.75), (-1.1, 0.7)],
               'TOP': [(1.9, 0.8), (1.5, 0.98), (1.0, 1.08), (-1.1, 1.08)],
               'BOT': [(1.9, 0.62), (1.5, 0.58), (-1.1, 0.7)] },
             [1.9, 1.85, 1.75, 1.6, 1.4, 1.2, 1.0, 0.7, 0.4, 0.1, -0.2, -0.5, -0.8, -1.0, -1.1], n=6, tumble=0.1)
    decimate(b, 0.35); shade(b)
    T, top = 0.045, 1.9
    cage = [tube(f'c{k}', (x, 1.06, z), (x, top, z), T, 'accent') for k, (x, z) in enumerate([(-0.66, 0.42), (0.66, 0.42), (-0.66, -0.78), (0.66, -0.78)])]
    cage += [tube(f'cs{k}', (s_ * 0.66, top, 0.42), (s_ * 0.66, top, -0.78), T, 'accent') for k, s_ in enumerate(MIR)]
    cage += [tube(f'cx{k}', (-0.66, top, z), (0.66, top, z), T, 'accent') for k, z in enumerate((0.42, -0.78))]
    cage += [tube(f'cb{k}', (s_ * 0.66, top, -0.78), (s_ * 0.6, 0.8, -1.55), T, 'accent') for k, s_ in enumerate(MIR)]
    parts = [b, rbox('chassis', (1.46, 0.2, 3.1), (0, 0.66, 0), 'trim', 0.05), join('seats', [rbox(f'seat{k}', (0.5, 0.36, 0.6), (s_ * 0.32, 1.14, -0.25), 'trim', 0.1) for k, s_ in enumerate(MIR)]),
             sphere('driver', 0.2, (-0.32, 1.46, -0.12), 'accent'), join('cage', cage),
             rbox('cabin', (1.2, 0.34, 0.04), (0, 1.3, 0.5), 'glass', 0.015, rot=(-0.3, 0, 0)),
             join('lightbar', [rbox('lb', (1.3, 0.12, 0.12), (0, top + 0.1, 0.44), 'trim', 0.03)] + [cyl(f'lbc{k}', 0.11, 0.1, (x, top + 0.1, 0.49), 'z', 'chrome', 16) for k, x in enumerate((-0.45, -0.15, 0.15, 0.45))]),
             join('bumper', [tube('nb0', (-0.62, 0.7, 1.92), (0.62, 0.7, 1.92), 0.05, 'trim'), tube('nb1', (-0.5, 1.0, 1.9), (0.5, 1.0, 1.9), 0.05, 'trim'),
                             tube('nb2', (-0.62, 0.7, 1.92), (-0.5, 1.0, 1.9), 0.05, 'trim'), tube('nb3', (0.62, 0.7, 1.92), (0.5, 1.0, 1.9), 0.05, 'trim')]),
             tyre('wing', 0.44, 0.28, (0, 1.0, -1.28), 'y', 'accent')]
    parts += lamps((-0.45, -0.15, 0.15, 0.45), top + 0.1, 0.55, 0.09) + tails((-0.56, 0.56), 0.84, -1.56, 0.24, 0.14)
    preview_wheels(W)
    return finish('buggy', parts, W, { 'dent': ['body'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.66, 1.03, 1.36, 0.3], 'soft': 2.2, 'knobbly': True, 'hub': 'accent' })

@design
def monster():
    """Monster Truck: a pickup riding high on four huge tyres, flared arches, roll bar with lamps."""
    R, Y = 0.95, 1.55
    W = four(1.05, 1.3, -1.3, R, 0.7)
    b = body({ 'W': [(1.76, 0.92), (1.6, 0.99), (-1.6, 1.0), (-1.76, 0.95)],
               'TOP': [(1.76, 1.78), (1.6, 1.92), (0.9, 1.97), (-1.76, 1.97)],
               'BOT': [(1.76, 1.44), (1.5, 1.36), (-1.5, 1.36), (-1.76, 1.44)] },
             [1.76, 1.72, 1.6, 1.4, 1.1, 0.8, 0.5, 0.2, -0.2, -0.5, -0.8, -1.1, -1.4, -1.6, -1.72, -1.76], n=8, tumble=0.05)
    arches(b, W, 0.08, 1.4); sill(b, 1.42); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.25, 0.25), ((1.7, 1.05),), 0.16)
    cab = glasshouse([1.06, 1.0, 0.8, 0.55, 0.3, 0.0, -0.2, -0.32, -0.36], 1.95, [(1.06, 1.97), (0.85, 2.52), (0.7, 2.58), (-0.28, 2.6), (-0.36, 2.0)],
                     [(1.06, 0.92), (-0.36, 0.92)], [(1.06, 0.82), (-0.36, 0.84)], roof_z=(0.75, -0.3))
    bed = join('bed', [rbox(f'bedside{k}', (0.08, 0.3, 1.3), (s_ * 0.94, 2.1, -1.1), 'paint', 0.03) for k, s_ in enumerate(MIR)] + [rbox('tailgate', (1.9, 0.3, 0.08), (0, 2.1, -1.74), 'paint', 0.03)])
    flares = join('flares', [rbox(f'fl{k}', (0.36, 0.14, 1.4), (s_ * 1.06, 2.0, z), 'accent', 0.05) for k, (s_, z) in enumerate([(a, c) for a in MIR for c in (1.3, -1.3)])])
    shocks = join('shocks', [tube(f'sh{k}', (s_ * 0.55, 0.95, z), (s_ * 0.66, 1.5, z * 0.9), 0.07, 'chrome') for k, (s_, z) in enumerate([(a, c) for a in MIR for c in (1.25, -1.25)])])
    parts = [b, s, cab, bed, flares, shocks, rbox('frame', (1.2, 0.18, 3.0), (0, 1.15, 0), 'trim', 0.04),
             join('bars', [tube(f'rb{k}', (s_ * 0.85, 1.97, -0.6), (s_ * 0.85, 2.55, -0.6), 0.05, 'trim') for k, s_ in enumerate(MIR)]),
             tube('wing', (-0.9, 2.55, -0.6), (0.9, 2.55, -0.6), 0.06, 'trim'), grille(0.8, 0.3, Y + 0.16, 1.76),
             rbox('bumper', (2.1, 0.22, 0.25), (0, Y - 0.1, 1.82), 'chrome', 0.07)]
    parts += lamps((-0.6, -0.2, 0.2, 0.6), 2.66, -0.52, 0.1, 'spot') + rects((-0.62, 0.62), Y + 0.2, 1.77, 0.4, 0.16) + tails((-0.7, 0.7), Y + 0.2, -1.78, 0.3, 0.2)
    parts += mirrors(1.0, 2.03, 0.95)
    preview_wheels(W)
    return finish('monster', parts, W, { 'dent': ['body', 'bed', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.7, 2.63, 0.2], 'soft': 2.6, 'knobbly': True, 'hub': 'accent' })

@design
def formula():
    """Formula Racer: needle nose, open wheels, the driver's helmet in the cockpit, big front and rear wings."""
    W = four(0.98, 1.3, -1.1, 0.34, 0.34, 0.4, 0.5)
    b = body({ 'W': [(1.98, 0.1), (1.6, 0.18), (0.9, 0.3), (0.3, 0.42), (-0.2, 0.46), (-1.4, 0.4), (-1.8, 0.3)],
               'TOP': [(1.98, 0.42), (1.4, 0.5), (0.5, 0.6), (0.0, 0.64), (-1.8, 0.56)],
               'BOT': [(1.98, 0.34), (1.6, 0.24), (-1.8, 0.24)] },
             [1.98, 1.9, 1.7, 1.45, 1.2, 0.9, 0.6, 0.3, 0.0, -0.3, -0.6, -0.9, -1.2, -1.5, -1.7, -1.8], n=4, tumble=0.1)
    decimate(b, 0.35); shade(b)
    pods = join('pods', [rbox(f'pod{k}', (0.5, 0.3, 1.5), (s_ * 0.62, 0.44, -0.45), 'paint', 0.12) for k, s_ in enumerate(MIR)])
    helmet = join('helmet', [sphere('helmet', 0.24, (0, 0.8, -0.25), 'accent', 20), sphere('visor', 0.2, (0, 0.82, -0.14), 'glass', 16, (1, 0.45, 0.8))])
    airbox = rbox('airbox', (0.62, 0.5, 0.5), (0, 0.82, -0.9), 'paint', 0.1); warp(airbox, lambda x, y, z: (x, y - 0.2 * max(0, y - 0.82) / 0.25 * max(0, -(z + 0.9)) / 0.25, z))
    parts = [b, pods, helmet, airbox, stripes(b, (0,), ((1.95, -1.6),), 0.12), rbox('screen', (0.36, 0.08, 0.2), (0, 0.72, 0.02), 'glass', 0.02, rot=(-0.4, 0, 0)),
             join('bumper', [rbox('fw', (1.9, 0.05, 0.36), (0, 0.24, 1.9), 'accent', 0.02)] + [rbox(f'fwe{k}', (0.04, 0.2, 0.4), (s_ * 0.95, 0.3, 1.9), 'accent', 0.01) for k, s_ in enumerate(MIR)]),
             join('wing', [rbox('rw', (1.8, 0.08, 0.5), (0, 1.12, -1.72), 'accent', 0.02)] + [rbox(f'rwe{k}', (0.04, 0.4, 0.55), (s_ * 0.9, 1.0, -1.72), 'accent', 0.01) for k, s_ in enumerate(MIR)]),
             rbox('strut0', (0.06, 0.5, 0.2), (-0.4, 0.86, -1.7), 'trim', 0.02), rbox('strut1', (0.06, 0.5, 0.2), (0.4, 0.86, -1.7), 'trim', 0.02)]
    parts += rects((0,), 0.43, 1.97, 0.16, 0.05) + tails((0,), 0.5, -1.8, 0.26, 0.14)
    preview_wheels(W)
    return finish('formula', parts, W, { 'dent': ['body', 'pods'], 'bumper': 'bumper', 'wing': 'wing', 'struts': ['strut0', 'strut1'], 'cabin': 'helmet', 'number': [0.5, 0.62, 0.75] })

@design
def rocket():
    """Rocket Car: a black dart with tail fins, a bubble canopy and a jet nozzle (its flame is the game's, by throttle)."""
    W = four(0.9, 1.25, -1.2, 0.36, 0.3, 0.42, 0.42, 0.95)
    b = body({ 'W': [(1.95, 0.25), (1.6, 0.45), (1.0, 0.68), (0.4, 0.82), (-1.9, 0.86)],
               'TOP': [(1.95, 0.52), (1.3, 0.7), (0.3, 0.85), (-1.9, 0.87)],
               'BOT': [(1.95, 0.46), (1.4, 0.36), (-1.9, 0.38)] },
             [1.95, 1.88, 1.75, 1.55, 1.3, 1.0, 0.7, 0.4, 0.1, -0.2, -0.5, -0.8, -1.1, -1.4, -1.65, -1.82, -1.9], n=4, tumble=0.18)
    arches(b, W); sill(b, 0.4); decimate(b, 0.3); shade(b)
    fins = join('fins', [rbox(f'fin{k}', (0.06, 0.8, 0.9), (s_ * 0.6, 1.2, -1.3), 'accent', 0.02) for k, s_ in enumerate(MIR)])
    warp(fins, lambda x, y, z: (x, y, z - 0.35 * (y - 0.8)))
    parts = [b, fins, sphere('cabin', 0.46, (0, 0.8, 0.3), 'glass', 24, (0.95, 0.62, 1.7)), stripes(b, (0,), ((1.9, -1.8),), 0.14),
             cyl('wing', 0.34, 0.45, (0, 0.72, -1.9), 'z', 'trim', 24, r2=0.42), rbox('bumper', (1.2, 0.1, 0.3), (0, 0.42, 1.9), 'accent', 0.04)]
    parts += rects((-0.35, 0.35), 0.62, 1.84, 0.28, 0.06) + tails((-0.62, 0.62), 0.72, -1.92, 0.2, 0.2)
    preview_wheels(W)
    return finish('rocket', parts, W, { 'dent': ['body', 'fins'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.6, 0.9, -0.7], 'nozzle': [0, 0.72, -2.12] })

def flames(x, z0, z1, y0, h, side, name):
    """Hot-rod flames on a flat side at x: tongues licking back from z0 to z1, accent with yellow cores."""
    import bmesh
    out = []
    for m, sc, off in (('accent', 1.0, 0.0), ('yellow', 0.55, 0.004)):
        bm = bmesh.new(); n = 4
        for k in range(n):
            za = z0 + (z1 - z0) * k / n * 0.5; length = (z0 - z1) * (1 - k / n * 0.45) * sc; hh = h * (0.9 - 0.15 * (k % 2)) * sc; yc = y0 + (k % 2 - 0.5) * h * 0.25
            pts = [(za, yc - hh / 2), (za - length * 0.55, yc - hh * 0.35), (za - length, yc), (za - length * 0.55, yc + hh * 0.3), (za, yc + hh / 2)]
            vs = [bm.verts.new(B(x + side * off, y, z)) for z, y in pts]
            f = bm.faces.new(vs if side > 0 else vs[::-1])
        o = obj(f'{name}_{m}', bm, [m]); out.append(o)
    return join(name, out)

@design
def hotrod():
    """Hot Rod: long narrow bonnet with flames, a chrome supercharger through it (shakes with the revs), a chopped cab, zoomies."""
    W = four(0.86, 1.3, -1.15, 0.36, 0.26, 0.5, 0.56, 0.98)
    bon = body({ 'W': [(1.66, 0.52), (1.4, 0.6), (0.1, 0.6)], 'TOP': [(1.66, 0.94), (1.5, 1.06), (0.1, 1.08)], 'BOT': [(1.66, 0.6), (0.1, 0.6)] },
               [1.66, 1.6, 1.5, 1.3, 1.0, 0.7, 0.4, 0.1], n=6, tumble=0.1, name='bonnet')
    decimate(bon, 0.4); shade(bon)
    tub = body({ 'W': [(0.05, 0.8), (-0.3, 0.84), (-1.75, 0.84)], 'TOP': [(0.05, 1.12), (-1.75, 1.18)], 'BOT': [(0.05, 0.62), (-1.75, 0.66)] },
               [0.05, 0.0, -0.2, -0.5, -0.8, -1.1, -1.4, -1.6, -1.72, -1.75], n=8, tumble=0.06, name='tub')
    arches(tub, W[2:]); decimate(tub, 0.35); shade(tub)
    cab = glasshouse([-0.25, -0.3, -0.5, -0.8, -1.05, -1.2, -1.25], 1.12, [(-0.25, 1.14), (-0.33, 1.6), (-1.2, 1.62), (-1.25, 1.2)], [(-0.25, 0.76), (-1.25, 0.76)], [(-0.25, 0.74), (-1.25, 0.74)], roof_z=(-0.3, -1.2))
    blower = join('blower', [rbox('bl0', (0.6, 0.3, 0.7), (0, 1.2, 0.95), 'chrome', 0.05), rbox('bl1', (0.5, 0.12, 0.4), (0, 1.42, 0.95), 'trim', 0.03), rbox('bl2', (0.36, 0.26, 0.2), (0, 1.6, 0.95), 'chrome', 0.04)])
    blower['pivot'] = (0, 1.2, 0.95)
    parts = [bon, tub, cab, blower, rbox('frame', (1.1, 0.24, 3.6), (0, 0.5, 0), 'trim', 0.05), flames(0.605, 1.62, 0.15, 0.86, 0.3, 1, 'flameR'), flames(-0.605, 1.62, 0.15, 0.86, 0.3, -1, 'flameL'),
             rbox('bumper', (1.1, 0.12, 0.14), (0, 0.56, 1.72), 'chrome', 0.05), rbox('wing', (1.6, 0.1, 0.16), (0, 0.62, -1.8), 'chrome', 0.04), grille(0.76, 0.36, 0.84, 1.67),
             join('buckets', [cyl(f'bk{k}', 0.18, 0.2, (s_ * 0.72, 0.9, 1.42), 'z', 'chrome', 20) for k, s_ in enumerate(MIR)])]
    for k, (s_, j) in enumerate([(a, c) for a in MIR for c in range(3)]):   # zoomie pipes, raked up towards the front
        zc = 1.1 - j * 0.3; parts.append(warp(cyl(f'zoom{k}', 0.05, 0.42, (s_ * 0.66, 1.02, zc), 'z', 'chrome', 10), lambda x, y, z, zc=zc: (x, y + (z - zc) * 0.55, z)))
    parts += lamps((-0.72, 0.72), 0.9, 1.53, 0.15) + tails((-0.72, 0.72), 0.9, -1.8, 0.18, 0.18)
    preview_wheels(W)
    return finish('hotrod', parts, W, { 'dent': ['bonnet', 'tub', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'struts': [f'zoom{k}' for k in range(6)], 'cabin': 'cabin', 'number': [0.6, 1.66, -0.75] })

@design
def police():
    """Interceptor: a long black-and-white sedan, push bar, a light bar flashing red and blue."""
    W = four(0.97, 1.2, -1.15, 0.42, 0.34)
    b = body({ 'W': [(1.84, 0.88), (1.7, 0.95), (1.4, 0.98), (-1.5, 0.98), (-1.84, 0.92)],
               'TOP': [(1.84, 0.84), (1.7, 0.98), (1.2, 1.04), (-1.4, 1.07), (-1.84, 1.0)],
               'BOT': [(1.84, 0.46), (1.5, 0.3), (-1.5, 0.3), (-1.84, 0.46)] },
             [1.84, 1.8, 1.7, 1.5, 1.25, 1.0, 0.7, 0.4, 0.1, -0.2, -0.5, -0.8, -1.1, -1.35, -1.55, -1.72, -1.8, -1.84], n=7, tumble=0.08)
    arches(b, W); sill(b)
    by_faces(b, lambda c, n: 'accent' if abs(c[0]) > 0.8 and abs(n[1]) < 0.5 and -0.95 < c[2] < 0.75 and 0.5 < c[1] < 1.0 else None)   # white doors
    decimate(b, 0.3); shade(b)
    cab = glasshouse([0.6, 0.55, 0.4, 0.2, -0.1, -0.4, -0.7, -0.95, -1.12, -1.2], 1.04, [(0.6, 1.06), (0.35, 1.5), (0.2, 1.57), (-0.85, 1.57), (-1.2, 1.1)],
                     [(0.6, 0.86), (-1.2, 0.86)], [(0.6, 0.74), (-1.2, 0.74)], roof_z=(0.25, -0.85), roof_mat='accent')
    parts = [b, cab, rbox('lightbase', (1.3, 0.1, 0.32), (0, 1.63, -0.2), 'trim', 0.03),
             rbox('lightred', (0.56, 0.14, 0.26), (-0.34, 1.73, -0.2), 'glowred', 0.04), rbox('lightblue', (0.56, 0.14, 0.26), (0.34, 1.73, -0.2), 'glowblue', 0.04),
             join('bumper', [tube(f'pb{k}', (x, 0.45, 1.93), (x, 0.9, 1.93), 0.045, 'trim') for k, x in enumerate((-0.55, 0.55))] + [tube(f'pbx{k}', (-0.6, y, 1.95), (0.6, y, 1.95), 0.045, 'trim') for k, y in enumerate((0.55, 0.82))]),
             rbox('wing', (1.7, 0.05, 0.24), (0, 1.09, -1.72), 'paint', 0.02, rot=(-0.15, 0, 0)), grille(0.76, 0.16, 0.84, 1.82),
             rbox('rbumper', (1.9, 0.14, 0.16), (0, 0.55, -1.85), 'trim', 0.05)]
    parts += rects((-0.62, 0.62), 0.86, 1.83, 0.44, 0.14) + tails((-0.64, 0.64), 0.9, -1.85, 0.44, 0.14)
    parts += mirrors(0.95, 1.1, 0.45)
    preview_wheels(W)
    return finish('police', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.7, 1.61, -0.6] })

@design
def kart():
    """Go-Kart: a flat tray with side pods and a nose cone, the driver sat right on it, a rear bumper bar."""
    W = four(0.72, 0.85, -0.85, 0.24, 0.3, 0.27, 0.38, 0.76)
    tray = rbox('tray', (1.3, 0.1, 2.3), (0, 0.28, 0), 'paint', 0.04)
    nose = body({ 'W': [(1.28, 0.4), (1.0, 0.55), (0.85, 0.56)], 'TOP': [(1.28, 0.42), (0.85, 0.5)], 'BOT': [(1.28, 0.28), (0.85, 0.26)] }, [1.28, 1.2, 1.05, 0.9, 0.85], n=4, name='nose', sub=1)
    by_faces(nose, lambda c, n: 'accent'); shade(nose)
    driver = join('driver', [rbox('torso', (0.5, 0.45, 0.4), (0, 0.82, -0.22), 'paint', 0.12, rot=(0.2, 0, 0))] + [tube(f'arm{k}', (s_ * 0.24, 0.95, -0.12), (s_ * 0.16, 0.8, 0.3), 0.06, 'paint') for k, s_ in enumerate(MIR)])
    helmet = join('helmet', [sphere('helmet', 0.24, (0, 1.2, -0.18), 'white', 20), sphere('visor', 0.2, (0, 1.21, -0.06), 'glass', 16, (1, 0.45, 0.8))])
    parts = [tray, nose, driver, helmet, join('pods', [rbox(f'pod{k}', (0.3, 0.2, 1.0), (s_ * 0.72, 0.36, 0.05), 'accent', 0.08) for k, s_ in enumerate(MIR)]),
             rbox('seat', (0.6, 0.4, 0.55), (0, 0.55, -0.35), 'trim', 0.1), torus('steer', 0.14, 0.025, (0, 0.8, 0.3), 'z', 'trim', 20, 6),
             rbox('engine', (0.5, 0.3, 0.3), (0, 0.5, -0.8), 'engine', 0.05),
             tube('bumper', (-0.6, 0.34, 1.3), (0.6, 0.34, 1.3), 0.05, 'chrome'), tube('wing', (-0.75, 0.36, -1.2), (0.75, 0.36, -1.2), 0.06, 'chrome')]
    parts += lamps((0,), 0.42, 1.29, 0.08) + tails((0,), 0.5, -1.0, 0.3, 0.1)
    preview_wheels(W)
    return finish('kart', parts, W, { 'dent': ['tray', 'nose', 'pods'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'helmet', 'number': [0.5, 0.52, 1.0, 0.25] })

@design
def tuktuk():
    """Tuk-Tuk: three wheels (one at the front), an open cab under a striped canopy, a bench behind."""
    W = [(0, 1.2, 0.34, 0.24), (0.72, -1.05, 0.36, 0.26), (-0.72, -1.05, 0.36, 0.26)]
    b = body({ 'W': [(1.6, 0.22), (1.3, 0.33), (0.6, 0.62), (0.4, 0.75), (-1.6, 0.75)],
               'TOP': [(1.6, 0.9), (1.2, 1.08), (0.6, 1.1), (0.4, 0.94), (-1.6, 0.94)],
               'BOT': [(1.6, 0.52), (-1.6, 0.5)] },
             [1.6, 1.55, 1.45, 1.3, 1.1, 0.9, 0.7, 0.5, 0.35, 0.1, -0.3, -0.7, -1.1, -1.4, -1.55, -1.6], n=6, tumble=0.1)
    arches(b, W); decimate(b, 0.35); shade(b)
    canopy = join('canopy', [rbox(f'cn{k}', (1.56, 0.08, 0.45), (0, 2.0, 0.73 - k * 0.45), 'accent' if k % 2 else 'paint', 0.03) for k in range(5)])
    warp(canopy, lambda x, y, z: (x, y + 0.08 * (1 - (x / 0.8) ** 2), z))
    parts = [b, canopy, rbox('cabin', (1.3, 0.5, 0.04), (0, 1.4, 0.55), 'glass', 0.015, rot=(-0.2, 0, 0)),
             join('poles', [tube(f'po{k}', (x, 0.94, z), (x, 2.0, z), 0.03, 'trim') for k, (x, z) in enumerate([(-0.68, 0.5), (0.68, 0.5), (-0.68, -1.5), (0.68, -1.5)])]),
             rbox('bench', (1.2, 0.3, 0.5), (0, 1.1, -1.1), 'wood', 0.08), rbox('driverseat', (0.5, 0.2, 0.4), (0, 1.05, 0.0), 'trim', 0.06),
             rbox('bumper', (0.6, 0.14, 0.14), (0, 0.52, 1.6), 'chrome', 0.05), rbox('wing', (1.3, 0.2, 0.2), (0, 0.95, -1.62), 'accent', 0.05)]
    parts += lamps((0,), 1.0, 1.52, 0.13) + tails((-0.58, 0.58), 0.8, -1.62, 0.2, 0.14)
    preview_wheels(W)
    return finish('tuktuk', parts, W, { 'dent': ['body'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.66, 2.1, -0.5], 'soft': 1.6 })

@design
def icecream():
    """Ice Cream Van: a tall pastel box with a serving hatch and awning, and a giant cone on the roof that turns."""
    W = four(0.97, 1.4, -1.3, 0.42, 0.34)
    box = rbox('box', (1.96, 1.3, 3.0), (0, 1.25, -0.5), 'paint', 0.12, segs=4); arches(box, W)
    nose = rbox('nose', (1.9, 0.7, 1.2), (0, 0.95, 1.45), 'paint', 0.14, segs=4); arches(nose, W)
    by_faces(box, lambda c, n: 'accent' if abs(n[0]) > 0.7 and 0.66 < c[1] < 0.78 else None)
    cone = join('cone', [cyl('wafer', 0.02, 1.0, (0, 2.4, -0.3), 'y', 'wafer', 20, r2=0.42)] + [sphere(f'scoop{k}', r, (0, y, -0.3), m, 20) for k, (m, y, r) in enumerate([('cream', 3.0, 0.46), ('pink', 3.35, 0.4), ('choc', 3.65, 0.3)])])
    cone['pivot'] = (0, 1.9, -0.3)
    parts = [box, nose, cone, rbox('chassis', (1.9, 0.3, 4.0), (0, 0.45, 0), 'trim', 0.05),
             glasshouse([1.2, 1.1, 0.95, 0.9], 1.28, [(1.2, 1.3), (0.9, 1.78)], [(1.2, 0.93), (0.9, 0.95)], [(1.2, 0.9), (0.9, 0.92)], roof_paint=False),
             join('hatch', [rbox(f'h{k}', (0.03, 0.5, 1.4), (s_ * 0.99, 1.4, -0.6), 'cream', 0.02) for k, s_ in enumerate(MIR)] + [rbox(f'aw{k}', (0.3, 0.04, 1.5), (s_ * 1.1, 1.72, -0.6), 'accent', 0.02, rot=(0, 0, -s_ * 0.35)) for k, s_ in enumerate(MIR)]),
             rbox('bumper', (2.0, 0.22, 0.2), (0, 0.6, 2.07), 'chrome', 0.07), rbox('wing', (1.96, 0.1, 0.3), (0, 1.94, -2.0), 'accent', 0.03), grille(0.9, 0.3, 0.98, 2.06)]
    parts += lamps((-0.66, 0.66), 0.95, 2.06, 0.13) + tails((-0.8, 0.8), 1.2, -2.01, 0.2, 0.36)
    parts += mirrors(1.03, 1.45, 1.05)
    preview_wheels(W)
    return finish('icecream', parts, W, { 'dent': ['box', 'nose'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.7, 1.93, -1.4], 'soft': 1.3 })

@design
def firetruck():
    """Fire Engine: a long red truck with lockers, a chrome ladder on the roof, a hose reel and blue beacons."""
    W = [(1.0, 1.7, 0.46, 0.4), (-1.0, 1.7, 0.46, 0.4), (1.0, -1.1, 0.46, 0.4), (-1.0, -1.1, 0.46, 0.4), (1.0, -1.8, 0.46, 0.4), (-1.0, -1.8, 0.46, 0.4)]
    cabb = rbox('cab', (2.1, 1.0, 1.4), (0, 1.2, 1.6), 'paint', 0.12, segs=4); arches(cabb, W[:2])
    box = rbox('box', (2.2, 1.2, 3.3), (0, 1.3, -0.75), 'paint', 0.08, segs=3); arches(box, W[2:])
    # lockers (roller shutters) and a white band down each side
    lockers = join('lockers', [rbox(f'lk{k}_{j}', (0.03, 0.78, 0.9), (s_ * 1.105, 1.44, 0.3 - j * 0.98), 'firered', 0.02) for k, s_ in enumerate(MIR) for j in range(3)]
                   + [rbox(f'sl{k}_{j}', (0.035, 0.015, 2.9), (s_ * 1.11, 1.12 + j * 0.13, -0.68), 'trim', 0) for k, s_ in enumerate(MIR) for j in range(1, 6)]
                   + [rbox(f'band{k}', (0.03, 0.12, 3.25), (s_ * 1.105, 0.98, -0.75), 'accent', 0.01) for k, s_ in enumerate(MIR)])
    ladder = join('ladder', [rbox(f'lr{k}', (0.08, 0.08, 4.0), (s_ * 0.4, 2.0, -0.45), 'chrome', 0.02) for k, s_ in enumerate(MIR)] + [rbox(f'lg{k}', (0.8, 0.05, 0.05), (0, 2.0, -2.3 + k * 0.37), 'chrome', 0.01) for k in range(11)])
    parts = [cabb, box, lockers, ladder, rbox('chassis', (2.0, 0.34, 4.8), (0, 0.5, 0), 'trim', 0.05),
             glasshouse([2.4, 2.36, 2.3, 2.26], 1.22, [(2.4, 1.24), (2.26, 1.62)], [(2.4, 0.98), (2.26, 0.98)], [(2.4, 0.95), (2.26, 0.95)], roof_paint=False),
             join('reel', [cyl('reel', 0.4, 0.5, (0, 2.2, -1.9), 'x', 'hose', 24), cyl('reelhub', 0.2, 0.54, (0, 2.2, -1.9), 'x', 'chrome', 16)]),
             rbox('beacon0', (0.3, 0.2, 0.3), (-0.8, 1.8, 2.05), 'glowblue', 0.05), rbox('beacon1', (0.3, 0.2, 0.3), (0.8, 1.8, 2.05), 'glowblue', 0.05),
             rbox('bumper', (2.1, 0.3, 0.2), (0, 0.62, 2.42), 'chrome', 0.07), rbox('wing', (2.0, 0.2, 0.2), (0, 0.66, -2.42), 'chrome', 0.06), grille(1.1, 0.38, 1.0, 2.31)]
    parts += lamps((-0.75, 0.75), 0.95, 2.32, 0.15) + tails((-0.85, 0.85), 1.0, -2.42, 0.26, 0.3)
    parts += mirrors(1.13, 1.42, 2.1)
    preview_wheels(W)
    return finish('firetruck', parts, W, { 'dent': ['cab', 'box'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.7, 1.72, 1.4] })

def crinkle(o, amp=0.012, k=9.0):
    """Crumpled foil: push every vertex in and out a little (deterministic)."""
    return warp(o, lambda x, y, z: (x + amp * math.sin(k * y + 3 * z), y + amp * math.sin(k * z + 2 * x), z + amp * math.sin(k * x + 5 * y)))

@design
def rover():
    """Moon Rover: gold-foil tubs on a frame, six wire wheels, two astronauts, solar panels, a mast and a scanning dish."""
    W = [(s_ * 0.98, z, 0.4, 0.3) for z in (1.25, 0, -1.25) for s_ in MIR]
    foil = join('foil', [crinkle(smooth(rbox('foilF', (1.5, 0.36, 1.1), (0, 0.98, 1.0), 'accent', 0.08), 1)), crinkle(smooth(rbox('foilR', (1.5, 0.36, 0.9), (0, 0.98, -1.1), 'accent', 0.08), 1))])
    crew = join('crew', [sphere(f'hm{k}', 0.2, (s_ * 0.38, 1.55, -0.05), 'white', 20) for k, s_ in enumerate(MIR)] + [sphere(f'vi{k}', 0.16, (s_ * 0.38, 1.56, 0.06), 'glass', 16, (1, 0.8, 0.7)) for k, s_ in enumerate(MIR)]
                 + [rbox(f'suit{k}', (0.36, 0.4, 0.3), (s_ * 0.38, 1.28, -0.08), 'white', 0.1) for k, s_ in enumerate(MIR)])
    dish = join('dish', [cyl('dishc', 0.4, 0.14, (0.55, 2.25, 1.3), 'y', 'white', 24, r2=0.06), cyl('horn', 0.03, 0.3, (0.55, 2.4, 1.3), 'y', 'chrome', 8)])
    warp(dish, lambda x, y, z: (x, 2.2 + (y - 2.2) * math.cos(1.2) - (z - 1.3) * math.sin(1.2), 1.3 + (y - 2.2) * math.sin(1.2) + (z - 1.3) * math.cos(1.2)))
    dish['pivot'] = (0.55, 2.2, 1.3)
    parts = [foil, crew, dish, rbox('frame', (1.6, 0.14, 3.2), (0, 0.72, 0), 'metal', 0.04),
             join('seats', [rbox(f'seat{k}', (0.5, 0.5, 0.5), (s_ * 0.38, 1.05, -0.1), 'paint', 0.08) for k, s_ in enumerate(MIR)]),
             join('solar', [rbox(f'sp{k}', (1.9, 0.04, 1.0 - 0.3 * (s_ + 1)), (0, 1.2, s_ * 1.0), 'solar', 0.01) for k, s_ in enumerate(MIR)]),
             tube('mast', (0.55, 1.05, 1.3), (0.55, 2.15, 1.3), 0.03, 'chrome'),
             join('fenders', [rbox(f'fe{k}', (0.34, 0.03, 0.7), (s_ * 0.98, 0.92, z), 'metal', 0.01) for k, (s_, z) in enumerate([(a, c) for a in MIR for c in (1.25, 0, -1.25)])]),
             tube('bumper', (-0.75, 0.72, 1.7), (0.75, 0.72, 1.7), 0.06, 'chrome'), rbox('wing', (1.2, 0.3, 0.3), (0, 1.0, -1.72), 'paint', 0.06)]
    parts += lamps((-0.5, 0.5), 0.95, 1.59, 0.11) + tails((-0.5, 0.5), 0.95, -1.58, 0.2, 0.12)
    preview_wheels(W)
    return finish('rover', parts, W, { 'dent': ['foil'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'crew', 'number': [0.5, 1.24, 1.1], 'soft': 2.0, 'knobbly': True, 'hub': 0xD3D7DD })

@design
def hover():
    """Hovercraft: a rounded hull on a fat rubber skirt, a glass bubble cockpit, a caged fan that spins with the throttle."""
    W = four(0.7, 1.2, -1.2, 0.2, 0.2)
    skirt = body({ 'W': [(1.95, 0.85), (1.7, 1.12), (1.3, 1.15), (-1.5, 1.15), (-1.8, 1.05), (-1.95, 0.85)],
                   'TOP': [(1.95, 0.56), (-1.95, 0.56)], 'BOT': [(1.95, 0.12), (1.7, 0.08), (-1.7, 0.08), (-1.95, 0.12)] },
                  [1.95, 1.9, 1.8, 1.65, 1.4, 1.0, 0.5, 0.0, -0.5, -1.0, -1.4, -1.65, -1.8, -1.9, -1.95], n=3, tumble=0.0, name='skirt')
    by_faces(skirt, lambda c, n: 'tyre'); decimate(skirt, 0.22); shade(skirt)
    hull = body({ 'W': [(1.8, 0.7), (1.5, 0.92), (1.1, 1.0), (-1.7, 1.0)], 'TOP': [(1.8, 0.82), (1.4, 0.92), (-1.7, 0.92)], 'BOT': [(1.8, 0.56), (-1.7, 0.56)] },
                 [1.8, 1.75, 1.6, 1.4, 1.1, 0.7, 0.3, -0.1, -0.5, -0.9, -1.3, -1.6, -1.7], n=5, tumble=0.1, name='hull')
    decimate(hull, 0.25); shade(hull)
    fan = join('fan', [rbox(f'bl{k}', (0.14, 1.3, 0.04), (0, 1.55, -1.45), 'white', 0.02, rot=(0, 0, k * math.pi / 3)) for k in range(3)] + [cyl('spinner', 0.12, 0.12, (0, 1.55, -1.42), 'z', 'accent', 16)])
    fan['pivot'] = (0, 1.55, -1.45)
    rud = rbox('rudder', (0.06, 0.8, 0.5), (0, 1.5, -1.95), 'accent', 0.02)
    parts = [skirt, hull, fan, rud, sphere('cabin', 0.62, (0, 0.92, 0.75), 'glass', 24, (0.95, 0.75, 1.15)),
             torus('fanring', 0.72, 0.09, (0, 1.55, -1.4), 'z', 'trim', 32, 8),
             join('strakes', [rbox(f'st{k}', (0.08, 0.06, 3.0), (s_ * 1.0, 0.9, 0.05), 'accent', 0.02) for k, s_ in enumerate(MIR)]),
             join('stands', [tube(f'sd{k}', (s_ * 0.5, 0.92, -1.4), (s_ * 0.72, 1.4, -1.4), 0.04, 'trim') for k, s_ in enumerate(MIR)]),
             rbox('bumper', (1.6, 0.14, 0.2), (0, 0.72, 1.9), 'accent', 0.05)]
    parts += lamps((-0.5, 0.5), 0.82, 1.8, 0.11) + tails((-0.8, 0.8), 0.8, -1.72, 0.2, 0.12)
    preview_wheels(W)
    return finish('hover', parts, W, { 'dent': ['hull', 'skirt'], 'bumper': 'bumper', 'wing': 'rudder', 'struts': ['fanring'], 'cabin': 'cabin', 'number': [0.6, 0.95, -0.3], 'soft': 1.6 })

@design
def snowcat():
    """Snowcat: a boxy cab on two wide rubber tracks, a snow blade, a roof light bar and a turning beacon."""
    W = [(s_ * 0.92, z, 0.3, 0.5) for z in (1.3, -1.3, 0) for s_ in MIR]
    tracks = []
    for k, s_ in enumerate(MIR):
        t = rbox(f'track{k}', (0.62, 0.72, 3.7), (s_ * 0.92, 0.4, 0), 'tyre', 0.3, segs=5)
        tracks.append(t); tracks += [rbox(f'cl{k}_{j}', (0.64, 0.05, 0.1), (s_ * 0.92, 0.78, -1.6 + j * 0.4), 'trim', 0.01) for j in range(9)]
    cab = rbox('cab', (1.9, 0.9, 2.3), (0, 1.28, -0.3), 'paint', 0.1, segs=4)
    parts = [join('tracks', tracks), cab, rbox('chassis', (1.2, 0.3, 3.2), (0, 0.62, 0), 'trim', 0.05),
             glasshouse([0.72, 0.68, 0.5, 0.2, -0.2, -0.45, -0.5], 1.72, [(0.72, 1.74), (0.62, 2.28), (-0.45, 2.3), (-0.5, 1.8)], [(0.72, 0.92), (-0.5, 0.92)], [(0.72, 0.86), (-0.5, 0.86)], roof_z=(0.62, -0.45)),
             rbox('bar', (1.4, 0.12, 0.2), (0, 2.4, 0.5), 'trim', 0.03), cyl('beacon', 0.12, 0.22, (0, 2.42, -0.3), 'y', 'glowamber', 16),
             rbox('bumper', (2.5, 0.6, 0.16), (0, 0.55, 2.02), 'accent', 0.04, rot=(-0.25, 0, 0)),
             join('arms', [rbox(f'arm{k}', (0.1, 0.1, 0.6), (s_ * 0.6, 0.6, 1.72), 'trim', 0.02) for k, s_ in enumerate(MIR)]),
             rbox('wing', (1.5, 0.5, 0.5), (0, 1.0, -1.7), 'accent', 0.06), grille(1.0, 0.42, 1.18, 0.86)]
    parts[-1]['pivot'] = (0, 1.18, 0.86)
    parts += lamps((-0.45, -0.15, 0.15, 0.45), 2.4, 0.62, 0.09) + tails((-0.7, 0.7), 1.1, -1.96, 0.2, 0.2)
    parts += mirrors(0.99, 1.85, 0.62)
    preview_wheels(W)
    return finish('snowcat', parts, W, { 'dent': ['cab', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'struts': ['bar'], 'cabin': 'cabin', 'number': [0.66, 2.33, -0.05], 'soft': 0.8 })

@design
def limo():
    """Stretch Limo: absurdly long and low, gold waistline, a long tinted glasshouse, sunroof with a flag, hood ornament."""
    W = four(0.94, 1.8, -1.8, 0.4, 0.3)
    b = body({ 'W': [(2.68, 0.88), (2.5, 0.96), (2.2, 0.98), (-2.3, 0.98), (-2.68, 0.93)],
               'TOP': [(2.68, 0.8), (2.5, 0.96), (2.0, 1.02), (-2.3, 1.04), (-2.68, 0.98)],
               'BOT': [(2.68, 0.44), (2.3, 0.28), (-2.3, 0.28), (-2.68, 0.44)] },
             [2.68, 2.62, 2.5, 2.3, 2.0, 1.8, 1.5, 1.1, 0.7, 0.3, -0.1, -0.5, -0.9, -1.3, -1.6, -1.8, -2.1, -2.35, -2.55, -2.64, -2.68], n=7, tumble=0.08)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (0,), ((2.6, 1.55),), 0.08, name='hoodline')
    cab = glasshouse([1.4, 1.35, 1.2, 0.9, 0.5, 0.1, -0.3, -0.7, -1.1, -1.5, -1.9, -2.1, -2.2], 1.02, [(1.4, 1.04), (1.15, 1.45), (-2.0, 1.47), (-2.2, 1.08)],
                     [(1.4, 0.86), (-2.2, 0.86)], [(1.4, 0.76), (-2.2, 0.76)], roof_z=(1.1, -2.0), sub=1)
    # the flag flies from the pole back along the car (-z) and waves: an authored loop the rig plays
    flag = flag_grid('flag', 0.36, 0.24, 6, 3, 'accent'); warp(flag, lambda x, y, z: (0.5, 1.95 + y, -0.09 - x)); flag['pivot'] = (0.5, 1.95, 0.1)
    wave_loop(flag, 12, lambda x, y, z, t: (x + 0.07 * (0.09 - z) / 0.36 * math.sin(2 * math.pi * t + z * 14), y, z), fps=12)
    parts = [b, s, cab, flag, rbox('sunroof', (0.9, 0.03, 0.9), (0, 1.48, 0.1), 'glass', 0.02),
             join('waist', [rbox(f'wl{k}', (0.02, 0.05, 4.7), (s_ * 0.985, 0.97, -0.05), 'accent', 0.01) for k, s_ in enumerate(MIR)]),
             join('ornament', [rbox('orn', (0.08, 0.14, 0.18), (0, 1.06, 2.45), 'accent', 0.03)]),
             rbox('bumper', (1.98, 0.15, 0.18), (0, 0.58, 2.7), 'chrome', 0.06), rbox('rbumper', (1.98, 0.14, 0.16), (0, 0.58, -2.7), 'chrome', 0.06),
             tube('wing', (0.5, 1.47, 0.1), (0.5, 2.07, 0.1), 0.02, 'chrome'), grille(0.64, 0.2, 0.78, 2.66)]
    parts += lamps((-0.7, -0.45, 0.45, 0.7), 0.82, 2.64, 0.1) + tails((-0.62, 0.62), 0.88, -2.69, 0.5, 0.1)
    parts += mirrors(0.95, 1.08, 1.25)
    preview_wheels(W)
    return finish('limo', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'struts': ['flag'], 'cabin': 'cabin', 'number': [0.6, 1.52, -1.4] })

@design
def sidecar():
    """Sidecar Bike: a big-bore bike with its rider, a bullet sidecar with a passenger who hangs out on the bends."""
    W = [(-0.55, 1.05, 0.38, 0.2), (0.95, 0.3, 0.3, 0.2), (-0.55, -1.0, 0.4, 0.26)]
    tub = body({ 'W': [(1.08, 0.12), (0.9, 0.3), (0.5, 0.44), (-0.6, 0.46), (-1.0, 0.36)], 'TOP': [(1.08, 0.66), (0.6, 0.8), (0.35, 0.92), (-1.0, 0.92)], 'BOT': [(1.08, 0.56), (0.6, 0.46), (-1.0, 0.5)] },
               [1.08, 1.0, 0.85, 0.65, 0.45, 0.2, -0.1, -0.4, -0.7, -0.9, -1.0], n=3, tumble=0.1, name='tub')
    move(tub, 0.62); cut(tub, sphere('_well', 0.3, (0.62, 1.0, -0.35), 'trim', 20, (1.1, 1, 1.3))); decimate(tub, 0.4); shade(tub)
    tub = join('tub', [tub, rbox('screen', (0.6, 0.26, 0.03), (0.62, 1.05, 0.12), 'glass', 0.02, rot=(-0.35, 0, 0))])   # the passenger's windscreen
    rider = join('rider', [rbox('torso', (0.5, 0.6, 0.4), (-0.55, 1.45, -0.15), 'accent', 0.14, rot=(0.5, 0, 0)), sphere('rhelm', 0.2, (-0.55, 1.85, 0.1), 'paint', 20),
                           tube('rarmL', (-0.78, 1.58, 0.05), (-0.88, 1.3, 0.8), 0.075, 'accent'), tube('rarmR', (-0.32, 1.58, 0.05), (-0.22, 1.3, 0.8), 0.075, 'accent')])
    rider['pivot'] = (-0.55, 1.1, -0.25)
    pas = join('pass', [rbox('ptorso', (0.44, 0.5, 0.36), (0.62, 1.2, -0.35), 'white', 0.12), sphere('phelm', 0.19, (0.62, 1.57, -0.35), 'accent', 20)])
    pas['pivot'] = (0.62, 0.95, -0.35)
    parts = [tub, rider, pas, rbox('frame', (0.36, 0.36, 2.2), (-0.55, 0.62, 0), 'trim', 0.1), rbox('tank', (0.46, 0.34, 0.9), (-0.55, 0.98, 0.35), 'paint', 0.14),
             rbox('seat', (0.4, 0.14, 0.7), (-0.55, 1.02, -0.35), 'tyre', 0.06), tube('bars', (-1.0, 1.26, 0.9), (-0.1, 1.26, 0.9), 0.03, 'chrome'),
             join('engine', [rbox('eng', (0.5, 0.36, 0.5), (-0.55, 0.62, 0.2), 'engine', 0.06)] + [cyl(f'fin{k}', 0.2, 0.62, (-0.55, 0.7 + k * 0.06, 0.2), 'x', 'engine', 16) for k in range(3)]),
             join('frameX', [tube(f'fx{k}', (-0.4, 0.62, z), (0.35, 0.62, z), 0.03, 'chrome') for k, z in enumerate((0.6, -0.6))]),
             tube('exhaust', (-0.3, 0.45, 0.3), (-0.3, 0.55, -1.25), 0.05, 'chrome'),
             rbox('bumper', (0.5, 0.12, 0.14), (0.62, 0.62, 1.12), 'chrome', 0.05), rbox('wing', (0.36, 0.12, 0.3), (-0.55, 0.94, -1.05), 'paint', 0.05)]
    parts += lamps((-0.55,), 1.1, 1.15, 0.13) + tails((-0.55,), 0.92, -1.2, 0.2, 0.12)
    preview_wheels(W)
    return finish('sidecar', parts, W, { 'dent': ['tub', 'tank'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'tub', 'number': [0.5, 0.95, 0.55], 'soft': 1.2 })

@design
def mixer():
    """Cement Mixer: a heavy cab and chassis carrying a striped drum that turns as it drives, a chute at the back, six wheels."""
    W = [(1.0, 1.75, 0.48, 0.4), (-1.0, 1.75, 0.48, 0.4), (1.0, -1.0, 0.48, 0.4), (-1.0, -1.0, 0.48, 0.4), (1.0, -1.95, 0.48, 0.4), (-1.0, -1.95, 0.48, 0.4)]
    cab = rbox('cab', (2.0, 1.2, 1.3), (0, 1.3, 1.75), 'paint', 0.14, segs=4); arches(cab, W[:2])
    # the drum is modelled level (its axis along the car); the game tilts it by drumTilt and spins it
    drum = join('drum', [cyl('dr', 0.8, 2.8, (0, 1.7, -0.6), 'z', 'accent', 28, r2=0.95)] + [torus(f'ring{k}', 0.84 + k * 0.035, 0.06, (0, 1.7, -1.8 + k * 0.7), 'z', 'paint', 28, 6) for k in range(4)]
                 + [rbox(f'fin{k}', (0.1, 0.14, 2.6), (0.88 * math.cos(k * math.pi / 2), 1.7 + 0.88 * math.sin(k * math.pi / 2), -0.6), 'paint', 0.03, rot=(0, 0, k * math.pi / 2)) for k in range(4)])
    drum['pivot'] = (0, 1.7, -0.6)
    parts = [cab, drum, rbox('chassis', (2.0, 0.34, 4.9), (0, 0.55, 0), 'trim', 0.05),
             glasshouse([2.44, 2.4, 2.32, 2.26], 1.36, [(2.44, 1.38), (2.26, 1.84)], [(2.44, 0.94), (2.26, 0.94)], [(2.44, 0.9), (2.26, 0.9)], roof_paint=False),
             join('supports', [rbox(f'su{k}', (0.2, 1.0, 0.2), (s_ * 0.7, 1.1, z), 'trim', 0.03) for k, (s_, z) in enumerate([(a, c) for a in MIR for c in (-1.6, 0.4)])]),
             join('fenders', [rbox(f'fd{k}', (0.46, 0.06, 1.5), (s_ * 1.0, 1.02, -1.5), 'trim', 0.02) for k, s_ in enumerate(MIR)]),
             rbox('wing', (0.5, 0.1, 0.9), (0, 1.1, -2.4), 'metal', 0.03, rot=(0.5, 0, 0)), rbox('bumper', (2.04, 0.3, 0.22), (0, 0.66, 2.46), 'trim', 0.06), grille(1.1, 0.4, 1.08, 2.41)]
    parts += lamps((-0.72, 0.72), 0.92, 2.43, 0.12) + tails((-0.8, 0.8), 0.9, -2.46, 0.24, 0.2)
    parts += mirrors(1.06, 1.5, 2.25)
    preview_wheels(W)
    return finish('mixer', parts, W, { 'dent': ['cab'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.66, 1.93, 1.6], 'soft': 0.8, 'drumTilt': 0.18 })
