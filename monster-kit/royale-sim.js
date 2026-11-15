// Royale-Sim: Alle-gegen-alle in EINER Arena, deterministisch (gleiche entrants-Reihenfolge + gleicher Seed -> bitgleicher Verlauf).
// Läuft auf dem Server (Ergebnis) und im Client (Replay wird aus dem Seed neu simuliert, nichts wird gespeichert).
//
// DETERMINISMUS: Im Sim-Zustand nur + - * / sowie sqrt, min, max, abs, floor, round. Keine Winkelfunktionen der Engine,
// kein Zufall der Engine, keine Uhr. Zufall kommt aus mulberry32(seed). Alle Timer sind ganze TICKS (1 Tick = DT = 0,05 s).
// Wer hier etwas ändert: scripts/royale-sim-test.mjs laufen lassen (prüft Quelltext, Determinismus, Lesbarkeit und Balance).
//
// ---------------------------------------------------------------------------------------------------------------
// FÜR DEN RENDERER
//
//   const sim = createSim({ entrants, seed, dayElement, maxSeconds });   // entrants-Reihenfolge ist Teil des Seeds!
//   const events = sim.step();        // 1 Tick weiter; liefert die Events dieses Ticks (stehen auch in sim.events)
//   sim.state                         // siehe unten; zwischen zwei Ticks mit px/py -> x/y interpolieren
//
// sim.state = { tick, time (s), done, winnerId, arena: {r}, zone: {x, y, r}, monsters: [...], projectiles: [...] }
//   Koordinaten: Ebene x/y, Mitte 0/0, 1 Einheit ~ eine Monsterbreite. Im 3D-Renderer: x -> x, y -> z.
//
// Monster: { id, i (Index = Position in entrants), name, element,
//   x, y, px, py           Position jetzt / im Tick davor (enthält schon Rückstoß und Abstandhalten)
//   fx, fy                 Blickrichtung (Einheitsvektor, zeigt aufs Ziel)
//   hp, maxHp              hp kann durch Zonenschaden Nachkommastellen haben -> zur Anzeige Math.ceil
//   alive, outside         outside = steht gerade außerhalb der Zone (nimmt Schaden)
//   targetId               wen es gerade jagt (Wechsel -> Event 'target')
//   cd: [basic, special]   Rest-Abklingzeit in TICKS
//   cast: null | { move: 0|1, kind, t (Rest-TICKS bis zum Auslösen), total (TICKS), targetId, tx, ty }
//                          Während cast läuft es nicht selbst (kann aber weggestoßen werden). Fortschritt = 1 - t / total.
//   dash: null | { move, t (TICKS seit Absprung), total (TICKS), sx, sy, tx, ty }
//                          Sprung: x/y laufen linear von s nach t. Höhe im Renderer z. B. 4 * k * (1 - k), k = t / total.
//   kt                     Rest-TICKS eines laufenden Rückstoßes (> 0 = wird gerade weggeschoben)
//   kills, dmgDealt, diedAt (s) | null, place (1 = Sieger) | null,
//   moves: [{ name, kind, element }, { name, kind, element }]   // [0] = Basis, [1] = Spezial (mehr Kraft, längere Abklingzeit)
// }
// Projektil (nur kind 'shot'): { id, by (Monster-id), move, kind, element, x, y, px, py, targetId }  zielsuchend
//
// EVENTS (alle mit t in Sekunden und tick). Reihenfolge in einem Tick: target/cast/leap/fire/hit/heal/dodge/fizzle, dann zone,
// dann ko (gesammelt am Tick-Ende), dann final, dann win.
//   { type: 'target', id, targetId, prev }                                              Monster nimmt ein (neues) Ziel; prev = altes Ziel oder null
//   { type: 'cast',  id, move, name, kind, element, special, targetId, x, y, tx, ty, ticks }   Ausholen beginnt (ticks lang) -> Namensschild zeigen
//   { type: 'leap',  id, move, kind: 'dash', element, x, y, tx, ty, ticks }             nur dash: Absprung (nach dem Ausholen)
//   { type: 'fire',  id, move, kind, element, x, y, tx, ty, projectileId? }             Ausholen fertig:
//        melee: x/y = Angreifer, tx/ty = Ziel (Angreifer steht ~1,7 entfernt -> Sprung/Hieb zeichnen; danach weicht er ~0,45 zurück)
//        shot: Projektil startet (projectileId fehlt, wenn das Ziel schon tot ist)
//        beam: Strahl von x/y nach tx/ty (volle Länge), trifft alle im Abstand <= MOVE_SPECS.beam.width
//        burst: Kreis um x/y mit Radius MOVE_SPECS.burst.range · dash: LANDUNG bei tx/ty (x/y = Absprungpunkt), Radius MOVE_SPECS.dash.radius
//   { type: 'hit',   by, target, dmg, crit, eff (1.5 | 1 | 0.67), kind, move, hp (Rest-HP des Ziels), kx, ky, projectileId? }
//        kx/ky = Rückstoß des Ziels als Vektor in Einheiten (weg vom Angreifer; Basis ~0,7, Spezial ~1,2), wird über 5 Ticks ausgeführt.
//        eff ist der volle Element-Faktor für die Anzeige ("super effective"); gerechnet wird abgeschwächt (TUNING.effScale).
//   { type: 'heal',  id, amount, hp }                                                    KO-Bonus: der Angreifer bekommt einen Teil seiner maxHp zurück
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
//   - Kein Haufen: Monster halten ~1,5 Einheiten Abstand (auch beim Angreifen). Nahkampf trifft deshalb aus ~2 Einheiten.
//   - Jeder Treffer stößt das Ziel weg (Rückstoß), der Nahkämpfer weicht nach dem Schlag kurz zurück.
//   - Wenige, große Angriffe: lange Abklingzeiten, viel Schaden pro Treffer, deutliches Ausholen (0,35–0,6 s).
//   - Zielwahl: nah, verwundet und "mein Angriff ist sehr effektiv" wird bevorzugt; wer schon von vielen gejagt wird, ist weniger attraktiv.
//   - Bewegung: Monster umkreisen ihr Ziel im Wunschabstand ihres nächsten Angriffs (Fernkämpfer weiter außen), stehen nie still.
//   - Zwei Angriffe: [0] Basis, [1] Spezial. Spezial geht vor, sobald es bereit und in Reichweite ist.
//   - Werte: hp -> maxHp, atk -> Schaden, def -> weniger Schaden, spd -> Lauftempo, Ausweichen und etwas kürzere Abklingzeiten.
//   - Ein KO heilt den Angreifer. Element-Vorteil zählt abgeschwächt. Nach dem Zonen-Minimum steigt aller Schaden langsam an (Finale wird kurz).
// ---------------------------------------------------------------------------------------------------------------
import { BEATS, effectiveness } from './battle.js';

export { BEATS, effectiveness };

export const DT = 0.05;
const TPS = 20; // Ticks pro Sekunde (1 / DT)

export const MOVE_KINDS = ['melee', 'shot', 'beam', 'burst', 'dash'];

// range/windup/cooldown in Einheiten bzw. Sekunden. power = Schadensfaktor. pref = Wunschabstand zum Ziel.
export const MOVE_SPECS = {
  melee: { range: 2.0, windup: 0.35, cooldown: 1.8, power: 0.7, pref: 1.75, single: true, reach: 0.9, recoil: 0.45 },
  shot: { range: 6.5, windup: 0.4, cooldown: 2.7, power: 0.75, pref: 4.3, single: true, speed: 10, hitRadius: 0.3 },
  beam: { range: 5.5, windup: 0.6, cooldown: 3.6, power: 0.9, pref: 3.7, single: false, width: 0.8 },
  burst: { range: 2.6, windup: 0.5, cooldown: 3.4, power: 0.8, pref: 1.85, single: false },
  dash: { range: 5.0, minRange: 2.5, windup: 0.4, cooldown: 3.8, power: 1.2, pref: 3.6, single: false, leap: 0.25, radius: 2.3, stop: 1.5 },
};
export const SPECIAL = { power: 1.5, cooldown: 1.9 };

export const TUNING = {
  K: 0.6, // globaler Schadensfaktor
  hpMult: 2.2, // maxHp = round(hpEff * hpMult)
  // Gewichte der vier Werte um den Mittelwert 75: eff = 75 + (wert - 75) * w. So ist jeder Punkt des 300er-Budgets etwa gleich viel wert.
  wHp: 0.8, wAtk: 0.75, wDef: 1.3,
  wSpd: 0.8, // Tempo verkürzt die Abklingzeiten: Faktor = 1 - wSpd * (spd - 75) / 75 (begrenzt auf hasteMin..hasteMax)
  hasteMin: 0.75, hasteMax: 1.3,
  cdScale: 1, // alle Abklingzeiten mal diesem Faktor
  speedBase: 1.6, speedPerSpd: 1 / 60, // Einheiten/s = speedBase + spd * speedPerSpd
  arenaBase: 4.6, arenaPerSqrtN: 0.95, // Arenaradius = arenaBase + arenaPerSqrtN * sqrt(n)
  spawnRing: 0.8,
  firstBasic: [1, 4], firstSpecial: [3.5, 7.5], // erste Angriffe (Sekunden, per Seed gestreut), damit der Start lesbar bleibt
  zoneStart: 8, zoneEnd: 35, zoneMin: 2.5, // Sekunden / Radius
  zoneDps: 6, zoneDpsPct: 0.03, // Schaden pro Sekunde außerhalb: zoneDps + zoneDpsPct * maxHp
  rageStart: 35, ragePerSec: 0, // ab rageStart steigt aller Schaden um ragePerSec pro Sekunde (hält das Finale kurz)
  // Zielwahl: kleinster Wert gewinnt. Wert = Distanz * Element-Faktor * (0,7 + 0,3 * HP-Anteil) * targetPile^(andere Jäger)
  retargetTicks: 12, retargetGain: 0.8, // alle 0,6 s prüfen; Wechsel nur, wenn das neue Ziel <= 80 % des Werts hat
  targetEffGood: 0.65, targetEffBad: 1.3, targetHpBase: 0.7, targetPile: 1.15,
  // Bewegung
  prefTol: 0.25, backoffSpeed: 0.7, strafeSpeed: 0.45, strafeFar: 1.5, strafeFlipTicks: 50, zoneMargin: 0.6,
  // Abstand halten und Rückstoß
  separation: 1.5, sepStiff: 0.6, sepMaxStep: 0.22,
  knockBasic: 0.7, knockSpecial: 1.2, knockTicks: 5,
  healOnKill: 0.25, // Anteil der maxHp, den ein Monster für einen KO zurückbekommt
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

function usable(kind, d) {
  const S = MOVE_SPECS;
  if (kind === 'melee') return d <= S.melee.range;
  if (kind === 'shot') return d <= S.shot.range;
  if (kind === 'beam') return d <= S.beam.range * 0.9;
  if (kind === 'burst') return d <= S.burst.range * 0.85;
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
  const WALL = R - 0.4;
  const ZS = Math.round(T.zoneStart * TPS); const ZE = Math.round(T.zoneEnd * TPS);
  const RAGE = Math.round(T.rageStart * TPS);
  const maxTicks = Math.max(1, Math.round(maxSeconds * TPS));
  const WIND = {};
  for (const k of MOVE_KINDS) WIND[k] = ticks(S[k].windup);
  const LEAP = ticks(S.dash.leap);
  const SHOT_STEP = S.shot.speed * DT;
  const KB = Math.max(1, Math.round(T.knockTicks));

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
    const haste = clamp(1 - (T.wSpd * (spd - 75)) / 75, T.hasteMin, T.hasteMax) * T.cdScale;
    const maxHp = Math.max(1, Math.round(hpEff * T.hpMult));
    const cool = {};
    for (const k of MOVE_KINDS) cool[k] = [Math.max(4, Math.round(S[k].cooldown * TPS * haste)), Math.max(4, Math.round(S[k].cooldown * SPECIAL.cooldown * TPS * haste))];
    const cd0 = Math.round(T.firstBasic[0] * TPS) + Math.floor(rand() * (Math.round((T.firstBasic[1] - T.firstBasic[0]) * TPS) + 1));
    const cd1 = Math.round(T.firstSpecial[0] * TPS) + Math.floor(rand() * (Math.round((T.firstSpecial[1] - T.firstSpecial[0]) * TPS) + 1));
    return {
      id: e.id, i, name: e.name, element: e.element,
      x, y, px: x, py: y, fx: -sc[1], fy: -sc[0],
      hp: maxHp, maxHp, alive: true, outside: false, targetId: null,
      cd: [cd0, cd1], cast: null, dash: null, kt: 0,
      kills: 0, dmgDealt: 0, diedAt: null, place: null,
      moves: movesFor(e),
      // intern
      ti: -1, atk: atkEff, def: defEff, spd, cool, kvx: 0, kvy: 0,
      speed: T.speedBase + spd * T.speedPerSpd,
      crit: T.critBase + T.critPerSharp * clamp(num(e.traits && e.traits.sharp, 0.5), 0, 1),
      bonus: dayElement && e.element === dayElement ? T.dayBonus : 1,
    };
  });

  // Zielwahl-Tabellen: Element-Faktor je Paar, und wie viele gerade wen jagen
  const effTable = [];
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      const a = monsters[i]; const b = monsters[j];
      const e0 = effectiveness(a.moves[0].element, b.element); const e1 = effectiveness(a.moves[1].element, b.element);
      effTable.push(e0 > 1 || e1 > 1 ? T.targetEffGood : e0 < 1 && e1 < 1 ? T.targetEffBad : 1);
    }
  }
  const aimed = []; const pushX = []; const pushY = [];
  for (let i = 0; i < n; i++) { aimed.push(0); pushX.push(0); pushY.push(0); }

  const state = { tick: 0, time: 0, done: n === 0, winnerId: null, arena: { r: R }, zone: { x: 0, y: 0, r: R }, monsters, projectiles: [] };
  const events = [];
  let aliveCount = n; let nextProjectile = 1; let finalEmitted = false; let rage = 1;
  let out = []; let pendingKo = [];

  function emit(e) { e.t = state.time; e.tick = state.tick; out.push(e); events.push(e); return e; }

  function setTarget(m, j) {
    if (m.ti === j) return;
    const prev = m.ti >= 0 ? monsters[m.ti].id : null;
    if (m.ti >= 0) aimed[m.ti]--;
    m.ti = j;
    if (j >= 0) { aimed[j]++; m.targetId = monsters[j].id; emit({ type: 'target', id: m.id, targetId: m.targetId, prev }); }
    else m.targetId = null;
  }

  function kill(m, byId, attacker) {
    m.alive = false; m.hp = 0; m.diedAt = state.time; m.place = aliveCount; aliveCount--;
    m.cast = null; m.dash = null; m.kt = 0;
    if (m.ti >= 0) { aimed[m.ti]--; m.ti = -1; }
    m.targetId = null;
    if (attacker) {
      attacker.kills++;
      if (attacker.alive && T.healOnKill > 0) {
        const amount = Math.min(attacker.maxHp - attacker.hp, Math.round(attacker.maxHp * T.healOnKill));
        if (amount > 0) { attacker.hp += amount; emit({ type: 'heal', id: attacker.id, amount, hp: attacker.hp }); }
      }
    }
    pendingKo.push({ m, by: byId });
  }

  // Rückstoß: Verschiebung (kx, ky) wird über KB Ticks ausgeführt; ein laufender Rest wird mitgenommen
  function knock(m, kx, ky) {
    const rx = m.kvx * m.kt + kx; const ry = m.kvy * m.kt + ky;
    m.kt = KB; m.kvx = rx / KB; m.kvy = ry / KB;
  }

  // Ein Treffer von att auf target mit dem Angriff im Slot. single = Ausweichen möglich. (sx, sy) = woher der Stoß kommt.
  function strike(att, target, slot, single, projectileId, sx, sy) {
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
    const dmg = Math.max(1, Math.round(att.atk * (60 / (60 + target.def)) * power * T.K * effMult * att.bonus * rage * roll * (crit ? T.critMult : 1)));
    att.dmgDealt += Math.min(dmg, target.hp);
    target.hp = Math.max(0, target.hp - dmg);
    // Rückstoß weg von der Quelle
    let ux = target.x - sx; let uy = target.y - sy; const ud = Math.sqrt(ux * ux + uy * uy);
    if (ud > 1e-6) { ux /= ud; uy /= ud; } else { ux = att.fx; uy = att.fy; }
    const kd = slot === 1 ? T.knockSpecial : T.knockBasic;
    const kx = ux * kd; const ky = uy * kd;
    const h = { type: 'hit', by: att.id, target: target.id, dmg, crit, eff, kind: mv.kind, move: slot, hp: target.hp, kx, ky };
    if (projectileId) h.projectileId = projectileId;
    emit(h);
    if (target.hp <= 0) kill(target, att.id, att);
    else knock(target, kx, ky);
  }

  function areaStrike(att, slot, cx, cy, radius) {
    const r2 = radius * radius;
    for (let j = 0; j < n; j++) {
      const o = monsters[j];
      if (j === att.i || !o.alive) continue;
      const dx = o.x - cx; const dy = o.y - cy;
      if (dx * dx + dy * dy <= r2) strike(att, o, slot, false, 0, cx, cy);
    }
  }

  // Wie attraktiv ist o als Ziel für m? Kleiner = besser.
  function score(m, o, countSelf) {
    const dx = o.x - m.x; const dy = o.y - m.y; const d = Math.sqrt(dx * dx + dy * dy);
    let others = aimed[o.i] - (countSelf ? 1 : 0);
    let pile = 1;
    for (let k = 0; k < others && k < 6; k++) pile *= T.targetPile;
    return d * effTable[m.i * n + o.i] * (T.targetHpBase + (1 - T.targetHpBase) * (o.hp / o.maxHp)) * pile;
  }

  function retarget(m) {
    let cur = m.ti >= 0 ? monsters[m.ti] : null;
    if (cur && !cur.alive) cur = null;
    if (cur && (state.tick + m.i * 5) % T.retargetTicks !== 0) return cur;
    let best = -1; let bs = Infinity;
    for (let j = 0; j < n; j++) {
      const o = monsters[j];
      if (j === m.i || !o.alive) continue;
      const s = score(m, o, cur === o);
      if (s < bs) { bs = s; best = j; }
    }
    if (best < 0) { setTarget(m, -1); return null; }
    if (cur && best !== cur.i && bs > T.retargetGain * score(m, cur, true)) return cur; // nicht deutlich besser -> Ziel behalten
    setTarget(m, best);
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
        const dx = tg.x - m.x; const dy = tg.y - m.y; const reach = spec.range + spec.reach; const d2 = dx * dx + dy * dy;
        if (d2 <= reach * reach) {
          strike(m, tg, slot, true, 0, m.x, m.y);
          // nach dem Schlag einen Schritt zurück
          const d = Math.sqrt(d2);
          if (m.alive && d > 1e-6) knock(m, (-dx / d) * spec.recoil, (-dy / d) * spec.recoil);
        }
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
        if (qx * qx + qy * qy <= w2) strike(m, o, slot, false, 0, m.x, m.y);
      }
    } else if (c.kind === 'burst') {
      emit({ type: 'fire', id: m.id, move: slot, kind: c.kind, element: mv.element, x: m.x, y: m.y, tx: m.x, ty: m.y });
      areaStrike(m, slot, m.x, m.y, spec.range);
    } else {
      // dash: Absprung. Landepunkt = mit Abstand vor dem Ziel (oder der gemerkte Punkt, wenn das Ziel schon tot ist)
      let lx = c.tx; let ly = c.ty;
      if (tg.alive) { lx = tg.x; ly = tg.y; }
      let dx = lx - m.x; let dy = ly - m.y; let d = Math.sqrt(dx * dx + dy * dy);
      if (d > 1e-6) {
        const len = Math.min(Math.max(0, d - spec.stop), spec.range + 0.5);
        lx = m.x + (dx / d) * len; ly = m.y + (dy / d) * len;
      } else { lx = m.x; ly = m.y; }
      const dl = Math.sqrt(lx * lx + ly * ly);
      if (dl > WALL) { lx = (lx / dl) * WALL; ly = (ly / dl) * WALL; }
      m.dash = { move: slot, t: 0, total: LEAP, sx: m.x, sy: m.y, tx: lx, ty: ly };
      m.kt = 0;
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
        emit({ type: 'cast', id: m.id, move: slot, name: m.moves[slot].name, kind, element: m.moves[slot].element, special: slot === 1, targetId: tg.id, x: m.x, y: m.y, tx: tg.x, ty: tg.y, ticks: WIND[kind] });
        return;
      }
    }

    // Bewegung: in die Zone, sonst auf Wunschabstand gehen und das Ziel umkreisen
    let vx = 0; let vy = 0;
    if (dc > zr - T.zoneMargin && dc > 1e-6) {
      vx = (-m.x / dc) * m.speed; vy = (-m.y / dc) * m.speed;
    } else {
      const want = m.cd[1] <= m.cd[0] ? 1 : 0;
      const pref = S[m.moves[want].kind].pref;
      let radial = 0;
      if (d > pref + T.prefTol) radial = 1; else if (d < pref - T.prefTol) radial = -T.backoffSpeed;
      let side = 0;
      if (d < pref + T.strafeFar) side = (Math.floor((state.tick + m.i * 37) / T.strafeFlipTicks) + m.i) % 2 === 0 ? T.strafeSpeed : -T.strafeSpeed;
      vx = (ux * radial - uy * side) * m.speed; vy = (uy * radial + ux * side) * m.speed;
    }
    m.x += vx * DT; m.y += vy * DT;
  }

  // Rückstoß ausführen, Abstand halten, in der Arena bleiben
  function physics() {
    for (let i = 0; i < n; i++) {
      const m = monsters[i];
      pushX[i] = 0; pushY[i] = 0;
      if (!m.alive || m.dash) continue;
      if (m.kt > 0) { m.x += m.kvx; m.y += m.kvy; m.kt--; }
    }
    const sep = T.separation; const sep2 = sep * sep;
    for (let i = 0; i < n; i++) {
      const a = monsters[i];
      if (!a.alive || a.dash) continue;
      for (let j = i + 1; j < n; j++) {
        const b = monsters[j];
        if (!b.alive || b.dash) continue;
        let dx = b.x - a.x; let dy = b.y - a.y; const d2 = dx * dx + dy * dy;
        if (d2 >= sep2) continue;
        const d = Math.sqrt(d2);
        if (d > 1e-6) { dx /= d; dy /= d; } else { dx = 1; dy = 0; }
        const push = (sep - d) * 0.5 * T.sepStiff;
        pushX[i] -= dx * push; pushY[i] -= dy * push; pushX[j] += dx * push; pushY[j] += dy * push;
      }
    }
    for (let i = 0; i < n; i++) {
      const m = monsters[i];
      if (!m.alive || m.dash) continue;
      let qx = pushX[i]; let qy = pushY[i];
      const q = Math.sqrt(qx * qx + qy * qy);
      if (q > T.sepMaxStep) { qx = (qx / q) * T.sepMaxStep; qy = (qy / q) * T.sepMaxStep; }
      m.x += qx; m.y += qy;
      const dd = Math.sqrt(m.x * m.x + m.y * m.y);
      if (dd > WALL) { m.x = (m.x / dd) * WALL; m.y = (m.y / dd) * WALL; }
    }
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

    // Zone und Schluss-Druck
    state.zone.r = tick <= ZS ? R : tick >= ZE ? T.zoneMin : R + ((T.zoneMin - R) * (tick - ZS)) / (ZE - ZS);
    rage = tick > RAGE ? 1 + (T.ragePerSec * (tick - RAGE)) / TPS : 1;

    // Monster handeln, Startindex wandert pro Tick (kein Vorteil durch die Reihenfolge)
    for (let k = 0; k < n; k++) {
      const m = monsters[(k + tick) % n];
      if (m.alive) act(m);
    }
    physics();

    // Projektile
    let w = 0;
    for (let k = 0; k < ps.length; k++) {
      const p = ps[k]; const tg = monsters[p.ti];
      if (!tg.alive) { emit({ type: 'fizzle', projectileId: p.id }); continue; }
      const dx = tg.x - p.x; const dy = tg.y - p.y; const d = Math.sqrt(dx * dx + dy * dy);
      if (d <= SHOT_STEP + S.shot.hitRadius) {
        const fromX = p.x; const fromY = p.y;
        p.x = tg.x; p.y = tg.y;
        strike(monsters[p.bi], tg, p.move, true, p.id, fromX, fromY);
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
