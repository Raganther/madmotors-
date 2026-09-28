import fs from 'node:fs';
import path from 'node:path';
import { STAGES } from '../src/core/index.js';
import { SANDBOXES } from '../src/data/sandboxes/index.js';
/** Resolve a stage from a CLI argument: 1-based number, (part of) its name, sandbox:<name>, or a .json file (a track the
 *  user sent from the editor, as ArtifactData saves it: its `stage`, with `comments` kept). Defaults to the last stage.
 *  Returns { stage, id, comments } where id names output files. */
export function stageArg(arg) {
  if (arg && arg.endsWith('.json')) {
    const j = JSON.parse(fs.readFileSync(arg, 'utf8')), d = j.data || j;
    return { stage: d.stage || d, id: 'file-' + path.basename(arg, '.json'), comments: d.comments || [] };
  }
  if (arg && arg.startsWith('sandbox:')) {
    const k = arg.slice(8); if (!SANDBOXES[k]) throw new Error(`no sandbox "${k}"; sandboxes: ${Object.keys(SANDBOXES).join(', ')}`);
    return { stage: SANDBOXES[k], id: 'sandbox-' + k };
  }
  const i = stageFromArg(arg); return { stage: STAGES[i], id: String(i + 1) };
}
export function stageFromArg(arg) {
  if (!arg) return STAGES.length - 1;
  const n = Number(arg); if (Number.isInteger(n) && n >= 1 && n <= STAGES.length) return n - 1;
  const i = STAGES.findIndex(s => s.name.toLowerCase().includes(String(arg).toLowerCase()));
  if (i < 0) throw new Error(`no stage matching "${arg}"; stages: ${STAGES.map((s, k) => `${k + 1} ${s.name}`).join(', ')}, or sandbox:<${Object.keys(SANDBOXES).join('|')}>`);
  return i;
}
