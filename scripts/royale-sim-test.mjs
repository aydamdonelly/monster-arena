// Test für monster-kit/royale-sim.js: Quelltext-Check (Determinismus), Wiederholbarkeit, Lesbarkeit, Dauer, Balance.
// Nutzung: node scripts/royale-sim-test.mjs [Anzahl Seeds, Standard 600]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, runSim, defaultMoves, MOVE_KINDS, MOVE_SPECS, SPECIAL, TUNING, DT } from '../monster-kit/royale-sim.js';
import { statsFromTraits } from '../monster-kit/battle.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = Number(process.argv[2] || 600);
let failed = 0;
const check = (ok, label, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ' · ' + detail : ''}`); };
const pct = (x) => (100 * x).toFixed(1) + '%';
const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
const kindAt = (i) => [MOVE_KINDS[i % 5], MOVE_KINDS[(i % 5 + 1 + (Math.floor(i / 5) % 4)) % 5]];

// ---------- 1. Quelltext: nur erlaubte Rechenoperationen ----------
const src = fs.readFileSync(path.join(here, '../monster-kit/royale-sim.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');
const usedMath = [...new Set([...src.matchAll(/Math\.([a-zA-Z0-9]+)/g)].map((m) => m[1]))].sort();
const allowed = new Set(['sqrt', 'min', 'max', 'abs', 'floor', 'round', 'imul']);
const forbidden = usedMath.filter((f) => !allowed.has(f));
check(forbidden.length === 0, 'Quelltext: nur erlaubte Math-Funktionen', `benutzt: ${usedMath.join(', ')}${forbidden.length ? ' · VERBOTEN: ' + forbidden.join(', ') : ''}`);
check(!/\bDate\b/.test(src) && !/performance\./.test(src) && !/\*\*/.test(src), 'Quelltext: keine Uhr, kein **-Operator');

// ---------- Testfelder aus den Foto-Testmonstern ----------
// KI-Feld: Angriffe wie von der KI vergeben (so laufen die echten Runden). Misch-Feld: Arten reihum, für die Balance der Angriffsarten.
const rows = JSON.parse(fs.readFileSync(path.join(here, '../monster-kit/test-genomes.json'), 'utf8'));
function entrant(r, i, id, name) {
  const g = r.genome; const e = { id, name, element: g.element, traits: g.traits, stats: statsFromTraits(g.traits) };
  const ai = [g.move1, g.move2].filter(Boolean);
  const [a, b] = kindAt(i);
  return { ki: { ...e, moves: ai.length === 2 ? ai : defaultMoves(e) }, mix: { ...e, moves: [{ name: `${a}`, kind: a, element: g.element }, { name: `${b}`, kind: b, element: g.element }] } };
}
const both = rows.map((r, i) => entrant(r, i, 'm' + i, r.genome.name));
both.push(entrant(rows[0], rows.length, 'm' + rows.length, rows[0].genome.name + ' II'));
const KI = both.map((x) => x.ki).slice(0, 16); const MIX = both.map((x) => x.mix).slice(0, 16);
const window = (field, n, s) => { const out = []; for (let k = 0; k < n; k++) out.push(field[(s * 3 + k) % field.length]); return out; };

console.log('\nTeilnehmer (16) · KI-Angriffe | Misch-Feld:');
KI.forEach((e, i) => console.log(' ', e.name.padEnd(18), e.element.padEnd(6), JSON.stringify(e.stats), `${e.moves[0].kind}/${e.moves[1].kind}`.padEnd(12), `${e.moves[0].name} · ${e.moves[1].name}`.padEnd(44), '|', `${MIX[i].moves[0].kind}/${MIX[i].moves[1].kind}`));

// ---------- 2. Wiederholbarkeit ----------
{
  const a = JSON.stringify(runSim({ entrants: KI, seed: 12345, dayElement: 'fire' }));
  const b = JSON.stringify(runSim({ entrants: KI, seed: 12345, dayElement: 'fire' }));
  const c = JSON.stringify(runSim({ entrants: KI, seed: 12346, dayElement: 'fire' }));
  check(a === b, 'Determinismus: gleicher Seed -> identisches JSON', `${a.length} Zeichen`);
  check(a !== c, 'anderer Seed -> anderer Verlauf');
  const sim = createSim({ entrants: KI, seed: 12345, dayElement: 'fire' });
  let guard = 4000; while (!sim.state.done && guard-- > 0) sim.step();
  check(JSON.stringify(sim.events) === JSON.stringify(JSON.parse(a).events), 'createSim + step() == runSim');
  const fp = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  console.log('     Fingerabdruck Seed 12345 (in Safari/Chrome vergleichen):', fp(a));
  const ev = JSON.parse(a).events; const hit = ev.find((e) => e.type === 'hit'); const tg = ev.find((e) => e.type === 'target'); const cast = ev.find((e) => e.type === 'cast');
  check(hit && typeof hit.kx === 'number' && typeof hit.ky === 'number' && tg && 'prev' in tg && cast && cast.ticks > 0, 'neue Felder: hit.kx/ky, target-Event, cast.ticks');
}

// ---------- 3. Lesbarkeit: Angriffe pro Sekunde, kein Haufen, niemand steht herum ----------
function readability(field, seeds) {
  let casts8 = 0, ticks8 = 0, close = 0, pairs = 0, nnSum = 0, idle = 0, free = 0, switches = 0, aliveTicks = 0, hits = 0, casts = 0, dmg = 0, hpSum = 0;
  for (let s = 0; s < seeds; s++) {
    const sim = createSim({ entrants: field, seed: 50 + s * 7919 }); const ms = sim.state.monsters;
    while (!sim.state.done) {
      let alive = 0; for (const m of ms) if (m.alive) alive++;
      const ev = sim.step(); let cc = 0;
      for (const e of ev) { if (e.type === 'cast') cc++; else if (e.type === 'target' && e.prev !== null) switches++; else if (e.type === 'hit') { hits++; dmg += e.dmg; } }
      casts += cc; aliveTicks += alive; if (alive === 8) { casts8 += cc; ticks8++; }
      if (sim.state.tick % 4 !== 0) continue;
      for (const m of ms) {
        if (!m.alive) continue;
        let nd = Infinity; for (const o of ms) { if (o === m || !o.alive) continue; const d = Math.sqrt((o.x - m.x) * (o.x - m.x) + (o.y - m.y) * (o.y - m.y)); if (d < nd) nd = d; }
        if (nd < Infinity) { pairs++; nnSum += nd; if (nd < 1.15) close++; }
        if (!m.cast && !m.dash) { free++; if (Math.sqrt((m.x - m.px) * (m.x - m.px) + (m.y - m.py) * (m.y - m.py)) < 0.02) idle++; }
      }
    }
    for (const m of ms) hpSum += m.maxHp;
  }
  return { cps8: casts8 / (ticks8 * DT), close: close / pairs, nn: nnSum / pairs, idle: idle / free, switches: switches / (aliveTicks * DT), perMonster: casts / (aliveTicks * DT), dmgPerHit: dmg / hits, hpAvg: hpSum / (seeds * field.length) };
}
console.log('\n=== Lesbarkeit (16 Teilnehmer, 100 Seeds) ===');
for (const [label, field] of [['KI-Feld', KI], ['Misch-Feld', MIX]]) {
  const r = readability(field, 100);
  check(r.cps8 >= 2 && r.cps8 <= 3, `${label}: 2–3 neue Angriffe pro Sekunde bei 8 Lebenden`, `${r.cps8.toFixed(2)}/s · je Monster ${r.perMonster.toFixed(2)}/s · Ø Schaden pro Treffer ${r.dmgPerHit.toFixed(0)} (${pct(r.dmgPerHit / r.hpAvg)} der Ø-HP)`);
  check(r.close < 0.02, `${label}: kein Haufen (nächster Nachbar näher als 1,15 in < 2 % der Fälle)`, `${pct(r.close)} · Ø Abstand zum Nächsten ${r.nn.toFixed(2)}`);
  check(r.idle < 0.1, `${label}: freie Monster stehen in < 10 % der Zeit still`, `${pct(r.idle)} · Zielwechsel je Monster ${r.switches.toFixed(2)}/s`);
}

// ---------- 4. Dauer je Feldgröße ----------
function durations(field, n, seeds) {
  const d = []; let to = 0;
  for (let s = 0; s < seeds; s++) { const res = runSim({ entrants: window(field, n, s), seed: 1000 + s * 7919 }); d.push(res.duration); if (res.events.at(-1).reason === 'time') to++; }
  d.sort((a, b) => a - b);
  return { med: q(d, 0.5), p10: q(d, 0.1), p90: q(d, 0.9), max: d.at(-1), to };
}
console.log(`\n=== Dauer (KI-Feld, ${SEEDS} Seeds, wechselnde Teilnehmer) ===`);
const TARGET = { 2: [12, 18], 8: [28, 38], 12: [34, 45], 16: [40, 52] };
for (const n of [2, 8, 12, 16]) {
  const r = durations(KI, n, SEEDS); const [lo, hi] = TARGET[n];
  check(r.med >= lo && r.med <= hi, `n = ${String(n).padStart(2)}: Median ${lo}–${hi} s`, `median ${r.med.toFixed(1)} s · p10 ${r.p10.toFixed(1)} · p90 ${r.p90.toFixed(1)} · max ${r.max.toFixed(1)}`);
  if (n === 16) check(r.p90 < 60, 'n = 16: p90 unter 60 s', `${r.p90.toFixed(1)} s`);
}
{
  const m = [2, 8, 12, 16].map((n) => { const r = durations(MIX, n, Math.min(SEEDS, 300)); return `n${n} ${r.med.toFixed(1)} (p90 ${r.p90.toFixed(0)})`; });
  console.log('     Misch-Feld zum Vergleich (mehr Fernkämpfer, daher etwas länger):', m.join(' · '));
}

// ---------- 5. Balance ----------
function balance(entrants, seeds) {
  const wins = {}; const kindWins = {}; const elWins = {}; const specWins = {}; const placeSum = {};
  let zoneKo = 0, ko = 0, winnerKills = 0, ties = 0, timeouts = 0;
  for (const e of entrants) { wins[e.id] = 0; placeSum[e.id] = 0; }
  for (let s = 0; s < seeds; s++) {
    const res = runSim({ entrants, seed: 1000 + s * 7919 });
    wins[res.winnerId]++;
    const w = entrants.find((e) => e.id === res.winnerId);
    kindWins[w.moves[0].kind] = (kindWins[w.moves[0].kind] || 0) + 1;
    specWins[w.moves[1].kind] = (specWins[w.moves[1].kind] || 0) + 1;
    elWins[w.element] = (elWins[w.element] || 0) + 1;
    winnerKills += res.kills[res.winnerId];
    res.placements.forEach((id, i) => { placeSum[id] += i + 1; });
    for (const ev of res.events) {
      if (ev.type === 'ko') { ko++; if (ev.by === 'zone') zoneKo++; }
      else if (ev.type === 'win') { if (ev.reason === 'tie') ties++; if (ev.reason === 'time') timeouts++; }
    }
  }
  return { wins, kindWins, specWins, elWins, placeSum, zoneShare: zoneKo / Math.max(1, ko), winnerKills: winnerKills / seeds, ties, timeouts };
}
const pop = (field, key) => { const o = {}; for (const e of field) { const k = key(e); o[k] = (o[k] || 0) + 1; } return o; };
const share = (winsBy, popBy, n) => Object.keys(popBy).map((k) => `${k} ${pct((winsBy[k] || 0) / SEEDS)} (im Feld ${pct(popBy[k] / n)})`).join(' · ');
for (const [label, field, kinds] of [['Misch-Feld', MIX, true], ['KI-Feld', KI, false]]) {
  console.log(`\n=== Balance: ${label}, 16 Teilnehmer, ${SEEDS} Seeds ===`);
  const r = balance(field, SEEDS);
  const rates = field.map((e) => ({ e, rate: r.wins[e.id] / SEEDS })).sort((a, b) => b.rate - a.rate);
  for (const { e, rate } of rates) console.log(' ', e.name.padEnd(18), e.element.padEnd(6), `${e.moves[0].kind}/${e.moves[1].kind}`.padEnd(12), pct(rate).padStart(6), ' Ø-Platz', (r.placeSum[e.id] / SEEDS).toFixed(1));
  check(rates[0].rate <= 0.2, `${label}: niemand über 20 %`, `max ${pct(rates[0].rate)} (${rates[0].e.name})`);
  check(rates.at(-1).rate >= 0.015, `${label}: niemand unter 1,5 %`, `min ${pct(rates.at(-1).rate)} (${rates.at(-1).e.name})`);
  console.log('Sieger nach Basis-Angriff:', share(r.kindWins, pop(field, (e) => e.moves[0].kind), field.length));
  console.log('Sieger nach Spezial-Angriff:', share(r.specWins, pop(field, (e) => e.moves[1].kind), field.length));
  console.log('Sieger nach Element:', share(r.elWins, pop(field, (e) => e.element), field.length));
  if (kinds) { const maxKind = Math.max(...Object.values(r.kindWins)) / SEEDS; check(maxKind <= 0.4, `${label}: keine Basis-Art über 40 % der Siege`, pct(maxKind)); }
  check(r.zoneShare <= 0.15, `${label}: Zonen-KOs höchstens 15 %`, pct(r.zoneShare));
  console.log(`Ø Kills des Siegers ${r.winnerKills.toFixed(2)} · Unentschieden ${r.ties} · Zeitlimit ${r.timeouts}`);
}

// ---------- 6. Labor: gleiche Werte, gleiche Elemente, Arten gleichmäßig -> reine Stärke der Angriffsarten ----------
{
  const lab = [];
  for (let i = 0; i < 20; i++) { const [a, b] = kindAt(i); lab.push({ id: 'L' + i, name: 'Lab' + i, element: 'none', stats: { hp: 75, atk: 75, def: 75, spd: 75 }, traits: { sharp: 0.5 }, moves: [{ name: a, kind: a, element: 'none' }, { name: b, kind: b, element: 'none' }] }); }
  const kw = {}; const sw = {};
  for (let s = 0; s < SEEDS; s++) { const res = runSim({ entrants: lab, seed: 31 + s * 7919 }); const w = lab.find((e) => e.id === res.winnerId); kw[w.moves[0].kind] = (kw[w.moves[0].kind] || 0) + 1; sw[w.moves[1].kind] = (sw[w.moves[1].kind] || 0) + 1; }
  console.log(`\n=== Labor: 20 gleiche Monster, je 4 pro Basis-Art, ${SEEDS} Seeds (erwartet je 20 %) ===`);
  console.log('Basis:  ', MOVE_KINDS.map((k) => `${k} ${pct((kw[k] || 0) / SEEDS)}`).join(' · '));
  console.log('Spezial:', MOVE_KINDS.map((k) => `${k} ${pct((sw[k] || 0) / SEEDS)}`).join(' · '));
  const hi = Math.max(...MOVE_KINDS.map((k) => (kw[k] || 0) / SEEDS)); const lo = Math.min(...MOVE_KINDS.map((k) => (kw[k] || 0) / SEEDS));
  check(hi <= 0.28 && lo >= 0.14, 'Labor: jede Basis-Art gewinnt 14–28 %', `max ${pct(hi)} · min ${pct(lo)}`);
}

// ---------- 7. Labor: vier Werte-Typen (einer hoch, drei niedrig, Summe 300) -> jeder Punkt soll etwa gleich viel wert sein ----------
{
  const ARCH = ['hp', 'atk', 'def', 'spd']; const lab = [];
  for (let i = 0; i < 20; i++) {
    const [a, b] = kindAt(i); const st = { hp: 68, atk: 68, def: 68, spd: 68 }; st[ARCH[i % 4]] = 96;
    lab.push({ id: 'S' + i, name: 'S' + i, arch: ARCH[i % 4], element: 'none', stats: st, traits: { sharp: 0.5 }, moves: [{ name: a, kind: a, element: 'none' }, { name: b, kind: b, element: 'none' }] });
  }
  const wins = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (let s = 0; s < SEEDS; s++) { const res = runSim({ entrants: lab, seed: 5 + s * 7919 }); wins[lab.find((e) => e.id === res.winnerId).arch]++; }
  console.log(`\n=== Labor: Werte-Typen 96/68/68/68, ${SEEDS} Seeds (erwartet je 25 %) ===`);
  console.log(ARCH.map((a) => `${a} ${pct(wins[a] / SEEDS)}`).join(' · '));
  const hi = Math.max(...ARCH.map((a) => wins[a] / SEEDS)); const lo = Math.min(...ARCH.map((a) => wins[a] / SEEDS));
  check(hi <= 0.36 && lo >= 0.14, 'Labor: kein Wert dominiert (14–36 %)', `max ${pct(hi)} · min ${pct(lo)}`);
}

// ---------- 8. Feldgrößen ----------
console.log('\n=== Feldgrößen (KI-Feld, bei Bedarf mehrfach) ===');
for (const n of [2, 3, 4, 6, 8, 12, 16, 24, 40, 100]) {
  const runs = n >= 100 ? 10 : 60; const d = []; let to = 0;
  for (let s = 0; s < runs; s++) {
    const field = []; for (let i = 0; i < n; i++) { const e = KI[(s * 3 + i) % KI.length]; field.push({ ...e, id: 'x' + i, name: i < KI.length ? e.name : `${e.name} ${Math.floor(i / KI.length) + 1}` }); }
    const res = runSim({ entrants: field, seed: 500 + s * 104729 }); d.push(res.duration); if (res.events.at(-1).reason === 'time') to++;
  }
  d.sort((a, b) => a - b);
  const big = []; for (let i = 0; i < n; i++) big.push({ ...KI[i % KI.length], id: 'y' + i });
  const t0 = Date.now(); const one = createSim({ entrants: big, seed: 7 }); while (!one.state.done) one.step(); const ms = Date.now() - t0;
  check(to === 0 && d.at(-1) <= TUNING.maxSeconds, `n = ${String(n).padStart(3)} endet`, `median ${q(d, 0.5).toFixed(1)} s · p90 ${q(d, 0.9).toFixed(1)} · max ${d.at(-1).toFixed(1)} s · Arena-Radius ${one.state.arena.r.toFixed(2)} · Rechenzeit ${ms} ms`);
}
{
  const one = runSim({ entrants: [KI[0]], seed: 1 }); const zero = runSim({ entrants: [], seed: 1 });
  check(one.winnerId === KI[0].id && zero.winnerId === null, 'Sonderfälle: 1 Teilnehmer gewinnt sofort, 0 Teilnehmer -> kein Sieger');
}

console.log(`\nKonstanten: K ${TUNING.K} · hpMult ${TUNING.hpMult} · Gewichte hp ${TUNING.wHp} atk ${TUNING.wAtk} def ${TUNING.wDef} spd(Abklingzeit) ${TUNING.wSpd} (Faktor ${TUNING.hasteMin}–${TUNING.hasteMax}) · KO-Heilung ${TUNING.healOnKill * 100} % · Element x${(1 + 0.5 * TUNING.effScale).toFixed(2)}/x${(1 - 0.33 * TUNING.effScale).toFixed(2)}`);
console.log(`Arena-Radius ${TUNING.arenaBase} + ${TUNING.arenaPerSqrtN} * sqrt(n) · Zone ab ${TUNING.zoneStart} s, Minimum r ${TUNING.zoneMin} nach ${TUNING.zoneEndBase} + ${TUNING.zoneEndPerSqrtN} * sqrt(n) s, danach +${TUNING.ragePerSec * 100} % Schaden pro Sekunde · Zonenschaden ${TUNING.zoneDps} + ${TUNING.zoneDpsPct * 100} %/s`);
console.log(`Abstand ${TUNING.separation} · Rückstoß Basis ${TUNING.knockBasic} / Spezial ${TUNING.knockSpecial} über ${TUNING.knockTicks} Ticks · Zielwahl: sehr effektiv x${TUNING.targetEffGood}, schwach x${TUNING.targetEffBad}, HP ${TUNING.targetHpBase}+${(1 - TUNING.targetHpBase).toFixed(1)}*Anteil, je Mitjäger x${TUNING.targetPile}, Wechsel ab x${TUNING.retargetGain}`);
console.log(`Erste Angriffe: Basis ${TUNING.firstBasic.join('–')} s, Spezial ${TUNING.firstSpecial.join('–')} s · Spezial x${SPECIAL.power} Kraft, x${SPECIAL.cooldown} Abklingzeit · DT ${DT}`);
console.log('Angriffe:', MOVE_KINDS.map((k) => `${k} Reichweite ${MOVE_SPECS[k].range} Ausholen ${MOVE_SPECS[k].windup} Abklingzeit ${MOVE_SPECS[k].cooldown} Kraft ${MOVE_SPECS[k].power} Wunschabstand ${MOVE_SPECS[k].pref}`).join(' · '));
console.log(failed ? `\n${failed} CHECK(S) FEHLGESCHLAGEN` : '\nALLE CHECKS OK');
process.exit(failed ? 1 : 0);
