// The race tracks: twenty songs, each a style. A song is data for music.js to play:
//   bpm, swing (0..0.3: how late the off 16ths fall), key (the tonic, semitones from A), scale (for the melody)
//   A / B   four chords each (names: Am, F#m7, Bb, C5, Gsus4, Dmaj7, E7, Bdim...): the verse and the bridge
//   drums   patterns over 16 steps (x hit, X accent): k kick, s snare, c clap, h hat, o open hat, r ride, t tom;
//           `kit` acoustic | 808 | chip | trap; `half` the break's pattern
//   bass    pat: one character a 16th: r root, o root an octave up, f the fifth, 7 the flat seventh, w a walk
//           toward the next chord, . hold, - rest; wave, cut (filter Hz), env (filter sweep), q, oct, wob (a
//           wobble every n steps), acid (squelch), dist (drive)
//   comp    the chords: pad | stab (on pat) | skank (off-beat chops) | power (driven fifths, on pat) | arp
//           (up / updown / oct / rand, every `rate` steps) | keys (soft stabs) | none; wave, cut, oct, gate (a
//           trance gate: 16ths chopped)
//   lead    wave saw | square | pulse | tri | sine; det (cents apart, two voices), oct, vib (vibrato depth),
//           echo (0..1), glide (s), trem (tremolo-picked: each note repeated as 16ths), dist, feel (the rhythm
//           its motifs are drawn from: drive | sparse | sync | busy | lazy), line (hand-written lines instead)
//   crackle (a record's surface noise), lift (up a step the second time round)
// The melodies of all but the first are generated (music.js melody): motifs that follow the chords, bar 3
// answering bar 1, ending home. Seeded by the song's name, so a song is the same every time.
const HOOK = [
  [[0, 7, 3], [3, 5, 1], [4, 3, 2], [6, 5, 2], [8, 7, 4], [12, 10, 2], [14, 12, 2]], [[0, 10, 3], [3, 7, 1], [4, 5, 2], [6, 3, 2], [8, 5, 6]],
  [[0, 7, 2], [2, 10, 2], [4, 15, 4], [8, 14, 2], [10, 10, 2], [12, 7, 4]], [[0, 5, 3], [3, 2, 1], [4, 5, 2], [6, 10, 2], [8, 5, 8]]];
const HOOK2 = [
  [[0, 12, 2], [2, 10, 2], [4, 7, 2], [6, 10, 2], [8, 12, 3], [11, 15, 1], [12, 14, 4]], [[0, 12, 2], [2, 10, 2], [4, 8, 4], [8, 7, 2], [10, 5, 2], [12, 3, 4]],
  [[0, 7, 2], [2, 3, 2], [4, 7, 2], [6, 10, 2], [8, 15, 4], [12, 14, 2], [14, 12, 2]], [[0, 10, 4], [4, 14, 4], [8, 17, 8]]];
const BRIDGE = [
  [[0, 12, 4], [4, 8, 2], [6, 7, 2], [8, 5, 8]], [[0, 3, 2], [2, 5, 2], [4, 8, 4], [8, 12, 4], [12, 15, 4]],
  [[0, 7, 8], [8, 12, 4], [12, 10, 4]], [[0, 11, 4], [4, 14, 4], [8, 19, 8]]];
const SC = { minor: [0, 2, 3, 5, 7, 8, 10], major: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], mixo: [0, 2, 4, 5, 7, 9, 10], harm: [0, 2, 3, 5, 7, 8, 11],
  phryg: [0, 1, 4, 5, 7, 8, 10], penta: [0, 3, 5, 7, 10], blues: [0, 3, 5, 6, 7, 10], majpenta: [0, 2, 4, 7, 9] };
const D = {   // drum patterns used by several songs
  rock: { k: 'x--x--x-x-------', s: '----x-------x---', h: 'x-x-x-x-x-x-x-x-' },
  four: { k: 'x---x---x---x---', c: '----x-------x---', h: '--x---x---x---x-', o: '--x---x---x---x-' },
  half: { k: 'x-------x-------', s: '------------x---', h: 'x---x---x---x---' }
};
export const SONGS = [
  { name: 'Downhill Rush', style: 'Synth rock: the theme', bpm: 140, key: 0, scale: SC.minor, A: ['Am', 'F', 'C', 'G'], B: ['Dm', 'F', 'Am', 'E'],
    drums: { kit: 'acoustic', k: 'x--x----x-x-----', s: '----x-------x---', h: 'x-x-x-x-x-x-x-x-', half: D.half }, bass: { pat: 'r-o-r-o-r-o-r-o-', wave: 'saw', cut: 1400, q: 5 },
    comp: { type: 'arp', arp: 'up', rate: 1, wave: 'square', cut: 2600 }, lead: { wave: 'saw', det: 7, echo: 0.3, vib: 0.006, line: { A: HOOK, A2: HOOK2, B: BRIDGE } } },
  { name: 'Neon Drive', style: 'Synthwave: gated pads, a big snare, 80s night', bpm: 112, key: -4, scale: SC.minor, A: ['Fm', 'Db', 'Ab', 'Eb'], B: ['Bbm', 'Db', 'Fm', 'C'],
    drums: { kit: 'acoustic', k: 'x-------x-------', s: '----X-------X---', h: 'x-x-x-x-x-x-x-x-', half: D.half, big: 1 }, bass: { pat: 'rrrrrrrrrrrrrrrr', wave: 'saw', cut: 700, env: 900, q: 3 },
    comp: { type: 'pad', wave: 'saw', cut: 1500 }, lead: { wave: 'saw', det: 12, oct: 0, echo: 0.45, vib: 0.008, glide: 0.04, feel: 'sparse' } },
  { name: 'Breakbeat Canyon', style: 'Breakbeat: chopped drums, a growling reese bass', bpm: 134, key: -5, scale: SC.dorian, A: ['Em7', 'Em7', 'Cmaj7', 'D'], B: ['Am7', 'C', 'Em7', 'B7'],
    drums: { kit: 'acoustic', k: 'x-x-------x--x--', s: '----x--x-x--x---', h: 'x-xxx-x-x-xxx-x-', half: { k: 'x-------x-------', s: '----x-------x---', h: 'x-x-x-x-x-x-x-x-' } },
    bass: { pat: 'r.....-r.-r.....', wave: 'saw', cut: 500, q: 2, oct: -1, det: 18 }, comp: { type: 'stab', pat: 'x-----x---x-----', wave: 'square', cut: 1800 }, lead: { wave: 'pulse', echo: 0.35, feel: 'sync' } },
  { name: 'Chiptune Rally', style: '8-bit: square leads and noise drums, a handheld from 1990', bpm: 152, key: 3, scale: SC.major, A: ['C', 'Am', 'F', 'G'], B: ['F', 'G', 'Em', 'Am'],
    drums: { kit: 'chip', k: 'x-----x-x-------', s: '----x-------x---', h: 'x-x-x-x-x-x-x-x-', half: D.half }, bass: { pat: 'r-o-r-o-r-o-r-o-', wave: 'tri', cut: 4000, q: 0.5 },
    comp: { type: 'arp', arp: 'oct', rate: 1, wave: 'square', cut: 6000, vol: 0.6 }, lead: { wave: 'square', echo: 0, vib: 0.01, feel: 'busy' } },
  { name: 'Surf Panic', style: 'Surf rock: tremolo-picked twang, a galloping beat', bpm: 168, key: -5, scale: SC.harm, A: ['Em', 'Em', 'C', 'B7'], B: ['Am', 'Em', 'C', 'B7'],
    drums: { kit: 'acoustic', k: 'x-x---x-x-x---x-', s: '----x-------x---', h: 'x-x-x-x-x-x-x-x-', half: D.half }, bass: { pat: 'r-r-f-o-r-r-f-7-', wave: 'tri', cut: 1200, q: 1 },
    comp: { type: 'stab', pat: 'x--x--x---x--x--', wave: 'saw', cut: 2400 }, lead: { wave: 'saw', det: 4, trem: 1, echo: 0.25, feel: 'sparse', cut: 3000 } },
  { name: 'Drum & Bass Overdrive', style: 'Drum and bass: a two-step break at 174, a sub you feel', bpm: 174, key: 5, scale: SC.minor, A: ['Dm', 'Dm', 'Bb', 'C'], B: ['Gm', 'Bb', 'Dm', 'A'],
    drums: { kit: 'acoustic', k: 'x---------x-----', s: '----x-------x---', h: 'x-xxx-x-x-xxx-xx', half: { k: 'x-------x-------', h: 'x-x-x-x-x-x-x-x-' } }, bass: { pat: 'r.......-.r.....', wave: 'sine', cut: 300, oct: -1 },
    comp: { type: 'pad', wave: 'saw', cut: 900 }, lead: { wave: 'tri', echo: 0.5, vib: 0.01, feel: 'sparse', oct: 1 } },
  { name: 'Funk Wheels', style: 'Funk: a slap of bass, clavinet chops, a swung groove', bpm: 106, swing: 0.18, key: -5, scale: SC.dorian, A: ['Em7', 'A7', 'Em7', 'A7'], B: ['Cmaj7', 'B7', 'Em7', 'A7'],
    drums: { kit: 'acoustic', k: 'x--x--x---x--x--', s: '----x--x-x--x---', h: 'xxxxxxxxxxxxxxxx', half: D.half }, bass: { pat: 'r--o-r-7-r-of-r-', wave: 'square', cut: 1100, env: 1400, q: 4 },
    comp: { type: 'skank', pat: '--x-x--x--x-x-xx', wave: 'square', cut: 2400 }, lead: { wave: 'pulse', echo: 0.15, feel: 'sync' } },
  { name: 'Desert Heat', style: 'Desert: Phrygian scales, hand drums and claps', bpm: 122, key: -5, scale: SC.phryg, A: ['E', 'F', 'E', 'Dm'], B: ['Am', 'G', 'F', 'E'],
    drums: { kit: '808', k: 'x--x--x---x-----', c: '----x--x----x---', t: 'x--x---x-x---x--', h: '--x---x---x---x-', half: { t: 'x--x--x---x--x--', h: 'x-x-x-x-x-x-x-x-' } },
    bass: { pat: 'r-.r-.r-r-.r-.f-', wave: 'saw', cut: 800, q: 3 }, comp: { type: 'arp', arp: 'updown', rate: 2, wave: 'tri', cut: 3000 }, lead: { wave: 'saw', det: 3, vib: 0.02, echo: 0.35, glide: 0.06, feel: 'lazy' } },
  { name: 'Eurobeat Drift', style: 'Eurobeat: octave bass, off-beat hats, a bright saw hook', bpm: 156, key: 1, scale: SC.minor, A: ['Bbm', 'Gb', 'Ab', 'Fm'], B: ['Gb', 'Ab', 'Bbm', 'Bbm'],
    drums: { kit: 'acoustic', k: 'x---x---x---x---', s: '----x-------x---', o: '--x---x---x---x-', half: D.half }, bass: { pat: 'r-o-r-o-r-o-r-o-', wave: 'saw', cut: 1600, q: 2 },
    comp: { type: 'stab', pat: '--x---x---x---x-', wave: 'saw', cut: 2800 }, lead: { wave: 'saw', det: 10, echo: 0.3, feel: 'busy' } },
  { name: 'Garage Punk', style: 'Punk: driven power chords, fast and loose', bpm: 182, key: -5, scale: SC.minor, A: ['E5', 'C5', 'G5', 'D5'], B: ['A5', 'C5', 'E5', 'B5'],
    drums: { kit: 'acoustic', k: 'x---x---x---x---', s: '--x---x---x---x-', h: 'x-x-x-x-x-x-x-x-', half: D.rock }, bass: { pat: 'rrrrrrrrrrrrrrrr', wave: 'saw', cut: 900, dist: 1 },
    comp: { type: 'power', pat: 'x-x-x-x-x-x-x-x-', cut: 2200 }, lead: { wave: 'saw', dist: 1, echo: 0.1, feel: 'drive', cut: 2600 } },
  { name: 'Ska Skid', style: 'Ska: off-beat chops, a walking bass, horns', bpm: 160, key: 3, scale: SC.major, A: ['C', 'F', 'G', 'C'], B: ['Am', 'F', 'D7', 'G'],
    drums: { kit: 'acoustic', k: 'x-------x-------', s: '----x-------x---', h: '--x---x---x---x-', half: D.half }, bass: { pat: 'r-w-f-w-r-w-f-w-', wave: 'tri', cut: 1500 },
    comp: { type: 'skank', pat: '--x---x---x---x-', wave: 'square', cut: 3000 }, lead: { wave: 'saw', det: 6, cut: 2200, echo: 0.1, feel: 'sync', brass: 1 } },
  { name: 'House Lap', style: 'House: four to the floor, piano stabs, an open hat on every off-beat', bpm: 124, key: -2, scale: SC.minor, A: ['Gm7', 'Ebmaj7', 'Bb', 'F'], B: ['Cm7', 'Ebmaj7', 'Gm7', 'D7'],
    drums: { kit: '808', ...D.four, half: { k: 'x---x---x---x---', h: '--x---x---x---x-' } }, bass: { pat: '--r---r---r---ro', wave: 'saw', cut: 600, env: 500, q: 4 },
    comp: { type: 'keys', pat: 'x--x--x---x--x--', cut: 3500 }, lead: { wave: 'tri', echo: 0.4, feel: 'sparse', oct: 1 } },
  { name: 'Big Beat Smash', style: 'Big beat: heavy breaks and a squelching acid bass', bpm: 128, key: 0, scale: SC.blues, A: ['Am', 'Am', 'C', 'D'], B: ['F', 'G', 'Am', 'Am'],
    drums: { kit: 'acoustic', k: 'X--x--x-x-x-----', s: '----X-------X--x', h: 'x-x-x-x-x-x-x-x-', half: D.half }, bass: { pat: 'rro-r7rorfr-orr7', wave: 'saw', cut: 400, env: 2600, q: 14, acid: 1 },
    comp: { type: 'none' }, lead: { wave: 'square', echo: 0.3, dist: 1, feel: 'sync' } },
  { name: 'Spaghetti Showdown', style: 'Western: a whistled tune over a galloping rhythm', bpm: 96, key: 0, scale: SC.minor, A: ['Am', 'G', 'F', 'E'], B: ['Dm', 'Am', 'F', 'E'],
    drums: { kit: 'acoustic', k: 'x--x--x-x--x--x-', h: '--x---x---x---x-', t: 'x-------x-------', half: { k: 'x-------x-------' } }, bass: { pat: 'r--f--r-r--f--o-', wave: 'tri', cut: 900 },
    comp: { type: 'arp', arp: 'up', rate: 1, wave: 'tri', cut: 2000 }, lead: { wave: 'sine', vib: 0.025, echo: 0.55, glide: 0.08, oct: 1, feel: 'lazy' } },
  { name: 'Trance Summit', style: 'Trance: a supersaw gate, rolling off-beat bass, a soaring lead', bpm: 138, key: 0, scale: SC.minor, A: ['Am', 'F', 'C', 'G'], B: ['F', 'G', 'Em', 'Am'],
    drums: { kit: '808', k: 'x---x---x---x---', c: '----x-------x---', o: '--x---x---x---x-', half: { o: '--x---x---x---x-' } }, bass: { pat: '-rr-rr-rr-rr-rr-', wave: 'saw', cut: 900, env: 600, q: 3 },
    comp: { type: 'pad', wave: 'saw', cut: 2500, gate: 1, sup: 1 }, lead: { wave: 'saw', det: 14, echo: 0.5, oct: 1, feel: 'drive' } },
  { name: 'Jazz Hatchback', style: 'Jazz: a swung ride, a walking bass, vibes on a ii-V-I', bpm: 150, swing: 0.3, key: -4, scale: SC.major, A: ['Gm7', 'C7', 'Fmaj7', 'Dm7'], B: ['Gm7', 'C7', 'Am7', 'D7'],
    drums: { kit: 'acoustic', k: 'x-------------x-', r: 'x---x-x-x---x-x-', s: '------x-------x-', h: '----x-------x---', half: { r: 'x---x-x-x---x-x-' } }, bass: { pat: 'r---w---f---w---', wave: 'tri', cut: 1000 },
    comp: { type: 'keys', pat: '---x-----x----x-', cut: 2600 }, lead: { wave: 'sine', vib: 0.004, echo: 0.2, feel: 'sync', vibes: 1, oct: 1 } },
  { name: 'Dubstep Demolition', style: 'Dubstep: half-time drums and a wobbling bass', bpm: 140, key: 5, scale: SC.minor, A: ['Dm', 'Dm', 'Bb', 'A'], B: ['Gm', 'Gm', 'Bb', 'A'],
    drums: { kit: '808', k: 'x-----x---x-----', s: '--------X-------', h: 'x-x-x-x-x-x-x-xx', half: { k: 'x---------------', h: 'x---x---x---x---' } }, bass: { pat: 'r...............', wave: 'saw', cut: 500, q: 8, wob: 4, oct: -1, dist: 1 },
    comp: { type: 'pad', wave: 'saw', cut: 800 }, lead: { wave: 'square', echo: 0.45, feel: 'sparse', oct: 1 } },
  { name: 'Metal Mayhem', style: 'Metal: double kick, chugging guitars, a screaming lead', bpm: 172, key: -5, scale: SC.harm, A: ['E5', 'E5', 'C5', 'D5'], B: ['A5', 'G5', 'F5', 'B5'],
    drums: { kit: 'acoustic', k: 'xxxxxxxxxxxxxxxx', s: '----X-------X---', h: 'x---x---x---x---', half: D.rock }, bass: { pat: 'r-rr-rr-r-rr-r-r', wave: 'saw', cut: 700, dist: 1 },
    comp: { type: 'power', pat: 'x-xx-xx-x-xx-x-x', cut: 1800 }, lead: { wave: 'saw', dist: 1, vib: 0.015, echo: 0.2, feel: 'busy', oct: 1, cut: 3200 } },
  { name: 'Lo-fi Cruise', style: 'Lo-fi: lazy swung beats, soft keys, a dusty record', bpm: 84, swing: 0.22, key: 5, scale: SC.major, A: ['Dmaj7', 'Bm7', 'Em7', 'A7'], B: ['Gmaj7', 'F#m7', 'Em7', 'A7'],
    drums: { kit: 'acoustic', k: 'x------x--x-----', s: '----x-------x---', h: 'x-x-x-x-x-x-x-x-', half: D.half, soft: 1 }, bass: { pat: 'r------r--f-----', wave: 'sine', cut: 600 },
    comp: { type: 'keys', pat: 'x-------x-----x-', cut: 1600 }, lead: { wave: 'tri', vib: 0.008, echo: 0.35, feel: 'lazy', cut: 1800 }, crackle: 1 },
  { name: 'Arcade Turbo', style: 'Arcade fusion: chip arps over synth bass, and a key change', bpm: 146, key: 4, scale: SC.minor, A: ['C#m', 'A', 'B', 'G#m'], B: ['A', 'B', 'C#m', 'G#'],
    drums: { kit: 'chip', k: 'x---x---x---x---', s: '----x-------x---', h: 'xxxxxxxxxxxxxxxx', half: D.half }, bass: { pat: 'r-ro-rr-r-ro-rr-', wave: 'square', cut: 1300, q: 4 },
    comp: { type: 'arp', arp: 'rand', rate: 1, wave: 'square', cut: 5000, vol: 0.6 }, lead: { wave: 'saw', det: 8, echo: 0.3, feel: 'drive' }, lift: 2 }
];
