# Scenery family: the natural and built things beside the road, instanced by the game (render/world/scenery.js) in
# their hundreds, so every model is light (a few hundred triangles) and carries its shading in vertex colours: darker
# underneath and inside, lighter on top, fixed details (windows, doors, hair) baked in. The game multiplies them by
# each instance's tint (a tree's green, a wall's colour, a fan's shirt). Parts are named <part><variant> (crown0,
# crown1...) and all sit at the model's origin, which is where the game places the instance.
import math, bpy
from kit import *

DESIGNS = {}
def design(fn): DESIGNS[fn.__name__] = fn; return fn
def far(o, ratio):
    c = o.copy(); c.data = o.data.copy(); bpy.context.collection.objects.link(c); decimate(c, ratio); c.name = o.name + '_lo'; c['part'] = o.name; return c
def finish(aid, parts, meta=None, ratio=0.5):
    lo = [far(o, ratio) if len(o.data.polygons) > 60 else o for o in parts]
    hide([o for o in lo if o not in parts])
    st = pack('scn-' + aid, 'scenery', { 'hi': parts, 'lo': lo }, meta or {}, origin=True, q=4000)
    return st
H = lambda x, y, z, s=0: (math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 19.19) * 43758.5453) % 1.0

# ---- trees ----
def tier(name, r, y0, h, seed, n=14):
    """One pine tier: a drooping skirt of needles, jagged at the rim, hollow underneath."""
    import bmesh
    bm = bmesh.new(); ring = lambda rr, yy, jag=0.0, droop=0.0: [bm.verts.new(B(*(lambda a, k: (rr * (1 - jag * (k % 2)) * (1 + 0.1 * (H(k, seed, rr) - 0.5)) * math.cos(a), yy - droop * (1 - k % 2) + 0.12 * (H(seed, k, yy) - 0.5), rr * (1 - jag * (k % 2)) * (1 + 0.1 * (H(k, seed, rr) - 0.5)) * math.sin(a)))(2 * math.pi * (k + 0.5 * (seed % 2)) / n, k))) for k in range(n)]
    apex = bm.verts.new(B(0.05 * (H(seed, 1, 2) - 0.5), y0 + h, 0.05 * (H(seed, 3, 4) - 0.5)))
    mid = ring(r * 0.5, y0 + h * 0.5); rim = ring(r, y0, 0.22, 0.18); under = ring(r * 0.55, y0 + h * 0.18); hub = bm.verts.new(B(0, y0 + h * 0.3, 0))
    for k in range(n):
        j = (k + 1) % n
        bm.faces.new((apex, mid[j], mid[k])); bm.faces.new((mid[k], mid[j], rim[j], rim[k])); bm.faces.new((rim[k], rim[j], under[j], under[k])); bm.faces.new((under[k], under[j], hub))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); o = obj(name, bm, ['pine']); autosmooth(o, 50); return o
def crown_shade(y0, y1, rmax):
    def f(p, n):
        rel = smoothstep(y0, y1, p[1]); rim = min(1, math.hypot(p[0], p[2]) / rmax)
        v = (0.55 + 0.45 * rel) * (0.55 if n[1] < -0.2 else 1) * (0.85 + 0.2 * rim)
        return (v * 0.97, v, v * 0.95)
    return f
@design
def pine():
    """Pines: three shapes of four drooping tiers on a tapered, flared trunk; snow caps for the winter stages."""
    trunk = cyl('trunk0', 0.27, 2.2, (0, 1.1, 0), 'y', 'bark', 9, r2=0.12)
    warp(trunk, lambda x, y, z: (x * (1 + 0.5 * max(0, 0.35 - y)), y, z * (1 + 0.5 * max(0, 0.35 - y))))   # root flare
    vcol(trunk, lambda p, n: (lambda v: (v, v, v))(0.62 + 0.4 * smoothstep(0, 1.6, p[1])))
    parts = [trunk]
    for v, (tiers, lean) in enumerate([([(2.0, 1.05, 1.7), (1.6, 2.05, 1.6), (1.2, 3.0, 1.5), (0.8, 3.9, 1.45)], 0.0),
                                       ([(1.8, 1.2, 1.9), (1.3, 2.4, 1.8), (0.85, 3.6, 1.7)], 0.03),
                                       ([(2.1, 0.9, 1.4), (1.75, 1.7, 1.35), (1.4, 2.5, 1.3), (1.05, 3.3, 1.3), (0.7, 4.1, 1.3)], -0.02)]):
        tt = [tier(f't{v}_{k}', r, y0, h, v * 10 + k) for k, (r, y0, h) in enumerate(tiers)]
        top = max(y0 + h for r, y0, h in tiers)
        c = join(f'crown{v}', tt); warp(c, lambda x, y, z: (x + lean * y, y, z)); vcol(c, crown_shade(tiers[0][1], top, tiers[0][0]))
        caps = []
        for k, (r, y0, h) in enumerate(tiers):   # snow lying on each tier
            cap = cyl(f'cap{v}_{k}', r * 0.8, h * 0.78, (0, y0 + h * 0.3 + h * 0.39 + 0.05, 0), 'y', 'snow', 14, r2=0.03)   # from 0.3 of the way up, a bit shallower than the tier so it shows
            caps.append(noisy(cap, 0.04, 3.0, k))
        s = join(f'snow{v}', caps); warp(s, lambda x, y, z: (x + lean * y, y, z)); vcol(s, lambda p, n: (lambda k: (k, k, k))(0.85 + 0.15 * max(0, n[1])))
        parts += [c, s]
    return finish('pine', parts, { 'variants': 3 })
def blobs(name, spec, voxel, target, mat, seed):
    """A lumpy cluster: spheres (r, x, y, z) fused into one skin, roughened, brought down to ~target triangles."""
    o = join(name, [sphere(f'{name}_b{k}', r, (x, y, z), mat, 16) for k, (r, x, y, z) in enumerate(spec)])
    remesh(o, voxel); noisy(o, voxel * 0.9, 1.3, seed); tri = sum(len(p.vertices) - 2 for p in o.data.polygons)
    decimate(o, min(1, target / max(1, tri))); autosmooth(o, 60); return o
@design
def broadleaf():
    """Broadleaf trees: a trunk that forks into two limbs under a lumpy crown; two shapes."""
    parts = []
    for v, spec in enumerate([[(1.45, 0, 3.3, 0), (1.1, 0.8, 3.8, 0.35), (1.05, -0.7, 3.9, -0.45), (0.9, 0.1, 4.5, 0.2), (0.8, -0.3, 3.2, 0.9)],
                              [(1.3, 0, 3.6, 0), (1.15, 0.9, 3.3, -0.3), (1.1, -0.8, 3.4, 0.4), (0.95, 0.2, 4.4, -0.2)]]):
        c = blobs(f'crown{v}', spec, 0.28, 420, 'leaf', v + 3)
        vcol(c, lambda p, n: (lambda k: (k * 0.97, k, k * 0.94))((0.55 + 0.5 * smoothstep(2.3, 5.1, p[1])) * (0.8 + 0.25 * max(0, n[1]))))
        t = join(f'trunk{v}', [cyl(f'tr{v}', 0.26, 2.4, (0, 1.2, 0), 'y', 'bark', 8, r2=0.17), tube(f'l{v}a', (0, 2.2, 0), (0.55, 3.3, 0.2), 0.12, 'bark', 6), tube(f'l{v}b', (0, 2.2, 0), (-0.5, 3.4, -0.25), 0.11, 'bark', 6)])
        vcol(t, lambda p, n: (lambda v: (v, v, v))(0.6 + 0.4 * smoothstep(0, 1.8, p[1])))
        parts += [t, c]
    return finish('broadleaf', parts, { 'variants': 2 })
@design
def bush():
    """Bushes: low mounds of foliage, two shapes."""
    parts = []
    for v, spec in enumerate([[(1.0, 0, 0, 0), (0.78, 0.65, -0.1, 0.25), (0.7, -0.5, -0.15, -0.3)], [(0.9, 0, 0.05, 0), (0.85, 0.2, -0.1, -0.6), (0.7, -0.6, -0.2, 0.3)]]):
        b = blobs(f'bush{v}', spec, 0.22, 200, 'leaf', v + 11); warp(b, lambda x, y, z: (x, y * 1.3 + 0.1, z))   # puffier than a mound
        vcol(b, lambda p, n: (lambda k: (k, k, k))(0.6 + 0.45 * smoothstep(-0.8, 0.8, p[1]) * (0.8 + 0.2 * max(0, n[1]))))
        parts.append(b)
    return finish('bush', parts, { 'variants': 2 })
@design
def rock():
    """Rocks: three lumpy boulders with flat bottoms and sharp-ish facets (the game adds moss on green stages)."""
    parts = []
    for v in range(3):
        bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=1.0); o = bpy.context.object; o.name = f'rock{v}'; o.data.materials.append(mat('rock'))
        o.scale = ((1.0, 1.25, 0.9)[v], (0.85, 1.0, 1.15)[v], 1.0); bpy.ops.object.transform_apply(scale=True)
        noisy(o, 0.35, 1.1, v * 5 + 1); noisy(o, 0.08, 4.0, v * 5 + 2)
        warp(o, lambda x, y, z: (x, -0.35 - (y + 0.35) * 0.2 if y < -0.35 else y, z))
        tri = sum(len(p.vertices) - 2 for p in o.data.polygons); decimate(o, 240 / tri); autosmooth(o, 30)
        vcol(o, lambda p, n: (lambda k: (k, k, k))((0.6 + 0.42 * smoothstep(-0.4, 0.8, p[1])) * (0.85 + 0.15 * (H(round(p[0] * 3), round(p[1] * 3), round(p[2] * 3)) ))))
        parts.append(o)
    return finish('rock', parts, { 'variants': 3 })
@design
def cactus():
    """Saguaros: a ribbed column with a domed top and upturned arms, two shapes."""
    def ribbed(name, r, h, loc, ribs=12):
        c = cyl(name, r, h, loc, 'y', 'cactus', ribs * 2)
        warp(c, lambda x, y, z: (lambda a: (x * (1 - 0.14 * (round(a / (math.pi / ribs)) % 2)), y, z * (1 - 0.14 * (round(a / (math.pi / ribs)) % 2))))(math.atan2(z - loc[2], x - loc[0]) % (2 * math.pi)))
        return join(name, [c, sphere(name + 'd', r * 0.95, (loc[0], loc[1] + h / 2, loc[2]), 'cactus', ribs * 2, (1, 0.8, 1))])
    parts = []
    for v, arms in enumerate([[(1, 1.5, 0.9, 1.2), (-1, 2.1, 0.75, 1.0)], [(1, 1.9, 0.8, 1.3), (-1, 1.3, 0.85, 0.9)]]):
        pcs = [ribbed(f'c{v}', 0.34, 3.4, (0, 1.7, 0))]
        for k, (s_, y, reach, up) in enumerate(arms):
            pcs += [tube(f'a{v}{k}', (0, y, 0), (s_ * reach, y, 0), 0.2, 'cactus', 16), sphere(f'e{v}{k}', 0.2, (s_ * reach, y, 0), 'cactus', 16), ribbed(f'u{v}{k}', 0.21, up, (s_ * reach, y + up / 2, 0), 8)]
        c = join(f'cactus{v}', pcs); tri = sum(len(p.vertices) - 2 for p in c.data.polygons); decimate(c, min(1, 520 / tri)); autosmooth(c, 40)
        vcol(c, lambda p, n: (lambda k: (k, k, k))((0.7 + 0.32 * smoothstep(0, 3.4, p[1]))))
        parts.append(c)
    return finish('cactus', parts, { 'variants': 2 })

# ---- houses: nominal 5 m wide (x), 4.2 m deep (z), walls 3.6 m from 0.0 (0.4 of it below the ground); the game scales
# each to its plot. walls<v> takes the wall colour (windows, doors, stone and timber are baked darker), roof<v> the roof's.
WIN, FRAME, DOOR, STONE, WOOD, BRICK = (0.2, 0.25, 0.32), (1, 1, 1), (0.42, 0.28, 0.18), (0.62, 0.6, 0.56), (0.55, 0.4, 0.28), (0.62, 0.38, 0.32)
def wall_shade(features):
    """Walls in white (tinted by the game) with features: [(test(p, n) -> bool, colour)], the first that matches wins."""
    def f(p, n):
        for test, c in features:
            if test(p, n): return c
        v = (0.78 + 0.22 * smoothstep(0.2, 3.4, p[1])) * (0.92 if abs(n[0]) > 0.5 else 1)
        return (v, v, v)
    return f
def openings(face_z, xs, y0, y1, w):
    """Window/door rectangles on the front and back walls (|z| = face_z)."""
    return lambda p, n: abs(n[2]) > 0.7 and abs(abs(p[2]) - face_z) < 0.08 and y0 < p[1] < y1 and any(abs(p[0] - x) < w / 2 for x in xs)
def side_openings(face_x, zs, y0, y1, w):
    return lambda p, n: abs(n[0]) > 0.7 and abs(abs(p[0]) - face_x) < 0.08 and y0 < p[1] < y1 and any(abs(p[2] - z) < w / 2 for z in zs)
def gable_roof(name, w, d, y, rise, over=0.35, thick=0.14, hip=False):
    """A pitched roof over w x d at eaves height y: ridge along x (gable ends at +-x), or hipped."""
    import bmesh
    bm = bmesh.new(); hw, hd = w / 2 + over, d / 2 + over; ridge = hw * (0.45 if hip else 1)
    P = [(-hw, y, -hd), (hw, y, -hd), (hw, y, hd), (-hw, y, hd), (-ridge, y + rise, 0), (ridge, y + rise, 0)]
    V = [bm.verts.new(B(*p)) for p in P]
    for f in ((0, 1, 5, 4), (2, 3, 4, 5), (1, 2, 5), (3, 0, 4), (0, 3, 2, 1)): bm.faces.new([V[k] for k in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); o = obj(name, bm, ['roof'])
    apply(o, 'SOLIDIFY', thickness=thick, offset=1); shade(o, False)
    vcol(o, lambda p, n: (lambda k: (k, k, k))(0.55 if n[1] < -0.3 else 0.82 + 0.18 * smoothstep(y, y + rise, p[1])))
    return o
def gable_walls(name, w, d, y, rise):
    """Box walls up to y with triangular gable ends (at +-x) up to the ridge."""
    import bmesh
    bm = bmesh.new(); hw, hd = w / 2, d / 2
    P = [(-hw, 0, -hd), (hw, 0, -hd), (hw, 0, hd), (-hw, 0, hd), (-hw, y, -hd), (hw, y, -hd), (hw, y, hd), (-hw, y, hd), (-hw, y + rise, 0), (hw, y + rise, 0)]
    V = [bm.verts.new(B(*p)) for p in P]
    for f in ((0, 1, 5, 4), (2, 3, 7, 6), (1, 2, 6, 9, 5), (3, 0, 4, 8, 7), (3, 2, 1, 0), (4, 5, 9, 8), (6, 7, 8, 9)): bm.faces.new([V[k] for k in f])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); o = obj(name, bm, ['wall'])
    # enough rows and columns that the baked windows have edges to sit on
    bpy.context.view_layer.objects.active = o; apply(o, 'SUBSURF', levels=3, subdivision_type='SIMPLE'); return o
@design
def house():
    """Country houses, four kinds: a gabled cottage with a chimney, a two-storey hipped house, an alpine chalet with a
    balcony and deep eaves, and a barn with a big door."""
    parts = []
    W, D = 5.0, 4.2
    # 0: cottage
    w0 = gable_walls('walls0', W, D, 3.6, 1.7)
    vcol(w0, wall_shade([(lambda p, n: p[1] < 0.85, STONE), (openings(D / 2, [-1.3, 1.3], 1.4, 2.6, 0.9), WIN), (openings(D / 2, [0.0], 0.4, 2.7, 0.9), DOOR),
                         (side_openings(W / 2, [0.0], 4.1, 4.7, 0.6), WIN), (openings(D / 2, [-1.3, 1.3], 1.3, 2.7, 1.08), FRAME)]))
    chim = rbox('chim0', (0.55, 1.6, 0.55), (1.3, 5.0, -0.7), 'wall', 0.02); vcol(chim, lambda p, n: BRICK)
    parts += [join('walls0', [w0, chim]), gable_roof('roof0', W, D, 3.6, 1.7)]
    # 1: two storeys, hipped roof
    w1 = gable_walls('walls1', W, D, 3.6, 0.0)
    vcol(w1, wall_shade([(lambda p, n: p[1] < 0.6, STONE), (openings(D / 2, [-1.5, 0, 1.5], 2.35, 3.2, 0.75), WIN), (openings(D / 2, [-1.5, 1.5], 0.95, 1.8, 0.75), WIN),
                         (openings(D / 2, [0.0], 0.4, 1.95, 0.85), DOOR), (side_openings(W / 2, [-0.9, 0.9], 1.0, 1.8, 0.7), WIN), (side_openings(W / 2, [-0.9, 0.9], 2.35, 3.15, 0.7), WIN),
                         (lambda p, n: abs(p[1] - 2.05) < 0.06, FRAME)]))
    parts += [w1, gable_roof('roof1', W, D, 3.6, 1.5, hip=True)]
    # 2: chalet: timber upper storey, deep eaves, a balcony across the front
    w2 = gable_walls('walls2', W, D, 3.6, 1.4)
    vcol(w2, wall_shade([(lambda p, n: p[1] < 1.9 and (openings(D / 2, [-1.4, 1.4], 0.95, 1.75, 0.8)(p, n)), WIN), (lambda p, n: p[1] < 1.9 and openings(D / 2, [0.0], 0.4, 1.8, 0.85)(p, n), DOOR),
                         (lambda p, n: p[1] < 1.9, (0.95, 0.95, 0.93)), (openings(D / 2, [-1.0, 1.0], 2.3, 3.1, 0.8), WIN), (lambda p, n: True, WOOD)]))
    bal = join('bal2', [rbox('balf', (W + 0.2, 0.12, 0.8), (0, 2.0, D / 2 + 0.4), 'wood', 0.01)] + [rbox(f'bp{k}', (0.06, 0.8, 0.06), (-W / 2 + k * W / 10, 2.45, D / 2 + 0.76), 'wood', 0) for k in range(11)] + [rbox('brail', (W + 0.2, 0.08, 0.08), (0, 2.86, D / 2 + 0.76), 'wood', 0.01)])
    vcol(bal, lambda p, n: WOOD)
    parts += [join('walls2', [w2, bal]), gable_roof('roof2', W, D, 3.6, 1.4, over=0.8)]
    # 3: barn: timber boarding, a big double door
    w3 = gable_walls('walls3', W, D, 3.2, 2.0)
    vcol(w3, lambda p, n: (lambda k: DOOR if openings(D / 2, [0.0], 0.4, 2.9, 2.2)(p, n) else (lambda b: (b * WOOD[0] * 1.5, b * WOOD[1] * 1.5, b * WOOD[2] * 1.5))(k))((0.8 + 0.12 * (int((p[0] if abs(n[2]) > 0.5 else p[2]) * 5) % 2)) * (0.8 + 0.2 * smoothstep(0, 3, p[1]))))
    parts += [w3, gable_roof('roof3', W, D, 3.2, 2.0, over=0.3)]
    return finish('house', parts, { 'variants': 4, 'size': [W, 3.6, D] }, ratio=0.6)

# ---- spectators: body (torso and legs, centred on the origin), head (centred), arm (hung from the shoulder at the origin)
@design
def fan():
    """Spectators: a shirt (the game's colour) over dark trousers, a head with hair, arms with hands."""
    torso = rbox('torso', (0.58, 0.62, 0.38), (0, 0.26, 0), 'shirt', 0.08)
    legs = join('legs', [rbox(f'leg{k}', (0.24, 0.62, 0.3), (s_ * 0.15, -0.3, 0), 'shirt', 0.05) for k, s_ in enumerate((-1, 1))] + [rbox(f'shoe{k}', (0.24, 0.1, 0.36), (s_ * 0.15, -0.56, 0.04), 'shirt', 0.03) for k, s_ in enumerate((-1, 1))])
    body = join('body', [torso, legs]); vcol(body, lambda p, n: (0.12, 0.12, 0.14) if p[1] < -0.52 else (0.3, 0.3, 0.36) if p[1] < -0.02 else (lambda k: (k, k, k))(0.8 + 0.2 * smoothstep(-0.05, 0.55, p[1])))
    head = sphere('head', 0.21, (0, 0, 0), 'skin', 14, (1, 1.1, 1))
    hair = sphere('hair', 0.225, (0, 0.05, -0.03), 'skin', 14, (1, 0.9, 1)); bpy.context.view_layer.objects.active = hair
    warp(hair, lambda x, y, z: (x, max(y, -0.02 + 0.2 * max(0, -z) / 0.23), z))   # a cap of hair, longer at the back
    h = join('head', [head, hair]); vcol(h, lambda p, n: (0.3, 0.2, 0.14) if (p[1] > 0.1 or (n[2] < -0.3 and p[1] > -0.12)) else (1, 1, 1))
    arm = join('arm', [rbox('sleeve', (0.15, 0.5, 0.15), (0, -0.22, 0), 'shirt', 0.05), sphere('hand', 0.08, (0, -0.55, 0), 'shirt', 10)])
    vcol(arm, lambda p, n: (1.0, 0.8, 0.66) if p[1] < -0.46 else (0.9, 0.9, 0.9))
    return finish('fan', [body, h, arm], { 'lab': { 'body': [0, 0.6, 0], 'head': [0, 1.45, 0], 'arm': [-0.4, 1.12, 0], 'arm2': [0.4, 1.12, 0] } }, ratio=0.6)
