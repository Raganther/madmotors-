# Classic cars: muscle, rally and Le Mans bodies built to the hatch's and the coupe's standard with the same car kit
# (cars.py: body lofts, glasshouses, stripes, lamps, finish). Each is its own design, made to read from the race camera
# by its silhouette and one or two signature details:
#   fastback   a 60s pony fastback: long bonnet, a roof that runs down to the tail, a big grille mouth with round
#              lamps in its corners, side scoops, three-bar tail lamps, stripes nose to tail
#   nightbrute a long late-60s muscle coupe: full-width black grille (the lamps hide in it), a bulge down the bonnet,
#              buttress sails beside the rear glass, a full-width tail lamp and a band round the tail
#   wasp       a 70s pony coupe: quad lamps in a recessed grille, a shaker scoop through the bonnet, a ducktail,
#              a hockey-stick stripe down the flanks
#   clubman    a 70s rally saloon: a boxy three-box body, black arch flares, two big spotlights, a roof vent, mud flaps
#   quadra     an 80s rally coupe: angular, box-flared arches, a deep air dam, a lamp pod, a tall wing on the hatch
#   sarthe     a 60s Le Mans racer: very low, a round nose with covered lamps, humps over the wheels, a louvred
#              engine deck, a stripe down the middle
# Wheels match each car's Classic builder (render/carmodels.js); everything stays inside the hitbox.
import math
from kit import *
from cars import body, arches, sill, glasshouse, stripes, lamps, tails, rects, grille, mirrors, preview_wheels, finish, four, MIR

DESIGNS = {}
def design(fn): DESIGNS[fn.__name__] = fn; return fn
def exhausts(xs, y, z, r=0.06, name='exh'):
    return [cyl(f'{name}{k}', r, 0.24, (x, y, z), 'z', 'chrome', 14) for k, x in enumerate(xs)]

@design
def fastback():
    """Stallion: the 60s pony fastback."""
    W = four(0.95, 1.2, -1.15, 0.41, 0.34)
    b = body({ 'W': [(1.86, 0.84), (1.75, 0.95), (1.5, 1.0), (1.2, 1.01), (0.6, 0.97), (0.0, 0.96), (-0.6, 0.99), (-1.15, 1.04), (-1.6, 1.0), (-1.86, 0.96)],
               'TOP': [(1.86, 0.8), (1.76, 0.9), (1.4, 0.94), (0.4, 0.97), (-1.0, 0.99), (-1.75, 1.02), (-1.86, 0.98)],
               'BOT': [(1.86, 0.44), (1.5, 0.34), (0.0, 0.3), (-1.5, 0.34), (-1.86, 0.46)] },
             [1.86, 1.82, 1.74, 1.6, 1.4, 1.15, 0.85, 0.55, 0.25, -0.05, -0.35, -0.65, -0.9, -1.15, -1.35, -1.55, -1.72, -1.82, -1.86], n=6, tumble=0.12)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.25, 0.25), ((1.8, 0.4), (-1.5, -1.84)), width=0.18)
    roof = [(0.36, 1.0), (0.12, 1.3), (-0.15, 1.42), (-0.55, 1.42), (-1.0, 1.24), (-1.45, 1.06), (-1.62, 1.0)]
    cab = glasshouse([0.38, 0.34, 0.2, 0.05, -0.15, -0.35, -0.55, -0.75, -0.95, -1.15, -1.35, -1.5, -1.62], 0.97, roof,
                     [(0.36, 0.84), (-0.6, 0.88), (-1.62, 0.86)], [(0.36, 0.76), (-0.3, 0.7), (-0.8, 0.72), (-1.62, 0.8)], roof_z=(-0.1, -1.1))
    parts = [b, s, cab, rbox('bumper', (1.86, 0.12, 0.14), (0, 0.54, 1.87), 'chrome', 0.05), rbox('rbumper', (1.9, 0.12, 0.14), (0, 0.54, -1.87), 'chrome', 0.05),
             rbox('wing', (1.66, 0.05, 0.22), (0, 1.04, -1.74), 'paint', 0.02, rot=(0.3, 0, 0)),
             rbox('mouth', (1.3, 0.24, 0.06), (0, 0.74, 1.84), 'trim', 0.05), rbox('emblem', (0.18, 0.1, 0.04), (0, 0.75, 1.88), 'chrome', 0.02)]
    for k, s_ in enumerate(MIR):   # side scoops on the rear quarters, three-bar tail lamps in a black panel
        parts.append(rbox(f'scoop{k}', (0.06, 0.16, 0.32), (s_ * 1.0, 0.76, -0.62), 'trim', 0.02))
    parts.append(rbox('tailpanel', (1.5, 0.2, 0.04), (0, 0.84, -1.86), 'trim', 0.02))
    parts += [rbox(f'tail{k}', (0.08, 0.15, 0.05), (s_ * (0.36 + 0.13 * j), 0.84, -1.88), 'tail', 0.01) for k, (s_, j) in enumerate([(s_, j) for s_ in MIR for j in range(3)])]
    parts += lamps((-0.56, 0.56), 0.76, 1.86, 0.11) + lamps((-0.26, 0.26), 0.72, 1.87, 0.06, 'fog')
    parts += exhausts((-0.45, 0.45), 0.4, -1.86)
    parts += mirrors(0.9, 1.04, 0.22)
    preview_wheels(W)
    return finish('fastback', parts, W, lo_ratio=0.22, roles={ 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.6, 1.44, -0.4] })

@design
def nightbrute():
    """Nightbrute: the long late-60s muscle coupe."""
    W = four(0.97, 1.3, -1.2, 0.42, 0.34, 0.44, 0.42, 1.0)
    b = body({ 'W': [(1.95, 0.94), (1.85, 0.99), (1.5, 1.01), (0.9, 0.99), (0.0, 0.96), (-0.8, 1.0), (-1.2, 1.06), (-1.7, 1.03), (-1.95, 1.0)],
               'TOP': [(1.95, 0.86), (1.86, 0.94), (1.4, 0.98), (0.4, 1.0), (-1.2, 1.02), (-1.85, 1.02), (-1.95, 0.96)],
               'BOT': [(1.95, 0.46), (1.6, 0.34), (0.0, 0.3), (-1.6, 0.34), (-1.95, 0.48)] },
             [1.95, 1.9, 1.8, 1.6, 1.35, 1.05, 0.7, 0.35, 0.0, -0.35, -0.7, -1.0, -1.25, -1.5, -1.7, -1.85, -1.92, -1.95], n=7, tumble=0.1)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    band = stripes(b, [x / 10 for x in range(-9, 10, 2)], ((-1.55, -1.75),), width=0.21)   # the band round the tail
    roof = [(0.3, 1.02), (0.05, 1.32), (-0.25, 1.43), (-0.75, 1.42), (-1.05, 1.22), (-1.2, 1.06)]
    cab = glasshouse([0.32, 0.28, 0.15, 0.0, -0.2, -0.4, -0.6, -0.8, -0.95, -1.1, -1.2], 1.0, roof,
                     [(0.3, 0.84), (-0.5, 0.88), (-1.2, 0.8)], [(0.3, 0.76), (-0.25, 0.7), (-0.8, 0.66), (-1.2, 0.62)], roof_z=(-0.15, -0.85))
    parts = [b, band, cab, rbox('bulge', (0.6, 0.08, 1.3), (0, 1.0, 0.95), 'paint', 0.04),
             rbox('bumper', (1.94, 0.12, 0.14), (0, 0.56, 1.96), 'chrome', 0.05), rbox('rbumper', (1.96, 0.12, 0.14), (0, 0.56, -1.96), 'chrome', 0.05),
             rbox('wing', (1.6, 0.05, 0.18), (0, 1.04, -1.84), 'paint', 0.02, rot=(0.25, 0, 0)), grille(1.76, 0.26, 0.76, 1.93)]
    for k, s_ in enumerate(MIR):   # the buttress sails either side of the tunnelled rear glass
        parts.append(rbox(f'sail{k}', (0.12, 0.08, 0.86), (s_ * 0.66, 1.2, -1.1), 'paint', 0.03, rot=(-0.47, 0, 0)))
    parts += rects((-0.62, 0.62), 0.8, 1.97, 0.42, 0.05)                                   # the lamps, hidden in the grille: a slit each side
    parts += rects((-0.45, 0.45), 0.86, -1.97, 0.82, 0.12, 'tail', 'tail')                 # one tail lamp right across
    parts += exhausts((-0.6, -0.48, 0.48, 0.6), 0.4, -1.95, 0.05)
    parts += [rbox(f'pin{k}', (0.05, 0.03, 0.05), (s_ * 0.55, 1.0, 1.7), 'chrome', 0.01) for k, s_ in enumerate(MIR)]   # bonnet pins
    parts += mirrors(0.92, 1.06, 0.18)
    preview_wheels(W)
    return finish('nightbrute', parts, W, { 'dent': ['body', 'bulge', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.62, 1.45, -0.45] })

@design
def wasp():
    """Wasp: the 70s pony coupe with a shaker scoop."""
    W = four(0.96, 1.2, -1.14, 0.41, 0.34, 0.43, 0.4, 0.99)
    b = body({ 'W': [(1.84, 0.95), (1.75, 1.0), (1.4, 1.02), (0.6, 1.0), (0.0, 0.99), (-0.7, 1.01), (-1.14, 1.05), (-1.6, 1.02), (-1.84, 0.98)],
               'TOP': [(1.84, 0.88), (1.76, 0.95), (1.3, 0.98), (0.35, 1.0), (-1.0, 1.0), (-1.7, 1.04), (-1.84, 1.0)],
               'BOT': [(1.84, 0.46), (1.5, 0.34), (0.0, 0.3), (-1.5, 0.34), (-1.84, 0.48)] },
             [1.84, 1.8, 1.72, 1.55, 1.3, 1.0, 0.7, 0.4, 0.1, -0.2, -0.5, -0.8, -1.05, -1.3, -1.5, -1.68, -1.8, -1.84], n=8, tumble=0.08)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, [x / 10 for x in range(-7, 8, 2)], ((1.82, 1.6),), width=0.21)    # a band across the nose
    roof = [(0.3, 1.0), (0.08, 1.3), (-0.2, 1.42), (-0.7, 1.42), (-1.05, 1.2), (-1.3, 1.04)]
    cab = glasshouse([0.32, 0.28, 0.15, 0.0, -0.2, -0.4, -0.6, -0.8, -1.0, -1.15, -1.3], 0.99, roof,
                     [(0.3, 0.84), (-0.5, 0.88), (-1.3, 0.84)], [(0.3, 0.76), (-0.25, 0.7), (-0.8, 0.7), (-1.3, 0.76)], roof_z=(-0.1, -0.95))
    shaker = join('shaker', [rbox('shaker', (0.5, 0.16, 0.6), (0, 1.08, 0.85), 'trim', 0.06), rbox('shakermouth', (0.42, 0.1, 0.04), (0, 1.1, 1.16), 'dark', 0.02)])
    parts = [b, s, cab, shaker, rbox('mask', (1.7, 0.3, 0.06), (0, 0.74, 1.83), 'trim', 0.06),
             rbox('bumper', (1.94, 0.12, 0.14), (0, 0.52, 1.86), 'chrome', 0.05), rbox('rbumper', (1.94, 0.12, 0.14), (0, 0.54, -1.86), 'chrome', 0.05),
             rbox('wing', (1.72, 0.07, 0.3), (0, 1.08, -1.72), 'paint', 0.025, rot=(-0.35, 0, 0))]   # the ducktail
    for k, s_ in enumerate(MIR):   # the hockey-stick stripe down each flank
        parts.append(rbox(f'flank{k}', (0.02, 0.07, 2.4), (s_ * 1.02, 0.86, -0.15), 'accent', 0.01))
        parts.append(rbox(f'flankup{k}', (0.02, 0.32, 0.07), (s_ * 1.03, 0.76, -1.36), 'accent', 0.01))
    parts += lamps((-0.72, -0.48, 0.48, 0.72), 0.76, 1.87, 0.1)
    parts += tails((-0.55, 0.55), 0.84, -1.86, 0.62, 0.14)
    parts += exhausts((-0.5, 0.5), 0.4, -1.86, 0.065)
    parts += mirrors(0.92, 1.05, 0.2)
    preview_wheels(W)
    return finish('wasp', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'struts': ['shaker'], 'cabin': 'cabin', 'number': [0.62, 1.44, -0.45] })

@design
def clubman():
    """Clubman: the 70s rally saloon."""
    W = four(0.92, 1.18, -1.12, 0.41, 0.3)
    b = body({ 'W': [(1.78, 0.86), (1.68, 0.92), (1.3, 0.93), (-1.3, 0.93), (-1.7, 0.91), (-1.78, 0.88)],
               'TOP': [(1.78, 0.9), (1.68, 0.98), (1.2, 1.0), (0.5, 1.02), (-1.2, 1.02), (-1.7, 1.0), (-1.78, 0.94)],
               'BOT': [(1.78, 0.44), (1.5, 0.32), (-1.5, 0.32), (-1.78, 0.46)] },
             [1.78, 1.74, 1.66, 1.5, 1.3, 1.05, 0.75, 0.45, 0.15, -0.15, -0.45, -0.75, -1.05, -1.3, -1.5, -1.66, -1.74, -1.78], n=10, tumble=0.04)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (0.0,), ((1.7, 0.5), (-1.1, -1.72)), width=0.34)
    roof = [(0.5, 1.02), (0.32, 1.56), (0.15, 1.62), (-0.75, 1.62), (-0.95, 1.5), (-1.12, 1.03)]
    cab = glasshouse([0.5, 0.45, 0.32, 0.15, -0.1, -0.35, -0.6, -0.8, -0.95, -1.05, -1.12], 1.01, roof,
                     [(0.5, 0.86), (-1.12, 0.86)], [(0.5, 0.76), (-1.12, 0.78)], roof_z=(0.25, -0.85))
    flares = join('flares', [rbox(f'flare{k}', (0.12, 0.16, 0.95), (s_ * 0.96, 0.74, z), 'trim', 0.05) for k, (s_, z) in enumerate([(s_, z) for s_ in MIR for z in (1.18, -1.12)])])
    parts = [b, s, cab, flares, rbox('vent', (0.44, 0.08, 0.36), (0, 1.66, 0.0), 'trim', 0.03),
             rbox('bumper', (1.86, 0.14, 0.16), (0, 0.54, 1.8), 'chrome', 0.05), rbox('rbumper', (1.86, 0.14, 0.16), (0, 0.54, -1.8), 'chrome', 0.05),
             rbox('wing', (1.5, 0.05, 0.2), (0, 1.06, -1.68), 'accent', 0.02, rot=(0.2, 0, 0)), grille(1.2, 0.2, 0.8, 1.78),
             join('flaps', [rbox(f'flap{k}', (0.34, 0.3, 0.04), (s_ * 0.9, 0.34, -1.58), 'tyre', 0.01) for k, s_ in enumerate(MIR)])]
    for k, s_ in enumerate(MIR):   # a band down each side
        parts.append(rbox(f'band{k}', (0.02, 0.12, 3.0), (s_ * 0.935, 0.72, 0), 'accent', 0.01))
    parts += lamps((-0.72, -0.5, 0.5, 0.72), 0.82, 1.79, 0.09)
    parts += lamps((-0.4, 0.4), 0.66, 1.92, 0.15, 'spot') + [join('spotcans', [cyl(f'can{k}', 0.17, 0.14, (x, 0.66, 1.84), 'z', 'chrome', 20) for k, x in enumerate((-0.4, 0.4))])]
    parts += rects((-0.62, 0.62), 0.86, -1.79, 0.4, 0.14, 'tail', 'tail')
    parts += exhausts((0.55,), 0.38, -1.78)
    parts += mirrors(0.9, 1.1, 0.4)
    preview_wheels(W)
    return finish('clubman', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'struts': ['spotcans'], 'cabin': 'cabin', 'number': [0.68, 1.65, -0.35] })

@design
def quadra():
    """Quadra: the 80s rally coupe with box flares and a tall wing."""
    W = four(1.0, 1.2, -1.16, 0.42, 0.36)
    b = body({ 'W': [(1.82, 0.9), (1.7, 0.96), (1.3, 0.97), (-1.3, 0.97), (-1.7, 0.95), (-1.82, 0.92)],
               'TOP': [(1.82, 0.84), (1.7, 0.94), (1.2, 0.98), (0.4, 1.0), (-1.4, 1.04), (-1.82, 1.0)],
               'BOT': [(1.82, 0.42), (1.5, 0.32), (-1.5, 0.32), (-1.82, 0.46)] },
             [1.82, 1.78, 1.7, 1.55, 1.35, 1.1, 0.8, 0.5, 0.2, -0.1, -0.4, -0.7, -1.0, -1.25, -1.45, -1.62, -1.75, -1.82], n=12, tumble=0.04)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.5, 0.5), ((1.7, 0.4),), width=0.12)
    roof = [(0.38, 1.0), (0.18, 1.46), (0.0, 1.52), (-0.8, 1.5), (-1.3, 1.1), (-1.45, 1.04)]
    cab = glasshouse([0.4, 0.35, 0.2, 0.0, -0.25, -0.5, -0.75, -0.95, -1.15, -1.3, -1.45], 0.99, roof,
                     [(0.38, 0.86), (-1.45, 0.88)], [(0.38, 0.76), (-0.8, 0.74), (-1.45, 0.8)], roof_z=(0.1, -0.95))
    # the box flares: squared-off blisters over each wheel, in the paint
    flares = join('flares', [rbox(f'flare{k}', (0.16, 0.36, 1.05), (s_ * 1.02, 0.72, z), 'paint', 0.04) for k, (s_, z) in enumerate([(s_, z) for s_ in MIR for z in (1.2, -1.16)])])
    wing = join('wing', [rbox('wing', (1.84, 0.07, 0.42), (0, 1.62, -1.62), 'accent', 0.02, rot=(0.12, 0, 0))] + [rbox(f'wst{k}', (0.06, 0.5, 0.14), (s_ * 0.6, 1.3, -1.56), 'trim', 0.01) for k, s_ in enumerate(MIR)])
    parts = [b, s, cab, flares, wing, rbox('vent', (0.5, 0.07, 0.34), (0, 1.55, -0.1), 'trim', 0.03),
             rbox('bumper', (2.02, 0.3, 0.28), (0, 0.5, 1.78), 'accent', 0.05), rbox('rbumper', (1.96, 0.18, 0.16), (0, 0.52, -1.82), 'trim', 0.04),
             grille(1.0, 0.16, 0.82, 1.8), rbox('pod', (1.2, 0.18, 0.12), (0, 1.06, 1.6), 'trim', 0.03)]
    parts += rects((-0.42, -0.14, 0.14, 0.42), 1.06, 1.67, 0.24, 0.12, 'spot')                 # the lamp pod's four lamps
    parts += rects((-0.66, 0.66), 0.84, 1.8, 0.34, 0.14)
    parts += rects((-0.6, 0.6), 0.88, -1.83, 0.5, 0.16, 'tail', 'tail')
    parts += exhausts((-0.7,), 0.38, -1.82, 0.07)
    parts += mirrors(0.95, 1.08, 0.3)
    preview_wheels(W)
    return finish('quadra', parts, W, lo_ratio=0.25, roles={ 'dent': ['body', 'flares', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.66, 1.53, -0.4] })

@design
def sarthe():
    """Sarthe: the 60s Le Mans racer."""
    W = four(0.97, 1.28, -1.2, 0.38, 0.32, 0.41, 0.4, 0.98)
    b = body({ 'W': [(1.9, 0.86), (1.8, 0.96), (1.5, 1.02), (1.0, 1.0), (0.3, 0.95), (-0.5, 0.98), (-1.2, 1.04), (-1.7, 1.02), (-1.9, 0.98)],
               'TOP': [(1.9, 0.62), (1.75, 0.78), (1.45, 0.9), (1.28, 0.92), (1.05, 0.88), (0.6, 0.77), (0.2, 0.74), (-0.5, 0.82), (-0.9, 0.93), (-1.2, 0.98), (-1.6, 0.96), (-1.82, 0.9), (-1.9, 0.84)],
               'BOT': [(1.9, 0.38), (1.6, 0.26), (-1.6, 0.26), (-1.9, 0.4)] },
             [1.9, 1.86, 1.78, 1.65, 1.48, 1.3, 1.1, 0.85, 0.6, 0.35, 0.1, -0.15, -0.4, -0.65, -0.9, -1.15, -1.35, -1.55, -1.72, -1.84, -1.9], n=5, tumble=0.2)
    arches(b, W, depth=1.0); sill(b, 0.36); decimate(b, 0.3); shade(b)
    s = stripes(b, (0.0,), ((1.86, 0.35), (-0.95, -1.88)), width=0.3)
    roof = [(0.4, 0.75), (0.2, 1.0), (0.0, 1.08), (-0.45, 1.08), (-0.8, 0.9), (-0.95, 0.8)]
    cab = glasshouse([0.42, 0.36, 0.25, 0.1, -0.1, -0.3, -0.5, -0.7, -0.85, -0.95], 0.74, roof,
                     [(0.4, 0.8), (-0.95, 0.82)], [(0.4, 0.66), (-0.3, 0.6), (-0.95, 0.66)], roof_z=(0.1, -0.6))
    louvres = join('louvres', [rbox(f'lv{k}', (0.9, 0.03, 0.05), (0, 0.97 + 0.004 * k, -1.0 - k * 0.11), 'trim', 0.01) for k in range(6)])
    parts = [b, s, cab, louvres, rbox('bumper', (1.4, 0.06, 0.3), (0, 0.38, 1.86), 'trim', 0.03), rbox('rbumper', (1.7, 0.16, 0.08), (0, 0.5, -1.9), 'trim', 0.03),
             rbox('wing', (1.7, 0.05, 0.2), (0, 0.9, -1.84), 'paint', 0.02, rot=(0.35, 0, 0)), rbox('mouth', (0.9, 0.12, 0.05), (0, 0.5, 1.88), 'trim', 0.04)]
    for k, s_ in enumerate(MIR):   # covered headlamps (a lamp under clear glass) and the side intakes behind the doors
        parts.append(sphere(f'cover{k}', 0.2, (s_ * 0.6, 0.8, 1.6), 'glass', 16, (0.9, 0.45, 1.3)))
        parts.append(rbox(f'intake{k}', (0.06, 0.14, 0.34), (s_ * 1.0, 0.66, -0.5), 'trim', 0.02))
    parts += lamps((-0.6, 0.6), 0.8, 1.72, 0.1)
    parts += tails((-0.6, 0.6), 0.66, -1.92, 0.4, 0.1)
    parts += exhausts((-0.2, 0.2), 0.42, -1.9, 0.06)
    parts += mirrors(0.86, 0.86, 0.3)
    preview_wheels(W)
    return finish('sarthe', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.56, 1.1, -0.2] })
