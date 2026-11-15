// Snappymon-Arena: 3D-Darstellung der Royale (alle gegen alle auf einer Insel).
// Framework-frei wie monster.js: läuft als statische Seite (arena.html) und in einer Expo-DOM-Component.
// Die Simulation (royale-sim.js) ist deterministisch; hier wird sie nur abgespielt und gezeichnet.
//
//   const arena = createArena(container, { entrants, seed, dayElement, camera: 'auto', followId, onEnd });
//   arena.setCamera('top' | 'tilt' | 'follow' | 'auto'); arena.setFollow(id); arena.setSpeed(2); arena.restart(); arena.dispose();
//
// entrants: [{ id, name, element, stats, traits?, moves?, genome, photoUrl?, ownerName? }]
import * as THREE from 'three';
import { buildMonster, updateMonster } from './monster.js';
import { createSim, DT, MOVE_SPECS } from './royale-sim.js';
import { createFx } from './arena-fx.js';

export const ELEMENT_COLORS = { fire: '#ff6b4a', water: '#3d9df3', plant: '#4cb867', metal: '#8c97a6', fluff: '#e98bc4', spirit: '#9a7bf0', leaf: '#4cb867', spark: '#f5c542', rock: '#a08a6a', normal: '#b0b6b3' };
const colorOf = (el) => ELEMENT_COLORS[el] || '#b0b6b3';
const S = 0.6; // Monster-Maßstab in der Arena
const INK = '#2b2523';
const MINI_OUTLINE = new THREE.MeshBasicMaterial({ color: INK, side: THREE.BackSide });

const CSS = `
.sa-ui { position: absolute; inset: 0; pointer-events: none; font-family: 'Fredoka', -apple-system, system-ui, sans-serif; font-size: 10px; color: ${INK}; overflow: hidden; user-select: none; -webkit-user-select: none; }
.sa-roster { position: absolute; top: .8em; left: .8em; right: .8em; display: grid; grid-template-columns: repeat(auto-fill, minmax(8.6em, 1fr)); gap: .35em; }
.sa-cell { display: flex; align-items: center; gap: .45em; background: rgba(255,255,255,.84); border-radius: .7em; padding: .28em .55em .28em .28em; min-width: 0; transition: opacity .4s; }
.sa-cell.dead { opacity: .3; }
.sa-cell.me { outline: .2em solid ${INK}; }
.sa-thumb { width: 1.9em; height: 1.9em; border-radius: .5em; background: #ddd center / cover no-repeat; flex: none; }
.sa-cellbody { flex: 1; min-width: 0; }
.sa-cellname { font-size: .95em; font-weight: 700; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.15; }
.sa-track { height: .45em; border-radius: .3em; background: rgba(43,37,35,.16); overflow: hidden; margin-top: .2em; }
.sa-fill { height: 100%; width: 100%; background: #4cc38a; transition: width .2s; }
.sa-hp { position: absolute; width: 3.4em; height: .5em; margin-left: -1.7em; border-radius: .3em; background: rgba(43,37,35,.4); overflow: hidden; outline: 1px solid rgba(255,255,255,.9); }
.sa-hp > i { display: block; height: 100%; background: #4cc38a; }
.sa-tag { position: absolute; transform: translate(-50%, -100%); font-size: 1.05em; font-weight: 700; background: rgba(255,255,255,.92); padding: .1em .65em; border-radius: 999px; white-space: nowrap; }
.sa-tag.me { background: ${INK}; color: #fff; }
.sa-move { position: absolute; transform: translate(-50%, -100%); font-size: 1.05em; font-weight: 700; letter-spacing: .04em; text-transform: uppercase; color: #fff; padding: .15em .7em; border-radius: .5em; border: .16em solid rgba(255,255,255,.92); white-space: nowrap; animation: sa-pop .18s ease-out; box-shadow: 0 .16em 0 rgba(0,0,0,.2); }
.sa-move.special { font-size: 1.45em; }
.sa-dmg { position: absolute; transform: translate(-50%, -50%); font-size: 1.6em; font-weight: 700; color: #fff; -webkit-text-stroke: .22em ${INK}; paint-order: stroke fill; white-space: nowrap; animation: sa-up .8s ease-out forwards; }
.sa-dmg.crit { font-size: 2.3em; color: #ffd23f; }
.sa-dmg.note { font-size: 1.15em; color: #9ff3c6; }
.sa-feed { position: absolute; left: .8em; bottom: 1em; display: flex; flex-direction: column; gap: .3em; font-size: 1.1em; font-weight: 700; }
.sa-feed > div { background: rgba(43,37,35,.74); color: #fff; padding: .2em .75em; border-radius: .55em; width: fit-content; animation: sa-in .2s ease-out; }
.sa-feed b { font-weight: 700; }
.sa-banner { position: absolute; left: 0; right: 0; top: 36%; text-align: center; font-size: 3.4em; font-weight: 700; line-height: 1.05; color: #fff; -webkit-text-stroke: .18em ${INK}; paint-order: stroke fill; letter-spacing: .02em; opacity: 0; transform: scale(.6); transition: opacity .2s, transform .3s cubic-bezier(.2,1.6,.4,1); padding: 0 .4em; }
.sa-banner.on { opacity: 1; transform: scale(1); }
.sa-banner.win { top: 13%; }
.sa-banner img { display: block; width: 2.4em; height: 2.4em; object-fit: cover; margin: .25em auto 0; border-radius: .35em; border: .09em solid #fff; box-shadow: 0 .08em .3em rgba(0,0,0,.3); transform: rotate(-4deg); }
.sa-banner small { display: block; font-size: .42em; -webkit-text-stroke: .28em ${INK}; margin-top: .3em; }
.sa-callout { position: absolute; left: 50%; bottom: 24%; transform: translateX(-50%) rotate(-2deg) scale(.5); opacity: 0; transition: opacity .12s, transform .22s cubic-bezier(.2,1.7,.4,1); font-size: 2.3em; font-weight: 700; letter-spacing: .03em; text-transform: uppercase; white-space: nowrap; color: #fff; padding: .12em .7em .16em; border-radius: .32em; border: .13em solid ${INK}; box-shadow: .18em .18em 0 ${INK}; -webkit-text-stroke: .05em ${INK}; paint-order: stroke fill; }
.sa-callout.on { opacity: 1; transform: translateX(-50%) rotate(-2deg) scale(1); }
.sa-callout small { display: block; font-size: .42em; letter-spacing: .08em; -webkit-text-stroke: 0; margin-bottom: -.2em; opacity: .95; }
.sa-cams { position: absolute; right: .8em; bottom: 1em; display: flex; gap: .4em; pointer-events: auto; }
.sa-cams button { border: 0; border-radius: 999px; padding: .5em .95em; font: 700 1.1em 'Fredoka', system-ui, sans-serif; background: rgba(255,255,255,.88); color: ${INK}; cursor: pointer; }
.sa-cams button.on { background: ${INK}; color: #fff; }
.sa-map { position: absolute; right: .8em; bottom: 1em; width: 7.4em; height: 7.4em; border-radius: 50%; background: rgba(255,255,255,.82); border: .16em solid ${INK}; box-shadow: .2em .2em 0 ${INK}; }
.sa-left { position: absolute; right: 1.5em; bottom: 9.4em; font-size: 1.15em; font-weight: 700; background: rgba(255,255,255,.85); padding: .25em .8em; border-radius: 999px; }
@keyframes sa-pop { from { transform: translate(-50%, -100%) scale(.5); opacity: 0; } to { transform: translate(-50%, -100%) scale(1); opacity: 1; } }
@keyframes sa-in { from { transform: translateX(-1em); opacity: 0; } to { transform: none; opacity: 1; } }
@keyframes sa-up { from { opacity: 1; margin-top: 0; } to { opacity: 0; margin-top: -3.2em; } }
`;

function el(tag, cls, parent, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
function lcg(seed) { let a = seed >>> 0; return () => { a = (Math.imul(a, 1664525) + 1013904223) >>> 0; return a / 4294967296; }; }
const lerp = (a, b, k) => a + (b - a) * k;
function lerpAngle(a, b, k) { let d = b - a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; return a + d * k; }
function fallbackGenome(e) { return { name: e.name, seed: 1, body: { shape: 'blob', color: colorOf(e.element) }, face: { eyes: 'dot', mouth: 'smile' }, limbs: { style: 'stub', pose: 'rest' }, parts: [] }; }

export function createArena(container, opts = {}) {
  const o = { camera: 'auto', speed: 1, intro: 3, controls: true, roster: true, seed: 1, labels: 'auto', hatch: true, ...opts }; // labels: 'all' | 'special' | 'auto' (alle erst ab 6 Überlebenden)
  const entrants = o.entrants || [];
  if (getComputedStyle(container).position === 'static') container.style.position = 'relative';
  container.style.overflow = 'hidden';
  const style = el('style', null, container); style.textContent = CSS;
  // Zeitquelle: normal die echte Uhr. Mit opts.manual läuft nichts von selbst; arena.step(ms) schaltet genau ein Bild weiter
  // (Simulation, Effekte, Timer und CSS-Animationen), damit sich Videos bildgenau rendern lassen.
  let vnow = 0; const timers = []; const stepped = new WeakSet();
  const later = (fn, ms) => { if (!o.manual) return setTimeout(fn, ms); const t = { at: vnow + ms, fn }; timers.push(t); return t; };
  const cancel = (t) => { if (!o.manual) return clearTimeout(t); const i = timers.indexOf(t); if (i >= 0) timers.splice(i, 1); };

  // ---------- three.js ----------
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
  Object.assign(renderer.domElement.style, { position: 'absolute', inset: '0', width: '100%', height: '100%', display: 'block', touchAction: 'none' });
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color('#cfeaf0');
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 300);
  scene.add(new THREE.HemisphereLight('#ffffff', '#cfdcd4', 1.5));
  const sun = new THREE.DirectionalLight('#ffffff', 1.9); sun.position.set(-6, 12, 7); scene.add(sun);
  const fill = new THREE.DirectionalLight('#fff4ec', 0.7); fill.position.set(4, 4, 10); scene.add(fill);

  const ui = el('div', 'sa-ui', container);
  const rosterEl = el('div', 'sa-roster', ui); if (!o.roster) rosterEl.style.display = 'none';
  const floatEl = el('div', null, ui);
  const feedEl = el('div', 'sa-feed', ui);
  const bannerEl = el('div', 'sa-banner', ui);
  const camsEl = el('div', 'sa-cams', ui); if (!o.controls) camsEl.style.display = 'none';
  const leftEl = el('div', 'sa-left', ui); leftEl.style.display = 'none';
  const calloutEl = el('div', 'sa-callout', ui);
  const mapEl = el('canvas', 'sa-map', ui); mapEl.width = mapEl.height = 160; const mapCtx = mapEl.getContext('2d'); mapEl.style.display = 'none';

  let sim, R, world, actors, shots, fx, started, ended, acc, introLeft, bannerTimer, winnerId;
  let mode = o.camera; let followId = o.followId || null; let speed = o.speed;
  const rig = { cx: 0, cz: 0, dist: 30, pitch: 0.9, yaw: 0, userYaw: 0, zoom: 1, kick: 0 };
  const tmp = new THREE.Vector3();
  const mats = new Map();
  const basicMat = (color, opacity = 1) => { const k = color + opacity; if (!mats.has(k)) mats.set(k, new THREE.MeshBasicMaterial({ color, transparent: opacity < 1, opacity, depthWrite: opacity >= 1 })); return mats.get(k); };
  const flatMat = (color) => { const k = 'f' + color; if (!mats.has(k)) mats.set(k, new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.95 })); return mats.get(k); };
  const GEO = { tetra: new THREE.TetrahedronGeometry(1), ico: new THREE.IcosahedronGeometry(1, 0), ring: new THREE.RingGeometry(0.9, 1, 40), cyl: new THREE.CylinderGeometry(1, 1, 1, 8), sphere: new THREE.SphereGeometry(1, 12, 8) };

  // ---------- Welt ----------
  function buildWorld() {
    const g = new THREE.Group();
    const rand = lcg(o.seed * 7 + 3);
    const island = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.6, R + 0.9, 0.9, 30), flatMat('#bfe3c5')); island.position.y = -0.455; g.add(island);
    const field = new THREE.Mesh(new THREE.CircleGeometry(R, 40), new THREE.MeshStandardMaterial({ color: '#cdeccf', roughness: 1 })); field.rotation.x = -Math.PI / 2; field.position.y = 0.002; g.add(field);
    for (let i = 0; i < 14; i++) { // helle Flecken als Bodenstruktur
      const a = rand() * Math.PI * 2; const d = Math.sqrt(rand()) * (R - 1); const s = 0.5 + rand() * 1.1;
      const spot = new THREE.Mesh(new THREE.CircleGeometry(s, 7), basicMat('#d9f3d8', 0.7)); spot.rotation.x = -Math.PI / 2; spot.position.set(Math.cos(a) * d, 0.004, Math.sin(a) * d); g.add(spot);
    }
    for (let i = 0; i < 26; i++) { // Felsen, Büsche und Bäume am Rand
      const a = (i / 26) * Math.PI * 2 + rand() * 0.2; const d = R + 0.55 + rand() * 0.8; const kind = rand();
      if (kind < 0.4) { const r = new THREE.Mesh(GEO.ico, flatMat('#a9b4ad')); r.scale.set(0.3 + rand() * 0.35, 0.25 + rand() * 0.3, 0.3 + rand() * 0.3); r.position.set(Math.cos(a) * d, 0.12, Math.sin(a) * d); r.rotation.y = rand() * 3; g.add(r); }
      else if (kind < 0.7) { const b = new THREE.Mesh(GEO.ico, flatMat('#7cc48a')); b.scale.setScalar(0.3 + rand() * 0.3); b.position.set(Math.cos(a) * d, 0.2, Math.sin(a) * d); g.add(b); }
      else { const trunk = new THREE.Mesh(GEO.cyl, flatMat('#9a7654')); trunk.scale.set(0.09, 0.5, 0.09); trunk.position.set(Math.cos(a) * d, 0.25, Math.sin(a) * d); g.add(trunk); const top = new THREE.Mesh(new THREE.ConeGeometry(0.42, 1.0, 6), flatMat('#5fae6e')); top.position.set(Math.cos(a) * d, 0.95, Math.sin(a) * d); g.add(top); }
    }
    const sea = new THREE.Mesh(new THREE.CircleGeometry(160, 24), basicMat('#bfe3ee')); sea.rotation.x = -Math.PI / 2; sea.position.y = -0.7; g.add(sea);
    // Zone: alles außerhalb ist rot, die Kante leuchtet
    const danger = new THREE.Mesh(new THREE.RingGeometry(R - 0.01, R, 56), basicMat('#ff5a4a', 0.3)); danger.rotation.x = -Math.PI / 2; danger.position.y = 0.01; g.add(danger);
    const edge = new THREE.Mesh(new THREE.RingGeometry(0.985, 1.0, 72), basicMat('#ff3b30', 0.9)); edge.rotation.x = -Math.PI / 2; edge.position.y = 0.012; g.add(edge);
    scene.add(g);
    return { g, danger, edge, zr: -1 };
  }

  // ---------- Monster ----------
  // Hauptfarbe eines Monsters (für sein Ei): beim frei gebauten Modell die Farbe des größten Bauteils
  function mainColor(e) {
    const parts = e.genome?.blueprint?.parts;
    if (parts?.length) { let best = parts[0]; for (const p of parts) if (Math.abs(p.w * p.h * p.d) > Math.abs(best.w * best.h * best.d)) best = p; return /^#[0-9a-f]{6}$/i.test(best.color || '') ? best.color : colorOf(e.element); }
    return e.genome?.body?.color || colorOf(e.element);
  }
  const EGG_GEO = (() => { const g = new THREE.IcosahedronGeometry(0.5, 1); const pos = g.attributes.position; for (let i = 0; i < pos.count; i++) { const y = pos.getY(i); const k = 1 - 0.22 * Math.max(0, y / 0.5); pos.setXYZ(i, pos.getX(i) * k, y * 1.32, pos.getZ(i) * k); } g.computeVertexNormals(); return g; })();
  function makeEgg(color, golden) {
    const g = new THREE.Group(); const shell = new THREE.Color(golden ? '#f7c531' : color).lerp(new THREE.Color('#ffffff'), golden ? 0.15 : 0.62);
    const m = new THREE.Mesh(EGG_GEO, new THREE.MeshStandardMaterial({ color: shell, flatShading: true, roughness: 0.85, emissive: shell, emissiveIntensity: 0.12 })); m.position.y = 0.66; g.add(m);
    const ol = new THREE.Mesh(EGG_GEO, MINI_OUTLINE); ol.scale.setScalar(1.09); ol.position.y = 0.66; g.add(ol);
    for (let i = 0; i < 5; i++) { const sp = new THREE.Mesh(GEO.sphere, basicMat(golden ? '#fff3b0' : color)); const a = i * 2.3 + 0.4; const y = 0.36 + (i % 3) * 0.26; const r = 0.4 * (1 - Math.abs(y - 0.62) * 0.75); sp.scale.set(0.085, 0.085, 0.03); sp.position.set(Math.cos(a) * r, y, Math.sin(a) * r + 0.02); sp.lookAt(0, y, 0); g.add(sp); }
    return g;
  }
  function buildActors() {
    actors = new Map(); rosterEl.innerHTML = ''; floatEl.innerHTML = '';
    for (const e of entrants) {
      let root; try { root = buildMonster(e.genome || fallbackGenome(e)); } catch { root = buildMonster(fallbackGenome(e)); }
      root.scale.setScalar(S);
      const holder = new THREE.Group(); holder.add(root); scene.add(holder);
      const height = (root.userData.monster?.height ?? 2.2) * S;
      // Mini-Kopie des Körpers für Geschosse und Eruptionen (gleiche Geometrie und Farbe, eigene Kontur)
      let bodyMesh = null; root.traverse((n) => { if (n.isMesh && n.userData.isBody) bodyMesh = n; });
      const model = root.userData.monster?.model; const modelH = model ? (model.userData.bb.max.y - model.userData.bb.min.y) : 2.3;
      const mini = model ? () => { const g = new THREE.Group(); const c = model.clone(true); const k = 2 / modelH; c.scale.multiplyScalar(k); c.position.multiplyScalar(k); c.position.y -= 1; g.add(c); return g; } : bodyMesh ? () => { const g = new THREE.Group(); g.add(new THREE.Mesh(bodyMesh.geometry, bodyMesh.material)); const ol = new THREE.Mesh(bodyMesh.geometry, MINI_OUTLINE); ol.scale.setScalar(1.14); g.add(ol); return g; } : null;
      const cell = el('div', 'sa-cell' + (e.id === followId ? ' me' : ''), rosterEl);
      const thumb = el('div', 'sa-thumb', cell); if (e.photoUrl) thumb.style.backgroundImage = `url("${e.photoUrl}")`; else thumb.style.background = colorOf(e.element);
      const body = el('div', 'sa-cellbody', cell); el('div', 'sa-cellname', body, e.name);
      const fillEl = el('div', 'sa-fill', el('div', 'sa-track', body));
      const hp = el('div', 'sa-hp', floatEl); const hpFill = el('i', null, hp);
      const tag = el('div', 'sa-tag' + (e.id === followId ? ' me' : ''), floatEl, e.id === followId ? `YOU · ${e.name}` : e.name);
      const egg = o.hatch ? makeEgg(mainColor(e), !!e.genome?.golden) : null; if (egg) { scene.add(egg); holder.visible = false; }
      actors.set(e.id, { e, root, holder, height, mini, egg, hatched: !o.hatch, pop: o.hatch ? 0 : 1, hatchAt: 0, cell, fillEl, hp, hpFill, tag, yaw: 0, lunge: 0, hurt: 0, dead: 0, shownHp: -1 });
    }
  }

  // ---------- Effekte ----------
  function addFx(update) { fx.push(update); }
  const FX = createFx(scene, addFx); // Angriffs-Effekte je Element und Angriffsart (arena-fx.js)
  const ring = FX.ring;
  const puff = (x, y, z, n = 8, power = 3) => FX.spray('normal', x, y, z, n, power, 0.2);
  function flash(actor) {
    const mat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.75, depthWrite: false });
    const m = new THREE.Mesh(GEO.sphere, mat); m.scale.setScalar(actor.height * 0.62); m.position.set(0, actor.height * 0.5, 0); actor.holder.add(m); let t = 0;
    addFx((dt) => { t += dt; mat.opacity = 0.75 * Math.max(0, 1 - t / 0.14); if (t >= 0.14) { actor.holder.remove(m); mat.dispose(); return false; } return true; });
  }
  function toScreen(x, y, z) { tmp.set(x, y, z).project(camera); return { x: (tmp.x * 0.5 + 0.5) * container.clientWidth, y: (-tmp.y * 0.5 + 0.5) * container.clientHeight, ok: tmp.z < 1 }; }
  function floatText(text, x, y, z, cls) { const p = toScreen(x, y, z); if (!p.ok) return; const d = el('div', 'sa-dmg' + (cls ? ' ' + cls : ''), floatEl, text); d.style.left = p.x + 'px'; d.style.top = p.y + 'px'; later(() => d.remove(), 820); }
  function moveLabel(actor, name, element, special) {
    if (actor.label) actor.label.remove();
    const d = el('div', 'sa-move' + (special ? ' special' : ''), floatEl, name); d.style.background = colorOf(element); actor.label = d; actor.labelLife = special ? 1.3 : 0.95;
  }
  function banner(html, seconds = 1.8) { bannerEl.innerHTML = html; bannerEl.classList.remove('win'); bannerEl.classList.add('on'); cancel(bannerTimer); if (seconds) bannerTimer = later(() => bannerEl.classList.remove('on'), seconds * 1000); }
  function feed(html) { const d = el('div', null, feedEl); d.innerHTML = html; while (feedEl.children.length > 5) feedEl.firstChild.remove(); later(() => d.remove(), 9000); }
  const nameHtml = (id) => { const a = actors.get(id); return a ? `<b style="color:${colorOf(a.e.element)}">${escapeHtml(a.e.name)}</b>` : 'the zone'; };
  function escapeHtml(s) { return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }

  // ---------- Ereignisse aus der Simulation ----------
  let calloutTimer = null; let slowLeft = 0; let slowCool = 0; let eggs = []; let introT = 0; let hatchEnd = 0;
  // Regie-Kamera (Hochformat): merkt sich, wo gerade etwas passiert, und fährt dort nah heran. Die Minimap zeigt den Überblick.
  const hot = []; const focus = { x: 0, z: 0, r: 4, hold: 0, score: 0 };
  const heat = (x, z, w) => { hot.push({ x, z, w, t: simTime }); if (hot.length > 60) hot.shift(); };
  function callout(owner, name, element) { // großer Namensruf für Spezialangriffe
    calloutEl.innerHTML = `<small>${escapeHtml(owner)} uses</small>${escapeHtml(name)}!`; calloutEl.style.background = colorOf(element); calloutEl.classList.add('on');
    cancel(calloutTimer); calloutTimer = later(() => calloutEl.classList.remove('on'), 1150);
  }
  function handle(e) {
    const st = (id) => sim.state.monsters.find((m) => m.id === id);
    const aliveN = sim.state.monsters.reduce((c, m) => c + (m.alive ? 1 : 0), 0);
    const dirTo = (x, y, tx, ty) => { const dx = tx - x, dy = ty - y; const d = Math.sqrt(dx * dx + dy * dy) || 1; return [dx / d, dy / d]; };
    if (e.type === 'cast') {
      const a = actors.get(e.id); if (!a) return;
      if (e.special) { callout(a.e.name, e.name, e.element); rig.kick = Math.max(rig.kick, 0.5); ring(e.x, e.y, 0.2, 1.2, colorOf(e.element), 0.4, 0.8); }
      else if (o.labels === 'all' || e.id === followId || (o.labels === 'auto' && aliveN <= 6)) moveLabel(a, e.name, e.element, false);
      if (e.kind === 'beam') { const [dx, dz] = dirTo(e.x, e.y, e.tx, e.ty); FX.charge(e.x, e.y, dx, dz, e.element, MOVE_SPECS.beam.windup, e.special); }
    } else if (e.type === 'fire') {
      const a = actors.get(e.id); const big = e.move === 1; const [dx, dz] = dirTo(e.x, e.y, e.tx ?? e.x, e.ty ?? e.y + 1);
      if (e.kind === 'melee') { if (a) a.lunge = 1; FX.slash(e.x, e.y, dx, dz, e.element, big); }
      else if (e.kind === 'beam') { FX.beam(e.x, e.y, e.tx, e.ty, e.element, big); rig.kick = Math.max(rig.kick, big ? 0.9 : 0.5); }
      else if (e.kind === 'burst') { FX.eruption(e.x, e.y, MOVE_SPECS.burst.range, e.element, big, a?.mini); rig.kick = Math.max(rig.kick, big ? 0.9 : 0.5); }
      else if (e.kind === 'dash') { FX.landing(e.tx, e.ty, e.element, big); rig.kick = Math.max(rig.kick, 0.6); }
      // Zeitlupe für große Momente: Spezialangriffe im Endkampf oder vom eigenen Monster, höchstens alle 3 s
      if (big && e.kind !== 'shot' && slowCool <= 0 && (aliveN <= 4 || e.id === followId)) { slowLeft = 0.22; slowCool = 3; }
    } else if (e.type === 'leap') { FX.streak(e.x, e.y, e.tx, e.ty, e.element); ring(e.x, e.y, 0.2, 0.9, '#ffffff', 0.25, 0.6);
    } else if (e.type === 'hit') {
      const t = actors.get(e.target); const m = st(e.target); if (!t || !m) return;
      const by = st(e.by); const element = by?.moves?.[e.move]?.element || by?.element;
      t.hurt = 1; flash(t); FX.impact(m.x, t.height * 0.6, m.y, element, e.crit || e.move === 1);
      floatText(`-${e.dmg}`, m.x, t.height + 0.3, m.y, e.crit ? 'crit' : '');
      if (e.crit) rig.kick = Math.max(rig.kick, 0.7);
      if (e.eff > 1) floatText('super effective!', m.x, t.height + 0.9, m.y, 'note');
    } else if (e.type === 'dodge') {
      const t = actors.get(e.target); const m = st(e.target); if (t && m) floatText('dodge!', m.x, t.height + 0.3, m.y, 'note');
    } else if (e.type === 'ko') {
      const a = actors.get(e.id); const m = st(e.id); if (!a) return;
      a.dead = 0.001; a.cell.classList.add('dead'); a.fillEl.style.width = '0%';
      if (m) { puff(m.x, 0.6, m.y, 16, 4); ring(m.x, m.y, 0.2, 1.4, '#ffffff', 0.4); later(() => { if (!disposed) eggs.push(FX.koEgg(m.x, m.y, a.e.genome?.body?.color || colorOf(a.e.element))); }, 420); }
      feed(`${e.by === 'zone' ? '<b style="color:#ff8a80">the zone</b>' : nameHtml(e.by)} ▸ ${nameHtml(e.id)}`);
      rig.kick = Math.max(rig.kick, 1);
      if (e.id === followId && e.by !== 'zone' && mode === 'follow') spectate = e.by;
    } else if (e.type === 'zone') { if (e.phase === 'start') banner('THE ZONE IS CLOSING', 1.6); }
    else if (e.type === 'final') banner('FINAL TWO', 1.8);
    else if (e.type === 'win') {
      winnerId = e.id; const a = actors.get(e.id); calloutEl.classList.remove('on');
      const born = a?.e.genome?.object ? `born from ${escapeHtml(String(a.e.genome.object).toLowerCase().replace(/^an? /, 'a ')).slice(0, 60)}` : '';
      banner(`${a ? escapeHtml(a.e.name) : 'Nobody'} WINS!${a?.e.photoUrl ? `<img src="${a.e.photoUrl}" alt="">` : ''}<small>${[a?.e.ownerName ? `by ${escapeHtml(a.e.ownerName)}` : '', born].filter(Boolean).join(' · ')}</small>`, 0); bannerEl.classList.add('win');
      const m = st(e.id); if (m) for (let i = 0; i < 5; i++) later(() => !disposed && FX.confetti(m.x, m.y), i * 300);
    }
    if (e.type === 'cast') { heat(e.x, e.y, e.special ? 3 : 1); if (e.special) focus.hold = Math.min(focus.hold, 0.15); }
    else if (e.type === 'hit') { const m = st(e.target); if (m) heat(m.x, m.y, e.crit ? 2.2 : 1.4); }
    else if (e.type === 'ko') { const m = st(e.id); if (m) heat(m.x, m.y, 3); }
    o.onEvent?.(e);
  }
  let spectate = null;

  // ---------- Kamera ----------
  const CAMS = [['auto', 'Auto'], ['tilt', '3D'], ['top', 'Top'], ['follow', 'Follow']];
  function drawCamButtons() { camsEl.innerHTML = ''; for (const [k, label] of CAMS) { if (k === 'follow' && !followId && !entrants.length) continue; const b = el('button', mode === k ? 'on' : '', camsEl, label); b.onclick = () => setCamera(k); } }
  function setCamera(m) { mode = m; spectate = null; drawCamButtons(); }
  function fitDist(r, pitch) {
    const vf = (camera.fov * Math.PI) / 360; const hf = Math.atan(Math.tan(vf) * camera.aspect);
    return Math.max(r / Math.tan(hf), (r * Math.max(0.45, Math.sin(pitch))) / Math.tan(vf)) * 1.04;
  }
  function updateCamera(dt, now) {
    const directing = o.director === true || (o.director !== false && camera.aspect < 0.8);
    const alive = sim.state.monsters.filter((m) => m.alive);
    let cx = 0, cz = 0, dist, pitch, yaw = rig.userYaw;
    const zr = Math.min(R, sim.state.zone.r + 1.2);
    if (mode === 'top') { pitch = 1.5; dist = fitDist(zr + 0.6, pitch); }
    else if (mode === 'tilt') { pitch = 0.86; dist = fitDist(zr + 0.4, pitch); yaw += now * 0.00004; }
    else if (mode === 'follow') {
      const target = sim.state.monsters.find((m) => m.id === (spectate || followId) && m.alive) || alive.slice().sort((a, b) => b.kills - a.kills || a.i - b.i)[0];
      if (target) { cx = target.x; cz = target.y; yaw += Math.atan2(-target.fx, -target.fy); }
      pitch = 0.5; dist = 7.5;
    } else { // auto: alle Lebenden im Bild, zieht sich mit der Zone zusammen
      if (winnerId) { const w = sim.state.monsters.find((m) => m.id === winnerId); if (w) { cx = w.x; cz = w.y; yaw = rig.userYaw + Math.atan2(w.fx, w.fy) + Math.sin(now * 0.0011) * 0.5; } pitch = 0.3; dist = 8.5; }
      else if (alive.length) {
        for (const m of alive) { cx += m.x; cz += m.y; } cx /= alive.length; cz /= alive.length;
        let far = 0; for (const m of alive) far = Math.max(far, Math.sqrt((m.x - cx) * (m.x - cx) + (m.y - cz) * (m.y - cz)));
        pitch = alive.length <= 2 ? 0.55 : 0.82; dist = fitDist(Math.max(3, far + 1.15), pitch); yaw += now * 0.00005;
        if (directing && alive.length > 3) { // Regie: auf den heißesten Kampf fahren statt alles klein zu zeigen
          focus.hold -= dt;
          if (focus.hold <= 0) {
            let best = null; let bestScore = 0;
            for (const m of alive) { let sc = m.id === followId ? 0.8 : 0; for (const h of hot) { const age = simTime - h.t; if (age > 1.8) continue; const d2 = (h.x - m.x) * (h.x - m.x) + (h.z - m.y) * (h.z - m.y); if (d2 < 12) sc += h.w * (1 - age / 1.8); } if (sc > bestScore) { bestScore = sc; best = m; } }
            if (best && (bestScore > focus.score * 1.3 || simTime - focus.since > 2.2)) {
              const t = alive.find((m) => m.id === best.targetId); const fx2 = t ? (best.x + t.x) / 2 : best.x; const fz2 = t ? (best.y + t.y) / 2 : best.y;
              const span = t ? Math.sqrt((best.x - t.x) * (best.x - t.x) + (best.y - t.y) * (best.y - t.y)) / 2 : 0;
              const jump = focus.since === undefined ? 99 : Math.sqrt((fx2 - focus.x) * (fx2 - focus.x) + (fz2 - focus.z) * (fz2 - focus.z));
              if (t) focus.yaw = Math.atan2(best.x - t.x, best.y - t.y) + 0.62; // schräg hinter dem Angreifer: man sieht dem Ziel ins Gesicht
              if (jump > 3.4) rig.cut = true; // weit entfernter Kampf: Schnitt statt Schwenk
              focus.x = fx2; focus.z = fz2; focus.r = Math.min(5.4, Math.max(3.7, span + 2.3)); focus.score = bestScore; focus.since = simTime; focus.hold = 1.25;
            } else { focus.score *= 0.9; focus.hold = 0.3; }
          }
          if (focus.since !== undefined) { cx = focus.x; cz = focus.z; pitch = 0.7; dist = fitDist(focus.r, pitch); if (focus.yaw !== undefined) yaw = rig.userYaw + focus.yaw; }
        }
      } else { pitch = 0.8; dist = fitDist(R, pitch); }
    }
    if (!started) {
      pitch = 0.62; dist = fitDist(R + 0.5, pitch); cx = 0; cz = 0; yaw = rig.userYaw + now * 0.00025;
      const me = o.hatchCam && followId ? sim.state.monsters.find((m) => m.id === followId) : null;
      if (me) { cx = me.x; cz = me.y; pitch = 0.36; dist = 6.2; yaw = rig.userYaw + Math.atan2(-me.x, -me.y) + Math.sin(now * 0.0009) * 0.25; } // Nahaufnahme auf das eigene Ei
      else if (o.hatch && directing) { // Hochformat: die Kamera wandert am Ring entlang zu dem Ei, das als Nächstes platzt
        let next = null; for (const a2 of actors.values()) if (!a2.hatched && (!next || a2.hatchAt < next.hatchAt)) next = a2;
        const m2 = next ? sim.state.monsters.find((m) => m.id === next.e.id) : null;
        if (m2 && introT > 0.9) { cx = m2.x * 0.72; cz = m2.y * 0.72; pitch = 0.5; dist = fitDist(4.3, pitch); yaw = rig.userYaw + Math.atan2(m2.x, m2.y) + 0.5; }
        else if (!next) { pitch = 0.62; dist = fitDist(R * 0.8, pitch); }
      }
    }
    const k = rig.cut ? 1 : 1 - Math.pow(0.0015, dt); rig.cut = false; // weiche Nachführung, bei einem Schnitt sofort
    rig.cx = lerp(rig.cx, cx, k); rig.cz = lerp(rig.cz, cz, k); rig.dist = lerp(rig.dist, dist * rig.zoom, k); rig.pitch = lerp(rig.pitch, pitch, k); rig.yaw = mode === 'follow' && started ? lerpAngle(rig.yaw, yaw, k * 0.6) : lerpAngle(rig.yaw, yaw, k);
    rig.kick = Math.max(0, rig.kick - dt * 3);
    const d = rig.dist * (1 - rig.kick * 0.035); const cp = Math.cos(rig.pitch);
    camera.position.set(rig.cx + Math.sin(rig.yaw) * cp * d, Math.sin(rig.pitch) * d, rig.cz + Math.cos(rig.yaw) * cp * d);
    camera.lookAt(rig.cx, winnerId ? 0.8 : 0.5, rig.cz);
  }
  // Ziehen dreht, Rad oder Zwei-Finger-Geste zoomt
  const pointers = new Map(); let pinch = 0;
  const dom = renderer.domElement;
  const onDown = (e) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); dom.setPointerCapture?.(e.pointerId); };
  const onMove = (e) => {
    const p = pointers.get(e.pointerId); if (!p) return;
    if (pointers.size === 1) rig.userYaw -= (e.clientX - p.x) * 0.006;
    p.x = e.clientX; p.y = e.clientY;
    if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); if (pinch) rig.zoom = Math.min(2.2, Math.max(0.45, rig.zoom * (pinch / d))); pinch = d; }
  };
  const onUp = (e) => { pointers.delete(e.pointerId); pinch = 0; };
  const onWheel = (e) => { e.preventDefault(); rig.zoom = Math.min(2.2, Math.max(0.45, rig.zoom * (1 + e.deltaY * 0.001))); };
  dom.addEventListener('pointerdown', onDown); dom.addEventListener('pointermove', onMove); dom.addEventListener('pointerup', onUp); dom.addEventListener('pointercancel', onUp); dom.addEventListener('wheel', onWheel, { passive: false });

  // ---------- Ablauf ----------
  function reset() {
    if (world) scene.remove(world.g);
    if (actors) for (const a of actors.values()) { scene.remove(a.holder); if (a.egg) scene.remove(a.egg); }
    if (shots) for (const s of shots.values()) s.dispose();
    for (const egg of eggs) scene.remove(egg); eggs = [];
    sim = createSim({ entrants: entrants.map(({ id, name, element, stats, traits, moves }) => ({ id, name, element, stats, traits, moves })), seed: o.seed, dayElement: o.dayElement });
    R = sim.state.arena.r; world = buildWorld(); buildActors(); shots = new Map(); fx = fx || []; feedEl.innerHTML = ''; calloutEl.classList.remove('on');
    hot.length = 0; focus.since = undefined; focus.yaw = undefined; focus.score = 0; focus.hold = 0;
    started = false; ended = false; acc = 0; winnerId = null; spectate = null; introLeft = o.intro; rig.kick = 0;
    for (const m of sim.state.monsters) { const a = actors.get(m.id); if (a) a.yaw = Math.atan2(-m.x, -m.y); }
    drawCamButtons(); introT = 0;
    if (o.hatch) { // Eier stehen an den Startplätzen und platzen nacheinander auf, das eigene zuletzt
      const order = sim.state.monsters.map((m) => m.id).sort((a, b) => (a === followId ? 1 : 0) - (b === followId ? 1 : 0)); const gap = Math.min(0.32, 4.2 / Math.max(1, order.length));
      order.forEach((id, i) => { const a = actors.get(id); const m = sim.state.monsters.find((x) => x.id === id); if (!a || !m) return; a.hatchAt = 1.6 + i * gap + (id === followId ? 0.5 : 0); a.egg.position.set(m.x, 0, m.y); a.egg.scale.setScalar(0.001); a.dropAt = i * 0.05; });
      hatchEnd = 1.6 + order.length * gap + (followId ? 0.5 : 0) + 1.5;
      banner(o.title || 'THE EGGS ARE IN', 1.4);
    } else if (o.intro > 0) banner(o.title || 'CHOOSE YOUR MONSTER!', 0); else start();
  }
  function start() { if (started) return; started = true; introLeft = 0; banner('FIGHT!', 0.9); }

  let last = o.manual ? 0 : performance.now(); let disposed = false; let simTime = 0;
  function frame(now) {
    if (disposed) return;
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const w = container.clientWidth || 1, h = container.clientHeight || 1;
    if (renderer.domElement.width !== Math.floor(w * renderer.getPixelRatio()) || renderer.domElement.height !== Math.floor(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
    const base = Math.max(10, Math.min(20, Math.min(w, h * 1.2) / 52)) * (o.uiScale || 1); if (ui.dataset.base !== String(base)) { ui.dataset.base = String(base); ui.style.fontSize = base + 'px'; }
    if (!started && o.hatch) { // Eier fallen herein, wackeln immer stärker und platzen auf
      introT += dt;
      for (const a of actors.values()) {
        if (a.hatched || !a.egg) continue;
        const since = introT - (a.dropAt || 0); const near = Math.max(0, 1 - (a.hatchAt - introT) / 1.2);
        a.egg.scale.setScalar(since <= 0 ? 0.001 : since < 0.35 ? (since / 0.35) * 1.15 : 1 + Math.sin(introT * 9 + a.hatchAt * 7) * 0.02);
        a.egg.rotation.z = Math.sin(introT * (10 + near * 16) + a.hatchAt * 5) * (0.04 + near * 0.2); a.egg.position.y = Math.abs(Math.sin(introT * (8 + near * 10) + a.hatchAt)) * near * 0.14;
        if (introT >= a.hatchAt) {
          a.hatched = true; a.pop = 0.001; a.holder.visible = true; const p = a.egg.position; const c = mainColor(a.e);
          FX.spray('normal', p.x, 0.7, p.z, 14, 4.2, 0.2); FX.stars(p.x, 0.9, p.z, c, 4, 0.55); ring(p.x, p.z, 0.2, 1.3, c, 0.35, 0.9); scene.remove(a.egg); a.egg = null; rig.kick = Math.max(rig.kick, a.e.id === followId ? 1 : 0.25);
          if (a.e.id === followId) banner(`${escapeHtml(a.e.name)}!<small>your egg hatched</small>`, 1.4);
        }
      }
      if (introT >= hatchEnd && o.autoStart !== false) start();
    } else if (!started && o.intro > 0 && o.autoStart !== false) { introLeft -= dt; if (introLeft <= 0) start(); }
    slowCool -= dt; const sdt = slowLeft > 0 ? dt * 0.3 : dt; slowLeft -= dt; // kurze Zeitlupe bei großen Angriffen
    if (started && !sim.state.done) {
      acc += sdt * speed; let guard = 0;
      while (acc >= DT && guard++ < 12 && !sim.state.done) { acc -= DT; for (const e of sim.step()) handle(e); }
      if (sim.state.done && !ended) { ended = true; const placements = sim.state.monsters.slice().sort((a, b) => (a.place ?? 1) - (b.place ?? 1)).map((m) => m.id); o.onEnd?.({ winnerId: sim.state.winnerId, placements }); }
    }
    const alpha = started && !sim.state.done ? acc / DT : 1; simTime += sdt;
    // Zone
    const zr = sim.state.zone.r; world.edge.scale.setScalar(zr); world.edge.material.opacity = 0.6 + 0.3 * Math.sin(now * 0.008);
    if (Math.abs(zr - world.zr) > 0.03 && zr < R) { world.zr = zr; world.danger.geometry.dispose(); world.danger.geometry = new THREE.RingGeometry(zr, R + 1.5, 56); }
    const zoneActive = zr < R - 0.05; world.danger.visible = world.edge.visible = zoneActive;
    // Monster
    for (const m of sim.state.monsters) {
      const a = actors.get(m.id); if (!a) continue;
      const x = lerp(m.px ?? m.x, m.x, alpha), z = lerp(m.py ?? m.y, m.y, alpha);
      let y = 0;
      if (m.dash) { const k = Math.min(1, Math.max(0, (m.dash.t + alpha) / (m.dash.total || 5))); y = 4 * k * (1 - k) * 1.5; }
      a.lunge = Math.max(0, a.lunge - dt * 6); a.hurt = Math.max(0, a.hurt - dt * 5);
      const lx = m.fx * a.lunge * 0.45, lz = m.fy * a.lunge * 0.45;
      a.holder.position.set(x + lx + (a.hurt ? Math.sin(now * 0.09) * 0.05 * a.hurt : 0), y, z + lz);
      a.yaw = lerpAngle(a.yaw, Math.atan2(m.fx, m.fy), Math.min(1, dt * 10)); a.holder.rotation.y = a.yaw;
      let sc = 1; if (a.pop < 1) { a.pop = Math.min(1, a.pop + dt * 2.6); const k = a.pop; sc = k === 1 ? 1 : 1 + Math.pow(2, -9 * k) * Math.sin((k * 9 - 0.75) * 2.094) * 1.0 - (1 - k) * 0.25; sc = Math.max(0.05, sc); }
      if (m.cast) { const k = 1 - m.cast.t / (m.cast.total || 0.3); sc = 1 + 0.14 * Math.sin(k * Math.PI); }
      if (a.dead) { a.dead = Math.min(1, a.dead + dt * 2.2); sc = Math.max(0.001, 1 - a.dead); a.holder.rotation.y += a.dead * 9; a.holder.position.y = a.dead * 0.8; if (a.dead >= 1) a.holder.visible = false; }
      if (m.id === winnerId) a.holder.position.y = Math.abs(Math.sin(now * 0.008)) * 0.6;
      a.holder.scale.setScalar(sc);
      updateMonster(a.root, simTime * (m.alive ? 1.6 : 0));
      // HP-Balken, Namen, Angriffs-Label
      const p = toScreen(a.holder.position.x, a.height + 0.28 + a.holder.position.y, a.holder.position.z);
      const showHp = m.alive && p.ok && started && !winnerId;
      a.hp.style.display = showHp ? 'block' : 'none';
      if (showHp) { a.hp.style.left = p.x + 'px'; a.hp.style.top = p.y + 'px'; }
      if (a.shownHp !== m.hp) { a.shownHp = m.hp; const f = Math.max(0, m.hp / m.maxHp); const col = f < 0.3 ? '#ff5a4a' : f < 0.6 ? '#f5c542' : '#4cc38a'; a.hpFill.style.width = a.fillEl.style.width = `${f * 100}%`; a.hpFill.style.background = a.fillEl.style.background = col; }
      const showTag = m.alive && p.ok && (started ? m.id === followId : a.hatched);
      a.tag.style.display = showTag ? 'block' : 'none';
      if (showTag) { a.tag.style.left = p.x + 'px'; a.tag.style.top = p.y - (started ? 6 : 2) + 'px'; }
      if (a.label) { a.labelLife -= dt; if (a.labelLife <= 0 || !m.alive) { a.label.remove(); a.label = null; } else { a.label.style.left = p.x + 'px'; a.label.style.top = p.y - (m.id === followId ? 24 : 6) + 'px'; a.label.style.opacity = Math.min(1, a.labelLife * 4); } }
    }
    // Geschosse
    const seen = new Set();
    for (const p of sim.state.projectiles) {
      seen.add(p.id); let shot = shots.get(p.id);
      if (!shot) { shot = FX.shot(p.element, p.move === 1, actors.get(p.by)?.mini); shots.set(p.id, shot); }
      shot.group.position.set(lerp(p.px ?? p.x, p.x, alpha), 0.62, lerp(p.py ?? p.y, p.y, alpha)); shot.update(sdt);
    }
    for (const [id, shot] of shots) if (!seen.has(id)) { shot.dispose(); shots.delete(id); }
    for (let i = fx.length - 1; i >= 0; i--) if (!fx[i](sdt)) fx.splice(i, 1);
    const aliveCount = sim.state.monsters.reduce((c, m) => c + (m.alive ? 1 : 0), 0);
    const showMap = started && !winnerId && aliveCount > 3 && mode === 'auto' && (o.director === true || (o.director !== false && camera.aspect < 0.8));
    if (mapEl.style.display !== (showMap ? 'block' : 'none')) mapEl.style.display = showMap ? 'block' : 'none';
    if (showMap) {
      const c = mapCtx; const k = 70 / (R + 0.6); c.clearRect(0, 0, 160, 160); c.save(); c.translate(80, 80);
      c.fillStyle = '#cdeccf'; c.beginPath(); c.arc(0, 0, R * k, 0, 7); c.fill();
      if (sim.state.zone.r < R - 0.05) { c.strokeStyle = '#ff3b30'; c.lineWidth = 3; c.beginPath(); c.arc(0, 0, sim.state.zone.r * k, 0, 7); c.stroke(); }
      const sn = Math.sin(-rig.yaw), cs = Math.cos(-rig.yaw); // Karte dreht mit der Kamera
      for (const m of sim.state.monsters) { if (!m.alive) continue; const x = (m.x * cs - m.y * sn) * k, y = (m.x * sn + m.y * cs) * k; c.fillStyle = colorOf(m.element); c.strokeStyle = '#2b2523'; c.lineWidth = m.id === followId ? 4 : 2; c.beginPath(); c.arc(x, y, m.id === followId ? 8 : 6, 0, 7); c.fill(); c.stroke(); }
      if (focus.since !== undefined) { const x = (focus.x * cs - focus.z * sn) * k, y = (focus.x * sn + focus.z * cs) * k; c.strokeStyle = 'rgba(43,37,35,.75)'; c.lineWidth = 2.5; c.setLineDash([6, 5]); c.beginPath(); c.arc(x, y, focus.r * k, 0, 7); c.stroke(); }
      c.restore();
    }
    if (leftEl.dataset.n !== String(aliveCount)) { leftEl.dataset.n = String(aliveCount); leftEl.textContent = `${aliveCount} left`; }
    leftEl.style.display = started && !winnerId && aliveCount > 2 ? 'block' : 'none';
    updateCamera(dt, now);
    renderer.render(scene, camera);
    if (!o.manual) raf = requestAnimationFrame(frame);
  }
  reset();
  let raf = o.manual ? 0 : requestAnimationFrame(frame);

  return {
    get sim() { return sim; },
    start,
    setCamera,
    setFollow(id) { followId = id; },
    setSpeed(x) { speed = x; },
    restart() { reset(); },
    later,
    // Nur mit opts.manual: ein Bild weiter (ms = Bilddauer). Reihenfolge: laufende CSS-Animationen vorziehen, Timer, Bild, neue Animationen anhalten.
    step(ms = 1000 / 30) {
      for (const a of document.getAnimations()) if (stepped.has(a)) a.currentTime = (Number(a.currentTime) || 0) + ms;
      vnow += ms;
      for (let i = timers.length - 1; i >= 0; i--) if (timers[i].at <= vnow) timers.splice(i, 1)[0].fn();
      frame(vnow);
      for (const a of document.getAnimations()) if (!stepped.has(a)) { stepped.add(a); a.pause(); a.currentTime = 0; }
    },
    dispose() {
      disposed = true; cancelAnimationFrame(raf); cancel(bannerTimer);
      dom.removeEventListener('pointerdown', onDown); dom.removeEventListener('pointermove', onMove); dom.removeEventListener('pointerup', onUp); dom.removeEventListener('pointercancel', onUp); dom.removeEventListener('wheel', onWheel);
      renderer.dispose(); dom.remove(); ui.remove(); style.remove();
    },
  };
}
