# Kit pieces: the built things placed along the road in numbers, each one shape the game positions (instanced or one
# per spot): tunnel portals, bridge and viaduct piers, off-piste gates, street lamps and the barrier pieces. Track-
# shaped things (the road, bridge decks, bores, headwalls) stay procedural. Like scenery, parts sit at the model's
# origin and carry their shading and fixed colours in vertex colours; the game's material colour is white (or the
# instance tint: an armco post vs a wooden one, a tyre's stripe).
import math, bpy
from kit import *

DESIGNS = {}
def design(fn): DESIGNS[fn.__name__] = fn; return fn
def far(o, ratio):
    c = o.copy(); c.data = o.data.copy(); bpy.context.collection.objects.link(c); decimate(c, ratio); c.name = o.name + '_lo'; c['part'] = o.name; return c
def finish(aid, parts, meta=None, ratio=0.5, q=4000, ao=(0.5, 1.0), together=False):
    bake_ao([parts] if together else [[o] for o in parts], *ao)   # together: parts that are one object (portal arch and band)
    lo = [far(o, ratio) if len(o.data.polygons) > 80 else o for o in parts]
    hide([o for o in lo if o not in parts])
    return pack('kit-' + aid, 'kit', { 'hi': parts, 'lo': lo }, meta or {}, origin=True, q=q)
H = lambda x, y, z, s=0: (math.sin(x * 12.9898 + y * 78.233 + z * 37.719 + s * 19.19) * 43758.5453) % 1.0
grey = lambda v: (v, v, v)

@design
def portal():
    """Tunnel portal: a masonry arch of voussoirs with a keystone round a yellow-and-black hazard band, a cornice and a
    name plaque, 1.2 m deep. Modelled for the game's bore (half width RT, height HT over the road at y = 0): the band
    spans RT..RT+0.8, the masonry out to RT+3 (the headwall rock continues from there). Facing -z; the hill is +z."""
    import bmesh
    RT, HT, SEG = 9.0, 7.2, 28
    def ring_band(name, r0, r1, depth, colour):
        bm = bmesh.new(); rows = []
        for k in range(SEG + 1):
            a = math.pi * k / SEG
            rows.append([bm.verts.new(B(math.cos(a) * (RT + r), math.sin(a) * (HT + r), z)) for r, z in ((r0, 0), (r1, 0), (r1, depth), (r0, depth))])
        for k in range(SEG):
            a, b = rows[k], rows[k + 1]
            for q in range(4): bm.faces.new((a[q], a[(q + 1) % 4], b[(q + 1) % 4], b[q]))
        for row in (rows[0], rows[-1]): bm.faces.new(row)
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); o = obj(name, bm, ['concrete']); shade(o, False); vcol(o, colour); return o
    band = ring_band('band', 0, 0.8, 1.0, lambda p, n: (lambda a: (1, 0.78, 0.17) if int(a / (math.pi / 14)) % 2 else (0.12, 0.12, 0.14))(math.atan2(p[1] / HT, p[0] / RT) % math.pi))
    vcol(band, lambda p, n: (lambda a: (1, 0.78, 0.17) if int(a / (math.pi / 14)) % 2 else (0.12, 0.12, 0.14))(math.atan2(p[1] / HT, p[0] / RT) % math.pi), per_face=True)
    # voussoirs: 13 wedge blocks, each a little proud or shy of the face, joints dark
    vs = []
    for k in range(13):
        a0, a1 = math.pi * k / 13 + 0.004, math.pi * (k + 1) / 13 - 0.004
        bm = bmesh.new(); key = k == 6; out = 3.0 + (0.5 if key else 0); fz = -0.12 if key else -0.04 * (k % 2)
        P = lambda a, r, z: B(math.cos(a) * (RT + r), math.sin(a) * (HT + r), z)
        v = [bm.verts.new(P(a, r, z)) for a, r, z in ((a0, 0.8, fz), (a1, 0.8, fz), (a1, out, fz), (a0, out, fz), (a0, 0.8, 1.2), (a1, 0.8, 1.2), (a1, out, 1.2), (a0, out, 1.2))]
        for f in ((0, 1, 2, 3), (7, 6, 5, 4), (0, 4, 5, 1), (1, 5, 6, 2), (2, 6, 7, 3), (3, 7, 4, 0)): bm.faces.new([v[i] for i in f])
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces); o = obj(f'vs{k}', bm, ['concrete']); shade(o, False)
        tone = 0.86 + 0.1 * H(k, 1, 2) + (0.06 if key else 0); vcol(o, lambda p, n, t=tone: grey(t * (0.8 if n[2] > 0.5 else 1))); vs.append(o)
    # piers either side down to the road, a cornice across the top, a plaque on it
    sides = [rbox(f'pier{k}', (3.0, 1.6, 1.3), (s * (RT + 1.9), 0.5, 0.55), 'concrete', 0.05) for k, s in enumerate((-1, 1))]
    for o in sides: vcol(o, lambda p, n: grey(0.8 + 0.08 * H(round(p[1] * 2), 3, 1)))
    cornice = rbox('cornice', (2 * RT + 7.4, 0.7, 1.6), (0, HT + 3.35, 0.5), 'concrete', 0.08); vcol(cornice, lambda p, n: grey(0.95 if n[1] > 0.5 else 0.78))
    plaque = rbox('plaque', (3.2, 0.9, 0.12), (0, HT + 1.9, -0.18), 'concrete', 0.03); vcol(plaque, lambda p, n: (0.18, 0.24, 0.36) if n[2] < -0.5 else grey(0.5))
    arch = join('arch', vs + sides + [cornice, plaque])
    return finish('portal', [arch, band], { 'rt': RT, 'ht': HT }, ratio=0.7, q=2000, ao=(0.55, 2.0), together=True)   # 13 m across: +-16 m range

@design
def pier():
    """Bridge and viaduct piers: a shaft of unit size (the game scales it to each pier) with chamfered corners, pilaster
    strips and weathering darker towards the ground; and a cornice cap of fixed height for the top of each."""
    shaft = rbox('shaft', (1, 1, 1), (0, 0, 0), 'concrete', 0.08, segs=2)
    strips = [rbox(f'strip{k}', (0.06, 1.0, 0.08), (x, 0, s * 0.51), 'concrete', 0.01) for k, (x, s) in enumerate([(x, s) for x in (-0.3, 0.3) for s in (-1, 1)])]
    shaft = join('shaft', [shaft] + strips)
    vcol(shaft, lambda p, n: grey((0.68 + 0.3 * smoothstep(-0.5, 0.45, p[1])) * (0.93 if abs(n[0]) > 0.5 else 1)))
    cap = join('cap', [rbox('capA', (1.14, 0.25, 1.14), (0, 0.125, 0), 'concrete', 0.03), rbox('capB', (1.06, 0.2, 1.06), (0, -0.1, 0), 'concrete', 0.03)])
    vcol(cap, lambda p, n: grey(1.0 if n[1] > 0.5 else 0.8))
    return finish('pier', [shaft, cap], { 'cap': 0.45, 'lab': { 'shaft': [-0.9, 0.5, 0], 'cap': [0.9, 0.2, 0] } })

@design
def gate():
    """Off-piste gate: a post with red and white bands, a ball on top and a plinth (6 m, centred), and a swallow-tailed
    pennant (1.4 x 0.8, centred) that the game waves."""
    import bmesh
    bands = []   # the pole as ten bands, each its own colour
    for k in range(10):
        y0 = -2.5 + k * 0.55; b = cyl(f'pb{k}', 0.22 - 0.002 * k, 0.55, (0, y0 + 0.275, 0), 'y', 'white', 16, r2=0.22 - 0.002 * (k + 1))
        vcol(b, lambda p, n, k=k: (0.88, 0.25, 0.18) if k % 2 else grey(0.96)); bands.append(b)
    ball = sphere('ball', 0.3, (0, 3.1, 0), 'white', 14); vcol(ball, lambda p, n: (1, 0.84, 0.2))
    plinth = cyl('plinth', 0.45, 0.5, (0, -2.75, 0), 'y', 'white', 16, r2=0.36); vcol(plinth, lambda p, n: grey(0.55 + 0.2 * max(0, n[1])))
    post = join('post', bands + [ball, plinth])
    # the pennant waves: a loop of 12 poses keyed on the timeline, a wave running out from the pole (-x) growing to the tail
    flag = flag_grid('flag', 1.4, 0.8, 10, 4, 'yellow', tail=0.35); vcol(flag, lambda p, n: (1, 0.78, 0.17))
    wave_loop(flag, 12, lambda x, y, z, t: (x, y + 0.03 * math.sin(2 * math.pi * t + x * 3) * (x + 0.7), z + 0.16 * (x + 0.7) / 1.4 * math.sin(2 * math.pi * t - (x + 0.7) * 4.2)), fps=10)
    return finish('gate', [post, flag], { 'lab': { 'post': [0, 3, 0], 'flag': [0.9, 5.6, 0] } })

@design
def lamp():
    """Street lamp: a cast-iron base and fluted pole, a curled arm over the road (+z) and a lantern; its glass lights up.
    The origin is the foot of the pole."""
    pole = join('post', [cyl('base', 0.2, 0.7, (0, 0.35, 0), 'y', 'dark', 12, r2=0.13), cyl('pole', 0.09, 4.2, (0, 2.7, 0), 'y', 'dark', 10, r2=0.07),
                         torus('curl', 0.18, 0.03, (0, 4.45, 0.2), 'x', 'dark', 16, 6), tube('arm', (0, 4.7, 0), (0, 4.75, 0.55), 0.04, 'dark', 8),
                         cyl('cap', 0.22, 0.14, (0, 4.95, 0.6), 'y', 'dark', 8, r2=0.05)])
    vcol(pole, lambda p, n: grey(0.32 + 0.12 * max(0, n[1])))
    glass = cyl('glow', 0.16, 0.36, (0, 4.72, 0.6), 'y', 'lamp', 8, r2=0.2); vcol(glass, lambda p, n: (1, 0.91, 0.66))
    return finish('lamp', [pole, glass], {}, together=True)

@design
def barrier():
    """Barrier pieces at their game sizes, centred: a tyre (0.55 x 0.42) with tread and sidewall lettering, a post
    (0.2 x 1.2), an armco rail (a W-beam 0.14 high, 1 m along z: the game stretches it) and a hay bale (1.0 x 0.9 x 1.5)."""
    import bmesh
    t = torus('tyre', 0.4, 0.16, (0, 0, 0), 'y', 'tyre', 14, 6)   # hundreds line a stage: keep it light; warp(t, lambda x, y, z: (x * (0.55 / 0.56), y * 1.3, z * (0.55 / 0.56)))
    vcol(t, lambda p, n: grey(0.55 if abs(n[1]) > 0.7 else 0.9 - 0.25 * (int(math.atan2(p[2], p[0]) / 0.2) % 2) * (math.hypot(p[0], p[2]) > 0.5)))
    post = rbox('post', (0.2, 1.2, 0.2), (0, 0, 0), 'white', 0.02, segs=1); warp(post, lambda x, y, z: (x, y + (0.08 if y > 0.55 and abs(x) < 0.05 and abs(z) < 0.05 else 0), z))
    vcol(post, lambda p, n: grey(0.8 + 0.2 * smoothstep(-0.6, 0.6, p[1])))
    bm = bmesh.new(); prof = [(-0.07, 0.05), (-0.03, 0.02), (0.0, 0.05), (0.03, 0.02), (0.07, 0.05), (0.07, 0.0), (-0.07, 0.0)]   # (y, x): the W, 5 cm deep
    rows = [[bm.verts.new(B(x - 0.025, y, z)) for y, x in prof] for z in (-0.5, 0.5)]
    for k in range(len(prof)): bm.faces.new((rows[0][k], rows[0][(k + 1) % len(prof)], rows[1][(k + 1) % len(prof)], rows[1][k]))
    bm.faces.new(rows[0][::-1]); bm.faces.new(rows[1]); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); rail = obj('rail', bm, ['metal']); shade(rail, False)
    vcol(rail, lambda p, n: grey(1.0 if n[0] > 0.3 else 0.8))
    bale = rbox('bale', (1.0, 0.9, 1.5), (0, 0, 0), 'hay', 0.14, segs=3)
    noisy(bale, 0.02, 9.0, 3)
    vcol(bale, lambda p, n: (0.55, 0.42, 0.25) if any(abs(p[2] - z) < 0.04 for z in (-0.4, 0.4)) else grey((0.82 + 0.18 * H(round(p[0] * 20), round(p[1] * 6), round(p[2] * 20))) * (0.85 if n[1] < -0.5 else 1)))
    return finish('barrier', [t, post, rail, bale], { 'lab': { 'tyre': [-2.2, 0.21, 0], 'post': [-0.9, 0.6, 0], 'rail': [0.2, 0.9, 0], 'bale': [1.6, 0.45, 0] } }, q=8000)
