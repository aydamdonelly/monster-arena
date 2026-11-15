// monster-kit: Genom -> süßes Low-Poly-Monster in three.js.
// Framework-frei: läuft im Web, in einer Expo-DOM-Component und in der Arena-Seite.
import * as THREE from 'three';

const INK = '#2b2523';

// ---------- Zufall (deterministisch pro Genom) ----------
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function hashString(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mat = (color, opts = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.9, metalness: 0, ...opts });
const basic = (color, opts = {}) => new THREE.MeshBasicMaterial({ color, ...opts });

// Verschiebt Ecken leicht, gleiche Position -> gleiche Verschiebung (Facetten bleiben geschlossen)
function jitter(geo, amount, seed) {
  const pos = geo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const r = rng(hashString(`${v.x.toFixed(3)},${v.y.toFixed(3)},${v.z.toFixed(3)}`) ^ seed);
    v.multiplyScalar(1 + (r() - 0.5) * amount);
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  pos.needsUpdate = true;
}
function mapVerts(geo, fn) {
  const pos = geo.attributes.position; const v = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) { v.fromBufferAttribute(pos, i); fn(v); pos.setXYZ(i, v.x, v.y, v.z); }
  pos.needsUpdate = true;
}

// ---------- Körperformen ----------
// Proportionen strecken den Körper vor allen Raycasts, damit Gesicht und Teile automatisch mitwandern.
const PROPORTIONS = { normal: [1, 1, 1], tall: [0.84, 1.24, 0.9], wide: [1.24, 0.84, 1.04] };
// Wo bei gebogenen Formen die Spitze liegt (x), damit Stiel/Krone dort sitzen
const TOP_X = { bean: 0.42 };
function bodyGeometry(shape, seed, proportions) {
  let g;
  switch (shape) {
    case 'bean': // lang und oben gebogen: Banane, Chili, Gurke, Karotte
      g = new THREE.CapsuleGeometry(0.6, 1.0, 2, 8).toNonIndexed(); jitter(g, 0.04, seed);
      mapVerts(g, (v) => { const k = 1 - 0.4 * smooth(0.1, 1.1, v.y); v.x *= k; v.z *= k; const t = Math.max(0, v.y); v.x += 0.36 * t * t; });
      break;
    case 'strawberry':
      g = new THREE.IcosahedronGeometry(1, 1); jitter(g, 0.08, seed);
      mapVerts(g, (v) => { const t = (v.y + 1) / 2; const s = 0.22 + 0.86 * smooth(0, 0.7, t) - 0.14 * smooth(0.86, 1, t); v.x *= s; v.z *= s * 0.9; v.y *= 1.1; });
      break;
    case 'egg':
      g = new THREE.IcosahedronGeometry(1, 1); jitter(g, 0.06, seed);
      mapVerts(g, (v) => { const k = 1 - 0.22 * Math.max(0, v.y); v.x *= k; v.z *= k * 0.92; v.y *= 1.25; });
      break;
    case 'drop':
      g = new THREE.IcosahedronGeometry(1, 1); jitter(g, 0.05, seed);
      mapVerts(g, (v) => { const k = v.y > 0.15 ? Math.max(0.04, 1 - (v.y - 0.15) * 1.1) : 1; v.x *= k; v.z *= k * 0.92; if (v.y > 0) v.y *= 1.4; });
      break;
    case 'cylinder':
      g = new THREE.CylinderGeometry(0.82, 0.76, 1.7, 9, 2).toNonIndexed(); jitter(g, 0.03, seed);
      break;
    case 'box':
      g = new THREE.BoxGeometry(1.6, 1.5, 1.3, 2, 2, 2).toNonIndexed();
      mapVerts(g, (v) => { const n = v.clone().normalize().multiplyScalar(1.05); v.lerp(n, 0.35); });
      jitter(g, 0.04, seed);
      break;
    case 'cactus':
      g = new THREE.CapsuleGeometry(0.62, 1.1, 2, 7).toNonIndexed(); jitter(g, 0.04, seed);
      break;
    default: // blob
      g = new THREE.IcosahedronGeometry(1, 1); jitter(g, 0.07, seed);
      mapVerts(g, (v) => { v.y *= 1.18; if (v.y < -0.75) v.y = -0.75 + (v.y + 0.75) * 0.35; v.z *= 0.92; });
  }
  const [sx, sy, sz] = PROPORTIONS[proportions] || PROPORTIONS.normal;
  g.scale(sx, sy, sz);
  g.computeVertexNormals(); g.computeBoundingBox(); g.computeBoundingSphere();
  return g;
}

// ---------- Oberflächen-Hilfen (Raycasts gegen den Körper) ----------
const ray = new THREE.Raycaster();
function hit(body, origin, dir) {
  ray.set(origin, dir.clone().normalize());
  const h = ray.intersectObject(body, false)[0];
  return h ? h.point.clone() : null;
}
const frontPoint = (body, x, y) => hit(body, new THREE.Vector3(x, y, 10), new THREE.Vector3(0, 0, -1));
// Kleiner Versatz, damit der Strahl nicht exakt durch einen Pol-Vertex läuft; Treffer unterhalb der Mitte ist ungültig.
function topPoint(body, x, z) {
  const bb = body.geometry.boundingBox; const cy = (bb.max.y + bb.min.y) / 2;
  const p = hit(body, new THREE.Vector3(x + 0.011, 10, z + 0.013), new THREE.Vector3(0, -1, 0));
  return p && p.y > cy ? p : new THREE.Vector3(x, bb.max.y - 0.02, z);
}
const apexPoint = (body) => topPoint(body, body.userData.topX || 0, 0);
const sidePoint = (body, side, y) => hit(body, new THREE.Vector3(10 * side, y, 0), new THREE.Vector3(-side, 0, 0));
const alongDir = (body, center, dir) => hit(body, center.clone().addScaledVector(dir, 10), dir.clone().negate());
const softNormal = (p, center) => p.clone().sub(center).normalize().lerp(new THREE.Vector3(0, 0, 1), 0.55).normalize();
function stickTo(mesh, point, normal, offset = 0.015) {
  mesh.position.copy(point).addScaledVector(normal, offset);
  mesh.lookAt(mesh.position.clone().add(normal));
  return mesh;
}
function randomDir(rand) {
  const u = rand() * 2 - 1; const a = rand() * Math.PI * 2; const r = Math.sqrt(1 - u * u);
  return new THREE.Vector3(r * Math.cos(a), u, r * Math.sin(a));
}

// ---------- Gesicht ----------
const EYE_HEIGHT = { strawberry: 0.2, drop: -0.02, egg: 0.05, cylinder: 0.06, box: 0.06, cactus: 0.1, blob: 0.08, bean: 0.03 };
// Bildschirm (Handy, Laptop): dunkle Fläche, die sich per Raycast an den Körper schmiegt
function addScreen(rig, body, bb, center, eyeY, color) {
  const h = bb.max.y - bb.min.y; const w = bb.max.x - bb.min.x;
  const sw = w * 0.68; const sh = h * 0.4; const cy = eyeY - h * 0.06;
  const g = new THREE.PlaneGeometry(sw, sh, 16, 10); const pos = g.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i); const y = pos.getY(i) + cy;
    const p = frontPoint(body, x, y);
    pos.setXYZ(i, x, y, (p ? p.z : bb.max.z) + 0.02);
  }
  g.computeVertexNormals();
  const dark = new THREE.Color(color || '#1f2633').lerp(new THREE.Color('#121620'), 0.75);
  rig.add(new THREE.Mesh(g, mat(dark, { roughness: 0.35, flatShading: false })));
}
function addFace(rig, body, bb, center, face) {
  const h = bb.max.y - bb.min.y; const w = bb.max.x - bb.min.x;
  const eyeY = center.y + h * (face.eyeHeight ?? EYE_HEIGHT[face.shape] ?? 0.08);
  const dx = w * (face.eyeSpread ?? 0.17);
  if (face.screen) addScreen(rig, body, bb, center, eyeY, face.screen);
  const lift = face.screen ? 0.024 : 0; // Gesicht liegt dann auf dem Bildschirm
  const ink = face.screen ? basic('#9ff3ff') : mat(INK, { roughness: 0.35, flatShading: false });
  const mouthDark = face.screen ? '#9ff3ff' : '#5a2a2a';
  const white = basic('#ffffff');
  const kinds = face.eyes === 'wink' ? ['dot', 'happy'] : [face.eyes || 'dot', face.eyes || 'dot'];
  const eyes = [];
  [-1, 1].forEach((s, i) => {
    const p = frontPoint(body, s * dx, eyeY); if (!p) return;
    let e;
    if (kinds[i] === 'happy') {
      e = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.03, 6, 14, Math.PI), ink);
    } else {
      const r = kinds[i] === 'big' ? 0.15 : 0.105;
      e = new THREE.Group();
      const ball = new THREE.Mesh(new THREE.SphereGeometry(r, 16, 12), ink); ball.scale.z = 0.45; e.add(ball);
      const hl = new THREE.Mesh(new THREE.SphereGeometry(r * 0.32, 10, 8), white); hl.position.set(-r * 0.3, r * 0.38, r * 0.42); e.add(hl);
    }
    stickTo(e, p, softNormal(p, center), 0.015 + lift); rig.add(e); eyes.push(e);
  });

  const mp = frontPoint(body, 0, eyeY - h * (face.beak ? 0.1 : 0.12));
  if (mp && face.beak) { // Entenschnabel ersetzt den Mund
    const bill = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 5), mat(face.beak));
    bill.scale.set(1.3, 0.42, 1.0); bill.position.copy(mp).add(new THREE.Vector3(0, 0, 0.07)); rig.add(bill);
  } else if (mp) {
    let m;
    if (face.mouth === 'open' || face.mouth === 'fang') {
      m = new THREE.Group();
      m.add(new THREE.Mesh(new THREE.CircleGeometry(0.15, 18, Math.PI, Math.PI), basic(face.screen ? '#2b5560' : mouthDark)));
      const tongue = new THREE.Mesh(new THREE.CircleGeometry(0.075, 14, Math.PI, Math.PI), basic('#ff8a9a'));
      tongue.position.set(0, -0.05, 0.002); m.add(tongue);
      if (face.mouth === 'fang') { const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.03, 0.07, 4), white); tooth.rotation.z = Math.PI; tooth.position.set(0.06, -0.03, 0.004); m.add(tooth); }
      stickTo(m, mp, softNormal(mp, center), 0.012 + lift);
    } else if (face.mouth === 'o') {
      m = stickTo(new THREE.Mesh(new THREE.CircleGeometry(0.06, 14), basic(mouthDark)), mp, softNormal(mp, center), 0.012 + lift);
    } else {
      m = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.028, 6, 14, Math.PI), ink);
      stickTo(m, mp, softNormal(mp, center), 0.012 + lift); m.rotateZ(Math.PI); // ∪
    }
    rig.add(m);
  }

  if (face.blush !== false) {
    [-1, 1].forEach((s) => {
      const p = frontPoint(body, s * dx * 1.6, eyeY - h * 0.09); if (!p) return;
      const b = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), basic('#ff7f95', { transparent: true, opacity: 0.55 }));
      b.scale.y = 0.7; rig.add(stickTo(b, p, softNormal(p, center), 0.01 + lift));
    });
  }
  return eyes;
}

// ---------- Arme und Beine ----------
function addLimbs(rig, body, bb, center, limbs, bodyColor, skipRightArm) {
  const out = { arms: [], legs: [] };
  const h = bb.max.y - bb.min.y; const w = bb.max.x - bb.min.x;
  const sticks = limbs.style !== 'stub';
  const m = sticks ? mat(limbs.color || INK, { roughness: 0.6, flatShading: false }) : mat(bodyColor);
  [-1, 1].forEach((s) => {
    if (s === 1 && skipRightArm) return;
    const p = sidePoint(body, s, center.y - h * 0.05); if (!p) return;
    const pivot = new THREE.Group(); pivot.position.copy(p);
    const len = sticks ? 0.42 : 0.28; const rad = sticks ? 0.045 : 0.13;
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(rad, len, 3, 8), m);
    arm.rotation.z = Math.PI / 2; arm.position.x = s * (len / 2 + rad * 0.5); pivot.add(arm);
    if (sticks) { const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), m); hand.position.x = s * (len + rad * 1.5); pivot.add(hand); }
    const pose = limbs.pose || 'cheer';
    const up = pose === 'cheer' ? 0.85 : pose === 'wave' ? (s > 0 ? 1.0 : -0.55) : -0.6;
    pivot.rotation.z = s * up; pivot.userData = { side: s, base: s * up };
    rig.add(pivot); out.arms.push(pivot);
  });
  [-1, 1].forEach((s) => {
    const x = s * w * 0.2;
    const p = hit(body, new THREE.Vector3(x, -10, 0.05), new THREE.Vector3(0, 1, 0));
    const base = p ? p.y : bb.min.y;
    const legLen = sticks ? 0.3 : 0.08; const legRad = sticks ? 0.05 : 0.17;
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(legRad, legLen, 3, 8), m);
    leg.position.set(x, base - legLen / 2 - (sticks ? 0.02 : 0.04), 0.05); rig.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(sticks ? 0.11 : 0.19, 12, 8), m);
    foot.scale.set(1, 0.55, 1.35); foot.position.set(x, base - legLen - (sticks ? 0.07 : 0.12), 0.1);
    rig.add(foot); out.legs.push(leg, foot);
  });
  return out;
}

// ---------- Teile ----------
function addParts(rig, body, bb, center, parts, bodyColor, rand, shape) {
  const top = bb.max.y; const h = top - bb.min.y; const w = bb.max.x - bb.min.x;
  const anim = { floaters: [] };
  const faceZone = (p) => Math.abs(p.x) < w * 0.33 && p.y > center.y - h * 0.2 && p.y < center.y + h * 0.22 && p.z > 0;
  for (const part of parts) {
    const color = part.color || '#ffd27a';
    switch (part.type) {
      case 'headphones': {
        const m = mat(color); const y0 = center.y + h * 0.1;
        const sp = sidePoint(body, 1, y0); const cx = (sp ? Math.abs(sp.x) : w / 2) + 0.07;
        const bx = Math.max(cx, w / 2 + 0.07);
        [-1, 1].forEach((s) => {
          const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 12), m); cup.rotation.z = Math.PI / 2; cup.position.set(s * cx, y0, -0.04); rig.add(cup);
          const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.04, 12), mat(new THREE.Color(color).multiplyScalar(0.72))); cap.rotation.z = Math.PI / 2; cap.position.set(s * (cx + 0.09), y0, -0.04); rig.add(cap);
        });
        const pts = [[-cx, y0 + 0.16], [-bx, (y0 + top) / 2], [-bx * 0.72, top + 0.06], [0, top + 0.15], [bx * 0.72, top + 0.06], [bx, (y0 + top) / 2], [cx, y0 + 0.16]];
        const curve = new THREE.CatmullRomCurve3(pts.map(([x, y]) => new THREE.Vector3(x, Math.max(y, y0), -0.04)));
        rig.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 28, 0.05, 6, false), m));
        break;
      }
      case 'cap': { // Flaschendeckel, Stiftkappe, Deckel
        const tp = apexPoint(body); const r = Math.min(0.3, w * 0.19);
        const neck = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.05, r * 1.6, 0.16, 10), mat(bodyColor)); neck.position.copy(tp).add(new THREE.Vector3(0, 0.04, 0)); rig.add(neck);
        const c = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.12, r * 1.12, 0.22, 10), mat(color)); c.position.copy(tp).add(new THREE.Vector3(0, 0.22, 0)); rig.add(c);
        break;
      }
      case 'straw': {
        const tp = apexPoint(body);
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 1.0, 8), mat(color)); s.position.copy(tp).add(new THREE.Vector3(0.14, 0.32, -0.08)); s.rotation.z = -0.3; rig.add(s);
        break;
      }
      case 'stem': { // Apfel, Kirsche, Banane, Chili
        const tp = apexPoint(body); const bean = shape === 'bean';
        const st = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.06, bean ? 0.2 : 0.28, 5), mat(color)); st.position.copy(tp).add(new THREE.Vector3(bean ? 0.05 : 0.02, bean ? 0.06 : 0.11, 0)); st.rotation.z = bean ? -0.75 : -0.3; rig.add(st);
        if (!bean) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.34, 4), mat('#6cbf4a')); leaf.scale.z = 0.3; leaf.position.copy(tp).add(new THREE.Vector3(0.19, 0.15, 0)); leaf.rotation.z = -1.2; rig.add(leaf); }
        break;
      }
      case 'spots': { // Pilz, Marienkäfer, Cookie, Pizza
        const m = mat(color, { flatShading: false });
        for (let i = 0; i < 16; i++) {
          const d = randomDir(rand); if (d.z < -0.35) continue;
          const p = alongDir(body, center, d); if (!p || faceZone(p) || p.y < bb.min.y + h * 0.12) continue;
          const s = new THREE.Mesh(new THREE.SphereGeometry(0.1 + rand() * 0.07, 12, 6), m); s.scale.z = 0.22;
          rig.add(stickTo(s, p, p.clone().sub(center).normalize(), 0.004));
        }
        break;
      }
      case 'leafCrown': {
        const m = mat(color); const tp = apexPoint(body) || new THREE.Vector3(0, top, 0);
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 + rand() * 0.3;
          const pivot = new THREE.Group();
          pivot.position.copy(tp).add(new THREE.Vector3(Math.cos(a) * 0.08, -0.05, Math.sin(a) * 0.08));
          const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.55, 4), m); leaf.scale.z = 0.35; leaf.position.y = 0.24;
          pivot.add(leaf); pivot.rotation.set(0, -a, -0.95 - rand() * 0.25); rig.add(pivot);
        }
        const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.22, 5), m); stem.position.copy(tp).add(new THREE.Vector3(0, 0.1, 0)); rig.add(stem);
        break;
      }
      case 'seeds': {
        const m = mat(color, { flatShading: false });
        for (let i = 0; i < 26; i++) {
          const d = randomDir(rand); if (d.z < -0.1) continue;
          const p = alongDir(body, center, d); if (!p || faceZone(p)) continue;
          const s = new THREE.Mesh(new THREE.OctahedronGeometry(0.062), m); s.scale.set(0.7, 1.25, 0.35);
          rig.add(stickTo(s, p, p.clone().sub(center).normalize(), 0.01));
        }
        break;
      }
      case 'spikes': {
        const m = mat(color);
        for (let i = 0; i < 22; i++) {
          const d = randomDir(rand); const p = alongDir(body, center, d); if (!p || faceZone(p) || p.y < bb.min.y + h * 0.15) continue;
          const n = p.clone().sub(center).normalize(); const c = new THREE.Mesh(new THREE.ConeGeometry(0.045, 0.16, 5), m);
          c.position.copy(p).addScaledVector(n, 0.06); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); rig.add(c);
        }
        break;
      }
      case 'horns': case 'ears': {
        const m = mat(part.type === 'ears' ? bodyColor : color);
        [-1, 1].forEach((s) => {
          const p = topPoint(body, s * w * 0.24, 0.05); if (!p) return;
          const c = new THREE.Mesh(new THREE.ConeGeometry(part.type === 'ears' ? 0.17 : 0.11, part.type === 'ears' ? 0.32 : 0.36, part.type === 'ears' ? 4 : 6), m);
          if (part.type === 'ears') c.scale.z = 0.45;
          c.position.copy(p).add(new THREE.Vector3(s * 0.02, 0.12, 0)); c.rotation.z = -s * 0.38; rig.add(c);
          if (part.type === 'ears') { const inner = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.2, 4), mat('#ff9fb0')); inner.scale.z = 0.3; inner.position.copy(c.position).add(new THREE.Vector3(0, -0.02, 0.05)); inner.rotation.z = c.rotation.z; rig.add(inner); }
        });
        break;
      }
      case 'antenna': {
        const tp = apexPoint(body) || new THREE.Vector3(0, top, 0);
        const stalk = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 6), mat(INK)); stalk.position.copy(tp).add(new THREE.Vector3(-0.025, 0.17, 0)); stalk.rotation.z = 0.15; rig.add(stalk);
        const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.085, 0), mat(color)); ball.position.copy(tp).add(new THREE.Vector3(-0.055, 0.37, 0)); rig.add(ball);
        anim.floaters.push({ mesh: ball, base: ball.position.y, amp: 0.02, speed: 3 });
        break;
      }
      case 'handle': {
        const p = sidePoint(body, 1, center.y); if (!p) break;
        const t = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.075, 6, 12, Math.PI), mat(color)); t.position.copy(p).add(new THREE.Vector3(-0.06, 0, 0)); t.rotation.z = -Math.PI / 2; rig.add(t);
        break;
      }
      case 'coffee': {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(w * 0.415, 9), mat(color)); disc.rotation.x = -Math.PI / 2; disc.position.set(0, top + 0.006, 0); rig.add(disc);
        break;
      }
      case 'steam': {
        const m = mat('#ffffff', { transparent: true, opacity: 0.9 });
        for (let i = 0; i < 3; i++) {
          const s = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1 - i * 0.017, 0), m); s.position.set((i - 1) * 0.13, top + 0.25 + i * 0.2, 0); rig.add(s);
          anim.floaters.push({ mesh: s, base: s.position.y, amp: 0.06, speed: 2 + i, phase: i });
        }
        break;
      }
      case 'flower': {
        const tp = apexPoint(body) || new THREE.Vector3(0, top, 0); const petal = mat(color);
        for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; const pe = new THREE.Mesh(new THREE.IcosahedronGeometry(0.08, 0), petal); pe.position.copy(tp).add(new THREE.Vector3(Math.cos(a) * 0.1, 0.06, Math.sin(a) * 0.1)); rig.add(pe); }
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry(0.06, 0), mat('#ffd23f')); c.position.copy(tp).add(new THREE.Vector3(0, 0.09, 0)); rig.add(c);
        break;
      }
      case 'tail': {
        const start = alongDir(body, center, new THREE.Vector3(0.55, -0.5, -0.65).normalize()); if (!start) break;
        const curve = new THREE.CatmullRomCurve3([start, start.clone().add(new THREE.Vector3(0.32, -0.06, -0.2)), start.clone().add(new THREE.Vector3(0.58, 0.22, -0.25)), start.clone().add(new THREE.Vector3(0.66, 0.5, -0.2))]);
        rig.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 12, 0.05, 6, false), mat(color)));
        const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), mat(color)); tip.scale.z = 0.4; tip.position.copy(curve.getPoint(1));
        tip.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), curve.getTangent(1)); rig.add(tip);
        break;
      }
      case 'wings': {
        const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(0.7, 0.35); shape.lineTo(0.55, -0.05); shape.lineTo(0.75, -0.25); shape.lineTo(0, -0.1);
        const m = mat(color, { side: THREE.DoubleSide });
        [-1, 1].forEach((s) => {
          const wing = new THREE.Mesh(new THREE.ShapeGeometry(shape), m); wing.position.set(s * w * 0.22, center.y + h * 0.12, -0.35); wing.scale.x = s; wing.rotation.y = s * 0.6; rig.add(wing);
          anim.floaters.push({ mesh: wing, flap: true, side: s });
        });
        break;
      }
      default: break;
    }
  }
  return anim;
}

function makeShadow(width) {
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64); grd.addColorStop(0, 'rgba(0,0,0,0.26)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.scale.set(width * 1.25, width * 0.75, 1); m.position.y = 0.005;
  return m;
}

// ---------- Öffentliche API ----------
export function buildMonster(genome) {
  const seed = genome.seed ?? hashString(JSON.stringify(genome));
  const rand = rng(seed);
  const bodyColor = genome.body?.color || '#f2a3b3';
  const shape = genome.body?.shape || 'blob'; const proportions = shape === 'bean' && genome.body?.proportions === 'wide' ? 'normal' : genome.body?.proportions || 'normal';
  const root = new THREE.Group(); root.name = genome.name || 'monster';
  const rig = new THREE.Group(); root.add(rig);
  const body = new THREE.Mesh(bodyGeometry(shape, seed, proportions), mat(bodyColor));
  body.userData.topX = (TOP_X[shape] || 0) * (PROPORTIONS[proportions] || PROPORTIONS.normal)[0];
  body.updateMatrixWorld(true);
  const bb = body.geometry.boundingBox.clone(); const center = bb.getCenter(new THREE.Vector3());
  const parts = genome.parts || [];
  const has = (t) => parts.some((p) => p.type === t); const colorOf = (t, d) => parts.find((p) => p.type === t)?.color || d;
  const eyes = addFace(rig, body, bb, center, { shape, ...(genome.face || {}), beak: has('beak') ? colorOf('beak', '#ffa23a') : null, screen: has('screen') ? colorOf('screen', '#1f2633') : null });
  const limbs = addLimbs(rig, body, bb, center, genome.limbs || {}, bodyColor, has('handle'));
  const anim = addParts(rig, body, bb, center, parts, bodyColor, rand, shape);
  rig.add(body);
  const box = new THREE.Box3().setFromObject(rig);
  rig.position.y = -box.min.y;
  root.add(makeShadow(bb.max.x - bb.min.x));
  root.scale.setScalar(genome.scale ?? 1);
  root.userData.monster = { rig, eyes, limbs, anim, phase: rand() * 10, baseY: rig.position.y, height: box.max.y - box.min.y };
  return root;
}

export function updateMonster(root, t) {
  const m = root.userData.monster; if (!m) return;
  const tt = t + m.phase;
  m.rig.position.y = m.baseY + Math.abs(Math.sin(tt * 2.2)) * 0.06;
  const sq = 1 + Math.sin(tt * 4.4) * 0.025; m.rig.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  m.rig.rotation.z = Math.sin(tt * 1.3) * 0.035;
  const blink = (tt % 3.7) < 0.12 ? 0.12 : 1; for (const e of m.eyes) e.scale.y = blink;
  for (const a of m.limbs.arms) a.rotation.z = a.userData.base + Math.sin(tt * 3 + a.userData.side) * 0.16;
  for (const f of m.anim.floaters) {
    if (f.flap) f.mesh.rotation.y = f.side * (0.6 + Math.sin(tt * 8) * 0.35);
    else f.mesh.position.y = f.base + Math.sin(tt * f.speed + (f.phase || 0)) * f.amp;
  }
}

// KI-Antwort (scripts/genome-test.mjs, GENOME_SCHEMA) -> Kit-Genom
export function genomeFromAI(ai, seed) {
  return {
    name: ai.name, seed, element: ai.element, lore: ai.lore, object: ai.object, traits: ai.traits,
    body: { shape: ai.shape, color: ai.colors?.body, proportions: ai.proportions || 'normal' },
    face: { eyes: ai.eyes, mouth: ai.mouth },
    limbs: { style: ai.limbStyle, pose: ai.pose },
    parts: (ai.parts || []).slice(0, 3),
  };
}

// ---------- Beispiel-Genome und Zufallsgenerator (für Test 1) ----------
export const PRESETS = [
  { name: 'Berrybop', body: { shape: 'strawberry', color: '#e5503f' }, face: { eyes: 'happy', mouth: 'smile' }, limbs: { style: 'stick', pose: 'cheer' }, parts: [{ type: 'leafCrown', color: '#76b947' }, { type: 'seeds', color: '#ffd23f' }] },
  { name: 'Mugzilla', body: { shape: 'cylinder', color: '#f4efe6' }, face: { eyes: 'dot', mouth: 'open' }, limbs: { style: 'stub', pose: 'wave' }, parts: [{ type: 'handle', color: '#f4efe6' }, { type: 'coffee', color: '#7a4b2e' }, { type: 'steam' }] },
  { name: 'Pricklet', body: { shape: 'cactus', color: '#5fae6e' }, face: { eyes: 'wink', mouth: 'fang' }, limbs: { style: 'stick', pose: 'wave' }, parts: [{ type: 'spikes', color: '#eef7d8' }, { type: 'flower', color: '#ff7aa8' }] },
  { name: 'Hornbun', body: { shape: 'blob', color: '#f2a3b3' }, face: { eyes: 'wink', mouth: 'open' }, limbs: { style: 'stub', pose: 'rest' }, parts: [{ type: 'horns', color: '#f3c27a' }, { type: 'tail', color: '#f2a3b3' }] },
];

const SHAPES = ['blob', 'egg', 'drop', 'cylinder', 'box', 'cactus', 'strawberry', 'bean'];
const COLORS = ['#f2a3b3', '#8fd3c1', '#ffd27a', '#a9c7ff', '#c7a6ff', '#ff9a7a', '#9be08a', '#f4efe6', '#e5503f', '#5fae6e'];
const EYES = ['dot', 'happy', 'wink', 'big'];
const MOUTHS = ['smile', 'open', 'fang', 'o'];
const PARTS = ['horns', 'ears', 'antenna', 'leafCrown', 'spikes', 'tail', 'wings', 'steam', 'seeds', 'flower', 'spots', 'stem', 'beak', 'headphones'];
export function randomGenome(seed) {
  const r = rng(seed); const pick = (a) => a[Math.floor(r() * a.length)];
  const parts = []; const n = 1 + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) { const t = pick(PARTS); if (!parts.some((p) => p.type === t)) parts.push({ type: t, color: pick(COLORS) }); }
  return { name: `Mon-${seed % 1000}`, seed, body: { shape: pick(SHAPES), color: pick(COLORS) }, face: { eyes: pick(EYES), mouth: pick(MOUTHS) }, limbs: { style: r() < 0.5 ? 'stick' : 'stub', pose: pick(['cheer', 'wave', 'rest']) }, parts };
}
