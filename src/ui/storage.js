// ---------- persistence ----------
export const BEST_KEY = 'downhill-rush-best-v1';
export let best = {};
try { best = JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch (e) { best = {}; }
export function saveBest() { try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) { } }
export const MODE_KEY = 'downhill-rush-mode';
export function loadMode() { try { const m = localStorage.getItem(MODE_KEY); return m === 'showdown' ? 'showdown' : 'race'; } catch (e) { return 'race'; } }
export function saveMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch (e) { } }
