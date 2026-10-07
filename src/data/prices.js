// Cost curves (G4), shared by the part, weapon and car prices (data/economy.js has the rest of the sheet). Pure: no
// imports, so data/parts.js and data/weapons.js can use it without a cycle through the ratings.
/** How much dearer each level of an upgrade is than the one before. */
export const COST_GROW = 2.5;
/** The prices of levels 1..n of something whose first level costs `base`, rounded to $250. */
export const costCurve = (base, n = 3, grow = COST_GROW) => Array.from({ length: n }, (_, i) => Math.round(base * grow ** i / 250) * 250);
