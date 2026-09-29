# The Blender lab's shared kit: scene setup, the material palette, shape builders (lofted bodies, rounded boxes,
# cylinders), modifiers (smooth, cut, bevel, decimate), packing a model for the game and rendering previews.
# Every asset script builds in GAME axes through B(): x right, y up, z forward (front +z); Blender is Z-up, so a game
# point (x, y, z) sits at Blender (x, -z, y) (a rotation, so faces keep their winding).
import bpy, bmesh, math, os, re, json, base64
import numpy as np
from mathutils import Vector
ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
GEN = os.path.join(ROOT, 'src', 'assets', 'gen')          # packed models the game imports (committed)
OUT = os.path.join(ROOT, 'blender', 'out')                 # preview renders (not committed)
B = lambda x, y, z: (x, -z, y)
G = lambda v: (v[0], v[2], -v[1])                          # Blender -> game

def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    global M; M = {}
srgb = lambda h: tuple(((h >> s & 255) / 255) ** 2.2 for s in (16, 8, 0))
# The palette: names the game maps to its own materials (render/assets/index.js MAT). Colours here are only for the
# previews; the game paints 'paint' / 'accent' in each car's livery.
PALETTE = { 'paint': (0xFFC72C, 0.1, 0.25), 'accent': (0x1C2340, 0.1, 0.3), 'glass': (0x1A2436, 0.2, 0.05), 'chrome': (0xD3D7DD, 1.0, 0.15),
  'trim': (0x2B2F3A, 0.2, 0.6), 'lamp': (0xFFF6C8, 0, 0.2), 'tail': (0xFF4A3A, 0, 0.3), 'tyre': (0x1E1E22, 0, 0.9), 'hub': (0xC9CCD4, 0.9, 0.3),
  'bark': (0x6B4A32, 0, 0.9), 'leaf': (0x4F8A3F, 0, 0.8), 'pine': (0x3E7447, 0, 0.8), 'rock': (0xA29E92, 0, 0.9), 'wall': (0xE9D3B4, 0, 0.8),
  'roof': (0xB5523B, 0, 0.7), 'window': (0x33414F, 0.3, 0.2), 'wood': (0x8A5E3B, 0, 0.8), 'metal': (0x8D939C, 0.7, 0.4), 'white': (0xF4F4F0, 0, 0.6),
  'red': (0xE0402F, 0, 0.5), 'yellow': (0xFFC72C, 0, 0.5), 'dark': (0x1C2340, 0, 0.6), 'cactus': (0x5B8A3A, 0, 0.7), 'skin': (0xE0B08A, 0, 0.7),
  'shirt': (0x2F7DE0, 0, 0.8), 'concrete': (0xC9C6BE, 0, 0.8), 'snow': (0xF2F6FA, 0, 0.6), 'hay': (0xE2C265, 0, 0.9),
  # car extras; glow* are lights a rig switches (each car gets its own material)
  'glowred': (0xFF2020, 0, 0.3), 'glowblue': (0x2050FF, 0, 0.3), 'glowamber': (0xFFA020, 0, 0.3), 'wafer': (0xD9A45A, 0, 0.8), 'cream': (0xFFF4DE, 0, 0.7),
  'pink': (0xF08AB4, 0, 0.7), 'choc': (0x8A5230, 0, 0.7), 'hose': (0xE8C050, 0.2, 0.5), 'solar': (0x2A3A6A, 0.3, 0.2), 'firered': (0xB81E18, 0.1, 0.4),
  'engine': (0x5A5E66, 0.6, 0.4) }
M = {}
def mat(name):
    if name in M: return M[name]
    h, metal, rough = PALETTE[name]; m = bpy.data.materials.new(name); m.use_nodes = True; p = m.node_tree.nodes['Principled BSDF']
    p.inputs['Base Color'].default_value = (*srgb(h), 1); p.inputs['Metallic'].default_value = metal; p.inputs['Roughness'].default_value = rough
    if name in ('lamp', 'tail'): p.inputs['Emission Color'].default_value = (*srgb(h), 1); p.inputs['Emission Strength'].default_value = 3
    if name in ('paint', 'accent') and 'Coat Weight' in p.inputs: p.inputs['Coat Weight'].default_value = 0.6
    M[name] = m; return m
def obj(name, bm, mats):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free(); o = bpy.data.objects.new(name, me); bpy.context.collection.objects.link(o)
    for m in mats: o.data.materials.append(mat(m))
    return o
def active(o):
    for x in bpy.context.selected_objects: x.select_set(False)
    bpy.context.view_layer.objects.active = o; o.select_set(True); return o
def apply(o, kind, **kw):
    m = o.modifiers.new(kind, kind)
    for k, v in kw.items(): setattr(m, k, v)
    active(o); bpy.ops.object.modifier_apply(modifier=m.name); return o
def smooth(o, levels=2): return apply(o, 'SUBSURF', levels=levels, render_levels=levels)
def decimate(o, ratio): return apply(o, 'DECIMATE', ratio=ratio) if ratio < 1 else o
def shade(o, smooth_=True):
    active(o); (bpy.ops.object.shade_smooth if smooth_ else bpy.ops.object.shade_flat)(); return o
def cut(o, cutter):
    apply(o, 'BOOLEAN', object=cutter, operation='DIFFERENCE', solver='EXACT'); bpy.data.objects.remove(cutter); return o
def lerp_keys(keys, z):
    """Piecewise-linear value at z from [(z, v), ...] listed with z falling."""
    for (z0, v0), (z1, v1) in zip(keys, keys[1:]):
        if z0 >= z >= z1: t = (z - z0) / (z1 - z0) if z1 != z0 else 0; return v0 + (v1 - v0) * t
    return keys[0][1] if z > keys[0][0] else keys[-1][1]
def loft(name, stations, ring, mats, close_ends=True):
    """A tube through cross-sections: stations = [(z, section(t) -> (x, y))], `ring` points each, capped at both ends."""
    bm = bmesh.new(); rows = []
    for z, sec in stations: rows.append([bm.verts.new(B(*sec(k / ring), z)) for k in range(ring)])
    for a, b in zip(rows, rows[1:]):
        for k in range(ring): bm.faces.new((a[k], a[(k + 1) % ring], b[(k + 1) % ring], b[k]))
    if close_ends: bm.faces.new(rows[0][::-1]); bm.faces.new(rows[-1])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces); return obj(name, bm, mats)
def superellipse(w, cy, hh, n=6, tumble=0.1, wtop=None):
    """A rounded-box section: half width w (w at the top: wtop), centre height cy, half height hh; n: squareness."""
    def f(t):
        a = t * 2 * math.pi; c, s = math.cos(a), math.sin(a)
        x = w * math.copysign(abs(c) ** (2 / n), c); y = cy + hh * math.copysign(abs(s) ** (2 / n), s)
        if s > 0: x *= (1 - tumble * s ** 3) * (1 if wtop is None else 1 + (wtop / w - 1) * s)
        return (x, y)
    return f
def poly_section(pts):
    """A section from a closed list of (x, y) points (t picks the nearest)."""
    return lambda t: pts[round(t * len(pts)) % len(pts)]
def rbox(name, size, loc, m, bevel=0.03, rot=(0, 0, 0), segs=3):
    """A box (game size w, h, d at game loc), rotation (rx, ry, rz) in game axes, edges rounded by `bevel`."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=B(*loc)); o = bpy.context.object; o.name = name; o.scale = (size[0], size[2], size[1])
    o.rotation_euler = (rot[0], -rot[2], rot[1]); bpy.ops.object.transform_apply(scale=True, rotation=True)
    if bevel > 0: apply(o, 'BEVEL', width=bevel, segments=segs)
    shade(o); o.data.materials.append(mat(m)); return o
def cyl(name, r, depth, loc, axis, m, verts=20, r2=None, bevel=0.0):
    """A cylinder along a game axis ('x', 'y' or 'z'); r2: the far end's radius (a cone)."""
    rot = { 'x': (0, math.pi / 2, 0), 'y': (0, 0, 0), 'z': (math.pi / 2, 0, 0) }[axis]
    if r2 is None: bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=B(*loc), rotation=rot)
    else: bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=B(*loc), rotation=rot)
    o = bpy.context.object; o.name = name; bpy.ops.object.transform_apply(rotation=True)
    if bevel > 0: apply(o, 'BEVEL', width=bevel, segments=2)
    shade(o); o.data.materials.append(mat(m)); return o
def sphere(name, r, loc, m, seg=16, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=max(6, seg // 2), radius=r, location=B(*loc)); o = bpy.context.object; o.name = name
    o.scale = (scale[0], scale[2], scale[1]); bpy.ops.object.transform_apply(scale=True); shade(o); o.data.materials.append(mat(m)); return o
def tube(name, a, b, r, m, verts=10):
    """A round bar from game point a to b."""
    va, vb = Vector(B(*a)), Vector(B(*b)); d = vb - va
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=d.length, location=(va + vb) / 2, rotation=d.to_track_quat('Z', 'Y').to_euler())
    o = bpy.context.object; o.name = name; bpy.ops.object.transform_apply(rotation=True); shade(o); o.data.materials.append(mat(m)); return o
def torus(name, R, r, loc, axis, m, seg=32, rseg=10):
    """A ring of radius R (tube r) round a game axis."""
    rot = { 'x': (0, math.pi / 2, 0), 'y': (0, 0, 0), 'z': (math.pi / 2, 0, 0) }[axis]
    bpy.ops.mesh.primitive_torus_add(major_radius=R, minor_radius=r, major_segments=seg, minor_segments=rseg, location=B(*loc), rotation=rot)
    o = bpy.context.object; o.name = name; bpy.ops.object.transform_apply(rotation=True); shade(o); o.data.materials.append(mat(m)); return o
def warp(o, f):
    """Move every vertex: f(x, y, z) -> (x, y, z), in game coords (world space; objects here keep identity transforms)."""
    active(o); bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for v in o.data.vertices: v.co = Vector(B(*f(*G(v.co))))
    o.data.update(); return o
def move(o, dx=0, dy=0, dz=0): return warp(o, lambda x, y, z: (x + dx, y + dy, z + dz))
def join(name, objs):
    for o in objs: o.select_set(False)
    active(objs[0])
    for o in objs[1:]: o.select_set(True)
    bpy.ops.object.join(); objs[0].name = name; return objs[0]
def by_faces(o, rule):
    """Re-assign material slots face by face: rule(game centre, game normal) -> material name or None to keep."""
    bm = bmesh.new(); bm.from_mesh(o.data); names = [s.material.name for s in o.material_slots]
    for f in bm.faces:
        m = rule(G(f.calc_center_median()), G(f.normal))
        if m is None: continue
        if m not in names: o.data.materials.append(mat(m)); names.append(m)
        f.material_index = names.index(m)
    bm.to_mesh(o.data); bm.free()
def vcol(o, f):
    """Vertex colours (linear floats, per corner): f(game position, game normal) -> (r, g, b). The game multiplies them by
    its own colour (the instance's tint for scenery), so shading and fixed details (windows, hair) live here."""
    me = o.data
    for a in list(me.color_attributes): me.color_attributes.remove(a)
    at = me.color_attributes.new('Col', 'FLOAT_COLOR', 'CORNER'); me.color_attributes.active_color = at
    for poly in me.polygons:
        n = G(poly.normal)
        for li in poly.loop_indices:
            c = f(G(me.vertices[me.loops[li].vertex_index].co), n); at.data[li].color = (c[0], c[1], c[2], 1)
    return o
def smoothstep(a, b, x): t = min(1, max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t)
def remesh(o, voxel):
    """Fuse overlapping blobs into one skin (voxel remesh)."""
    return apply(o, 'REMESH', mode='VOXEL', voxel_size=voxel)
def autosmooth(o, deg=35):
    """Smooth across gentle edges, sharp across creases (the packed normals are the evaluated ones)."""
    active(o); bpy.ops.object.shade_auto_smooth(angle=math.radians(deg)); return o
def noisy(o, amp, scale=1.0, seed=0):
    """Push every vertex along its normal by smooth noise: lumps on a rock, a canopy, a bush."""
    from mathutils import noise
    o.data.update()
    for v in o.data.vertices: v.co += v.normal * amp * noise.noise(v.co * scale + Vector((seed * 7.1, seed * 3.3, seed * 1.7)))
    o.data.update(); return o

# ---- packing for the game ----
def _tris(o):
    dg = bpy.context.evaluated_depsgraph_get(); ob = o.evaluated_get(dg); me = ob.to_mesh(); me.calc_loop_triangles()
    mw = o.matrix_world; nm = mw.to_3x3().inverted().transposed(); groups = {}
    col = me.color_attributes.active_color if me.color_attributes else None
    for tri in me.loop_triangles:
        name = o.material_slots[tri.material_index].material.name if o.material_slots else 'trim'
        g = groups.setdefault(name, [[], [], []])
        for li in tri.loops:
            v = mw @ me.vertices[me.loops[li].vertex_index].co; n = (nm @ me.corner_normals[li].vector).normalized()
            if n.length < 0.5: n = (nm @ tri.normal).normalized()                   # a degenerate corner: the face's normal
            if n.length < 0.5: n = Vector((0, 0, 1))
            g[0].append(G(v)); g[1].append(G(n))
            if col: c = col.data[li].color if col.domain == 'CORNER' else col.data[me.loops[li].vertex_index].color; g[2].append(tuple(c[:3]))
    ob.to_mesh_clear(); return groups
def _pack(pos, nor, col):
    P = np.round(np.array(pos) * 8000).astype(np.int32); Nn = np.round(np.array(nor) * 127).astype(np.int32)
    Cc = np.round(np.array(col) * 255).astype(np.int32) if col else None
    key = np.concatenate([P, Nn] + ([Cc] if Cc is not None else []), axis=1)
    uniq, inv = np.unique(key, axis=0, return_inverse=True)
    if len(uniq) > 65535: raise ValueError('too many vertices in one part')
    if np.abs(P).max() > 32767: raise ValueError('part larger than 4 m from its origin')
    e = lambda a, t: base64.b64encode(a.astype(t).tobytes()).decode()
    out = { 'pos': e(uniq[:, 0:3], np.int16), 'nor': e(uniq[:, 3:6], np.int8), 'idx': e(inv.reshape(-1), np.uint16) }
    if Cc is not None: out['col'] = e(uniq[:, 6:9], np.uint8)
    return out, len(inv) // 3, len(uniq)
def pack(asset_id, family, levels, meta=None, origin=False):
    """Write src/assets/gen/<asset_id>.js: levels = { 'hi': [objects], 'lo': [objects] } (lo optional). Each object's
    triangles are grouped by material into parts {name, mat, pos, nor, idx[, col]}. Returns stats for the manifest.
    origin: every part's pivot is the model's origin (instanced scenery, placed by the game's own transforms)."""
    os.makedirs(GEN, exist_ok=True); data = { 'id': asset_id, 'family': family, 'meta': meta or {} }; stats = { 'family': family }
    lo_all, hi_all, piv = [], [], {}
    # every part has a pivot (its `at`, game coords): the object's 'pivot' property if the design set one (a hinge, an
    # axle), else the middle of its near-level bounds. Its vertices are stored relative to it, so the game can swing,
    # spin or knock the part off about the right point.
    for lvl in sorted(levels, key=lambda k: k != 'hi'):
        parts, tris = [], 0
        for o in levels[lvl]:
            groups = _tris(o); name = o.get('part', o.name)   # a far copy carries its near part's name
            if re.search(r'\.\d{3}$', name): raise ValueError(f'{asset_id}: two parts named {name[:-4]} (Blender renamed one)')
            if name not in piv:
                if origin: piv[name] = [0.0, 0.0, 0.0]
                elif 'pivot' in o: piv[name] = [round(float(v), 4) for v in o['pivot']]
                else: a = np.array([v for g in groups.values() for v in g[0]]); piv[name] = [round(float(v), 4) for v in (a.min(0) + a.max(0)) / 2]
            at = np.array(piv[name])
            for m, (p, n, c) in groups.items():
                pk, t, _ = _pack(list(np.array(p) - at), n, c); parts.append({ 'name': name, 'mat': m, 'at': piv[name], **pk }); tris += t
                (hi_all if lvl == 'hi' else lo_all).extend(p)
        data[lvl] = parts; stats[lvl + 'Tris'] = tris
    pts = np.array(hi_all); stats['min'] = [round(v, 3) for v in pts.min(0)]; stats['max'] = [round(v, 3) for v in pts.max(0)]
    stats['parts'] = sorted({ p['name'] + ':' + p['mat'] for p in data['hi'] })
    txt = json.dumps(data, separators=(',', ':'))
    open(os.path.join(GEN, asset_id + '.js'), 'w').write(f'// Generated by blender/build.py ({family}). Do not edit: change the Blender script and rebuild.\nexport default {txt};\n')
    stats['kb'] = round(len(txt) / 1024); return stats

# ---- previews ----
def studio(ground=0x7E8A6A):
    bpy.ops.mesh.primitive_plane_add(size=60, location=(0, 0, 0)); g = bpy.context.object; g.name = '_ground'
    gm = bpy.data.materials.new('_ground'); gm.use_nodes = True; gm.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value = (*srgb(ground), 1); g.data.materials.append(gm)
    w = bpy.data.worlds.new('w'); bpy.context.scene.world = w; w.use_nodes = True; bg = w.node_tree.nodes['Background']; bg.inputs['Color'].default_value = (0.55, 0.65, 0.8, 1); bg.inputs['Strength'].default_value = 0.8
    bpy.ops.object.light_add(type='SUN', location=(4, 4, 8)); s = bpy.context.object; s.name = '_sun'; s.data.energy = 4; s.rotation_euler = (0.7, 0.2, 0.9)
    sc = bpy.context.scene; sc.render.engine = 'CYCLES'; sc.cycles.device = 'CPU'; sc.cycles.samples = int(os.environ.get('SAMPLES', '24'))
    sc.render.resolution_x, sc.render.resolution_y = 720, 450; sc.view_settings.view_transform = 'Standard'
    cam = bpy.data.cameras.new('_cam'); co = bpy.data.objects.new('_cam', cam); sc.collection.objects.link(co); sc.camera = co; cam.lens = 55
def render(name, dist=9.0, height=0.6, views=(('34', (0.65, -0.75, 0.36)), ('top', (0.55, 0.52, 0.95)))):
    if os.environ.get('NORENDER'): return
    os.makedirs(OUT, exist_ok=True); sc = bpy.context.scene; co = sc.camera
    for tag, d in views:
        v = Vector(d).normalized() * dist; co.location = v + Vector((0, 0, height)); co.rotation_euler = (Vector((0, 0, height)) - co.location).to_track_quat('-Z', 'Y').to_euler()
        sc.render.filepath = os.path.join(OUT, f'{name}-{tag}.png'); bpy.ops.render.render(write_still=True)
def hide(objs):
    for o in objs: o.hide_render = True
def show(objs):
    for o in objs: o.hide_render = False
