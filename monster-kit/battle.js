// Kampf-Engine: deterministisch (gleicher Seed -> gleicher Kampf), keine Abhängigkeiten.
// Läuft in Convex (Royale berechnen) und im Browser (Replay). Die KI schreibt höchstens Kommentare dazu.

function rng(seed) {
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

// Zwei Dreiecke: Feuer > Pflanze > Wasser > Feuer, Metall > Plüsch > Geist > Metall
export const BEATS = { fire: 'plant', plant: 'water', water: 'fire', metal: 'fluff', fluff: 'spirit', spirit: 'metal' };
export function effectiveness(attacker, defender) {
  if (BEATS[attacker] === defender) return 1.5;
  if (BEATS[defender] === attacker) return 0.67;
  return 1;
}

// Festes Budget von 300 Punkten: 40 Basis je Wert, 140 verteilt nach den Eigenschaften des Objekts
export function statsFromTraits(t = {}) {
  const v = (k) => Math.min(1, Math.max(0, Number(t[k] ?? 0.5)));
  const w = {
    hp: 0.4 + v('big') + v('soft') * 0.6,
    atk: 0.4 + v('sharp') + v('big') * 0.3,
    def: 0.4 + v('hard') + v('soft') * 0.3,
    spd: 0.4 + v('fast') + (1 - v('big')) * 0.3,
  };
  const sum = w.hp + w.atk + w.def + w.spd;
  const s = {}; let used = 0;
  for (const k of ['hp', 'atk', 'def', 'spd']) { s[k] = 40 + Math.floor((140 * w[k]) / sum); used += s[k]; }
  s.hp += 300 - used;
  return s;
}

// a, b: { id, name, element, stats: {hp, atk, def, spd}, traits? }
// opts.dayElement: Element des Tages bekommt +10 % Angriff
export function runBattle(a, b, seed, opts = {}) {
  const r = rng(seed);
  const side = (m, key) => ({
    key, id: m.id, name: m.name, element: m.element, stats: m.stats,
    maxHp: Math.round(m.stats.hp * 1.6), hp: Math.round(m.stats.hp * 1.6),
    crit: 0.08 + 0.12 * Math.min(1, Math.max(0, m.traits?.sharp ?? 0.5)),
    bonus: opts.dayElement && m.element === opts.dayElement ? 1.1 : 1,
  });
  const A = side(a, 'a'); const B = side(b, 'b');
  const events = [{ type: 'start', a: { id: A.id, name: A.name, element: A.element, maxHp: A.maxHp }, b: { id: B.id, name: B.name, element: B.element, maxHp: B.maxHp } }];
  let turn = 0; let winner = null; let reason = 'ko';
  while (!winner && turn < 24) {
    // Schnellere Seite beginnt die Runde, Gleichstand entscheidet der Seed
    const first = A.stats.spd > B.stats.spd || (A.stats.spd === B.stats.spd && r() < 0.5) ? A : B;
    for (const att of [first, first === A ? B : A]) {
      const def = att === A ? B : A;
      turn++;
      const dodge = Math.min(0.22, Math.max(0.03, 0.05 + (def.stats.spd - att.stats.spd) / 250));
      if (r() < dodge) { events.push({ type: 'dodge', by: def.key, turn }); continue; }
      const eff = effectiveness(att.element, def.element);
      const crit = r() < att.crit;
      const roll = 0.85 + r() * 0.3;
      const dmg = Math.max(1, Math.round(att.stats.atk * (60 / (60 + def.stats.def)) * eff * att.bonus * roll * (crit ? 1.6 : 1) * 0.75));
      def.hp = Math.max(0, def.hp - dmg);
      events.push({ type: 'hit', by: att.key, turn, dmg, crit, eff, hpA: A.hp, hpB: B.hp });
      if (def.hp <= 0) { events.push({ type: 'ko', who: def.key, turn }); winner = att; break; }
    }
  }
  if (!winner) { reason = 'time'; winner = A.hp / A.maxHp >= B.hp / B.maxHp ? A : B; }
  events.push({ type: 'end', winner: winner.key, reason });
  return { winnerId: winner.id, loserId: winner === A ? B.id : A.id, events, turns: turn };
}

// K.-o.-Royale: alle Kämpfe auf einmal berechnet, Gewinner heilen zwischen den Runden.
// entrants: [{ id, name, element, stats, traits? }]
export function runRoyale(entrants, seed, opts = {}) {
  const r = rng(seed);
  const pool = [...entrants];
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
  const rounds = []; const battles = [];
  let alive = pool; let round = 0;
  while (alive.length > 1) {
    const matches = []; const next = [];
    for (let i = 0; i + 1 < alive.length; i += 2) {
      const s = hashString(`${seed}:${round}:${alive[i].id}:${alive[i + 1].id}`);
      const res = runBattle(alive[i], alive[i + 1], s, opts);
      const winner = res.winnerId === alive[i].id ? alive[i] : alive[i + 1];
      matches.push({ aId: alive[i].id, bId: alive[i + 1].id, winnerId: res.winnerId, battle: battles.length });
      battles.push({ round, aId: alive[i].id, bId: alive[i + 1].id, seed: s, winnerId: res.winnerId, events: res.events });
      next.push(winner);
    }
    if (alive.length % 2 === 1) { const bye = alive[alive.length - 1]; matches.push({ aId: bye.id, bId: null, winnerId: bye.id, bye: true }); next.push(bye); }
    rounds.push(matches); alive = next; round++;
  }
  return { rounds, battles, championId: alive[0]?.id ?? null };
}
