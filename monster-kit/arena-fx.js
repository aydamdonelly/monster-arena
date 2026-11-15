// Angriffs-Effekte für die Arena: jedes Element hat eigene Teilchen, jede Angriffsart ein eigenes Bild.
//   melee = Klingenhieb · shot = Geschoss mit Schweif · beam = Strahl mit Aufladen · burst = Eruption aus dem Boden · dash = Sturmlauf mit Einschlag
// Reine Darstellung (darf Math.random benutzen); die Kampflogik steckt in royale-sim.js.
import * as THREE from 'three';

export const THEMES = {
  fire: { c: '#ff6b4a', c2: '#ffd23f', shape: 'flame' },
  water: { c: '#3d9df3', c2: '#c9ecff', shape: 'drop' },
  plant: { c: '#4cb867', c2: '#c5ee7a', shape: 'leaf' },
  metal: { c: '#8c97a6', c2: '#f1f6fb', shape: 'shard' },
  fluff: { c: '#e98bc4', c2: '#ffe3f3', shape: 'puff' },
  spirit: { c: '#9a7bf0', c2: '#e6dcff', shape: 'wisp' },
  leaf: { c: '#4cb867', c2: '#c5ee7a', shape: 'leaf' },
  spark: { c: '#f5c542', c2: '#fff6c9', shape: 'shard' },
  rock: { c: '#a08a6a', c2: '#e2d6c2', shape: 'shard' },
  normal: { c: '#b0b6b3', c2: '#ffffff', shape: 'puff' },
};
const themeOf = (el) => THEMES[el] || THEMES.normal;

export function createFx(scene, addFx) {
  const GEO = {
    flame: new THREE.ConeGeometry(0.5, 1.3, 5),
    drop: new THREE.SphereGeometry(0.5, 8, 6),
    leaf: new THREE.OctahedronGeometry(0.6),
    shard: new THREE.TetrahedronGeometry(0.6),
    puff: new THREE.IcosahedronGeometry(0.55, 1),
    wisp: new THREE.SphereGeometry(0.45, 8, 6),
    ring: new THREE.RingGeometry(0.86, 1, 40),
    disc: new THREE.CircleGeometry(1, 28),
    cyl: new THREE.CylinderGeometry(1, 1, 1, 10),
    arc: new THREE.TorusGeometry(0.8, 0.11, 4, 14, Math.PI * 0.95),
    star: new THREE.OctahedronGeometry(0.5),
    cone: new THREE.ConeGeometry(0.5, 1, 6),
    ico: new THREE.IcosahedronGeometry(0.5, 0),
    egg: new THREE.IcosahedronGeometry(0.5, 1),
    nut: new THREE.CylinderGeometry(0.5, 0.5, 0.36, 6),
  };
  const mats = new Map();
  const mat = (color) => { if (!mats.has(color)) mats.set(color, new THREE.MeshBasicMaterial({ color })); return mats.get(color); };
  const fade = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, side: THREE.DoubleSide });
  const rnd = (a, b) => a + Math.random() * (b - a);
  const UP = new THREE.Vector3(0, 1, 0);

  // Ein Teilchen in der Form des Elements. v = Geschwindigkeit, g = Schwerkraft (negativ = steigt), life in s
  function particle(shape, x, y, z, v, life, size, color, g = 9) {
    const m = new THREE.Mesh(GEO[shape] || GEO.ico, mat(color)); m.position.set(x, y, z);
    if (shape === 'leaf') m.scale.set(size, size * 0.14, size * 0.6); else if (shape === 'drop') m.scale.set(size * 0.75, size * 1.25, size * 0.75); else m.scale.setScalar(size);
    const base = m.scale.clone(); m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); const spin = shape === 'flame' || shape === 'drop' ? 0 : rnd(4, 11);
    if (shape === 'flame' || shape === 'drop') m.rotation.set(0, rnd(0, 6), 0);
    scene.add(m); let t = 0;
    addFx((dt) => {
      t += dt; const k = t / life; v.y -= g * dt; m.position.addScaledVector(v, dt);
      if (spin) { m.rotation.x += spin * dt; m.rotation.z += spin * 0.7 * dt; }
      const s = shape === 'puff' ? Math.sin(Math.min(1, k) * Math.PI) * 1.25 : 1 - k * k;
      m.scale.copy(base).multiplyScalar(Math.max(0.001, s));
      if (k >= 1 || m.position.y < -0.2) { scene.remove(m); return false; } return true;
    });
  }
  function spray(el, x, y, z, n, power = 3, size = 0.2, up = 1) {
    const th = themeOf(el);
    for (let i = 0; i < n; i++) {
      const a = rnd(0, Math.PI * 2); const p = rnd(0.35, 1) * power;
      const rising = th.shape === 'flame' || th.shape === 'wisp' || th.shape === 'puff';
      particle(th.shape, x, y, z, new THREE.Vector3(Math.cos(a) * p, rnd(0.4, 1) * power * up * (rising ? 0.7 : 1), Math.sin(a) * p), rnd(0.35, 0.7), size * rnd(0.7, 1.3), i % 3 === 0 ? th.c2 : th.c, rising ? 1.5 : 9);
    }
  }
  function ring(x, z, r0, r1, color, dur = 0.35, opacity = 0.85, y = 0.05) {
    const material = fade(color, opacity); const m = new THREE.Mesh(GEO.ring, material); m.rotation.x = -Math.PI / 2; m.position.set(x, y, z); scene.add(m); let t = 0;
    addFx((dt) => { t += dt; const k = Math.min(1, t / dur); m.scale.setScalar(r0 + (r1 - r0) * (1 - (1 - k) * (1 - k))); material.opacity = opacity * (1 - k); if (k >= 1) { scene.remove(m); material.dispose(); return false; } return true; });
  }
  function stars(x, y, z, color, n = 3, size = 0.35) { // Treffer-Sterne: spitze Oktaeder, die kurz aufblitzen
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(GEO.star, mat(i ? color : '#ffffff')); m.position.set(x + rnd(-0.3, 0.3), y + rnd(-0.2, 0.3), z + rnd(-0.3, 0.3)); m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); scene.add(m); let t = 0; const life = rnd(0.16, 0.26); const s = size * rnd(0.7, 1.2);
      addFx((dt) => { t += dt; const k = t / life; m.scale.set(s * (0.3 + k), s * (1.8 - k), s * (0.3 + k)); m.rotation.y += dt * 9; if (k >= 1) { scene.remove(m); return false; } return true; });
    }
  }

  return {
    themeOf, ring, spray, stars,

    // Nahkampf: eine Klinge aus Licht fegt vor dem Angreifer durch, am Ziel blitzen Sterne
    slash(x, z, dx, dz, el, big) {
      const th = themeOf(el); const yaw = Math.atan2(dx, dz); const size = big ? 1.5 : 1.05;
      for (const [color, sc, delay] of [[th.c, 1, 0], ['#ffffff', 0.72, 0.03]]) {
        const material = fade(color, 0.95); const m = new THREE.Mesh(GEO.arc, material);
        const pivot = new THREE.Group(); pivot.position.set(x + dx * 0.9, 0.62, z + dz * 0.9); pivot.rotation.y = yaw; pivot.add(m);
        m.rotation.set(-0.5, 0, -0.35); m.scale.setScalar(0.01); scene.add(pivot); let t = -delay; const dur = 0.2;
        addFx((dt) => { t += dt; if (t < 0) return true; const k = Math.min(1, t / dur); m.scale.setScalar(size * sc * (0.5 + 0.8 * k)); m.rotation.z = -0.35 - 2.4 * k + 1.2; material.opacity = 0.95 * (1 - k * k); if (k >= 1) { scene.remove(pivot); material.dispose(); return false; } return true; });
      }
    },

    // Geschoss: Form je Element; update() dreht es und zieht einen Schweif
    // mini: optionale Fabrik für eine Mini-Kopie des Angreifers (die Banane wirft kleine Bananen, der Becher kleine Becher)
    shot(el, big, mini) {
      const th = themeOf(el); const g = new THREE.Group(); const s = big ? 0.36 : 0.25;
      let core; const copy = mini ? mini() : null;
      if (copy) { core = copy; core.scale.setScalar(s * 1.05); }
      else { core = new THREE.Mesh(th.shape === 'shard' ? GEO.nut : th.shape === 'leaf' ? GEO.leaf : th.shape === 'flame' ? GEO.ico : GEO.wisp, mat(th.c)); if (th.shape === 'leaf') core.scale.set(s * 2.2, s * 0.3, s * 1.2); else core.scale.setScalar(s * 1.5); }
      const inner = new THREE.Mesh(GEO.wisp, mat(th.c2)); inner.scale.setScalar(copy ? 0.001 : s * 0.8);
      const glow = new THREE.Mesh(GEO.wisp, fade(th.c, copy ? 0.2 : 0.28)); glow.scale.setScalar(s * 3.2);
      g.add(core, inner, glow); scene.add(g); let acc = 0;
      return {
        group: g,
        update(dt) {
          core.rotation.x += dt * (copy ? 9 : 14); core.rotation.y += dt * (copy ? 6 : 10); glow.scale.setScalar(s * (3 + Math.sin(performance.now() * 0.02) * 0.4));
          acc += dt; if (acc > 0.028) { acc = 0; particle(th.shape, g.position.x, g.position.y, g.position.z, new THREE.Vector3(rnd(-0.6, 0.6), rnd(0.2, 1.2), rnd(-0.6, 0.6)), 0.32, s * rnd(0.5, 0.9), Math.random() < 0.4 ? th.c2 : th.c, th.shape === 'flame' || th.shape === 'wisp' ? -2 : 5); }
        },
        dispose() { scene.remove(g); },
      };
    },

    impact(x, y, z, el, big) {
      const th = themeOf(el); spray(el, x, y, z, big ? 16 : 9, big ? 4.6 : 3.2, big ? 0.3 : 0.22);
      stars(x, y, z, th.c2, big ? 5 : 3, big ? 0.55 : 0.4); ring(x, z, 0.2, big ? 1.5 : 0.95, th.c, 0.28, 0.8);
    },

    // Aufladen vor einem Strahl: Lichtkugel wächst vor dem Angreifer, Teilchen strömen hinein
    charge(x, z, dx, dz, el, dur, big) {
      const th = themeOf(el); const material = fade(th.c2, 0.9); const m = new THREE.Mesh(GEO.wisp, material); const px = x + dx * 0.75, pz = z + dz * 0.75;
      m.position.set(px, 0.62, pz); scene.add(m); let t = 0;
      addFx((dt) => {
        t += dt; const k = Math.min(1, t / dur); m.scale.setScalar((big ? 1.1 : 0.75) * (0.1 + k) * (1 + Math.sin(t * 50) * 0.08));
        if (Math.random() < 0.6) { const a = rnd(0, Math.PI * 2); const r = rnd(0.7, 1.2); particle(th.shape, px + Math.cos(a) * r, 0.62 + rnd(-0.4, 0.5), pz + Math.sin(a) * r, new THREE.Vector3(-Math.cos(a) * r * 4, 0, -Math.sin(a) * r * 4), 0.22, 0.12, th.c, 0); }
        if (k >= 1) { scene.remove(m); material.dispose(); return false; } return true;
      });
    },

    // Strahl: farbiger Mantel, weißer Kern, Ringe laufen hindurch, am Ende sprüht es
    beam(x0, z0, x1, z1, el, big) {
      const th = themeOf(el); const dir = new THREE.Vector3(x1 - x0, 0, z1 - z0); const len = dir.length() || 1; dir.normalize();
      const w = big ? 0.42 : 0.27; const q = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      const mk = (material) => { const m = new THREE.Mesh(GEO.cyl, material); m.position.set((x0 + x1) / 2, 0.62, (z0 + z1) / 2); m.quaternion.copy(q); scene.add(m); return m; };
      const mo = fade(th.c, 0.9), mc = fade('#ffffff', 0.98); const outer = mk(mo), core = mk(mc);
      const rings = [0, 0.33, 0.66].map((off) => { const material = fade(th.c2, 0.9); const r = new THREE.Mesh(GEO.ring, material); r.quaternion.copy(q); r.rotateX(Math.PI / 2); scene.add(r); return { r, material, off }; });
      const flare = new THREE.Mesh(GEO.wisp, fade(th.c2, 0.95)); flare.position.set(x0 + dir.x * 0.5, 0.62, z0 + dir.z * 0.5); scene.add(flare);
      let t = 0; const dur = big ? 0.6 : 0.45;
      addFx((dt) => {
        t += dt; const k = Math.min(1, t / dur); const pulse = 1 + Math.sin(t * 70) * 0.12; const ww = w * (k < 0.15 ? k / 0.15 : 1 - Math.pow((k - 0.15) / 0.85, 2)) * pulse;
        outer.scale.set(Math.max(0.001, ww), len, Math.max(0.001, ww)); core.scale.set(Math.max(0.001, ww * 0.42), len, Math.max(0.001, ww * 0.42));
        for (const o of rings) { const p = (o.off + t * 2.6) % 1; o.r.position.set(x0 + dir.x * len * p, 0.62, z0 + dir.z * len * p); o.r.scale.setScalar(ww * 2.6 + 0.05); o.material.opacity = 0.9 * (1 - k); }
        flare.scale.setScalar(Math.max(0.001, ww * 2.4));
        if (Math.random() < 0.8) spray(el, x1 + rnd(-0.2, 0.2), 0.5, z1 + rnd(-0.2, 0.2), 1, 3.4, big ? 0.26 : 0.19);
        if (Math.random() < 0.5) { const p = Math.random(); particle(th.shape, x0 + dir.x * len * p, 0.62, z0 + dir.z * len * p, new THREE.Vector3(rnd(-1, 1), rnd(0.5, 2), rnd(-1, 1)), 0.3, 0.13, th.c2, 3); }
        if (k >= 1) { scene.remove(outer, core, flare); for (const o of rings) { scene.remove(o.r); o.material.dispose(); } mo.dispose(); mc.dispose(); return false; } return true;
      });
    },

    // Eruption: Säulen in der Form des Elements schießen rund um den Angreifer aus dem Boden
    eruption(x, z, radius, el, big, mini) {
      const th = themeOf(el); const n = big ? 13 : 8;
      if (mini) for (let i = 0; i < (big ? 6 : 4); i++) { // kleine Kopien des Angreifers fliegen im Bogen nach außen
        const a = (i / (big ? 6 : 4)) * Math.PI * 2 + rnd(-0.3, 0.3); const m = mini(); const sc = big ? 0.3 : 0.24; m.position.set(x, 0.3, z); scene.add(m);
        const v = new THREE.Vector3(Math.cos(a) * radius * 1.7, rnd(4.2, 5.4), Math.sin(a) * radius * 1.7); let t = 0; const life = 0.62;
        addFx((dt) => { t += dt; v.y -= 15 * dt; m.position.addScaledVector(v, dt); m.rotation.x += dt * 10; m.rotation.z += dt * 7; const k = t / life; m.scale.setScalar(sc * (k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.7) / 0.3))); if (k >= 1) { scene.remove(m); return false; } return true; });
      }
      const ground = fade(th.c, 0.35); const disc = new THREE.Mesh(GEO.disc, ground); disc.rotation.x = -Math.PI / 2; disc.position.set(x, 0.03, z); scene.add(disc); let gt = 0;
      addFx((dt) => { gt += dt; const k = Math.min(1, gt / 0.5); disc.scale.setScalar(radius * (0.3 + 0.7 * k)); ground.opacity = 0.35 * (1 - k); if (k >= 1) { scene.remove(disc); ground.dispose(); return false; } return true; });
      ring(x, z, 0.3, radius, th.c, 0.42, 0.9); ring(x, z, 0.2, radius * 0.7, '#ffffff', 0.3, 0.7);
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + rnd(-0.25, 0.25); const r = radius * (i % 2 ? rnd(0.75, 0.95) : rnd(0.35, 0.6)); const px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
        const tall = (big ? 1.5 : 1.05) * rnd(0.75, 1.2); const delay = (r / radius) * 0.16; let t = -delay; const life = rnd(0.42, 0.6);
        const geo = th.shape === 'drop' ? GEO.cyl : th.shape === 'puff' ? GEO.puff : th.shape === 'wisp' ? GEO.wisp : th.shape === 'shard' ? GEO.shard : GEO.cone;
        const m = new THREE.Mesh(geo, mat(i % 3 === 0 ? th.c2 : th.c)); const wide = th.shape === 'drop' ? 0.16 : th.shape === 'puff' ? 0.5 : th.shape === 'wisp' ? 0.3 : 0.36;
        if (th.shape === 'leaf' || th.shape === 'shard') { m.rotation.z = Math.cos(a) * -0.45; m.rotation.x = Math.sin(a) * 0.45; }
        m.position.set(px, 0, pz); m.scale.setScalar(0.001); scene.add(m);
        addFx((dt) => {
          t += dt; if (t < 0) return true; const k = Math.min(1, t / life); const up = k < 0.25 ? k / 0.25 : 1 - (k - 0.25) / 0.75; const hgt = tall * Math.max(0.001, up);
          if (th.shape === 'puff' || th.shape === 'wisp') { m.scale.setScalar(wide * (0.4 + up)); m.position.y = 0.3 + k * tall; } else { m.scale.set(wide * (0.6 + 0.4 * up), hgt, wide * (0.6 + 0.4 * up)); m.position.y = hgt * 0.5; }
          if (k >= 1) { scene.remove(m); return false; } return true;
        });
        if (i % 2 === 0) spray(el, px, 0.2, pz, 2, 3, 0.16, 1.3);
      }
    },

    // Sturmlauf: Staub und Schlieren entlang der Bahn
    streak(x0, z0, x1, z1, el) {
      const th = themeOf(el); const n = 7;
      for (let i = 0; i < n; i++) { const p = i / (n - 1); const x = x0 + (x1 - x0) * p, z = z0 + (z1 - z0) * p; particle('puff', x + rnd(-0.15, 0.15), 0.2, z + rnd(-0.15, 0.15), new THREE.Vector3(rnd(-0.4, 0.4), rnd(0.3, 0.9), rnd(-0.4, 0.4)), 0.4 + p * 0.2, 0.2, i % 2 ? '#ffffff' : th.c2, 0.5); }
    },
    landing(x, z, el, big) {
      const th = themeOf(el); ring(x, z, 0.2, big ? 1.7 : 1.25, th.c, 0.32, 0.9); ring(x, z, 0.1, big ? 1.1 : 0.8, '#ffffff', 0.24, 0.7);
      spray(el, x, 0.25, z, big ? 14 : 9, big ? 4.4 : 3.3, 0.22, 1.2); stars(x, 0.5, z, th.c2, 3, 0.45);
    },

    // KO: das Monster wird wieder zum Ei und bleibt als Marke liegen
    koEgg(x, z, color) {
      const g = new THREE.Group(); const egg = new THREE.Mesh(GEO.egg, new THREE.MeshStandardMaterial({ color: new THREE.Color(color).lerp(new THREE.Color('#ffffff'), 0.6), flatShading: true, roughness: 0.9 }));
      egg.scale.set(0.42, 0.55, 0.42); egg.position.y = 0.26; egg.rotation.z = rnd(-0.5, 0.5); g.add(egg);
      const line = new THREE.Mesh(GEO.egg, new THREE.MeshBasicMaterial({ color: '#2b2523', side: THREE.BackSide })); line.scale.set(0.47, 0.6, 0.47); line.position.copy(egg.position); line.rotation.copy(egg.rotation); g.add(line);
      g.position.set(x, 0, z); g.scale.setScalar(0.001); scene.add(g); let t = 0;
      addFx((dt) => { t += dt; const k = Math.min(1, t / 0.35); g.scale.setScalar(k < 0.7 ? (k / 0.7) * 1.2 : 1.2 - ((k - 0.7) / 0.3) * 0.2); return k < 1; });
      return g;
    },

    confetti(x, z) {
      const colors = ['#ffd60a', '#ff6b4a', '#3d9df3', '#4cb867', '#e98bc4', '#9a7bf0'];
      for (let i = 0; i < 26; i++) particle(i % 2 ? 'leaf' : 'shard', x + rnd(-1.6, 1.6), rnd(2.4, 3.6), z + rnd(-1.6, 1.6), new THREE.Vector3(rnd(-1.5, 1.5), rnd(0, 2.5), rnd(-1.5, 1.5)), rnd(0.9, 1.5), rnd(0.12, 0.2), colors[i % colors.length], 3.5);
    },
  };
}
