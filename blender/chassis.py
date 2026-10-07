# Car families (G6): one generator, many cars. The numbers come from src/data/families.js (tools/assets.sh writes them
# to blender/out/families.json), the same ones the game's Classic builder (src/render/families.js) reads, so both
# providers draw the same car: a lofted body from the chassis's length, width, deck and nose/tail drop, the glasshouse
# (or an open cockpit, or a cab and load bed), arches round the wheels, bumpers, lights, a wing, and the extras a car
# names. Each family car packs to car-<id> like the hand-built ones (blender/cars.py finish()).
import json, os
from kit import *
from cars import body, arches, sill, glasshouse, rects, grille, mirrors, preview_wheels, finish

SRC = os.path.join(OUT, 'families.json')
DATA = json.load(open(SRC)) if os.path.exists(SRC) else { 'cars': {} }
DESIGNS = {}

def build(cid, P):
    L, Wd, base, deck, cab = P['L'], P['W'], P['base'], P['deck'], P['cab']; hw = Wd / 2
    x, zf, zr, r, wd = P['wheels']; W4 = [(x, zf, r, wd), (-x, zf, r, wd), (x, zr, r, wd), (-x, zr, r, wd)]
    zs = [L - k * 0.2 for k in range(int(2 * L / 0.2) + 1)] + [-L]
    b = body({ 'W': [(L, hw * 0.9), (L - 0.4, hw), (-L + 0.4, hw), (-L, hw * 0.93)],
               'TOP': [(L, deck - P['nose'] - 0.12), (L - 0.5, deck - P['nose'] * 0.3), (0.0, deck), (-L + 0.4, deck - P['tail'] * 0.4), (-L, deck - P['tail'] - 0.08)],
               'BOT': [(L, base + 0.14), (L - 0.4, base), (-L + 0.4, base), (-L, base + 0.14)] }, zs, n=7, tumble=0.08)
    arches(b, W4); sill(b, base + 0.06); decimate(b, 0.3 if P.get('bed') else 0.35); shade(b)
    parts = [b]; dent = ['body']; struts = []; mid = (cab['zf'] + cab['zr']) / 2; rake = cab['rake']; roofZ = mid - rake * 0.32
    stripe = [rbox(f'stripe{k}', (0.02, 0.07, 2 * L * 0.78), (s_ * (hw + 0.006), deck - 0.2, 0), 'accent', 0) for k, s_ in enumerate((-1, 1))]
    parts += stripe
    if P.get('open'):
        cabin = rbox('cabin', (Wd * 0.8, 0.3, 0.05), (0, deck + 0.17, cab['zf']), 'glass', 0.01, rot=(-0.45, 0, 0))
        parts += [cabin] + [rbox(f'seat{k}', (0.5, 0.3, 0.5), (s_ * 0.36, deck + 0.05, mid - 0.1), 'trim', 0.06) for k, s_ in enumerate((-1, 1))]
        number = [0.5, deck + 0.02, -L + 0.55]
    else:
        zc = [cab['zf'] - k * (cab['zf'] - cab['zr']) / 10 for k in range(11)]
        roof = [(cab['zf'], deck + 0.02), (cab['zf'] - rake, cab['roof']), (cab['zr'] + rake * 0.35, cab['roof']), (cab['zr'], deck + 0.02)]
        cabin = glasshouse(zc, deck, roof, [(cab['zf'], hw * 0.9), (cab['zr'], hw * 0.9)], [(cab['zf'], hw * 0.9 * cab['taper']), (cab['zr'], hw * 0.9 * cab['taper'])], roof_z=(cab['zf'] - rake - 0.04, cab['zr'] + rake * 0.35 + 0.04))
        parts += [cabin] + mirrors(hw - 0.02, deck + 0.08, cab['zf'] - 0.15); dent.append('cabin')
        number = [min(0.62, (cab['zf'] - cab['zr']) * 0.5), cab['roof'] + 0.03, roofZ]
    if P.get('bed'):
        bl = cab['zr'] - (-L + 0.12); bz = (cab['zr'] + (-L + 0.12)) / 2
        parts += [rbox('bed', (Wd - 0.24, 0.04, bl), (0, deck + 0.02, bz), 'trim', 0.01)] + [rbox(f'bedside{k}', (0.1, 0.22, bl), (s_ * (hw - 0.05), deck + 0.11, bz), 'paint', 0.02) for k, s_ in enumerate((-1, 1))]
        parts.append(rbox('tailgate', (Wd, 0.22, 0.1), (0, deck + 0.11, -L + 0.07), 'paint', 0.02))
    bc = 'chrome' if P['bumper'] == 'chrome' else 'trim'
    if P['bumper'] == 'bar': parts.append(join('bumper', [rbox('bumper', (Wd * 0.86, 0.36, 0.1), (0, base + 0.36, L + 0.12), 'trim', 0.03)] + [rbox(f'bb{k}', (0.08, 0.08, 0.2), (s_ * 0.5, base + 0.3, L + 0.02), 'trim', 0.01) for k, s_ in enumerate((-1, 1))]))
    else: parts.append(rbox('bumper', (Wd + 0.04, 0.16, 0.18), (0, base + 0.22, L + 0.02), bc, 0.05))
    parts.append(rbox('rbumper', (Wd + 0.02, 0.15, 0.16), (0, base + 0.22, -L - 0.02), bc, 0.05))
    wing = None
    if P['wing'] == 1: wing = rbox('wing', (Wd * 0.84, 0.06, 0.3), (0, deck - P['tail'] + 0.06, -L + 0.2), 'accent', 0.02, rot=(0.3, 0, 0))
    if P['wing'] == 2:
        wing = rbox('wing', (Wd + 0.06, 0.07, 0.5), (0, deck + 0.52, -L + 0.28), 'accent', 0.025)
        struts = [rbox(f'strut{k}', (0.07, 0.48, 0.14), (s_ * 0.6, deck + 0.26, -L + 0.28), 'trim', 0.02) for k, s_ in enumerate((-1, 1))]; parts += struts
    if wing: parts.append(wing)
    parts += rects((-hw * 0.64, hw * 0.64), deck - P['nose'] - 0.14, L + 0.01, 0.36, 0.13) + rects((-hw * 0.66, hw * 0.66), deck - P['tail'] - 0.12, -L - 0.01, 0.4, 0.13, name='tail', m='tail')
    parts.append(grille(Wd * 0.36, 0.14, deck - P['nose'] - 0.18, L + 0.01))
    X = P.get('extras', [])
    if 'sign' in X: parts += [rbox('sign', (0.62, 0.18, 0.24), (0, cab['roof'] + 0.17, roofZ), 'white', 0.03), rbox('signbase', (0.66, 0.04, 0.28), (0, cab['roof'] + 0.08, roofZ), 'trim', 0.01)]
    if 'box' in X: parts.append(rbox('roofbox', (Wd * 0.6, 0.22, min(1.2, cab['zf'] - cab['zr'] - 0.5)), (0, cab['roof'] + 0.2, roofZ - 0.1), 'trim', 0.08))
    if 'lamps' in X:
        z = cab['zf'] - 0.2 if P.get('open') else cab['zf'] - rake - 0.05; y = (deck + 0.4 if P.get('open') else cab['roof']) + 0.12
        parts += [rbox('lampbar', (1.1, 0.1, 0.1), (0, y - 0.04, z), 'trim', 0.02)] + [cyl(f'pod{k}', 0.09, 0.08, (px, y + 0.04, z + 0.06), 'z', 'lamp', 16) for k, px in enumerate((-0.39, -0.13, 0.13, 0.39))]
    if 'tyres' in X: parts += [join(f'spare{k}', [cyl(f'spare{k}', 0.32, 0.24, (0.25 * (1 if z > -1 else -1), deck + 0.2, z), 'x', 'tyre', 16), cyl(f'spare{k}h', 0.17, 0.26, (0.25 * (1 if z > -1 else -1), deck + 0.2, z), 'x', 'hub', 10)]) for k, z in enumerate((-0.95, -1.45))]   # light: the bed is busy
    if 'cage' in X:
        for k, s_ in enumerate((-1, 1)):
            parts += [rbox(f'cage{k}', (0.06, 0.06, cab['zf'] - cab['zr'] - rake), (s_ * Wd * 0.3, cab['roof'] + 0.04, roofZ), 'trim', 0.02), rbox(f'cagepost{k}', (0.04, cab['roof'] - deck - 0.1, 0.04), (s_ * Wd * 0.43, (cab['roof'] + deck) / 2, mid), 'trim', 0.01)]
    if 'plates' in X: parts += [rbox(f'plate{k}', (0.04, 0.32, 1.3), (s_ * (hw + 0.03), base + 0.48, -0.05), 'metal', 0.01) for k, s_ in enumerate((-1, 1))]
    if 'flaps' in X: parts += [rbox(f'flap{k}', (0.36, 0.28, 0.04), (s_ * x, 0.3, zr - r - 0.12), 'tyre', 0.01) for k, s_ in enumerate((-1, 1))]
    if 'pipes' in X: parts += [cyl(f'pipe{k}', 0.06, 1.1, (s_ * (hw + 0.04), base + 0.2, -0.2), 'z', 'chrome', 16) for k, s_ in enumerate((-1, 1))]
    if 'helmet' in X: parts.append(sphere('helmet', 0.19, (-0.36, deck + 0.27, mid - 0.15), 'accent', 20))
    preview_wheels(W4)
    roles = { 'dent': dent, 'bumper': 'bumper', 'cabin': 'cabin', 'number': number }
    if wing: roles['wing'] = 'wing'
    if struts: roles['struts'] = [s.name for s in struts]
    if P.get('knobbly'): roles.update({ 'knobbly': True, 'soft': 1.8 })
    return finish(cid, parts, W4, roles)

for _cid, _P in DATA['cars'].items():
    DESIGNS[_cid] = (lambda c, p: (lambda: build(c, p)))(_cid, _P)
