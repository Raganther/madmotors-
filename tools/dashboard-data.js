// The economy numbers the pacing dashboard quotes (tools/dashboard.mjs), from the sheet itself.
import { SLOTS } from '../src/data/parts.js';
export { CAR_BASE } from '../src/data/economy.js';
export const COST_TABLE = SLOTS.slice(0, 1).map(s => s.price.map(p => '$' + p.toLocaleString('en-US')).join(' / ')).join('') + ' (engine; each level 2.5x the last)';
export const PART1 = SLOTS[0].price[0];
