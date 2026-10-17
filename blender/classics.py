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

# ---------------------------------------------------------------------------------------------------------------------
# The second and third batches: more muscle, rally and supercars.
#   bandit    a '69 pony coupe: cowl-induction bonnet, gills behind the doors, wide stripes nose and tail, a lip spoiler
#   barra     a '70 E-body: twin bonnet scoops, quad lamps in a split grille, a billboard stripe down the rear quarters
#   judge     a '69 muscle coupe: a body-coloured beak nose, split grille, a wing on posts across the boot
#   asp       a 60s roadster: wide hips, an oval mouth, a little screen, a roll bar, side pipes, stripes
#   strato    a 70s rally wedge: short and wide, a wrap-round screen, a lamp pod, a spoiler over the rear glass
#   pleiades  a 90s rally saloon: a big bonnet scoop, a tall wing on the boot, fog lamps, gold wheels
#   cyclone   a late-90s rally saloon: a two-tier wing, a deep bumper full of intakes, bonnet vents
#   turin     an 80s mid-engined rally coupe: low and long, a lamp pod, louvres, a tail spoiler
#   toro      a 60s mid-engined supercar: lashes round the lamps, louvres over the engine, a long curved nose
#   taurus    a 70s wedge supercar: all edges, roof scoops behind the cabin, a big wing, slot lamps
#   swabia    a 60s rear-engined coupe: round lamps up on the wings, a sloping tail, a ducktail, wide rear hips
#   rosso     an 80s supercar: a wedge, ducts in the bonnet, a wing across the tail, slatted engine cover
@design
def bandit():
    """Bandit SS: the '69 pony coupe."""
    W = four(0.96, 1.2, -1.14, 0.41, 0.34, 0.42, 0.38, 0.98)
    b = body({ 'W': [(1.84, 0.92), (1.74, 0.99), (1.4, 1.01), (0.7, 0.99), (0.0, 0.97), (-0.7, 1.0), (-1.14, 1.04), (-1.6, 1.01), (-1.84, 0.97)],
               'TOP': [(1.84, 0.86), (1.76, 0.95), (1.3, 0.97), (0.35, 1.0), (-1.0, 1.0), (-1.75, 1.02), (-1.84, 0.98)],
               'BOT': [(1.84, 0.46), (1.5, 0.34), (0.0, 0.3), (-1.5, 0.34), (-1.84, 0.48)] },
             [1.84, 1.8, 1.72, 1.55, 1.3, 1.0, 0.7, 0.4, 0.1, -0.2, -0.5, -0.8, -1.05, -1.3, -1.5, -1.68, -1.8, -1.84], n=7, tumble=0.1)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.22, 0.22), ((1.8, 0.4), (-1.18, -1.82)), width=0.26)
    roof = [(0.32, 1.0), (0.1, 1.3), (-0.2, 1.42), (-0.75, 1.42), (-1.05, 1.2), (-1.25, 1.03)]
    cab = glasshouse([0.34, 0.3, 0.15, 0.0, -0.2, -0.4, -0.6, -0.8, -1.0, -1.15, -1.25], 0.99, roof,
                     [(0.32, 0.84), (-0.5, 0.88), (-1.25, 0.84)], [(0.32, 0.76), (-0.25, 0.7), (-0.8, 0.7), (-1.25, 0.76)], roof_z=(-0.1, -0.95))
    cowl = join('cowl', [rbox('cowl', (0.6, 0.1, 0.62), (0, 1.02, 0.62), 'paint', 0.04), rbox('cowlslot', (0.5, 0.05, 0.03), (0, 1.04, 0.31), 'trim', 0.01)])
    parts = [b, s, cab, cowl, rbox('mouth', (1.7, 0.26, 0.06), (0, 0.74, 1.83), 'trim', 0.05),
             rbox('bumper', (1.9, 0.12, 0.14), (0, 0.52, 1.86), 'chrome', 0.05), rbox('rbumper', (1.92, 0.12, 0.14), (0, 0.54, -1.86), 'chrome', 0.05),
             rbox('wing', (1.6, 0.05, 0.2), (0, 1.06, -1.72), 'paint', 0.02, rot=(0.25, 0, 0))]
    for k, s_ in enumerate(MIR):   # the gills on the rear quarters
        parts.append(join(f'gill{k}', [rbox(f'gill{k}_{j}', (0.04, 0.12, 0.05), (s_ * 1.0, 0.8, -0.6 - j * 0.09), 'trim', 0.01) for j in range(3)]))
    parts += lamps((-0.66, 0.66), 0.76, 1.87, 0.12) + tails((-0.5, 0.5), 0.84, -1.86, 0.5, 0.12)
    parts += exhausts((-0.5, 0.5), 0.4, -1.86)
    parts += mirrors(0.92, 1.05, 0.2)
    preview_wheels(W)
    return finish('bandit', parts, W, { 'dent': ['body', 'cowl', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.62, 1.44, -0.45] })

@design
def barra():
    """Barra 440: the '70 E-body."""
    W = four(0.98, 1.18, -1.12, 0.42, 0.36, 0.44, 0.42, 1.0)
    b = body({ 'W': [(1.8, 0.96), (1.7, 1.02), (1.3, 1.04), (0.0, 1.02), (-1.12, 1.06), (-1.6, 1.04), (-1.8, 1.0)],
               'TOP': [(1.8, 0.86), (1.72, 0.94), (1.3, 0.97), (0.35, 0.99), (-1.0, 0.99), (-1.7, 1.0), (-1.8, 0.96)],
               'BOT': [(1.8, 0.44), (1.5, 0.32), (0.0, 0.28), (-1.5, 0.32), (-1.8, 0.46)] },
             [1.8, 1.76, 1.68, 1.52, 1.28, 1.0, 0.7, 0.4, 0.1, -0.2, -0.5, -0.8, -1.05, -1.3, -1.5, -1.66, -1.76, -1.8], n=8, tumble=0.08)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    roof = [(0.3, 0.98), (0.08, 1.28), (-0.2, 1.4), (-0.7, 1.4), (-1.0, 1.18), (-1.2, 1.01)]
    cab = glasshouse([0.32, 0.28, 0.15, 0.0, -0.2, -0.4, -0.6, -0.8, -0.95, -1.1, -1.2], 0.97, roof,
                     [(0.3, 0.86), (-0.5, 0.9), (-1.2, 0.86)], [(0.3, 0.78), (-0.25, 0.72), (-0.8, 0.72), (-1.2, 0.78)], roof_z=(-0.1, -0.9))
    scoops = join('scoops', [rbox(f'scoop{k}', (0.3, 0.1, 0.5), (s_ * 0.36, 1.02, 0.95), 'paint', 0.04) for k, s_ in enumerate(MIR)]
                  + [rbox(f'scoopm{k}', (0.24, 0.06, 0.03), (s_ * 0.36, 1.04, 1.21), 'trim', 0.01) for k, s_ in enumerate(MIR)])
    parts = [b, cab, scoops, rbox('mask', (1.76, 0.28, 0.06), (0, 0.72, 1.79), 'trim', 0.05), rbox('split', (0.1, 0.28, 0.08), (0, 0.72, 1.81), 'paint', 0.02),
             rbox('bumper', (1.98, 0.12, 0.14), (0, 0.5, 1.82), 'chrome', 0.05), rbox('rbumper', (2.0, 0.12, 0.14), (0, 0.52, -1.82), 'chrome', 0.05),
             rbox('wing', (1.5, 0.05, 0.18), (0, 1.03, -1.68), 'paint', 0.02, rot=(0.2, 0, 0)), rbox('tailband', (1.8, 0.16, 0.04), (0, 0.84, -1.81), 'trim', 0.02)]
    for k, s_ in enumerate(MIR):   # the billboard stripe down the rear quarter
        parts.append(rbox(f'billboard{k}', (0.02, 0.22, 1.1), (s_ * 1.045, 0.78, -1.0), 'accent', 0.01))
    parts += lamps((-0.76, -0.52, 0.52, 0.76), 0.74, 1.82, 0.1)
    parts += rects((-0.5, 0.5), 0.84, -1.83, 0.6, 0.1, 'tail', 'tail')
    parts += exhausts((-0.62, 0.62), 0.38, -1.82, 0.065)
    parts += mirrors(0.94, 1.03, 0.18)
    preview_wheels(W)
    return finish('barra', parts, W, { 'dent': ['body', 'scoops', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.62, 1.42, -0.45] })

@design
def judge():
    """Judge: the '69 muscle coupe with a beak and a wing on posts."""
    W = four(0.97, 1.26, -1.18, 0.42, 0.34, 0.44, 0.4, 1.0)
    b = body({ 'W': [(1.92, 0.7), (1.85, 0.9), (1.6, 1.0), (1.0, 1.0), (0.0, 0.97), (-0.8, 1.0), (-1.18, 1.05), (-1.7, 1.02), (-1.9, 0.98)],
               'TOP': [(1.92, 0.84), (1.84, 0.95), (1.4, 0.98), (0.35, 1.0), (-1.0, 1.0), (-1.8, 1.01), (-1.9, 0.96)],
               'BOT': [(1.92, 0.5), (1.6, 0.34), (0.0, 0.3), (-1.6, 0.34), (-1.9, 0.48)] },
             [1.92, 1.88, 1.8, 1.65, 1.42, 1.15, 0.85, 0.55, 0.25, -0.05, -0.35, -0.65, -0.9, -1.15, -1.4, -1.6, -1.76, -1.86, -1.9], n=7, tumble=0.1)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.75, 0.75), ((1.5, -0.2),), width=0.08)
    roof = [(0.28, 1.0), (0.05, 1.3), (-0.25, 1.42), (-0.8, 1.42), (-1.1, 1.2), (-1.3, 1.02)]
    cab = glasshouse([0.3, 0.26, 0.12, -0.05, -0.25, -0.45, -0.65, -0.85, -1.0, -1.15, -1.3], 0.99, roof,
                     [(0.28, 0.84), (-0.5, 0.88), (-1.3, 0.84)], [(0.28, 0.76), (-0.25, 0.7), (-0.8, 0.7), (-1.3, 0.76)], roof_z=(-0.1, -0.95))
    wing = join('wing', [rbox('wing', (1.76, 0.06, 0.3), (0, 1.22, -1.72), 'accent', 0.02, rot=(0.15, 0, 0))] + [rbox(f'wpost{k}', (0.08, 0.2, 0.12), (s_ * 0.7, 1.1, -1.72), 'paint', 0.02) for k, s_ in enumerate(MIR)])
    parts = [b, s, cab, wing, rbox('beak', (0.24, 0.3, 0.3), (0, 0.78, 1.8), 'paint', 0.08)]
    for k, s_ in enumerate(MIR):   # the split grille either side of the beak, the quad lamps in it
        parts.append(rbox(f'grille{k}', (0.62, 0.22, 0.05), (s_ * 0.5, 0.74, 1.84), 'trim', 0.04))
    parts += [rbox('bumper', (1.9, 0.1, 0.12), (0, 0.5, 1.86), 'paint', 0.04), rbox('rbumper', (1.92, 0.12, 0.14), (0, 0.52, -1.9), 'chrome', 0.05),
              rbox('scoops', (0.7, 0.06, 0.4), (0, 1.02, 1.0), 'trim', 0.03)]
    parts += lamps((-0.72, -0.48, 0.48, 0.72), 0.75, 1.88, 0.09)
    parts += rects((-0.55, 0.55), 0.84, -1.9, 0.52, 0.1, 'tail', 'tail')
    parts += exhausts((-0.58, 0.58), 0.4, -1.9)
    parts += mirrors(0.93, 1.04, 0.16)
    preview_wheels(W)
    return finish('judge', parts, W, { 'dent': ['body', 'beak', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.62, 1.44, -0.5] })

@design
def asp():
    """Asp 427: the 60s roadster."""
    W = four(0.98, 1.12, -1.1, 0.4, 0.34, 0.43, 0.44, 1.0)
    b = body({ 'W': [(1.72, 0.7), (1.62, 0.86), (1.3, 1.0), (0.8, 0.94), (0.0, 0.9), (-0.7, 0.98), (-1.1, 1.06), (-1.5, 1.0), (-1.72, 0.9)],
               'TOP': [(1.72, 0.7), (1.6, 0.8), (1.12, 0.92), (0.6, 0.86), (0.0, 0.84), (-0.6, 0.86), (-1.1, 0.96), (-1.6, 0.92), (-1.72, 0.84)],
               'BOT': [(1.72, 0.44), (1.4, 0.32), (-1.4, 0.32), (-1.72, 0.46)] },
             [1.72, 1.68, 1.6, 1.45, 1.25, 1.0, 0.75, 0.5, 0.25, 0.0, -0.25, -0.5, -0.75, -1.0, -1.2, -1.4, -1.58, -1.68, -1.72], n=5, tumble=0.2)
    arches(b, W); sill(b, 0.4); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.2, 0.2), ((1.68, 0.4), (-0.75, -1.7)), width=0.2)
    cockpit = rbox('cockpit', (1.2, 0.08, 1.1), (0, 0.86, -0.3), 'trim', 0.05)
    cab = rbox('cabin', (1.1, 0.24, 0.04), (0, 1.0, 0.32), 'glass', 0.02, rot=(-0.45, 0, 0))   # the little screen
    bar = join('rollbar', [tube('rb0', (-0.4, 0.88, -0.75), (-0.4, 1.38, -0.75), 0.04, 'chrome'), tube('rb1', (0.4, 0.88, -0.75), (0.4, 1.38, -0.75), 0.04, 'chrome'), tube('rb2', (-0.4, 1.38, -0.75), (0.4, 1.38, -0.75), 0.04, 'chrome')])
    parts = [b, s, cockpit, cab, bar, rbox('seats', (0.9, 0.3, 0.4), (0, 1.0, -0.55), 'trim', 0.08), sphere('driver', 0.17, (-0.25, 1.3, -0.4), 'accent', 12),
             rbox('mouth', (0.7, 0.2, 0.05), (0, 0.6, 1.72), 'trim', 0.08), rbox('bumper', (1.2, 0.06, 0.08), (0, 0.52, 1.76), 'chrome', 0.03),
             rbox('rbumper', (1.4, 0.06, 0.08), (0, 0.56, -1.74), 'chrome', 0.03), rbox('wing', (1.3, 0.04, 0.16), (0, 0.9, -1.64), 'paint', 0.02, rot=(0.3, 0, 0))]
    for k, s_ in enumerate(MIR):   # side pipes along the sills
        parts.append(cyl(f'pipe{k}', 0.07, 1.4, (s_ * 1.03, 0.36, -0.05), 'z', 'chrome', 12))
    parts += lamps((-0.6, 0.6), 0.74, 1.6, 0.12) + tails((-0.55, 0.55), 0.78, -1.72, 0.2, 0.12)
    preview_wheels(W)
    return finish('asp', parts, W, { 'dent': ['body'], 'bumper': 'bumper', 'wing': 'wing', 'struts': ['rollbar'], 'cabin': 'cabin', 'number': [0.5, 0.92, 1.2] })

@design
def strato():
    """Strato: the 70s rally wedge."""
    W = four(0.98, 1.06, -1.02, 0.41, 0.36)
    b = body({ 'W': [(1.66, 0.84), (1.55, 0.96), (1.2, 1.02), (0.0, 1.0), (-1.0, 1.04), (-1.66, 1.0)],
               'TOP': [(1.66, 0.62), (1.5, 0.76), (1.0, 0.86), (0.4, 0.92), (-1.66, 0.98)],
               'BOT': [(1.66, 0.4), (1.4, 0.3), (-1.4, 0.3), (-1.66, 0.42)] },
             [1.66, 1.62, 1.54, 1.4, 1.2, 0.95, 0.7, 0.45, 0.2, -0.05, -0.3, -0.55, -0.8, -1.05, -1.3, -1.5, -1.62, -1.66], n=8, tumble=0.1)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.3, 0.3), ((1.6, 0.45),), width=0.16)
    roof = [(0.62, 0.9), (0.42, 1.28), (0.15, 1.42), (-0.55, 1.42), (-0.85, 1.1), (-1.0, 0.98)]   # the wrap-round screen bulges forward
    cab = glasshouse([0.62, 0.56, 0.45, 0.3, 0.1, -0.15, -0.4, -0.6, -0.8, -0.95, -1.0], 0.9, roof,
                     [(0.62, 0.84), (0.2, 0.92), (-1.0, 0.86)], [(0.62, 0.72), (0.2, 0.8), (-1.0, 0.74)], roof_z=(0.0, -0.55))
    louvres = join('louvres', [rbox(f'lv{k}', (1.1, 0.03, 0.05), (0, 0.99 + 0.003 * k, -1.08 - k * 0.1), 'trim', 0.01) for k in range(5)])
    pod = join('pod', [rbox('pod', (1.0, 0.2, 0.14), (0, 0.92, 1.22), 'trim', 0.04)])
    parts = [b, s, cab, louvres, pod, rbox('roofwing', (1.2, 0.05, 0.22), (0, 1.44, -0.62), 'accent', 0.02, rot=(0.25, 0, 0)),
             rbox('bumper', (1.86, 0.1, 0.16), (0, 0.42, 1.66), 'trim', 0.03), rbox('rbumper', (1.8, 0.14, 0.1), (0, 0.5, -1.66), 'trim', 0.03),
             rbox('wing', (1.7, 0.06, 0.24), (0, 1.02, -1.6), 'accent', 0.02, rot=(0.3, 0, 0))]
    parts += lamps((-0.38, -0.13, 0.13, 0.38), 0.94, 1.3, 0.1, 'spot') + rects((-0.62, 0.62), 0.72, 1.62, 0.3, 0.08)
    parts += [cyl(f'tail{k}', 0.11, 0.08, (x, 0.78, -1.67), 'z', 'tail', 20) for k, x in enumerate((-0.62, 0.62))]
    parts += exhausts((-0.3, 0.3), 0.42, -1.66)
    parts += mirrors(0.9, 1.05, 0.5)
    preview_wheels(W)
    return finish('strato', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'struts': ['roofwing'], 'cabin': 'cabin', 'number': [0.6, 1.45, -0.2] })

@design
def pleiades():
    """Pleiades: the 90s rally saloon with gold wheels."""
    W = four(0.95, 1.18, -1.12, 0.41, 0.34)
    b = body({ 'W': [(1.8, 0.86), (1.7, 0.94), (1.3, 0.97), (-1.3, 0.97), (-1.7, 0.94), (-1.8, 0.9)],
               'TOP': [(1.8, 0.82), (1.7, 0.92), (1.2, 0.96), (0.5, 1.0), (-1.2, 1.04), (-1.7, 1.02), (-1.8, 0.96)],
               'BOT': [(1.8, 0.42), (1.5, 0.32), (-1.5, 0.32), (-1.8, 0.46)] },
             [1.8, 1.76, 1.68, 1.52, 1.3, 1.05, 0.75, 0.45, 0.15, -0.15, -0.45, -0.75, -1.05, -1.3, -1.5, -1.66, -1.76, -1.8], n=6, tumble=0.12)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    roof = [(0.5, 1.0), (0.28, 1.46), (0.05, 1.54), (-0.85, 1.54), (-1.05, 1.36), (-1.2, 1.05)]
    cab = glasshouse([0.5, 0.45, 0.32, 0.15, -0.1, -0.35, -0.6, -0.8, -0.95, -1.1, -1.2], 0.99, roof,
                     [(0.5, 0.88), (-1.2, 0.9)], [(0.5, 0.76), (-0.4, 0.72), (-1.2, 0.8)], roof_z=(0.2, -0.85))
    scoop = join('scoop', [rbox('scoop', (0.56, 0.12, 0.5), (0, 1.0, 0.95), 'paint', 0.05), rbox('scoopm', (0.46, 0.08, 0.03), (0, 1.02, 1.21), 'trim', 0.01)])
    wing = join('wing', [rbox('wing', (1.66, 0.06, 0.32), (0, 1.4, -1.6), 'paint', 0.02, rot=(0.12, 0, 0))] + [rbox(f'wst{k}', (0.06, 0.36, 0.14), (s_ * 0.62, 1.2, -1.58), 'paint', 0.01) for k, s_ in enumerate(MIR)])
    parts = [b, cab, scoop, wing, rbox('vent', (0.4, 0.06, 0.3), (0, 1.57, -0.2), 'trim', 0.03),
             rbox('bumper', (1.84, 0.24, 0.2), (0, 0.5, 1.76), 'paint', 0.06), grille(0.7, 0.16, 0.8, 1.78),
             rbox('rbumper', (1.84, 0.18, 0.16), (0, 0.5, -1.78), 'paint', 0.05),
             join('flaps', [rbox(f'flap{k}', (0.34, 0.3, 0.04), (s_ * 0.93, 0.34, -1.56), 'white', 0.01) for k, s_ in enumerate(MIR)])]
    for k, s_ in enumerate(MIR):   # a star-sprinkled band down each side (the accent)
        parts.append(rbox(f'band{k}', (0.02, 0.18, 2.6), (s_ * 0.97, 0.74, 0), 'accent', 0.01))
    parts += rects((-0.6, 0.6), 0.84, 1.8, 0.4, 0.14) + lamps((-0.55, -0.35, 0.35, 0.55), 0.5, 1.87, 0.07, 'fog')
    parts += rects((-0.62, 0.62), 0.88, -1.81, 0.42, 0.14, 'tail', 'tail')
    parts += exhausts((0.55,), 0.38, -1.8, 0.07)
    parts += mirrors(0.92, 1.08, 0.38)
    preview_wheels(W)
    return finish('pleiades', parts, W, { 'dent': ['body', 'scoop', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'hub': 'accent', 'number': [0.68, 1.57, -0.5] })

@design
def cyclone():
    """Cyclone: the late-90s rally saloon with a two-tier wing."""
    W = four(0.96, 1.2, -1.14, 0.41, 0.36)
    b = body({ 'W': [(1.82, 0.88), (1.72, 0.96), (1.3, 0.99), (-1.3, 0.99), (-1.72, 0.96), (-1.82, 0.92)],
               'TOP': [(1.82, 0.8), (1.72, 0.9), (1.2, 0.96), (0.5, 1.0), (-1.2, 1.04), (-1.72, 1.02), (-1.82, 0.96)],
               'BOT': [(1.82, 0.4), (1.5, 0.3), (-1.5, 0.3), (-1.82, 0.44)] },
             [1.82, 1.78, 1.7, 1.54, 1.32, 1.05, 0.75, 0.45, 0.15, -0.15, -0.45, -0.75, -1.05, -1.3, -1.5, -1.66, -1.78, -1.82], n=9, tumble=0.08)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.42, 0.42), ((1.72, 0.55),), width=0.1)
    roof = [(0.5, 1.0), (0.28, 1.46), (0.05, 1.53), (-0.85, 1.53), (-1.05, 1.34), (-1.2, 1.05)]
    cab = glasshouse([0.5, 0.45, 0.32, 0.15, -0.1, -0.35, -0.6, -0.8, -0.95, -1.1, -1.2], 0.99, roof,
                     [(0.5, 0.88), (-1.2, 0.92)], [(0.5, 0.76), (-0.4, 0.72), (-1.2, 0.8)], roof_z=(0.2, -0.85))
    wing = join('wing', [rbox('wing', (1.72, 0.05, 0.3), (0, 1.36, -1.62), 'trim', 0.02, rot=(0.15, 0, 0)), rbox('wing2', (1.6, 0.04, 0.22), (0, 1.2, -1.66), 'trim', 0.02, rot=(0.2, 0, 0))]
                + [rbox(f'wst{k}', (0.05, 0.36, 0.3), (s_ * 0.86, 1.2, -1.62), 'trim', 0.01) for k, s_ in enumerate(MIR)])
    parts = [b, s, cab, wing, rbox('vent', (0.6, 0.04, 0.3), (0, 1.0, 1.05), 'trim', 0.02),
             join('bumper', [rbox('bumper', (1.9, 0.3, 0.22), (0, 0.52, 1.76), 'paint', 0.06)] + [rbox(f'intake{k}', (0.42, 0.14, 0.04), (x, 0.5, 1.88), 'trim', 0.02) for k, x in enumerate((-0.6, 0.0, 0.6))]),
             rbox('rbumper', (1.88, 0.2, 0.16), (0, 0.5, -1.8), 'trim', 0.05),
             join('flaps', [rbox(f'flap{k}', (0.34, 0.3, 0.04), (s_ * 0.94, 0.34, -1.58), 'tyre', 0.01) for k, s_ in enumerate(MIR)])]
    parts += rects((-0.62, 0.62), 0.84, 1.8, 0.4, 0.13) + rects((-0.62, 0.62), 0.88, -1.82, 0.42, 0.14, 'tail', 'tail')
    parts += exhausts((0.6,), 0.38, -1.82, 0.075)
    parts += mirrors(0.93, 1.08, 0.38)
    preview_wheels(W)
    return finish('cyclone', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.68, 1.56, -0.45] })

@design
def turin():
    """Turin 037: the 80s mid-engined rally coupe."""
    W = four(0.98, 1.28, -1.16, 0.4, 0.34, 0.42, 0.4)
    b = body({ 'W': [(1.86, 0.84), (1.76, 0.96), (1.4, 1.02), (0.5, 0.98), (-0.6, 1.0), (-1.16, 1.05), (-1.7, 1.02), (-1.86, 0.96)],
               'TOP': [(1.86, 0.62), (1.7, 0.76), (1.28, 0.84), (0.7, 0.8), (0.0, 0.84), (-0.8, 0.94), (-1.6, 0.98), (-1.86, 0.92)],
               'BOT': [(1.86, 0.38), (1.6, 0.28), (-1.6, 0.28), (-1.86, 0.42)] },
             [1.86, 1.82, 1.74, 1.6, 1.4, 1.15, 0.9, 0.65, 0.4, 0.15, -0.1, -0.35, -0.6, -0.85, -1.1, -1.35, -1.55, -1.72, -1.82, -1.86], n=7, tumble=0.12)
    arches(b, W); sill(b, 0.38); decimate(b, 0.3); shade(b)
    s = stripes(b, (-0.36, -0.2, 0.2, 0.36), ((1.8, 0.4), (-0.95, -1.84)), width=0.1)
    roof = [(0.5, 0.82), (0.3, 1.18), (0.1, 1.28), (-0.5, 1.28), (-0.75, 1.04), (-0.9, 0.94)]
    cab = glasshouse([0.5, 0.45, 0.35, 0.2, 0.0, -0.2, -0.4, -0.6, -0.75, -0.9], 0.82, roof,
                     [(0.5, 0.84), (-0.9, 0.88)], [(0.5, 0.7), (-0.4, 0.66), (-0.9, 0.72)], roof_z=(0.1, -0.5))
    louvres = join('louvres', [rbox(f'lv{k}', (1.0, 0.03, 0.05), (0, 0.97 + 0.004 * k, -1.0 - k * 0.11), 'trim', 0.01) for k in range(6)])
    pod = rbox('pod', (1.1, 0.16, 0.12), (0, 0.84, 1.5), 'trim', 0.03)
    parts = [b, s, cab, louvres, pod, rbox('bumper', (1.8, 0.1, 0.2), (0, 0.38, 1.84), 'trim', 0.03), rbox('rbumper', (1.84, 0.14, 0.1), (0, 0.48, -1.86), 'trim', 0.03),
             rbox('wing', (1.8, 0.06, 0.24), (0, 1.04, -1.8), 'paint', 0.02, rot=(0.3, 0, 0))]
    parts += lamps((-0.4, -0.13, 0.13, 0.4), 0.86, 1.57, 0.09, 'spot') + rects((-0.66, 0.66), 0.66, 1.78, 0.3, 0.08)
    parts += rects((-0.62, 0.62), 0.82, -1.87, 0.4, 0.12, 'tail', 'tail')
    parts += exhausts((-0.3, 0.3), 0.4, -1.86)
    parts += mirrors(0.9, 0.98, 0.35)
    preview_wheels(W)
    return finish('turin', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.56, 1.3, -0.2] })

@design
def toro():
    """Toro: the 60s mid-engined supercar."""
    W = four(0.98, 1.3, -1.16, 0.38, 0.32, 0.41, 0.38)
    b = body({ 'W': [(1.92, 0.8), (1.8, 0.94), (1.5, 1.0), (0.8, 0.97), (0.0, 0.96), (-0.8, 1.0), (-1.16, 1.04), (-1.7, 1.0), (-1.92, 0.94)],
               'TOP': [(1.92, 0.6), (1.78, 0.72), (1.3, 0.82), (0.6, 0.78), (0.0, 0.8), (-0.8, 0.9), (-1.6, 0.92), (-1.92, 0.84)],
               'BOT': [(1.92, 0.36), (1.6, 0.26), (-1.6, 0.26), (-1.92, 0.4)] },
             [1.92, 1.86, 1.74, 1.55, 1.3, 1.0, 0.65, 0.3, -0.05, -0.4, -0.75, -1.05, -1.3, -1.52, -1.72, -1.86, -1.92], n=5, tumble=0.2)
    arches(b, W); sill(b, 0.36); decimate(b, 0.3); shade(b)
    roof = [(0.45, 0.78), (0.25, 1.06), (0.0, 1.14), (-0.45, 1.14), (-0.7, 0.98), (-0.85, 0.9)]
    cab = glasshouse([0.46, 0.4, 0.3, 0.15, -0.05, -0.25, -0.45, -0.65, -0.78, -0.86], 0.78, roof,
                     [(0.45, 0.82), (-0.86, 0.86)], [(0.45, 0.66), (-0.4, 0.62), (-0.86, 0.68)], roof_z=(0.1, -0.5))
    slats = join('slats', [rbox(f'sl{k}', (0.9, 0.03, 0.04), (0, 0.93 + 0.004 * k, -0.95 - k * 0.11), 'trim', 0.01) for k in range(7)])
    parts = [b, cab, slats, rbox('bumper', (1.3, 0.05, 0.1), (0, 0.46, 1.9), 'chrome', 0.02), rbox('rbumper', (1.6, 0.05, 0.08), (0, 0.5, -1.92), 'chrome', 0.02),
             rbox('wing', (1.5, 0.04, 0.14), (0, 0.88, -1.86), 'paint', 0.02, rot=(0.3, 0, 0)), rbox('mouth', (0.9, 0.08, 0.05), (0, 0.44, 1.86), 'trim', 0.03)]
    for k, s_ in enumerate(MIR):   # the lashes round each lamp, the intakes behind the doors
        parts.append(join(f'lash{k}', [rbox(f'lash{k}_{j}', (0.04, 0.03, 0.18), (s_ * (0.46 + j * 0.07), 0.82, 1.52), 'trim', 0.005) for j in range(4)]))
        parts.append(rbox(f'intake{k}', (0.05, 0.12, 0.4), (s_ * 0.98, 0.7, -0.6), 'trim', 0.02))
    parts += lamps((-0.56, 0.56), 0.76, 1.6, 0.1) + tails((-0.6, 0.6), 0.7, -1.93, 0.4, 0.08)
    parts += exhausts((-0.12, 0.0, 0.12), 0.42, -1.92, 0.04)
    parts += mirrors(0.86, 0.86, 0.3)
    preview_wheels(W)
    return finish('toro', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.5, 1.16, -0.2] })

@design
def taurus():
    """Taurus: the 70s wedge supercar."""
    W = four(1.0, 1.28, -1.18, 0.38, 0.34, 0.42, 0.44)
    b = body({ 'W': [(1.94, 0.86), (1.8, 0.96), (1.2, 1.0), (0.0, 1.0), (-1.18, 1.06), (-1.94, 1.04)],
               'TOP': [(1.94, 0.52), (1.4, 0.66), (0.6, 0.78), (0.0, 0.84), (-1.94, 0.9)],
               'BOT': [(1.94, 0.36), (1.6, 0.26), (-1.6, 0.26), (-1.94, 0.38)] },
             [1.94, 1.9, 1.78, 1.6, 1.38, 1.12, 0.85, 0.58, 0.3, 0.0, -0.3, -0.6, -0.9, -1.18, -1.45, -1.7, -1.86, -1.94], n=14, tumble=0.04)
    arches(b, W); sill(b, 0.36); decimate(b, 0.3); shade(b)
    roof = [(0.65, 0.72), (0.2, 1.06), (-0.1, 1.12), (-0.6, 1.1), (-1.0, 0.92)]
    cab = glasshouse([0.66, 0.55, 0.4, 0.2, 0.0, -0.2, -0.4, -0.6, -0.8, -1.0], 0.72, roof,
                     [(0.65, 0.82), (-1.0, 0.9)], [(0.65, 0.6), (-0.3, 0.6), (-1.0, 0.68)], roof_z=(0.1, -0.7))
    boxes = join('airboxes', [rbox(f'airbox{k}', (0.32, 0.2, 0.6), (s_ * 0.7, 1.02, -0.85), 'paint', 0.02) for k, s_ in enumerate(MIR)] + [rbox(f'abm{k}', (0.26, 0.14, 0.03), (s_ * 0.7, 1.02, -0.54), 'trim', 0.01) for k, s_ in enumerate(MIR)])
    wing = join('wing', [rbox('wing', (1.9, 0.07, 0.42), (0, 1.32, -1.66), 'paint', 0.02, rot=(0.1, 0, 0))] + [rbox(f'wst{k}', (0.1, 0.4, 0.3), (s_ * 0.55, 1.1, -1.66), 'paint', 0.02, rot=(-0.3, 0, 0)) for k, s_ in enumerate(MIR)])
    parts = [b, cab, boxes, wing, rbox('bumper', (1.8, 0.06, 0.12), (0, 0.42, 1.92), 'trim', 0.02), rbox('rbumper', (1.9, 0.18, 0.08), (0, 0.5, -1.95), 'trim', 0.02)]
    for k, s_ in enumerate(MIR):   # the NACA ducts in the doors
        parts.append(rbox(f'duct{k}', (0.04, 0.12, 0.36), (s_ * 1.0, 0.7, -0.15), 'trim', 0.01))
    parts += rects((-0.62, 0.62), 0.6, 1.88, 0.36, 0.06) + rects((-0.56, 0.56), 0.72, -1.96, 0.62, 0.14, 'tail', 'tail')
    parts += exhausts((-0.22, -0.08, 0.08, 0.22), 0.4, -1.94, 0.05)
    parts += mirrors(0.88, 0.92, 0.38)
    preview_wheels(W)
    return finish('taurus', parts, W, { 'dent': ['body', 'airboxes', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.5, 1.14, -0.3] })

@design
def swabia():
    """Swabia: the 60s rear-engined coupe with a ducktail."""
    W = four(0.92, 1.18, -1.12, 0.39, 0.32, 0.41, 0.38, 0.97)
    b = body({ 'W': [(1.7, 0.78), (1.6, 0.9), (1.3, 0.96), (0.6, 0.93), (0.0, 0.92), (-0.7, 0.96), (-1.12, 1.03), (-1.55, 0.98), (-1.7, 0.92)],
               'TOP': [(1.7, 0.66), (1.55, 0.8), (1.18, 0.92), (0.75, 0.86), (0.4, 0.88), (-0.9, 0.94), (-1.6, 0.86), (-1.7, 0.8)],
               'BOT': [(1.7, 0.42), (1.4, 0.32), (-1.4, 0.32), (-1.7, 0.44)] },
             [1.7, 1.66, 1.58, 1.45, 1.3, 1.1, 0.85, 0.6, 0.35, 0.1, -0.15, -0.4, -0.65, -0.9, -1.15, -1.35, -1.52, -1.64, -1.7], n=4, tumble=0.25)
    arches(b, W); sill(b); decimate(b, 0.3); shade(b)
    roof = [(0.4, 0.88), (0.2, 1.24), (-0.05, 1.34), (-0.45, 1.32), (-0.9, 1.08), (-1.4, 0.88)]
    cab = glasshouse([0.42, 0.36, 0.25, 0.1, -0.1, -0.3, -0.5, -0.7, -0.9, -1.1, -1.25, -1.4], 0.87, roof,
                     [(0.4, 0.84), (-1.4, 0.84)], [(0.4, 0.72), (-0.4, 0.7), (-1.4, 0.76)], roof_z=(0.05, -0.75))
    parts = [b, cab, rbox('bumper', (1.6, 0.1, 0.12), (0, 0.5, 1.7), 'chrome', 0.04), rbox('rbumper', (1.7, 0.1, 0.12), (0, 0.52, -1.72), 'chrome', 0.04),
             rbox('wing', (1.3, 0.06, 0.3), (0, 0.98, -1.55), 'paint', 0.03, rot=(-0.3, 0, 0)), rbox('grille', (0.6, 0.04, 0.2), (0, 0.84, -1.42), 'trim', 0.01)]
    for k, s_ in enumerate(MIR):   # the script stripe along each side
        parts.append(rbox(f'script{k}', (0.02, 0.1, 2.2), (s_ * 0.955, 0.56, 0.0), 'accent', 0.01))
    parts += [cyl(f'head{k}', 0.13, 0.08, (s_ * 0.62, 0.86, 1.48), 'z', 'lamp', 24) for k, s_ in enumerate(MIR)]   # round lamps up on the wings
    parts += [rbox(f'bezel{k}', (0.34, 0.3, 0.12), (s_ * 0.62, 0.84, 1.42), 'paint', 0.1) for k, s_ in enumerate(MIR)]
    parts += rects((-0.55, 0.55), 0.72, -1.71, 0.36, 0.1, 'tail', 'tail')
    parts += exhausts((-0.45,), 0.38, -1.72)
    parts += mirrors(0.86, 1.0, 0.32)
    preview_wheels(W)
    return finish('swabia', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.55, 1.36, -0.25] })

@design
def rosso():
    """Rosso 40: the 80s supercar with a wing right across."""
    W = four(1.0, 1.28, -1.18, 0.38, 0.34, 0.42, 0.44)
    b = body({ 'W': [(1.94, 0.86), (1.8, 0.98), (1.2, 1.02), (0.0, 1.0), (-1.18, 1.07), (-1.94, 1.05)],
               'TOP': [(1.94, 0.5), (1.6, 0.62), (0.9, 0.74), (0.3, 0.8), (-1.0, 0.92), (-1.94, 0.96)],
               'BOT': [(1.94, 0.34), (1.6, 0.26), (-1.6, 0.26), (-1.94, 0.38)] },
             [1.94, 1.9, 1.8, 1.62, 1.4, 1.15, 0.88, 0.6, 0.32, 0.04, -0.25, -0.55, -0.85, -1.15, -1.45, -1.7, -1.86, -1.94], n=9, tumble=0.08)
    arches(b, W); sill(b, 0.36); decimate(b, 0.3); shade(b)
    roof = [(0.55, 0.76), (0.25, 1.06), (0.0, 1.12), (-0.5, 1.1), (-0.85, 0.98)]
    cab = glasshouse([0.56, 0.48, 0.35, 0.2, 0.0, -0.2, -0.4, -0.6, -0.75, -0.85], 0.76, roof,
                     [(0.55, 0.82), (-0.85, 0.88)], [(0.55, 0.64), (-0.3, 0.62), (-0.85, 0.7)], roof_z=(0.1, -0.6))
    slats = join('slats', [rbox(f'sl{k}', (1.1, 0.03, 0.05), (0, 0.97 + 0.003 * k, -0.95 - k * 0.11), 'trim', 0.01) for k in range(7)])
    wing = join('wing', [rbox('wing', (2.0, 0.08, 0.36), (0, 1.12, -1.8), 'paint', 0.02, rot=(0.15, 0, 0))] + [rbox(f'wend{k}', (0.06, 0.2, 0.42), (s_ * 1.0, 1.02, -1.78), 'paint', 0.01) for k, s_ in enumerate(MIR)])
    parts = [b, cab, slats, wing, rbox('bumper', (1.8, 0.06, 0.14), (0, 0.38, 1.9), 'trim', 0.02), rbox('rbumper', (1.9, 0.16, 0.08), (0, 0.48, -1.95), 'trim', 0.02),
             rbox('mouth', (1.1, 0.1, 0.05), (0, 0.48, 1.92), 'trim', 0.03)]
    for k, s_ in enumerate(MIR):   # the ducts in the bonnet and the doors
        parts.append(rbox(f'nduct{k}', (0.16, 0.03, 0.4), (s_ * 0.3, 0.72, 1.2), 'trim', 0.01))
        parts.append(rbox(f'sduct{k}', (0.04, 0.12, 0.36), (s_ * 1.02, 0.68, -0.4), 'trim', 0.01))
    parts += rects((-0.66, 0.66), 0.58, 1.86, 0.4, 0.08) + [cyl(f'tail{k}', 0.08, 0.06, (x, 0.74, -1.96), 'z', 'tail', 16) for k, x in enumerate((-0.62, -0.42, 0.42, 0.62))]
    parts += exhausts((-0.1, 0.1), 0.44, -1.94, 0.05)
    parts += mirrors(0.9, 0.9, 0.35)
    preview_wheels(W)
    return finish('rosso', parts, W, { 'dent': ['body', 'cabin'], 'bumper': 'bumper', 'wing': 'wing', 'cabin': 'cabin', 'number': [0.5, 1.14, -0.3] })
