// Shapes of the main data structures, for editors and readers (JSDoc; nothing here runs).

/**
 * A stage: pure data. Downhill stages have `plan`; circuits have `type` ('loop' | 'pass' | 'gorge').
 * @typedef {object} Stage
 * @property {string} name
 * @property {string} blurb
 * @property {'tarmac'|'gravel'|'snow'} surface
 * @property {number} seed                 random seed for layout, terrain and scenery
 * @property {number} [laps]               circuits only
 * @property {'loop'|'pass'|'gorge'} [type]
 * @property {Array} [plan]                downhill: [['st'|'sw'|'sb', arg], ...] straight / sweepers / switchbacks
 * @property {Segment[]} [segs]            'gorge' circuits: the road, section by section
 * @property {{on: number, with: number}} [traffic]  oncoming / same-way civilian cars kept alive
 * @property {{pts: number[][], level: number, width: number, logs?: number, frozen?: boolean}} [river]
 * @property {RailDef[]} [rails]
 * @property {object} colors               terrain, road, sky and scenery palette
 * @property {object} light                sun/fill light, cloud shadows, colour grade, optional valley haze
 * @property {boolean} [armco]             fences are metal guard rail (bends) instead of wood
 * @property {boolean} [viaduct]           bridges are stone viaducts
 */

/**
 * One section of a 'gorge' circuit in screen axes (a = right, b = up-screen; the camera looks from below).
 *   ['s', length | {toA} | {toB}, endHeight, tags]   straight
 *   ['a', radius, degrees (+ = left), endHeight, tags] arc
 * @typedef {Array} Segment
 */

/**
 * Section tags. far/near: ground height relative to the road on the up-screen / camera side (negative = drop),
 * reached over rampF/rampN metres (small = sheer).
 * @typedef {object} SegmentTags
 * @property {number} [far] @property {number} [near] @property {number} [rampF] @property {number} [rampN]
 * @property {boolean} [bridge] @property {boolean} [tunnel] @property {boolean} [jump]
 * @property {boolean} [town] @property {boolean} [gallery] @property {boolean} [rockfall]
 * @property {number} [kick]              kicker jump of this height (m) at the start of the section
 * @property {boolean} [arch]             scenery rock arch over the middle of the section
 * @property {boolean} [gap]              a void to jump; @property {boolean} [boost]  boost pads; @property {boolean} [ferry]  barge crossing (see core/elements)
 */

/**
 * @typedef {object} RailDef
 * @property {string} id
 * @property {number[][]} pts             [a, b, height] points; corners rounded by `round`
 * @property {number} [round] @property {boolean} [portals]  ends hidden inside hills
 * @property {number} speed @property {number} cars @property {number} body @property {number} coach @property {number} band
 */

/**
 * A built track: arrays indexed by road sample (1 m apart). Circuits are unrolled lap after lap (`loopN` samples
 * per lap), so progress just keeps increasing.
 * @typedef {object} Track
 * @property {number} N @property {number} [loopN] @property {number} [laps]
 * @property {Float32Array} xs @property {Float32Array} zs @property {Float32Array} H   centre line and height
 * @property {Float32Array} th @property {Float32Array} tx @property {Float32Array} tz  heading and tangent
 * @property {Float32Array} rx @property {Float32Array} rz                              right-hand normal
 * @property {Float32Array} ks                                                          smoothed curvature
 * @property {Uint8Array} wallL @property {Uint8Array} wallR  0 none, 1 tyres, 2 fence/armco, 3 hay, 4 bridge rail, 5 tunnel/gallery, 6 rock face, 7 town bollards
 * @property {Uint8Array} bridge @property {Uint8Array} tunnel @property {Uint8Array} jump
 * @property {number} startIdx @property {number} finishIdx
 * @property {Function} nearest            (x, z) -> {i, d} nearest road sample
 * @property {object} [rails] @property {object} [river] @property {Uint8Array} [town] @property {Uint8Array} [gallery] @property {Uint8Array} [rockfall]
 */

/**
 * What the simulation runs against.
 * @typedef {object} World
 * @property {Track} tr @property {object} terr  terrain grid with at(x, z)
 * @property {'tarmac'|'gravel'|'snow'} surf @property {boolean} armco @property {object} [traffic]
 * @property {object} [bar]                 barrier damage state (created per race)
 */

/**
 * A car (racer, traffic or parked). Positions in metres, velocities in m/s.
 * @typedef {object} Car
 * @property {number} x @property {number} y @property {number} z @property {number} yaw
 * @property {number} vx @property {number} vy @property {number} vz
 * @property {{throttle: number, brake: number, steer: number, handbrake: number}} inp
 * @property {{i: number, s: number, lat: number, dist: number}} pr   position projected onto the road
 * @property {{f: number, b: number, l: number, r: number}} dmg     damage per zone, 0..1
 * @property {object[]} events              things that happened this step, for the renderer/audio ({t: 'hit' | 'smash' | 'wreck' | ...})
 * @property {boolean} isPlayer @property {boolean} [traffic] @property {boolean} [parked] @property {boolean} finished
 */

/**
 * @typedef {object} Race
 * @property {Car[]} cars @property {Car} player @property {number} time @property {'grid'|'racing'} phase
 * @property {Function} rnd                  seeded random numbers for race features
 * @property {Car[]} traffic @property {Car[]} parked @property {object[]} trains @property {object[]} rocks
 */
export {};
