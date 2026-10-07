import * as THREE from 'three';
import { VEHICLES } from '../data/vehicles.js';
import { STAGES } from '../data/stages/index.js';
import { CAR_HL, CAR_HW } from '../core/constants.js';
import { buildCarModel, setCarDetail, HD_COL } from '../render/carmodels.js';
import { setCarEnvironment } from '../render/carpaint.js';
import { dentMesh, repairCarVis } from '../render/vehicles.js';
import { panelStep, updatePanels } from '../render/anatomy.js';
import { decodePack, packIds, packOf, packTris } from '../render/assets/index.js';
import MANIFEST from '../assets/gen/manifest.json';
import { G } from '../game.js';
import { PART_MAX, SLOTS } from '../data/parts.js';
import { ratingOf } from '../data/ratings.js';
import { DISCIPLINES, discsOf } from '../data/disciplines.js';

// The Asset Lab (?lab, the menu's Asset Lab button, or its own build: `npm run lab`): every asset on a turntable,
// Classic and Blender side by side in turn, near and far detail, wireframe, triangles and draw calls, under any stage's
// light, from the studio or the race camera; cars can be dented, lose their bumper and wing, have their panels bent,
// swung open and taken off (render/anatomy.js), and be repaired. Notes
// on an asset go to the artifact's database ("assetNotes": asset, provider, text; Claude answers in `reply`).
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const CSS = `
#lab{position:fixed;inset:0;display:flex;font:14px/1.35 system-ui,sans-serif;color:#E8ECF4;background:#141828;z-index:100}
#lab-side{width:250px;flex:none;overflow-y:auto;background:#1C2340;padding:10px;box-sizing:border-box}
#lab-side h1{font:700 18px system-ui;margin:4px 0 8px} #lab-side h2{font:600 12px system-ui;text-transform:uppercase;letter-spacing:.06em;color:#9AA6C4;margin:12px 0 4px}
#lab button{cursor:pointer}#lab-back,#lab-ns{background:#FFC72C;color:#1C2340;border:0;border-radius:7px;padding:6px 10px;font:600 13px system-ui}
#lab-list button{display:flex;justify-content:space-between;width:100%;text-align:left;background:none;border:0;color:inherit;padding:5px 6px;border-radius:6px;cursor:pointer;font:inherit}
#lab-list button.on{background:#FFC72C;color:#1C2340} #lab-list small{opacity:.7}
#lab-view{flex:1;position:relative;min-width:0} #lab-view canvas{display:block;width:100%;height:100%}
#lab-bar{position:absolute;left:10px;right:10px;top:10px;display:flex;flex-wrap:wrap;gap:6px}
#lab-bar button,#lab-bar select,#lab-bar input{background:rgba(28,35,64,.88);color:#fff;border:1px solid #3A4570;border-radius:7px;padding:6px 9px;font:inherit}
#lab-bar button.on{background:#FFC72C;color:#1C2340;border-color:#FFC72C} #lab-bar input[type=color]{padding:1px;width:40px;height:32px}
#lab-parts{position:absolute;right:10px;top:96px;display:flex;flex-direction:column;gap:4px}#lab-parts button{background:rgba(28,35,64,.88);color:#fff;border:1px solid #3A4570;border-radius:7px;padding:4px 8px;font:12px system-ui;text-align:left;min-width:150px}#lab-parts button.on{border-color:#FFC72C}
#lab-stats{position:absolute;left:10px;bottom:10px;background:rgba(16,20,40,.85);padding:8px 10px;border-radius:8px;font:12px/1.4 ui-monospace,Menlo,monospace;white-space:pre}
#lab-notes{position:absolute;right:10px;bottom:10px;width:min(320px,calc(100% - 20px));background:rgba(16,20,40,.9);padding:8px;border-radius:8px;box-sizing:border-box}
#lab-notes textarea{width:100%;box-sizing:border-box;height:52px;border-radius:6px;border:0;padding:6px;font:inherit}
#lab-notes .n{border-top:1px solid #333C60;padding:4px 0;font-size:13px} #lab-notes .r{color:#8FE08F}
#lab-notes ul{max-height:160px;overflow-y:auto;margin:4px 0;padding:0;list-style:none}
@media (max-width:700px){#lab{flex-direction:column}#lab-side{width:auto;height:30%}#lab-parts{position:absolute;right:10px;top:96px;display:flex;flex-direction:column;gap:4px}#lab-parts button{background:rgba(28,35,64,.88);color:#fff;border:1px solid #3A4570;border-radius:7px;padding:4px 8px;font:12px system-ui;text-align:left;min-width:150px}#lab-parts button.on{border-color:#FFC72C}
#lab-stats{display:none}}`;
// scenery tints in the lab, as a green stage would give them (the game tints each instance itself)
const TINT = { hay: 0xE2C265, concrete: 0xC9C6BE, pine: 0x3E7447, leaf: 0x4F8A3F, bark: 0x6B4A32, rock: 0xA29E92, wall: 0xEADBC4, roof: 0xB5523B, cactus: 0x5F7F3C, snow: 0xF2F6FA, shirt: 0x2F7DE0, skin: 0xE0B08A };
// what a car's rig reads (render/carmodels.js anim): a car cruising with a little throttle
const FAKE = { boost: 0, speed: 20, vx: 0, vz: 20, yaw: 0, inp: { throttle: 0.6, steer: 0 }, dmg: { f: 0, b: 0 } };
let R, scene, cam, sun, hemi, holder, cur = null, db = null, notes = [];
const S = { build: {}, lift: 0, pan: -1, id: VEHICLES[0].id, provider: 'blender', near: true, wire: false, spin: true, view: 'studio', stage: 0, color: null, a: -0.25 };
// what can be shown: every vehicle (Classic always, Blender when packed), then any other packed asset
function items() {
  const out = VEHICLES.map(v => ({ id: v.id, label: v.name, fam: 'cars', pack: 'car-' + v.model, def: v }));
  for (const id of packIds()) if (!id.startsWith('car-')) out.push({ id, label: id, fam: MANIFEST[id].family, pack: id });
  return out;
}
const itemOf = id => items().find(i => i.id === id);
export function startLab() {
  G.lab = true;
  for (const el of document.body.children) if (el.tagName !== 'SCRIPT') el.hidden = true;
  const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
  const L = document.createElement('div'); L.id = 'lab'; document.body.appendChild(L);
  L.innerHTML = `<div id="lab-side"><h1>Asset Lab</h1><button id="lab-back" type="button">Back to the game</button><h2>Assets</h2><div id="lab-list"></div></div>
  <div id="lab-view"><div id="lab-bar">
    <button data-p="blender">Blender</button><button data-p="classic">Classic</button>
    <button id="lab-lod">Near detail</button><button id="lab-wire">Wireframe</button><button id="lab-spin">Turntable</button><button id="lab-cam">Studio view</button>
    <select id="lab-stage"></select><input id="lab-col" type="color" title="Paint">
    <button id="lab-dent">Dent</button><button id="lab-bump">Knock bumper</button><button id="lab-wing">Knock wing</button><button id="lab-pan">Panels: bend</button><button id="lab-fix">Repair</button>
  </div><div id="lab-parts"></div><pre id="lab-stats"></pre>
  <div id="lab-notes"><b>Notes on this asset</b><ul id="lab-nl"></ul><textarea id="lab-nt" placeholder="What would you change? (goes to Claude)"></textarea><button id="lab-ns" type="button">Send to Claude</button> <span id="lab-nm"></span></div></div>`;
  const $ = id => document.getElementById(id), view = $('lab-view');
  R = new THREE.WebGLRenderer({ antialias: true }); R.setPixelRatio(Math.min(devicePixelRatio || 1, 2)); R.shadowMap.enabled = true;
  view.insertBefore(R.domElement, view.firstChild);
  scene = new THREE.Scene(); cam = new THREE.PerspectiveCamera(35, 1, 0.1, 200);
  hemi = new THREE.HemisphereLight(0xE8F4FF, 0x6B7A4A, 0.62); scene.add(hemi);
  sun = new THREE.DirectionalLight(0xFFF1DC, 0.9); sun.position.set(-6, 12, -4); sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -5, right: 5, top: 5, bottom: -5 }); scene.add(sun);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(7, 48).rotateX(-Math.PI / 2), new THREE.MeshLambertMaterial({ color: 0x8C8F94 })); floor.receiveShadow = true; scene.add(floor);
  holder = new THREE.Group(); scene.add(holder);
  $('lab-stage').innerHTML = STAGES.map((s, i) => `<option value="${i}">${esc(s.name)}</option>`).join('');
  const resize = () => { const w = view.clientWidth, h = view.clientHeight; R.setSize(w, h, false); R.domElement.style.width = '100%'; R.domElement.style.height = '100%'; cam.aspect = w / h; cam.updateProjectionMatrix(); };
  addEventListener('resize', resize); resize();
  $('lab-back').onclick = () => location.reload();
  $('lab-list').onclick = e => { const b = e.target.closest('[data-id]'); if (b) { S.id = b.dataset.id; S.color = null; show(); } };
  for (const b of document.querySelectorAll('#lab-bar [data-p]')) b.onclick = () => { S.provider = b.dataset.p; show(); };
  $('lab-lod').onclick = () => { S.near = !S.near; applyView(); };
  $('lab-wire').onclick = () => { S.wire = !S.wire; applyView(); };
  $('lab-spin').onclick = () => { S.spin = !S.spin; applyView(); };
  $('lab-cam').onclick = () => { S.view = S.view === 'studio' ? 'race' : 'studio'; applyView(); };
  $('lab-stage').onchange = e => { S.stage = +e.target.value; light(); };
  $('lab-col').oninput = e => { S.color = parseInt(e.target.value.slice(1), 16); show(); };
  $('lab-dent').onclick = () => { if (!cur || !cur.v) return; const a = Math.random() * Math.PI * 2, [hw, hl] = cur.hit; dentMesh(cur.v, Math.sin(a) * hw, 0.7, Math.cos(a) * hl, -Math.sin(a), -Math.cos(a), 0.22, 0.9); };
  $('lab-bump').onclick = () => { const b = cur && cur.v && cur.v.bumper; if (b) { b.rotation.x = 0.35; b.position.y -= 0.12; b.rotation.z = 0.2; cur.v.heads.forEach(m => m.visible = false); } };
  $('lab-wing').onclick = () => { const w = cur && cur.v && cur.v.wing; if (w) { w.rotation.z = 0.3; w.position.y -= 0.08; cur.v.tails.forEach(m => m.visible = false); } };
  // the car's panels (render/anatomy.js) one step further each press: bent, swung open, gone (in a race they fly off)
  $('lab-pan').onclick = () => { const v = cur && cur.v; if (!v || !v.panels) return; S.pan = (S.pan + 1) % 3; for (const id in v.panels) { panelStep(v, id, S.pan); if (S.pan === 2) v.panels[id].visible = false; } $('lab-pan').textContent = 'Panels: ' + ['open', 'off', 'bend'][S.pan]; };
  $('lab-fix').onclick = () => { if (cur && cur.v) { repairCarVis(cur.v); S.pan = -1; $('lab-pan').textContent = 'Panels: bend'; } };
  // upgrade parts (data/parts.js, render/parts.js): each press fits the next level; the car rises on its jacks while it's fitted
  $('lab-parts').onclick = e => {
    const b = e.target.closest('[data-s]'); if (!b) return; const k = b.dataset.s, B = { ...S.build };
    if (k === 'all') { const full = SLOTS.every(s => B[s.id] === PART_MAX); for (const s of SLOTS) B[s.id] = full ? 0 : PART_MAX; }
    else if (k === 'kind') B.tyrKind = B.tyrKind === 'gravel' ? undefined : 'gravel';
    else B[k] = ((B[k] || 0) + 1) % (PART_MAX + 1);
    S.build = B; S.lift = 1; show();
  };
  $('lab-ns').onclick = sendNote;
  if (window.claude && window.claude.use) window.claude.use('db').then(d => {
    if (!d) return; db = d; db.collection('assetNotes').onSnapshot(s => { notes = s.docs.map(x => ({ id: x.id, ...x.data() })); listNotes(); }, () => { db = null; });
  });
  light(); show();
  let last = performance.now();
  const loop = t => { requestAnimationFrame(loop); const dt = Math.min(0.1, (t - last) / 1000); last = t; if (S.spin) S.a += dt * 0.5; if (cur) holder.rotation.y = S.a; if (S.lift > 0) { S.lift = Math.max(0, S.lift - dt * 1.4); holder.position.y = Math.sin(Math.min(1, S.lift * 1.6) * Math.PI / 2) * 0.35; } if (cur && cur.anim) cur.anim(cur.v, FAKE, t / 1000); if (cur && cur.v) updatePanels(cur.v, FAKE, dt, t / 1000); R.render(scene, cam); stats(); };
  requestAnimationFrame(loop);
}
function light() {
  const st = STAGES[S.stage], Lt = st.light;
  sun.color.setHex(Lt.sun); sun.intensity = Lt.sunI; hemi.color.setHex(Lt.sky); hemi.groundColor.setHex(Lt.ground); hemi.intensity = Lt.hemiI;
  scene.background = new THREE.Color(st.colors.sky); setCarEnvironment(R, scene, st);
}
function build(it) {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  if (it.fam === 'cars') {
    const def = { ...it.def, color: S.color ?? it.def.color, num: 7, build: S.build }, m = buildCarModel(def, root, body, S.provider); body.position.y = m.lift || 0;
    const v = { root, body, wheels: m.wheels, struts: m.struts || [], dentable: m.dentable, bumper: m.bumper, wing: m.wing, heads: m.heads, tails: m.tails, cabin: m.cabin, glassM: m.cabin.material, panels: m.panels, pstep: {} };
    return { root, v, lod: m.lod, anim: m.anim, hit: [def.hw || CAR_HW, def.hl || CAR_HL], blender: S.provider === 'blender' && !!packOf(it.pack) };
  }
  // any other pack (scenery): its parts tinted as a typical stage would, variants side by side (parts named <part><n>),
  // or laid out by the pack's meta.lab offsets (the spectator's body, head and arms)
  const H = decodePack(packOf(it.pack)), lab = H.meta.lab || {}, n = H.meta.variants || 1, gap = H.meta.size ? H.meta.size[0] + 2.5 : 5;
  for (const name of Object.keys(H.hi)) for (const [mat, g] of Object.entries(H.hi[name])) {
    const c = TINT[mat] ?? HD_COL[mat] ?? 0xA0A4A8, m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, vertexColors: !!g.attributes.color }));
    const v = +(name.match(/(\d+)$/) || [0, 0])[1], off = lab[name] || [(v - (n - 1) / 2) * gap, 0, 0];
    m.position.set(...off); m.castShadow = true; m.userData.lod = [H.lo[name] && H.lo[name][mat] || g, g]; body.add(m);
    if (lab[name + '2']) { const m2 = m.clone(); m2.userData.lod = m.userData.lod; m2.position.set(...lab[name + '2']); body.add(m2); }   // (clone() copies userData as JSON)
  }
  return { root, v: null, lod: null, hit: null, blender: true };
}
function show() {
  holder.clear(); const it = itemOf(S.id); cur = build(it); holder.add(cur.root);
  cur.root.traverse(o => { if (o.isMesh) o.castShadow = true; });
  const box = new THREE.Box3().setFromObject(cur.root); cur.size = box.getSize(new THREE.Vector3()).length();
  document.getElementById('lab-list').innerHTML = items().map(i => `<button data-id="${i.id}" class="${i.id === S.id ? 'on' : ''}">${esc(i.label)} <small>${packOf(i.pack) ? 'B' : ''}</small></button>`).join('');
  for (const b of document.querySelectorAll('#lab-bar [data-p]')) { b.classList.toggle('on', b.dataset.p === S.provider); b.disabled = b.dataset.p === 'blender' && !packOf(it.pack); }
  if (it.fam === 'cars') document.getElementById('lab-col').value = '#' + (S.color ?? it.def.color).toString(16).padStart(6, '0');
  document.getElementById('lab-parts').hidden = !cur.v;
  if (cur.v) document.getElementById('lab-parts').innerHTML = SLOTS.map(s => { const L = S.build[s.id] || 0; return `<button data-s="${s.id}" class="${L ? 'on' : ''}">${s.name} ${L}/${PART_MAX}${L ? ': ' + esc(s.looks[L - 1]) : ''}</button>`; }).join('')
    + `<button data-s="kind">Tyres: ${S.build.tyrKind === 'gravel' ? 'gravel' : 'road'}</button><button data-s="all">${SLOTS.every(s => S.build[s.id] === PART_MAX) ? 'Strip to stock' : 'Full build'}</button>`;
  for (const id of ['lab-dent', 'lab-bump', 'lab-wing', 'lab-fix', 'lab-col']) document.getElementById(id).hidden = !cur.v;
  document.getElementById('lab-pan').hidden = !(cur.v && cur.v.panels && Object.keys(cur.v.panels).length); S.pan = -1; document.getElementById('lab-pan').textContent = 'Panels: bend';
  applyView(); listNotes();
}
function applyView() {
  if (!cur) return;
  if (cur.lod) setCarDetail(cur.lod, S.near);
  else cur.root.traverse(o => { if (o.userData.lod) o.geometry = o.userData.lod[S.near ? 1 : 0]; });
  cur.root.traverse(o => { if (o.isMesh) for (const m of [].concat(o.material)) m.wireframe = S.wire; });
  const d = Math.max(4, cur.size);
  if (S.view === 'studio') { cam.fov = 35; cam.position.set(d * 0.95, d * 0.55, d * 1.05); } else { cam.fov = 40; cam.position.set(0, d * 2.4, -d * 1.1); }   // race: from high behind, the race camera's angle
  cam.updateProjectionMatrix(); cam.lookAt(0, 0.6, 0);
  const set = (id, on, a, b) => { const e = document.getElementById(id); e.classList.toggle('on', on); if (a) e.textContent = on ? a : b; };
  set('lab-lod', S.near, 'Near detail', 'Far detail'); set('lab-wire', S.wire); set('lab-spin', S.spin); set('lab-cam', S.view === 'race', 'Race view', 'Studio view');
}
function stats() {
  const it = itemOf(S.id), p = packOf(it.pack), man = MANIFEST[it.pack], info = R.info.render;
  document.getElementById('lab-stats').textContent = `${it.label}  (${cur.blender ? 'Blender' : 'Classic'}, ${S.near ? 'near' : 'far'})\n`
    + (S.wire ? `drawn: wireframe, ${info.calls} draw calls\n` : `drawn: ${info.triangles} triangles, ${info.calls} draw calls\n`)
    + (it.fam === 'cars' ? (r => `rating: pace ${r.bands.tarmac} tarmac (${r.tarmac}%), ${r.bands.loose} loose (${r.loose}%), toughness ${r.bands.tough} (${r.tough})\n${discsOf(it.id, S.build).map(d => DISCIPLINES[d].name).join(', ')}\n`)(ratingOf(it.id, S.build)) : '')
    + (p ? `pack ${it.pack}: ${packTris(p, 'hi')} near / ${packTris(p, 'lo')} far tris, ${man ? man.kb : '?'} KB` : 'no Blender pack yet');
}
function listNotes() {
  const mine = notes.filter(n => n.asset === S.id).sort((a, b) => (a.at || 0) - (b.at || 0));
  document.getElementById('lab-nl').innerHTML = mine.map(n => `<li class="n">${esc(n.text)} <small>(${esc(n.provider || '')})</small>${n.reply ? `<div class="r">Claude: ${esc(n.reply)}</div>` : ''}</li>`).join('');
  document.getElementById('lab-nm').textContent = db ? '' : 'Notes need the published page';
}
async function sendNote() {
  const t = document.getElementById('lab-nt'), text = t.value.trim(), msg = document.getElementById('lab-nm'); if (!text) return;
  if (!db) { msg.textContent = 'No database here: copy the note to Claude'; return; }
  try { await db.collection('assetNotes').doc('a' + Date.now().toString(36)).set({ asset: S.id, pack: itemOf(S.id).pack, provider: cur.blender ? 'blender' : 'classic', text, status: 'open', at: Date.now() }); t.value = ''; msg.textContent = 'Sent'; } catch (e) { msg.textContent = 'Could not send: ' + e.message; }
}
