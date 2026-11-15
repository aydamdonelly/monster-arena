// Test für monster-kit/royale-sim.js: Quelltext-Check (Determinismus), Wiederholbarkeit, Balance.
// Nutzung: node scripts/royale-sim-test.mjs [Anzahl Seeds]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, runSim, defaultMoves, MOVE_KINDS, MOVE_SPECS, SPECIAL, TUNING, DT } from '../monster-kit/royale-sim.js';
import { statsFromTraits } from '../monster-kit/battle.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = Number(process.argv[2] || 300);
let failed = 0;
const check = (ok, label, detail = '') => { if (!ok) failed++; console.log(`${ok ? 'OK  ' : 'FAIL'} ${label}${detail ? ' · ' + detail : ''}`); };
const pct = (x) => (100 * x).toFixed(1) + '%';
const q = (sorted, p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];

// ---------- 1. Quelltext: nur erlaubte Rechenoperationen ----------
const src = fs.readFileSync(path.join(here, '../monster-kit/royale-sim.js'), 'utf8')
  .replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/([^:'"`])\/\/.*$/gm, '$1');
const usedMath = [...new Set([...src.matchAll(/Math\.([a-zA-Z0-9]+)/g)].map((m) => m[1]))].sort();
const allowed = new Set(['sqrt', 'min', 'max', 'abs', 'floor', 'round', 'imul']);
const forbidden = usedMath.filter((f) => !allowed.has(f));
check(forbidden.length === 0, 'Quelltext: nur erlaubte Math-Funktionen', `benutzt: ${usedMath.join(', ')}${forbidden.length ? ' · VERBOTEN: ' + forbidden.join(', ') : ''}`);
check(!/\bDate\b/.test(src) && !/performance\./.test(src) && !/\*\*/.test(src), 'Quelltext: keine Uhr, kein **-Operator');

// ---------- Teilnehmer aus den Foto-Testmonstern ----------
const rows = JSON.parse(fs.readFileSync(path.join(here, '../monster-kit/test-genomes.json'), 'utf8'));
const base = rows.map((r, i) => {
  const e = { id: 'm' + i, name: r.genome.name, element: r.genome.element, traits: r.genome.traits, stats: statsFromTraits(r.genome.traits) };
  e.moves = defaultMoves(e);
  return e;
});
function clone(e, id, name) { const c = { ...e, id, name }; c.moves = defaultMoves(c); return c; }
const sixteen = [...base, clone(base[0], 'm15', base[0].name + ' II')];

console.log('\nTeilnehmer (16):');
for (const e of sixteen) console.log(' ', e.name.padEnd(18), e.element.padEnd(6), JSON.stringify(e.stats), `${e.moves[0].kind}/${e.moves[1].kind}`.padEnd(12), `${e.moves[0].name} · ${e.moves[1].name}`);

// ---------- 2. Wiederholbarkeit ----------
{
  const a = JSON.stringify(runSim({ entrants: sixteen, seed: 12345, dayElement: 'fire' }));
  const b = JSON.stringify(runSim({ entrants: sixteen, seed: 12345, dayElement: 'fire' }));
  const c = JSON.stringify(runSim({ entrants: sixteen, seed: 12346, dayElement: 'fire' }));
  check(a === b, 'Determinismus: gleicher Seed -> identisches JSON', `${a.length} Zeichen`);
  check(a !== c, 'anderer Seed -> anderer Verlauf');
  // Schrittweise (wie im Client) muss dasselbe ergeben wie runSim
  const sim = createSim({ entrants: sixteen, seed: 12345, dayElement: 'fire' });
  let guard = 4000; while (!sim.state.done && guard-- > 0) sim.step();
  check(JSON.stringify(sim.events) === JSON.stringify(JSON.parse(a).events), 'createSim + step() == runSim');
  const fp = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(16); };
  console.log('     Fingerabdruck Seed 12345 (in Safari/Chrome vergleichen):', fp(a));
}

// ---------- 3. Balance: 16 Teilnehmer ----------
function stats(entrants, seeds, opts = {}) {
  const wins = {}; const kindWins = {}; const elWins = {}; const specWins = {};
  const durations = []; let zoneKo = 0; let ko = 0; let winnerKills = 0; let ties = 0; let timeouts = 0; let casts = 0; let hits = 0; let dodges = 0;
  const placeSum = {}; const dmgByKind = {}; const castByKind = {};
  for (const e of entrants) { wins[e.id] = 0; placeSum[e.id] = 0; }
  for (let s = 0; s < seeds; s++) {
    const res = runSim({ entrants, seed: 1000 + s * 7919, ...opts });
    durations.push(res.duration);
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
      else if (ev.type === 'cast') { casts++; castByKind[ev.kind] = (castByKind[ev.kind] || 0) + 1; }
      else if (ev.type === 'hit') { hits++; dmgByKind[ev.kind] = (dmgByKind[ev.kind] || 0) + ev.dmg; }
      else if (ev.type === 'dodge') dodges++;
    }
  }
  durations.sort((a, b) => a - b);
  return { wins, kindWins, specWins, elWins, durations, zoneShare: zoneKo / Math.max(1, ko), winnerKills: winnerKills / seeds, ties, timeouts, casts: casts / seeds, hits: hits / seeds, dodges: dodges / seeds, placeSum, dmgByKind, castByKind };
}

console.log(`\n=== Balance: 16 Teilnehmer, ${SEEDS} Seeds ===`);
const r = stats(sixteen, SEEDS);
const med = q(r.durations, 0.5); const p10 = q(r.durations, 0.1); const p90 = q(r.durations, 0.9);
check(med >= 55 && med <= 85, 'Dauer Median 55–85 s', `median ${med.toFixed(1)} s · p10 ${p10.toFixed(1)} · p90 ${p90.toFixed(1)} · max ${r.durations.at(-1).toFixed(1)}`);
check(p90 < 110, 'Dauer p90 < 110 s', `${p90.toFixed(1)} s`);
console.log('\nSiegquote je Monster (Ø-Platz):');
const rates = sixteen.map((e) => ({ e, rate: r.wins[e.id] / SEEDS })).sort((a, b) => b.rate - a.rate);
for (const { e, rate } of rates) console.log(' ', e.name.padEnd(18), e.element.padEnd(6), `${e.moves[0].kind}/${e.moves[1].kind}`.padEnd(12), pct(rate).padStart(6), ' Ø-Platz', (r.placeSum[e.id] / SEEDS).toFixed(1));
check(rates[0].rate <= 0.2, 'niemand über 20 %', `max ${pct(rates[0].rate)} (${rates[0].e.name})`);
check(rates.at(-1).rate >= 0.015, 'niemand unter 1,5 %', `min ${pct(rates.at(-1).rate)} (${rates.at(-1).e.name})`);

const pop = (key) => { const o = {}; for (const e of sixteen) { const k = key(e); o[k] = (o[k] || 0) + 1; } return o; };
const share = (winsBy, popBy) => Object.keys(popBy).map((k) => `${k} ${pct((winsBy[k] || 0) / SEEDS)} (Anteil im Feld ${pct(popBy[k] / sixteen.length)})`).join(' · ');
const kindPop = pop((e) => e.moves[0].kind);
console.log('\nSieger nach Basis-Angriff:', share(r.kindWins, kindPop));
console.log('Sieger nach Spezial-Angriff:', share(r.specWins, pop((e) => e.moves[1].kind)));
console.log('Sieger nach Element:', share(r.elWins, pop((e) => e.element)));
const maxKind = Math.max(...Object.values(r.kindWins)) / SEEDS;
check(maxKind <= 0.4, 'keine Basis-Art über 40 % der Siege', pct(maxKind));
check(r.zoneShare < 0.35, 'Zonen-KOs unter 35 %', pct(r.zoneShare));
console.log(`Ø Kills des Siegers ${r.winnerKills.toFixed(2)} · Ø Angriffe/Runde ${r.casts.toFixed(0)} · Ø Treffer ${r.hits.toFixed(0)} · Ø Ausweicher ${r.dodges.toFixed(1)} · Unentschieden ${r.ties} · Zeitlimit ${r.timeouts}`);
console.log('Schaden je Art (Anteil):', MOVE_KINDS.map((k) => `${k} ${pct((r.dmgByKind[k] || 0) / Object.values(r.dmgByKind).reduce((a, b) => a + b, 0))}`).join(' · '));

// ---------- 4. Labor: gleiche Werte, gleiche Elemente, Arten gleichmäßig -> reine Stärke der Angriffsarten ----------
{
  const lab = [];
  for (let i = 0; i < 20; i++) {
    const a = MOVE_KINDS[i % 5]; const b = MOVE_KINDS[(i % 5 + 1 + Math.floor(i / 5)) % 5];
    lab.push({ id: 'L' + i, name: 'Lab' + i, element: 'none', stats: { hp: 75, atk: 75, def: 75, spd: 75 }, traits: { sharp: 0.5 }, moves: [{ name: a, kind: a, element: 'none' }, { name: b, kind: b, element: 'none' }] });
  }
  const L = stats(lab, SEEDS);
  console.log(`\n=== Labor: 20 gleiche Monster, je 4 pro Basis-Art, ${SEEDS} Seeds (erwartet je 20 %) ===`);
  console.log('Basis:  ', MOVE_KINDS.map((k) => `${k} ${pct((L.kindWins[k] || 0) / SEEDS)}`).join(' · '));
  console.log('Spezial:', MOVE_KINDS.map((k) => `${k} ${pct((L.specWins[k] || 0) / SEEDS)}`).join(' · '));
  console.log(`Dauer median ${q(L.durations, 0.5).toFixed(1)} s · p90 ${q(L.durations, 0.9).toFixed(1)} s · Zonen-KOs ${pct(L.zoneShare)}`);
  const worst = Math.max(...MOVE_KINDS.map((k) => (L.kindWins[k] || 0) / SEEDS));
  const least = Math.min(...MOVE_KINDS.map((k) => (L.kindWins[k] || 0) / SEEDS));
  check(worst <= 0.4, 'Labor: keine Basis-Art über 40 %', `max ${pct(worst)} · min ${pct(least)}`);
}

// ---------- 4b. Labor: vier Werte-Typen (einer hoch, drei niedrig, Summe 300) -> jeder Punkt soll etwa gleich viel wert sein ----------
{
  const ARCH = ['hp', 'atk', 'def', 'spd']; const lab = [];
  for (let i = 0; i < 20; i++) {
    const a = MOVE_KINDS[i % 5]; const b = MOVE_KINDS[(i % 5 + 1 + Math.floor(i / 5)) % 5];
    const st = { hp: 68, atk: 68, def: 68, spd: 68 }; st[ARCH[i % 4]] = 96;
    lab.push({ id: 'S' + i, name: 'S' + i, arch: ARCH[i % 4], element: 'none', stats: st, traits: { sharp: 0.5 }, moves: [{ name: a, kind: a, element: 'none' }, { name: b, kind: b, element: 'none' }] });
  }
  const wins = { hp: 0, atk: 0, def: 0, spd: 0 };
  for (let s = 0; s < SEEDS; s++) { const res = runSim({ entrants: lab, seed: 5 + s * 7919 }); wins[lab.find((e) => e.id === res.winnerId).arch]++; }
  console.log(`\n=== Labor: Werte-Typen 96/68/68/68, ${SEEDS} Seeds (erwartet je 25 %) ===`);
  console.log(ARCH.map((a) => `${a} ${pct(wins[a] / SEEDS)}`).join(' · '));
  const hi = Math.max(...ARCH.map((a) => wins[a] / SEEDS)); const lo = Math.min(...ARCH.map((a) => wins[a] / SEEDS));
  check(hi <= 0.36 && lo >= 0.14, 'Labor: kein Wert dominiert (14–36 %)', `max ${pct(hi)} · min ${pct(lo)}`);
}

// ---------- 5. Feldgrößen ----------
console.log('\n=== Feldgrößen ===');
for (const n of [2, 4, 8, 16, 24, 40, 100]) {
  const field = [];
  for (let i = 0; i < n; i++) field.push(i < base.length ? base[i] : clone(base[i % base.length], 'x' + i, `${base[i % base.length].name} ${Math.floor(i / base.length) + 1}`));
  const d = []; let to = 0;
  const runs = n >= 100 ? 10 : 40;
  for (let s = 0; s < runs; s++) { const res = runSim({ entrants: field, seed: 500 + s * 104729 }); d.push(res.duration); if (res.events.at(-1).reason === 'time') to++; }
  d.sort((a, b) => a - b);
  const t0 = Date.now(); runSim({ entrants: field, seed: 7 }); const ms = Date.now() - t0;
  check(to === 0 && d.at(-1) <= TUNING.maxSeconds, `n = ${String(n).padStart(3)} endet`, `median ${q(d, 0.5).toFixed(1)} s · max ${d.at(-1).toFixed(1)} s · Zeitlimit ${to}/${runs} · Rechenzeit ${ms} ms`);
}
{
  const one = runSim({ entrants: [base[0]], seed: 1 }); const zero = runSim({ entrants: [], seed: 1 });
  check(one.winnerId === base[0].id && zero.winnerId === null, 'Sonderfälle: 1 Teilnehmer gewinnt sofort, 0 Teilnehmer -> kein Sieger');
}

console.log(`\nKonstanten: K ${TUNING.K} · hpMult ${TUNING.hpMult} · Gewichte hp ${TUNING.wHp} atk ${TUNING.wAtk} def ${TUNING.wDef} spd(Abklingzeit) ${TUNING.wSpd} · KO-Heilung ${TUNING.healOnKill * 100} % · Element x${(1 + 0.5 * TUNING.effScale).toFixed(2)}/x${(1 - 0.33 * TUNING.effScale).toFixed(2)} · Fernkampf-Abstand ${TUNING.rangedApproach} · Zone ${TUNING.zoneStart}–${TUNING.zoneEnd} s auf r ${TUNING.zoneMin} · Zonenschaden ${TUNING.zoneDps} + ${TUNING.zoneDpsPct * 100} %/s · Spezial x${SPECIAL.power} Kraft, x${SPECIAL.cooldown} Abklingzeit · DT ${DT}`);
console.log('Angriffe:', MOVE_KINDS.map((k) => `${k} r${MOVE_SPECS[k].range} w${MOVE_SPECS[k].windup} cd${MOVE_SPECS[k].cooldown} p${MOVE_SPECS[k].power}`).join(' · '));
console.log(failed ? `\n${failed} CHECK(S) FEHLGESCHLAGEN` : '\nALLE CHECKS OK');
process.exit(failed ? 1 : 0);
