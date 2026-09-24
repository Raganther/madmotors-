// ---------- persistence ----------
export const BEST_KEY = 'downhill-rush-best-v1';
export let best = {};
try { best = JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch (e) { best = {}; }
export function saveBest() { try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) { } }
