// Royale-Sim: Alle-gegen-alle in EINER Arena, deterministisch (gleiche entrants-Reihenfolge + gleicher Seed -> bitgleicher Verlauf).
// Läuft auf dem Server (Ergebnis) und im Client (Replay wird aus dem Seed neu simuliert, nichts wird gespeichert).
//
// DETERMINISMUS: Im Sim-Zustand nur + - * / sowie sqrt, min, max, abs, floor, round. Keine Winkelfunktionen der Engine,
// kein Zufall der Engine, keine Uhr. Zufall kommt aus mulberry32(seed). Alle Timer sind ganze TICKS (1 Tick = DT = 0,05 s).
// Wer hier etwas ändert: scripts/royale-sim-test.mjs laufen lassen (prüft Quelltext, Determinismus und Balance).
//
// ---------------------------------------------------------------------------------------------------------------
// FÜR DEN RENDERER
//
//   const sim = createSim({ entrants, seed, dayElement, maxSeconds });   // entrants-Reihenfolge ist Teil des Seeds!
//   const events = sim.step();        // 1 Tick weiter; liefert die Events dieses Ticks (stehen auch in sim.events)
//   sim.state                         // siehe unten; zwischen zwei Ticks mit px/py -> x/y interpolieren
//
// sim.state = { tick, time (s), done, winnerId, arena: {r}, zone: {x, y, r}, monsters: [...], projectiles: [...] }
//   Koordinaten: Ebene x/y, Mitte 0/0, Einheiten ~ Monsterbreiten. Im 3D-Renderer: x -> x, y -> z.
//
// Monster: { id, i (Index = Position in entrants), name, element,
//   x, y, px, py           Position jetzt / im Tick davor
//   fx, fy                 Blickrichtung (Einheitsvektor)
//   hp, maxHp              hp kann durch Zonenschaden Nachkommastellen haben -> zur Anzeige Math.ceil
//   alive, outside         outside = steht gerade außerhalb der Zone (nimmt Schaden)
//   targetId
//   cd: [basic, special]   Rest-Abklingzeit in TICKS
//   cast: null | { move: 0|1, kind, t (Rest-TICKS bis zum Auslösen), total (TICKS), targetId, tx, ty }
//                          Während cast steht das Monster still. Fortschritt = 1 - t / total.
//   dash: null | { move, t (TICKS seit Absprung), total (TICKS), sx, sy, tx, ty }
//                          Sprung: x/y laufen linear von s nach t. Höhe im Renderer z. B. 4 * k * (1 - k), k = t / total.
//   kills, dmgDealt, diedAt (s) | null, place (1 = Sieger) | null,
//   moves: [{ name, kind, element }, { name, kind, element }]   // [0] = Basis, [1] = Spezial (Kraft x1,5, Abklingzeit x1,9)
// }
// Projektil (nur kind 'shot'): { id, by (Monster-id), move, kind, element, x, y, px, py, targetId }  zielsuchend, 10 Einheiten/s
//
// EVENTS (alle mit t in Sekunden und tick). Reihenfolge in einem Tick: cast/leap/fire/hit/heal/dodge/fizzle, dann zone,
// dann ko (gesammelt am Tick-Ende), dann final, dann win.
//   { type: 'cast',  id, move, name, kind, element, special, targetId, x, y, tx, ty }   Ausholen beginnt -> Namensschild zeigen
//   { type: 'leap',  id, move, kind: 'dash', element, x, y, tx, ty, ticks }             nur dash: Absprung (nach dem Ausholen)
//   { type: 'fire',  id, move, kind, element, x, y, tx, ty, projectileId? }             Ausholen fertig:
//        melee: x/y = Angreifer, tx/ty = Ziel · shot: Projektil startet (projectileId fehlt, wenn das Ziel schon tot ist)
//        beam: Strahl von x/y nach tx/ty (volle Länge), trifft alle im Abstand <= MOVE_SPECS.beam.width
//        burst: Kreis um x/y mit Radius MOVE_SPECS.burst.range · dash: LANDUNG bei tx/ty (x/y = Absprungpunkt), Radius MOVE_SPECS.dash.radius
//   { type: 'hit',   by, target, dmg, crit, eff (1.5 | 1 | 0.67), kind, move, hp (Rest-HP des Ziels), projectileId? }
//        eff ist der volle Element-Faktor für die Anzeige ("super effective"); gerechnet wird abgeschwächt (TUNING.effScale).
//   { type: 'heal',  id, amount, hp }                                                    KO-Bonus: der Angreifer bekommt 25 % seiner maxHp zurück
//   { type: 'dodge', by (Angreifer), target (ist ausgewichen), kind, projectileId? }     nur melee und shot
//   { type: 'fizzle', projectileId }                                                    Ziel schon tot, Projektil verpufft
//   { type: 'zone',  phase: 'start' | 'end' }                                           Zone beginnt zu schrumpfen / ist am Minimum
//   { type: 'ko',    id, by (Monster-id oder 'zone'), place }
//   { type: 'final', n: 2, ids: [a, b] }                                                noch zwei übrig
//   { type: 'win',   id, reason: 'last' | 'tie' | 'time' }
//        'tie': die Letzten fielen im selben Tick; wer mehr Schaden gemacht hat, gewinnt und steht mit 1 HP wieder (kein ko-Event für ihn).
//        'time': Zeitlimit; höchster HP-Anteil gewinnt, die übrigen bleiben stehen.
//
// REGELN IN KURZ (Zahlen stehen in MOVE_SPECS und TUNING, per Simulation ausbalanciert):
//   - Arena-Radius 6 + 1,1 * sqrt(n), Start auf einem Ring. Zone schrumpft von 15 s bis 70 s auf Radius 2,5; außerhalb gibt es Schaden.
//   - Jedes Monster jagt den nächsten Gegner, prüft alle 0,6 s neu. Fernkämpfer (shot, beam) halten 60 % ihrer Reichweite und umkreisen.
//   - Zwei Angriffe: [0] Basis, [1] Spezial (x1,5 Kraft, x1,9 Abklingzeit). Spezial geht vor, sobald es bereit und in Reichweite ist.
//   - Werte: hp -> maxHp, atk -> Schaden, def -> weniger Schaden, spd -> Lauftempo, Ausweichen UND kürzere Abklingzeiten.
//     Die vier Werte sind so gewichtet (wHp, wAtk, wDef, wSpd), dass jeder Punkt des 300er-Budgets etwa gleich viel bringt.
//   - Ein KO heilt den Angreifer um 25 % (belohnt Angriff, sorgt für Comebacks). Element-Vorteil zählt abgeschwächt (x1,2 / x0,87), sonst hat ein Element in einem einseitigen Feld keine Chance.
//   - Typischer Verlauf bei 16 Monstern: erster KO ~17 s, die meisten KOs 20–40 s, FINAL TWO ~55 s, Ende ~69 s.
// ---------------------------------------------------------------------------------------------------------------
import { BEATS, effectiveness } from './battle.js';

export { BEATS, effectiveness };

export const DT = 0.05;
const TPS = 20; // Ticks pro Sekunde (1 / DT)

export const MOVE_KINDS = ['melee', 'shot', 'beam', 'burst', 'dash'];

// range/windup/cooldown in Einheiten bzw. Sekunden. power = Schadensfaktor. Der Renderer liest range, windup, width, radius, leap.
export const MOVE_SPECS = {
  melee: { range: 1.25, windup: 0.25, cooldown: 1.0, power: 0.7, single: true, reach: 0.8 },
  shot: { range: 6.5, windup: 0.3, cooldown: 1.5, power: 0.75, single: true, speed: 10, hitRadius: 0.3 },
  beam: { range: 5.5, windup: 0.5, cooldown: 2.0, power: 0.9, single: false, width: 0.8 },
  burst: { range: 2.3, windup: 0.4, cooldown: 1.9, power: 0.8, single: false },
  dash: { range: 5.0, minRange: 1.5, windup: 0.3, cooldown: 2.1, power: 1.2, single: false, leap: 0.25, radius: 1.2 },
};
export const SPECIAL = { power: 1.5, cooldown: 1.9 };

export const TUNING = {
  K: 0.23, // globaler Schadensfaktor
  hpMult: 2.2, // maxHp = round(hpEff * hpMult)
  // Gewichte der vier Werte um den Mittelwert 75: eff = 75 + (wert - 75) * w. So ist jeder Punkt des 300er-Budgets etwa gleich viel wert.
  wHp: 0.8, wAtk: 0.75, wDef: 1.3,
  wSpd: 0.8, // Tempo verkürzt die Abklingzeiten: Faktor = 1 - wSpd * (spd - 75) / 75 (begrenzt auf hasteMin..hasteMax)
  hasteMin: 0.55, hasteMax: 1.6,
  speedBase: 1.6, speedPerSpd: 1 / 60, // Einheiten/s = speedBase + spd * speedPerSpd
  arenaBase: 4.6, arenaPerSqrtN: 0.95, // Arenaradius = 4,6 + 0,95 * sqrt(n) (kleiner, damit die Monster im Hochformat groß genug sind)
  spawnRing: 0.8,
  zoneStart: 15, zoneEnd: 70, zoneMin: 2.5, // Sekunden / Radius
  zoneDps: 6, zoneDpsPct: 0.03, // Schaden pro Sekunde außerhalb: zoneDps + zoneDpsPct * maxHp
  retargetTicks: 12, retargetGain: 0.8, // alle 0,6 s; Wechsel nur, wenn das neue Ziel <= 80 % der Distanz hat
  approach: 0.85, rangedApproach: 0.6, backoff: 0, backoffSpeed: 0.6, strafeSpeed: 0.35, // Fernkämpfer halten 60 % ihrer Reichweite, weichen nicht zurück
  healOnKill: 0.25, // Anteil der maxHp, den ein Monster für einen KO zurückbekommt
  separation: 0.9, separationPush: 2.2,
  critBase: 0.08, critPerSharp: 0.12, critMult: 1.6,
  dodgeBase: 0.04, dodgePerSpd: 1 / 300, dodgeMin: 0.02, dodgeMax: 0.2,
  dayBonus: 1.1,
  effScale: 0.4, // Element-Vorteil abschwächen: Faktor = 1 + (eff - 1) * effScale (im hit-Event steht weiter das volle eff)
  maxSeconds: 150,
};

// ---------- Zufall und Hash (ganzzahlig, überall gleich) ----------
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hashStr(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

// Sinus/Kosinus als Taylorreihe aus Grundrechenarten (nur für die Startaufstellung), damit jede Engine dasselbe rechnet.
const PI = 3.141592653589793;
function sinCos(angle) {
  let a = angle - Math.floor((angle + PI) / (2 * PI)) * 2 * PI; // -> [-PI, PI)
  let sign = 1;
  if (a > PI / 2) { a = PI - a; sign = -1; } else if (a < -PI / 2) { a = -PI - a; sign = -1; }
  const a2 = a * a;
  let s = a; let term = a;
  for (let k = 1; k <= 9; k++) { term = (-term * a2) / (2 * k * (2 * k + 1)); s += term; }
  let c = 1; term = 1;
  for (let k = 1; k <= 9; k++) { term = (-term * a2) / ((2 * k - 1) * (2 * k)); c += term; }
  return [s, sign * c];
}

const num = (v, d) => (typeof v === 'number' && v === v ? v : d);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const ticks = (seconds) => Math.max(1, Math.round(seconds * TPS));

// ---------- Angriffe ----------
const MOVE_NAMES = {
  fire: { melee: 'Ember Smack', shot: 'Fire Spit', beam: 'Heat Ray', burst: 'Flame Burst', dash: 'Blaze Rush' },
  water: { melee: 'Splash Slap', shot: 'Water Shot', beam: 'Hydro Beam', burst: 'Tidal Burst', dash: 'Wave Dash' },
  plant: { melee: 'Vine Whip', shot: 'Seed Shot', beam: 'Solar Ray', burst: 'Spore Burst', dash: 'Root Rush' },
  metal: { melee: 'Iron Bonk', shot: 'Bolt Shot', beam: 'Laser Beam', burst: 'Shock Pulse', dash: 'Steel Charge' },
  fluff: { melee: 'Pillow Punch', shot: 'Fluff Ball', beam: 'Lint Laser', burst: 'Cuddle Quake', dash: 'Fuzzy Tackle' },
  spirit: { melee: 'Ghost Jab', shot: 'Spook Orb', beam: 'Phantom Ray', burst: 'Haunt Wave', dash: 'Shadow Step' },
  _: { melee: 'Bonk', shot: 'Pebble Shot', beam: 'Zap Ray', burst: 'Boom', dash: 'Tackle' },
};

// Ersatz-Angriffe, wenn ein Monster keine (gültigen) hat: fest aus Element + Hash des Namens
export function defaultMoves(entrant) {
  const element = entrant.element;
  const names = MOVE_NAMES[element] || MOVE_NAMES._;
  const h = hashStr('mv1269:' + String(entrant.name ?? entrant.id ?? ''));
  const a = h % 5;
  const b = (a + 1 + ((h >>> 8) % 4)) % 5; // immer eine andere Art als a
  return [
    { name: names[MOVE_KINDS[a]], kind: MOVE_KINDS[a], element },
    { name: names[MOVE_KINDS[b]], kind: MOVE_KINDS[b], element },
  ];
}
function movesFor(entrant) {
  const fallback = defaultMoves(entrant);
  const out = [];
  for (let s = 0; s < 2; s++) {
    const m = Array.isArray(entrant.moves) ? entrant.moves[s] : null;
    if (m && typeof m.name === 'string' && m.name.length > 0 && MOVE_KINDS.indexOf(m.kind) >= 0) {
      out.push({ name: m.name, kind: m.kind, element: typeof m.element === 'string' ? m.element : entrant.element });
    } else out.push(fallback[s]);
  }
  return out;
}

// Wohlfühl-Abstand je Angriffsart: weiter weg -> annähern, näher als min -> zurückweichen, dazwischen ggf. umkreisen
function bands() {
  const T = TUNING; const S = MOVE_SPECS;
  return {
    melee: { min: 0, max: S.melee.range * T.approach, strafe: false },
    shot: { min: S.shot.range * T.backoff, max: S.shot.range * T.rangedApproach, strafe: true },
    beam: { min: S.beam.range * T.backoff, max: S.beam.range * T.rangedApproach, strafe: true },
    burst: { min: 0, max: S.burst.range * T.approach, strafe: false },
    dash: { min: S.dash.minRange, max: S.dash.range * T.approach, strafe: true },
  };
}
function usable(kind, d) {
  const S = MOVE_SPECS;
  if (kind === 'melee') return d <= S.melee.range;
  if (kind === 'shot') return d <= S.shot.range;
  if (kind === 'beam') return d <= S.beam.range * 0.9;
  if (kind === 'burst') return d <= S.burst.range * TUNING.approach;
  return d >= S.dash.minRange && d <= S.dash.range; // dash
}

/**
 * @param {{ entrants: any[], seed: number, dayElement?: string | null, maxSeconds?: number }} opts
 */
export function createSim({ entrants, seed, dayElement = null, maxSeconds = TUNING.maxSeconds }) {
  const T = TUNING; const S = MOVE_SPECS;
  const rand = rng(seed >>> 0);
  const n = entrants.length;
  const R = T.arenaBase + T.arenaPerSqrtN * Math.sqrt(n);
  const BAND = bands();
  const ZS = Math.round(T.zoneStart * TPS); const ZE = Math.round(T.zoneEnd * TPS);
  const maxTicks = Math.max(1, Math.round(maxSeconds * TPS));
  const WIND = {};
  for (const k of MOVE_KINDS) WIND[k] = ticks(S[k].windup);
  const LEAP = ticks(S.dash.leap);
  const SHOT_STEP = S.shot.speed * DT;

  // Startplätze: gleichmäßig auf einem Ring, Reihenfolge vom Seed gemischt, leicht verwackelt
  const slots = [];
  for (let i = 0; i < n; i++) slots.push(i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); const t = slots[i]; slots[i] = slots[j]; slots[j] = t; }

  const monsters = entrants.map((e, i) => {
    const st = e.stats || {};
    const hpStat = clamp(num(st.hp, 75), 1, 999); const atk = clamp(num(st.atk, 75), 1, 999);
    const def = clamp(num(st.def, 75), 1, 999); const spd = clamp(num(st.spd, 75), 1, 999);
    const angle = ((slots[i] + (rand() - 0.5) * 0.5) * 2 * PI) / Math.max(1, n);
    const radius = T.spawnRing * R + (rand() - 0.5) * 0.9;
    const sc = sinCos(angle);
    const x = sc[1] * radius; const y = sc[0] * radius;
    const hpEff = 75 + (hpStat - 75) * T.wHp; const atkEff = Math.max(1, 75 + (atk - 75) * T.wAtk); const defEff = Math.max(1, 75 + (def - 75) * T.wDef);
    const haste = clamp(1 - (T.wSpd * (spd - 75)) / 75, T.hasteMin, T.hasteMax);
    const maxHp = Math.max(1, Math.round(hpEff * T.hpMult));
    const cool = {};
    for (const k of MOVE_KINDS) cool[k] = [Math.max(4, Math.round(S[k].cooldown * TPS * haste)), Math.max(4, Math.round(S[k].cooldown * SPECIAL.cooldown * TPS * haste))];
    const cd0 = Math.floor(rand() * 21); const cd1 = 40 + Math.floor(rand() * 61);
    return {
      id: e.id, i, name: e.name, element: e.element,
      x, y, px: x, py: y, fx: -sc[1], fy: -sc[0],
      hp: maxHp, maxHp, alive: true, outside: false, targetId: null,
      cd: [cd0, cd1], cast: null, dash: null,
      kills: 0, dmgDealt: 0, diedAt: null, place: null,
      moves: movesFor(e),
      // intern
      ti: -1, atk: atkEff, def: defEff, spd, cool,
      speed: T.speedBase + spd * T.speedPerSpd,
      crit: T.critBase + T.critPerSharp * clamp(num(e.traits && e.traits.sharp, 0.5), 0, 1),
      bonus: dayElement && e.element === dayElement ? T.dayBonus : 1,
      strafe: i % 2 === 0 ? 1 : -1,
    };
  });

  const state = { tick: 0, time: 0, done: n === 0, winnerId: null, arena: { r: R }, zone: { x: 0, y: 0, r: R }, monsters, projectiles: [] };
  const events = [];
  let aliveCount = n; let nextProjectile = 1; let finalEmitted = false;
  let out = []; let pendingKo = [];

  function emit(e) { e.t = state.time; e.tick = state.tick; out.push(e); events.push(e); return e; }

  function kill(m, byId, attacker) {
    m.alive = false; m.hp = 0; m.diedAt = state.time; m.place = aliveCount; aliveCount--;
    m.cast = null; m.dash = null; m.targetId = null; m.ti = -1;
    if (attacker) {
      attacker.kills++;
      if (attacker.alive && T.healOnKill > 0) {
        const amount = Math.min(attacker.maxHp - attacker.hp, Math.round(attacker.maxHp * T.healOnKill));
        if (amount > 0) { attacker.hp += amount; emit({ type: 'heal', id: attacker.id, amount, hp: attacker.hp }); }
      }
    }
    pendingKo.push({ m, by: byId });
  }

  // Ein Treffer von att auf target mit dem Angriff im Slot. single = Ausweichen möglich.
  function strike(att, target, slot, single, projectileId) {
    const mv = att.moves[slot]; const spec = S[mv.kind];
    if (single) {
      const dodge = clamp(T.dodgeBase + (target.spd - att.spd) * T.dodgePerSpd, T.dodgeMin, T.dodgeMax);
      if (rand() < dodge) {
        const d = { type: 'dodge', by: att.id, target: target.id, kind: mv.kind };
        if (projectileId) d.projectileId = projectileId;
        emit(d); return;
      }
    }
    const eff = effectiveness(mv.element, target.element);
    const crit = rand() < att.crit;
    const roll = 0.85 + rand() * 0.3;
    const power = spec.power * (slot === 1 ? SPECIAL.power : 1);
    const effMult = 1 + (eff - 1) * T.effScale;
    const dmg = Math.max(1, Math.round(att.atk * (60 / (60 + target.def)) * power * T.K * effMult * att.bonus * roll * (crit ? T.critMult : 1)));
    att.dmgDealt += Math.min(dmg, target.hp);
    target.hp = Math.max(0, target.hp - dmg);
    const h = { type: 'hit', by: att.id, target: target.id, dmg, crit, eff, kind: mv.kind, move: slot, hp: target.hp };
    if (projectileId) h.projectileId = projectileId;
    emit(h);
    if (target.hp <= 0) kill(target, att.id, att);
  }

  function areaStrike(att, slot, cx, cy, radius) {
    const r2 = radius * radius;
    for (let j = 0; j < n; j++) {
      const o = monsters[j];
      if (j === att.i || !o.alive) continue;
      const dx = o.x - cx; const dy = o.y - cy;
      if (dx * dx + dy * dy <= r2) strike(att, o, slot, false, 0);
    }
  }

  function retarget(m) {
    let cur = m.ti >= 0 ? monsters[m.ti] : null;
    if (cur && !cur.alive) cur = null;
    if (cur && (state.tick + m.i * 5) % T.retargetTicks !== 0) return cur;
    let best = -1; let bd2 = Infinity;
    for (let j = 0; j < n; j++) {
      const o = monsters[j];
      if (j === m.i || !o.alive) continue;
      const dx = o.x - m.x; const dy = o.y - m.y; const d2 = dx * dx + dy * dy;
      if (d2 < bd2) { bd2 = d2; best = j; }
    }
    if (best < 0) { m.ti = -1; m.targetId = null; return null; }
    if (cur) {
      const dx = cur.x - m.x; const dy = cur.y - m.y;
      if (bd2 > T.retargetGain * T.retargetGain * (dx * dx + dy * dy)) return cur; // nicht deutlich näher -> Ziel behalten
    }
    m.ti = best; m.targetId = monsters[best].id;
    return monsters[best];
  }

  function fire(m) {
    const c = m.cast; m.cast = null;
    const slot = c.move; const mv = m.moves[slot]; const spec = S[c.kind];
    m.cd[slot] = m.cool[c.kind][slot];
    const tg = monsters[c.ti];
    if (c.kind === 'melee') {
      emit({ type: 'fire', id: m.id, move: slot, kind: c.kind, element: mv.element, x: m.x, y: m.y, tx: tg.x, ty: tg.y });
      if (tg.alive) {
        const dx = tg.x - m.x; const dy = tg.y - m.y; const reach = spec.range + spec.reach;
        if (dx * dx + dy * dy <= reach * reach) strike(m, tg, slot, true, 0);
      }
    } else if (c.kind === 'shot') {
      const f = { type: 'fire', id: m.id, move: slot, kind: c.kind, element: mv.element, x: m.x, y: m.y, tx: tg.x, ty: tg.y };
      if (tg.alive) {
        const p = { id: nextProjectile++, by: m.id, move: slot, kind: 'shot', element: mv.element, x: m.x, y: m.y, px: m.x, py: m.y, targetId: tg.id, bi: m.i, ti: tg.i };
        state.projectiles.push(p); f.projectileId = p.id;
      }
      emit(f);
    } else if (c.kind === 'beam') {
      // Richtung beim Ausholen festgelegt; trifft alle nahe der Strecke
      let ux = m.fx; let uy = m.fy;
      const dx = c.tx - m.x; const dy = c.ty - m.y; const d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1e-6) { ux = dx / d; uy = dy / d; }
      const len = spec.range; const ex = m.x + ux * len; const ey = m.y + uy * len;
      emit({ type: 'fire', id: m.id, move: slot, kind: c.kind, element: mv.element, x: m.x, y: m.y, tx: ex, ty: ey });
      const w2 = spec.width * spec.width;
      for (let j = 0; j < n; j++) {
        const o = monsters[j];
        if (j === m.i || !o.alive) continue;
        const ox = o.x - m.x; const oy = o.y - m.y;
        const along = clamp(ox * ux + oy * uy, 0, len);
        const qx = ox - ux * along; const qy = oy - uy * along;
        if (qx * qx + qy * qy <= w2) strike(m, o, slot, false, 0);
      }
    } else if (c.kind === 'burst') {
      emit({ type: 'fire', id: m.id, move: slot, kind: c.kind, element: mv.element, x: m.x, y: m.y, tx: m.x, ty: m.y });
      areaStrike(m, slot, m.x, m.y, spec.range);
    } else {
      // dash: Absprung. Landepunkt = kurz vor dem Ziel (oder der gemerkte Punkt, wenn das Ziel schon tot ist)
      let lx = c.tx; let ly = c.ty;
      if (tg.alive) { lx = tg.x; ly = tg.y; }
      let dx = lx - m.x; let dy = ly - m.y; let d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1e-6) {
        const len = Math.min(Math.max(0, d - 0.6), spec.range + 0.5);
        lx = m.x + (dx / d) * len; ly = m.y + (dy / d) * len;
      } else { lx = m.x; ly = m.y; }
      const dl = Math.sqrt(lx * lx + ly * ly); const lim = R - 0.4;
      if (dl > lim) { lx = (lx / dl) * lim; ly = (ly / dl) * lim; }
      m.dash = { move: slot, t: 0, total: LEAP, sx: m.x, sy: m.y, tx: lx, ty: ly };
      dx = lx - m.x; dy = ly - m.y; d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1e-6) { m.fx = dx / d; m.fy = dy / d; }
      emit({ type: 'leap', id: m.id, move: slot, kind: 'dash', element: mv.element, x: m.x, y: m.y, tx: lx, ty: ly, ticks: LEAP });
    }
  }

  function act(m) {
    if (m.cd[0] > 0) m.cd[0]--;
    if (m.cd[1] > 0) m.cd[1]--;

    if (m.dash) {
      const ds = m.dash; ds.t++;
      const k = ds.t / ds.total;
      m.x = ds.sx + (ds.tx - ds.sx) * k; m.y = ds.sy + (ds.ty - ds.sy) * k;
      if (ds.t >= ds.total) {
        m.x = ds.tx; m.y = ds.ty; m.dash = null;
        const mv = m.moves[ds.move];
        emit({ type: 'fire', id: m.id, move: ds.move, kind: 'dash', element: mv.element, x: ds.sx, y: ds.sy, tx: ds.tx, ty: ds.ty });
        areaStrike(m, ds.move, m.x, m.y, S.dash.radius);
      }
      return;
    }
    if (m.cast) {
      m.cast.t--;
      if (m.cast.t <= 0) fire(m);
      return;
    }

    const tg = retarget(m);
    if (!tg) return;
    const dx = tg.x - m.x; const dy = tg.y - m.y; const d = Math.sqrt(dx * dx + dy * dy);
    let ux = m.fx; let uy = m.fy;
    if (d > 1e-6) { ux = dx / d; uy = dy / d; }
    m.fx = ux; m.fy = uy;

    const dc = Math.sqrt(m.x * m.x + m.y * m.y);
    const zr = state.zone.r;

    // Angriff wählen (außerhalb der Zone erst hineinlaufen)
    if (dc <= zr) {
      let slot = -1;
      if (m.cd[1] === 0 && usable(m.moves[1].kind, d)) slot = 1;
      else if (m.cd[0] === 0 && usable(m.moves[0].kind, d)) slot = 0;
      if (slot >= 0) {
        const kind = m.moves[slot].kind;
        m.cast = { move: slot, kind, t: WIND[kind], total: WIND[kind], targetId: tg.id, tx: tg.x, ty: tg.y, ti: tg.i };
        emit({ type: 'cast', id: m.id, move: slot, name: m.moves[slot].name, kind, element: m.moves[slot].element, special: slot === 1, targetId: tg.id, x: m.x, y: m.y, tx: tg.x, ty: tg.y });
        return;
      }
    }

    // Bewegung
    let vx = 0; let vy = 0;
    if (dc > zr - 0.5 && dc > 1e-6) {
      vx = (-m.x / dc) * m.speed; vy = (-m.y / dc) * m.speed;
    } else {
      const want = m.cd[1] <= m.cd[0] ? 1 : 0;
      const band = BAND[m.moves[want].kind];
      if (d > band.max) { vx = ux * m.speed; vy = uy * m.speed; }
      else if (d < band.min) { vx = -ux * m.speed * T.backoffSpeed; vy = -uy * m.speed * T.backoffSpeed; }
      else if (band.strafe) { vx = -uy * m.speed * T.strafeSpeed * m.strafe; vy = ux * m.speed * T.strafeSpeed * m.strafe; }
    }
    const sep = T.separation; const sep2 = sep * sep;
    for (let j = 0; j < n; j++) {
      const o = monsters[j];
      if (j === m.i || !o.alive) continue;
      const sx = m.x - o.x; const sy = m.y - o.y; const sd2 = sx * sx + sy * sy;
      if (sd2 < sep2) {
        const sd = Math.sqrt(sd2);
        if (sd > 1e-6) { const f = ((sep - sd) / sep) * T.separationPush; vx += (sx / sd) * f; vy += (sy / sd) * f; }
        else vx += m.i < j ? 1 : -1;
      }
    }
    m.x += vx * DT; m.y += vy * DT;
    const dd = Math.sqrt(m.x * m.x + m.y * m.y); const lim = R - 0.4;
    if (dd > lim) { m.x = (m.x / dd) * lim; m.y = (m.y / dd) * lim; }
  }

  function finish(winner, reason) {
    winner.place = 1; state.done = true; state.winnerId = winner.id;
    emit({ type: 'win', id: winner.id, reason });
  }

  function step() {
    out = [];
    if (state.done) return out;
    state.tick++; state.time = state.tick / TPS;
    const tick = state.tick;
    pendingKo = [];
    for (let i = 0; i < n; i++) { const m = monsters[i]; m.px = m.x; m.py = m.y; }
    const ps = state.projectiles;
    for (let k = 0; k < ps.length; k++) { ps[k].px = ps[k].x; ps[k].py = ps[k].y; }

    // Zone
    state.zone.r = tick <= ZS ? R : tick >= ZE ? T.zoneMin : R + ((T.zoneMin - R) * (tick - ZS)) / (ZE - ZS);

    // Monster handeln, Startindex wandert pro Tick (kein Vorteil durch die Reihenfolge)
    for (let k = 0; k < n; k++) {
      const m = monsters[(k + tick) % n];
      if (m.alive) act(m);
    }

    // Projektile
    let w = 0;
    for (let k = 0; k < ps.length; k++) {
      const p = ps[k]; const tg = monsters[p.ti];
      if (!tg.alive) { emit({ type: 'fizzle', projectileId: p.id }); continue; }
      const dx = tg.x - p.x; const dy = tg.y - p.y; const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= SHOT_STEP + S.shot.hitRadius) {
        p.x = tg.x; p.y = tg.y;
        strike(monsters[p.bi], tg, p.move, true, p.id);
        continue;
      }
      p.x += (dx / d) * SHOT_STEP; p.y += (dy / d) * SHOT_STEP;
      ps[w++] = p;
    }
    ps.length = w;

    // Zonenschaden
    if (tick === ZS) emit({ type: 'zone', phase: 'start' });
    if (tick === ZE) emit({ type: 'zone', phase: 'end' });
    const zr = state.zone.r;
    for (let i = 0; i < n; i++) {
      const m = monsters[i];
      if (!m.alive) continue;
      m.outside = m.x * m.x + m.y * m.y > zr * zr;
      if (m.outside) {
        m.hp -= (T.zoneDps + T.zoneDpsPct * m.maxHp) * DT;
        if (m.hp <= 0) kill(m, 'zone', null);
      }
    }

    // Tick-Ende: KOs melden, Ende prüfen
    if (aliveCount === 0 && pendingKo.length > 0) {
      // Die Letzten fielen gleichzeitig: mehr Schaden gewinnt (bei Gleichstand der kleinere Index) und steht wieder auf
      let wi = 0;
      for (let k = 1; k < pendingKo.length; k++) {
        const a = pendingKo[k].m; const b = pendingKo[wi].m;
        if (a.dmgDealt > b.dmgDealt || (a.dmgDealt === b.dmgDealt && a.i < b.i)) wi = k;
      }
      const winner = pendingKo[wi].m;
      const rest = [];
      for (let k = 0; k < pendingKo.length; k++) if (k !== wi) rest.push(pendingKo[k]);
      rest.sort((a, b) => (b.m.dmgDealt - a.m.dmgDealt) || (a.m.i - b.m.i));
      for (let k = 0; k < rest.length; k++) { rest[k].m.place = k + 2; emit({ type: 'ko', id: rest[k].m.id, by: rest[k].by, place: rest[k].m.place }); }
      winner.alive = true; winner.hp = 1; winner.diedAt = null; aliveCount = 1;
      finish(winner, 'tie');
      return out;
    }
    for (let k = 0; k < pendingKo.length; k++) emit({ type: 'ko', id: pendingKo[k].m.id, by: pendingKo[k].by, place: pendingKo[k].m.place });

    if (aliveCount === 1) {
      for (let i = 0; i < n; i++) if (monsters[i].alive) { finish(monsters[i], 'last'); break; }
      return out;
    }
    if (aliveCount === 2 && !finalEmitted) {
      finalEmitted = true;
      const ids = [];
      for (let i = 0; i < n; i++) if (monsters[i].alive) ids.push(monsters[i].id);
      emit({ type: 'final', n: 2, ids });
    }
    if (tick >= maxTicks) {
      // Zeitlimit: höchster HP-Anteil gewinnt (dann Schaden, dann Index)
      const alive = [];
      for (let i = 0; i < n; i++) if (monsters[i].alive) alive.push(monsters[i]);
      alive.sort((a, b) => (b.hp / b.maxHp - a.hp / a.maxHp) || (b.dmgDealt - a.dmgDealt) || (a.i - b.i));
      for (let k = 1; k < alive.length; k++) alive[k].place = k + 1;
      finish(alive[0], 'time');
    }
    return out;
  }

  // Sonderfall: nur ein Teilnehmer
  if (n === 1) { monsters[0].place = 1; state.done = true; state.winnerId = monsters[0].id; }

  return { state, events, step };
}

/**
 * Ganze Runde durchrechnen (Server).
 * @param {{ entrants: any[], seed: number, dayElement?: string | null }} opts
 * @returns {{ winnerId: any, placements: any[], kills: Record<string, number>, events: any[], duration: number, ticks: number }}
 */
export function runSim(opts, maxSeconds = TUNING.maxSeconds) {
  const sim = createSim({ entrants: opts.entrants, seed: opts.seed, dayElement: opts.dayElement, maxSeconds });
  let guard = Math.round(maxSeconds * TPS) + 10;
  while (!sim.state.done && guard-- > 0) sim.step();
  const ms = sim.state.monsters;
  const order = ms.slice().sort((a, b) => ((a.place ?? 9999) - (b.place ?? 9999)) || (a.i - b.i));
  const kills = {};
  for (let i = 0; i < ms.length; i++) kills[ms[i].id] = ms[i].kills;
  return { winnerId: sim.state.winnerId, placements: order.map((m) => m.id), kills, events: sim.events, duration: sim.state.time, ticks: sim.state.tick };
}
