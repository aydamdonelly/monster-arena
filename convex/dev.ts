// Nur für Tests: Testmonster aus monster-kit/test-genomes.json anlegen (Spieler mit isTest = true, zählen nirgends mit).
// npx convex run dev:seedTest "$(node -e "const r=require('./monster-kit/test-genomes.json');console.log(JSON.stringify({rows:r.map(({title,image,genome})=>({title,image,genome}))}))")"
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { genomeFromAI } from "../monster-kit/genome-spec.js";
import { statsFromTraits } from "../monster-kit/battle.js";

export const seedTest = internalMutation({
  args: { rows: v.array(v.object({ title: v.string(), image: v.string(), genome: v.any() })) },
  returns: v.number(),
  handler: async (ctx, { rows }) => {
    let n = 0;
    for (const [i, r] of rows.entries()) {
      const deviceId = `test-${r.title}`;
      const existing = await ctx.db
        .query("players")
        .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
        .unique();
      const playerId =
        existing?._id ??
        (await ctx.db.insert("players", { deviceId, name: `Test ${r.title.replace(/_/g, " ")}`, source: "seed", isTest: true }));
      const genome = { ...genomeFromAI(r.genome, 5000 + i), photoUrl: r.image };
      // Als fertiges Ei anlegen: schlüpft bei der nächsten Royale mit includeTest
      await ctx.db.insert("monsters", {
        playerId,
        genome,
        name: genome.name,
        element: genome.element,
        stats: statsFromTraits(genome.traits),
        stage: 1,
        status: "egg",
        ready: true,
      });
      n++;
    }
    return n;
  },
});

// Wilde Monster (Hausspieler): füllen die Arena auf, wenn zu wenige Eier da sind (siehe royale.ts). Zählen nirgends als Spieler.
// node scripts/seed-wild.mjs
export const seedWild = internalMutation({
  args: { rows: v.array(v.object({ title: v.string(), genome: v.any() })) },
  returns: v.number(),
  handler: async (ctx, { rows }) => {
    const existing = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", "house-wild"))
      .unique();
    const playerId = existing?._id ?? (await ctx.db.insert("players", { deviceId: "house-wild", name: "Wild", source: "house", isTest: true }));
    const have = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .take(200);
    const names = new Set(have.map((m) => m.name));
    let n = 0;
    for (const [i, r] of rows.entries()) {
      const genome = genomeFromAI(r.genome, 9000 + i);
      if (names.has(genome.name)) continue;
      await ctx.db.insert("monsters", {
        playerId,
        genome,
        name: genome.name,
        element: genome.element,
        stats: statsFromTraits(genome.traits),
        stage: 1,
        status: "hatched",
        ready: true,
      });
      n++;
    }
    return n;
  },
});

// Wilde Monster sind nur Füllung: Sie kämpfen mit weniger Leben und Angriff, damit möglichst ein echtes Ei gewinnt.
// Die Werte stehen am Monster, also rechnen Server und Clients mit denselben Zahlen. npx convex run dev:nerfWild '{"factor":0.65}'
export const nerfWild = internalMutation({
  args: { factor: v.number() },
  returns: v.number(),
  handler: async (ctx, { factor }) => {
    const house = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", "house-wild"))
      .unique();
    if (!house) return 0;
    const pool = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", house._id))
      .take(200);
    let n = 0;
    for (const m of pool) {
      const base = statsFromTraits(m.genome?.traits);
      await ctx.db.patch("monsters", m._id, {
        stats: { ...base, hp: Math.round(base.hp * factor), atk: Math.round(base.atk * factor) },
      });
      n++;
    }
    return n;
  },
});

// Cloud-Rechner der Agenten nachträglich als Test markieren (Linux-Browser mit Zeitzone UTC). npx convex run dev:flagCloud '{"since":…}'
export const flagCloud = internalMutation({
  args: { since: v.number() },
  returns: v.number(),
  handler: async (ctx, { since }) => {
    const rows = await ctx.db
      .query("players")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", since))
      .take(4000);
    let n = 0;
    for (const p of rows) {
      if (!p.isTest && p.tz === "UTC" && p.dev === "other" && !(p.eggs ?? 0)) {
        await ctx.db.patch("players", p._id, { isTest: true });
        n++;
      }
    }
    return n;
  },
});

// Vor dem Start: alle bisherigen Spieler als Test markieren (zählen nicht in Zahlen und Royale).
// npx convex run dev:markAllTest '{"before": <Zeitstempel in ms>}'
export const markAllTest = internalMutation({
  args: { before: v.number() },
  returns: v.number(),
  handler: async (ctx, { before }) => {
    let n = 0;
    for await (const p of ctx.db.query("players")) {
      if (p._creationTime < before && !p.isTest) {
        await ctx.db.patch("players", p._id, { isTest: true });
        n++;
      }
    }
    return n;
  },
});

// Einmalig nach dem Einführen der Zähler: Ei-Zahl je Spieler und den Zähler "Eier warten" aus dem Bestand nachtragen.
// npx convex run dev:backfillStats '{"since": <Zeitstempel in ms>}'
export const backfillStats = internalMutation({
  args: { since: v.number() },
  handler: async (ctx, { since }) => {
    const players = await ctx.db
      .query("players")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", since))
      .take(2000);
    let waiting = 0, touched = 0;
    for (const p of players) {
      const mine = await ctx.db
        .query("monsters")
        .withIndex("by_playerId", (q) => q.eq("playerId", p._id))
        .take(50);
      if (!mine.length) continue;
      const eggs = mine.length;
      const rejects = mine.filter((m) => m.status === "rejected").length;
      const firstEggAt = Math.min(...mine.map((m) => m._creationTime));
      await ctx.db.patch("players", p._id, { eggs, rejects, firstEggAt });
      touched++;
      if (!p.isTest) waiting += mine.filter((m) => m.status === "egg").length;
    }
    const row = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "eggsWaiting"))
      .unique();
    if (row) await ctx.db.patch("counters", row._id, { n: waiting });
    else await ctx.db.insert("counters", { name: "eggsWaiting", n: waiting });
    return { players: players.length, touched, waiting };
  },
});

// Übersicht für uns: Spieler (ohne Test) nach Quelle, Schlüpfe, Wiederkehrer
export const overview = internalMutation({
  args: {},
  handler: async (ctx) => {
    const players = await ctx.db.query("players").take(2000);
    const real = players.filter((p) => !p.isTest);
    const bySource: Record<string, number> = {};
    for (const p of real) bySource[p.source ?? "unknown"] = (bySource[p.source ?? "unknown"] ?? 0) + 1;
    const realIds = new Set(real.map((p) => p._id as string));
    const monsters = await ctx.db.query("monsters").order("desc").take(4000);
    const perPlayer: Record<string, number> = {};
    for (const m of monsters) if (realIds.has(m.playerId)) perPlayer[m.playerId] = (perPlayer[m.playerId] ?? 0) + 1;
    const hatchers = Object.keys(perPlayer).length;
    return {
      players: real.length,
      testPlayers: players.length - real.length,
      bySource,
      playersWithMonster: hatchers,
      monsters: Object.values(perPlayer).reduce((a, b) => a + b, 0),
      playersWith2Plus: Object.values(perPlayer).filter((n) => n >= 2).length,
      latest: real.slice(-8).map((p) => ({ name: p.name ?? null, source: p.source ?? null, at: new Date(p._creationTime).toISOString().slice(11, 19) })),
    };
  },
});
