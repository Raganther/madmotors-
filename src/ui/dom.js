export const $ = id => document.getElementById(id);
export const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
export function isTouchDevice() { return matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; }
