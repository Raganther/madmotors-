import { STAGES } from '../src/core/index.js';
/** Resolve a stage from a CLI argument: 1-based number or (part of) its name. Defaults to the last stage. */
export function stageFromArg(arg) {
  if (!arg) return STAGES.length - 1;
  const n = Number(arg); if (Number.isInteger(n) && n >= 1 && n <= STAGES.length) return n - 1;
  const i = STAGES.findIndex(s => s.name.toLowerCase().includes(String(arg).toLowerCase()));
  if (i < 0) throw new Error(`no stage matching "${arg}"; stages: ${STAGES.map((s, k) => `${k + 1} ${s.name}`).join(', ')}`);
  return i;
}
