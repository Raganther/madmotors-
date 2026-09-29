# The Muscle Coupe, modelled in Blender (headless: `python3 tools/blender/coupe.py`). A coarse cage lofted through
# cross-sections, smoothed with a subdivision surface, wheel arches cut with booleans; a fastback glasshouse, chrome
# bumpers, ducktail, scoop, lamps. Game axes: x right, y up, z forward (front +z); Blender: x, -z (front at -Y), y.
# Writes renders to tools/out/ and the parts to tools/out/coupe-parts.json (game axes) for tools/blender/export.mjs.
import bpy, bmesh, math, json, os, sys
from mathutils import Vector
OUT = os.path.join(os.path.dirname(__file__), '..', 'out'); os.makedirs(OUT, exist_ok=True)
bpy.ops.wm.read_factory_settings(use_empty=True)
B = lambda x, y, z: (x, -z, y)                                 # game -> Blender
def mat(name, rgb, metal=0.0, rough=0.4, alpha=1.0, emit=None):
    m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*rgb, 1); p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    if 'Coat Weight' in p.inputs and name in ('paint', 'accent'): p.inputs['Coat Weight'].default_value = 0.6
    if alpha < 1: p.inputs['Alpha'].default_value = alpha
    if emit: p.inputs['Emission Color'].default_value = (*emit, 1); p.inputs['Emission Strength'].default_value = 3
    return m
srgb = lambda h: tuple(((h >> s & 255) / 255) ** 2.2 for s in (16, 8, 0))
M = { 'paint': mat('paint', srgb(0xFFC72C), 0.1, 0.25), 'accent': mat('accent', srgb(0x1C2340), 0.1, 0.3), 'glass': mat('glass', srgb(0x1A2436), 0.2, 0.05),
      'chrome': mat('chrome', srgb(0xD3D7DD), 1.0, 0.15), 'trim': mat('trim', srgb(0x2B2F3A), 0.2, 0.6), 'lamp': mat('lamp', srgb(0xFFF6C8), 0, 0.2, emit=srgb(0xFFF6C8)),
      'tail': mat('tail', srgb(0xFF4A3A), 0, 0.3, emit=srgb(0xFF2A1A)), 'tyre': mat('tyre', srgb(0x1E1E22), 0, 0.9), 'hub': mat('hub', srgb(0xC9CCD4), 0.9, 0.3) }
def obj(name, bm, mats):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    for m in mats: o.data.materials.append(M[m])
    return o
def loft(stations, ring, close_ends=True):
    """stations: [(z, section(t) -> (x, y))] with ring points per section; a closed tube, capped."""
    bm = bmesh.new(); rows = []
    for z, sec in stations: rows.append([bm.verts.new(B(*sec(k / ring), z)) for k in range(ring)] if False else [bm.verts.new(B(sec(k / ring)[0], sec(k / ring)[1], z)) for k in range(ring)])
    for a, b in zip(rows, rows[1:]):
        for k in range(ring): bm.faces.new((a[k], a[(k + 1) % ring], b[(k + 1) % ring], b[k]))
    if close_ends: bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])
    bm.normal_update(); bmesh.ops.recalc_face_normals(bm, faces=bm.faces); return bm
def lerp_keys(keys, z):
    for (z0, v0), (z1, v1) in zip(keys, keys[1:]):
        if z0 >= z >= z1: t = (z - z0) / (z1 - z0); return v0 + (v1 - v0) * t
    return keys[0][1] if z > keys[0][0] else keys[-1][1]
# ---- the body: a rounded box section (superellipse) with its width, sill and shoulder varying along the car ----
W = [(1.86, 0.88), (1.7, 0.97), (1.45, 1.03), (1.22, 1.05), (0.95, 1.02), (0.5, 0.97), (0.0, 0.97), (-0.5, 0.99), (-0.75, 1.06), (-1.12, 1.13), (-1.45, 1.08), (-1.7, 1.0), (-1.86, 0.94)]      # half width
TOP = [(1.86, 0.78), (1.74, 0.88), (1.4, 0.95), (0.4, 0.99), (0.1, 1.0), (-1.2, 1.03), (-1.7, 1.03), (-1.86, 0.96)]                  # bonnet / deck
BOT = [(1.86, 0.46), (1.5, 0.36), (0.0, 0.30), (-1.5, 0.36), (-1.86, 0.48)]                                                          # underside
def body_sec(z):
    w, top, bot = lerp_keys(W, z), lerp_keys(TOP, z), lerp_keys(BOT, z); cy, hh = (top + bot) / 2, (top - bot) / 2
    def f(t):
        a = t * 2 * math.pi; c, s = math.cos(a), math.sin(a); n = 6
        x = w * math.copysign(abs(c) ** (2 / n), c); y = cy + hh * math.copysign(abs(s) ** (2 / n), s)
        if s > 0: x *= 1 - 0.1 * s ** 3                                                  # tumblehome: the shoulders roll in
        return (x, y)
    return f
zs = [1.86, 1.82, 1.72, 1.55, 1.35, 1.1, 0.8, 0.5, 0.2, -0.2, -0.5, -0.75, -0.95, -1.12, -1.3, -1.5, -1.68, -1.8, -1.86]
body = obj('body', loft([(z, body_sec(z)) for z in zs], 24), ['paint', 'accent', 'trim'])
sub = body.modifiers.new('sub', 'SUBSURF'); sub.levels = 2; sub.render_levels = 2
bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier='sub')
# wheel arches: cut with cylinders round each wheel (a little bigger than the tyre), then a dark liner inside
WHEELS = [(0.94, 1.22, 0.4, 0.3), (-0.94, 1.22, 0.4, 0.3), (1.02, -1.12, 0.46, 0.48), (-1.02, -1.12, 0.46, 0.48)]
for x, z, r, wd in WHEELS:
    bpy.ops.mesh.primitive_cylinder_add(vertices=40, radius=r + 0.05, depth=0.9, location=B(math.copysign(1.05, x), r, z), rotation=(0, math.pi / 2, 0)); cut = bpy.context.object
    bo = body.modifiers.new('arch', 'BOOLEAN'); bo.object = cut; bo.operation = 'DIFFERENCE'; bo.solver = 'EXACT'
    bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier='arch'); bpy.data.objects.remove(cut)
# stripes (accent) on the bonnet and deck, and a dark sill: by face position
bm = bmesh.new(); bm.from_mesh(body.data)
for f in bm.faces:
    c = f.calc_center_median(); gx, gy, gz = c.x, c.z, -c.y; n = f.normal
    if gy < 0.42: f.material_index = 2
bm.to_mesh(body.data); bm.free()
dec = body.modifiers.new('dec', 'DECIMATE'); dec.ratio = float(os.environ.get('DECIMATE', '0.3'))   # a game-weight mesh: the shape holds, the triangle count drops
bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier='dec')
bpy.ops.object.shade_smooth()
# twin stripes: thin decals laid on the finished surface (ray cast down onto it), so their edges stay crisp
from mathutils.bvhtree import BVHTree
dg = bpy.context.evaluated_depsgraph_get(); tree = BVHTree.FromObject(body, dg)
def surf(x, z):
    hit = tree.ray_cast(Vector(B(x, 3, z)), Vector((0, 0, -1))); return hit[0].z + 0.006 if hit[0] else None
sb = bmesh.new()
for cx in (-0.33, 0.33):
    for z0, z1 in ((1.8, 0.36), (-1.24, -1.84)):
        n = max(2, int(abs(z1 - z0) / 0.06)); prev = None
        for k in range(n + 1):
            z = z0 + (z1 - z0) * k / n; ys = [surf(cx - 0.1, z), surf(cx + 0.1, z)]
            if None in ys: prev = None; continue
            row = [sb.verts.new((cx - 0.1, -z, ys[0])), sb.verts.new((cx + 0.1, -z, ys[1]))]
            if prev: sb.faces.new((prev[0], prev[1], row[1], row[0]))
            prev = row
bmesh.ops.recalc_face_normals(sb, faces=sb.faces)
for f in sb.faces:
    if f.normal.z < 0: f.normal_flip()
stripes = obj('stripes', sb, ['accent']); bpy.context.view_layer.objects.active = stripes; bpy.ops.object.shade_smooth()
# ---- the glasshouse: a fastback cabin, glass all round under a painted roof ----
def cab_sec(z):
    base, roof = 0.99, lerp_keys([(0.32, 1.0), (0.05, 1.28), (-0.25, 1.44), (-0.8, 1.45), (-1.15, 1.25), (-1.45, 1.04)], z)
    wb, wt = lerp_keys([(0.32, 0.82), (-0.5, 0.86), (-1.45, 0.84)], z), lerp_keys([(0.32, 0.76), (-0.25, 0.68), (-0.8, 0.68), (-1.45, 0.76)], z)
    pts = [(-wb, base - 0.05), (-wb * 0.99, base + 0.08), (-wt, roof - 0.07), (-wt * 0.8, roof), (wt * 0.8, roof), (wt, roof - 0.07), (wb * 0.99, base + 0.08), (wb, base - 0.05)]
    return lambda t: pts[round(t * len(pts)) % len(pts)]
cab = obj('cabin', loft([(z, cab_sec(z)) for z in [0.34, 0.31, 0.2, 0.05, -0.12, -0.25, -0.4, -0.55, -0.7, -0.8, -0.95, -1.15, -1.3, -1.42, -1.46]], 8), ['glass', 'paint'])
sub = cab.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; bpy.context.view_layer.objects.active = cab; bpy.ops.object.modifier_apply(modifier='sub')
bm = bmesh.new(); bm.from_mesh(cab.data)
for f in bm.faces:
    c = f.calc_center_median(); gx, gy, gz = c.x, c.z, -c.y
    roof = lerp_keys([(0.32, 1.0), (0.05, 1.28), (-0.25, 1.44), (-0.8, 1.45), (-1.15, 1.25), (-1.45, 1.04)], gz)
    if gy > roof - 0.06 and abs(gx) < 0.6 and -1.0 < gz < -0.15: f.material_index = 1      # the roof is painted
bm.to_mesh(cab.data); bm.free(); bpy.context.view_layer.objects.active = cab; bpy.ops.object.shade_smooth()
# ---- small parts ----
def rbox(name, size, loc, m, bevel=0.03, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=B(*loc)); o = bpy.context.object; o.name = name; o.scale = (size[0], size[2], size[1]); o.rotation_euler = rot
    bpy.ops.object.transform_apply(scale=True, rotation=True)
    bv = o.modifiers.new('bv', 'BEVEL'); bv.width = bevel; bv.segments = 3; bpy.ops.object.modifier_apply(modifier='bv'); bpy.ops.object.shade_smooth()
    o.data.materials.append(M[m]); return o
bumper = rbox('bumper', (1.96, 0.15, 0.16), (0, 0.56, 1.86), 'chrome', 0.06)
rbump = rbox('rbumper', (1.94, 0.14, 0.14), (0, 0.56, -1.87), 'chrome', 0.06)
wing = rbox('wing', (1.72, 0.06, 0.34), (0, 1.07, -1.72), 'paint', 0.025, rot=(-0.35, 0, 0))
scoop = rbox('scoop', (0.46, 0.12, 0.72), (0, 1.03, 0.72), 'paint', 0.05)
mouth = rbox('scoopmouth', (0.36, 0.07, 0.04), (0, 1.04, 1.08), 'trim', 0.01)
grille = rbox('grille', (0.9, 0.16, 0.05), (0, 0.76, 1.84), 'trim', 0.02)
lamps = []
for x in (-0.72, -0.42, 0.42, 0.72):
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.1, depth=0.1, location=B(x, 0.8, 1.8), rotation=(math.pi / 2, 0, 0)); o = bpy.context.object; o.data.materials.append(M['lamp']); bpy.ops.object.shade_smooth(); lamps.append(o)
tails = []
for s in (-1, 1): tails.append(rbox(f'tail{s}', (0.5, 0.1, 0.05), (s * 0.58, 0.86, -1.85), 'tail', 0.02))
for s in (-1, 1): rbox(f'exh{s}', (0.12, 0.1, 0.24), (s * 0.5, 0.4, -1.84), 'chrome', 0.04)
# wheels for the renders (the game draws its own)
for x, z, r, wd in WHEELS:
    bpy.ops.mesh.primitive_cylinder_add(vertices=32, radius=r, depth=wd, location=B(x, r, z), rotation=(0, math.pi / 2, 0)); t = bpy.context.object; t.data.materials.append(M['tyre']); bpy.ops.object.shade_smooth(); t['render_only'] = 1
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=r * 0.6, depth=wd + 0.02, location=B(x, r, z), rotation=(0, math.pi / 2, 0)); h = bpy.context.object; h.data.materials.append(M['hub']); h['render_only'] = 1
# ---- export the parts (game axes, triangles, smooth normals kept as split by the modifiers) ----
parts = []
for o in bpy.context.scene.objects:
    if o.type != 'MESH' or o.get('render_only'): continue
    dg = bpy.context.evaluated_depsgraph_get(); me = o.evaluated_get(dg).to_mesh(); me.calc_loop_triangles()
    mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed(); groups = {}
    for tri in me.loop_triangles:
        g = groups.setdefault(o.material_slots[tri.material_index].material.name if o.material_slots else 'trim', [[], []])
        for li in tri.loops:
            v = mw @ me.vertices[me.loops[li].vertex_index].co; n = (nm @ me.corner_normals[li].vector).normalized()
            g[0] += [round(v.x, 4), round(v.z, 4), round(-v.y, 4)]; g[1] += [round(n.x, 3), round(n.z, 3), round(-n.y, 3)]
    for m, (p, n) in groups.items(): parts.append({ 'name': o.name, 'mat': m, 'pos': p, 'nor': n })
    o.evaluated_get(dg).to_mesh_clear()
json.dump(parts, open(os.path.join(OUT, 'coupe-parts.json'), 'w'))
print('tris', sum(len(p['pos']) // 9 for p in parts), 'parts', len(parts))
# ---- renders ----
bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); g = bpy.context.object; g.data.materials.append(mat('ground', srgb(0x7E8A6A), 0, 0.9))
w = bpy.data.worlds.new('w'); bpy.context.scene.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs['Color'].default_value = (0.55, 0.65, 0.8, 1); w.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.8
bpy.ops.object.light_add(type='SUN', location=(4, 4, 8)); sun = bpy.context.object; sun.data.energy = 4; sun.rotation_euler = (0.7, 0.2, 0.9)
sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(sys.argv[-1]) if sys.argv[-1].isdigit() else 48
sc.render.resolution_x, sc.render.resolution_y = 900, 560; sc.view_settings.view_transform = 'Standard'
cam = bpy.data.cameras.new('c'); co = bpy.data.objects.new('c', cam); sc.collection.objects.link(co); sc.camera = co; cam.lens = 55
def shoot(name, loc):
    co.location = Vector(loc); d = Vector((0, 0, 0.55)) - co.location; co.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
    sc.render.filepath = os.path.join(OUT, name); bpy.ops.render.render(write_still=True)
shoot('coupe-blender-34.png', (6.5, -7.5, 3.6))
shoot('coupe-blender-top.png', (5.5, 5.2, 9.5))
print('done')
