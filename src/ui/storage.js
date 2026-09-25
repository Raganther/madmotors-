// ---------- persistence ----------
export const BEST_KEY = 'downhill-rush-best-v1';
export let best = {};
try { best = JSON.parse(localStorage.getItem(BEST_KEY) || '{}') || {}; } catch (e) { best = {}; }
export function saveBest() { try { localStorage.setItem(BEST_KEY, JSON.stringify(best)); } catch (e) { } }
export const MODE_KEY = 'downhill-rush-mode';
export function loadMode() { try { const m = localStorage.getItem(MODE_KEY); return m === 'showdown' ? 'showdown' : 'race'; } catch (e) { return 'race'; } }
export function saveMode(m) { try { localStorage.setItem(MODE_KEY, m); } catch (e) { } }
export const STEER_KEY = 'downhill-rush-steer';
export function loadSteer() { try { return localStorage.getItem(STEER_KEY) === 'arrows' ? 'arrows' : 'wheel'; } catch (e) { return 'wheel'; } }
export function saveSteer(m) { try { localStorage.setItem(STEER_KEY, m); } catch (e) { } }
export const CAM_KEY = 'downhill-rush-camera';
export function loadCamera() { try { return JSON.parse(localStorage.getItem(CAM_KEY) || '{}') || {}; } catch (e) { return {}; } }
export function saveCamera(c) { try { localStorage.setItem(CAM_KEY, JSON.stringify(c)); } catch (e) { } }
export const VEH_KEY = 'downhill-rush-vehicle';
export function loadVehicle() { try { return localStorage.getItem(VEH_KEY) || 'coupe'; } catch (e) { return 'coupe'; } }
export function saveVehicle(id) { try { localStorage.setItem(VEH_KEY, id); } catch (e) { } }
