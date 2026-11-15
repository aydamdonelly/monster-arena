// Royale: alle Monster des Tages kämpfen alle-gegen-alle (monster-kit/royale-sim.js).
// Der Server rechnet nur das Ergebnis aus. Clients spielen jede Runde aus seed + entrants bitgleich nach (monster-kit/arena.js).
// Bei mehr als 20 Monstern gibt es Vorrunden (Heats) und ein Finale.
import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { runSim } from "../monster-kit/royale-sim.js";
import { hashString } from "../monster-kit/battle.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const SINGLE_MAX = 20; // bis hierhin eine einzige Arena
const HEAT_SIZE = 16;

type Entrant = {
  id: Id<"monsters">;
  playerId: Id<"players">;
  name: string;
  element: string;
  stats: { hp: number; atk: number; def: number; spd: number };
  traits: unknown;
  moves: unknown;
  genome: unknown;
  photoId: Id<"_storage"> | null;
  ownerName: string | null;
};
type Round = { seed: number; entrants: Entrant[]; winnerId: string | null; placements: string[]; duration: number };
type RoyaleData = { title: string; dayElement: string | null; entrantCount: number; heats: Round[]; final: Round };

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function simulate(entrants: Entrant[], seed: number, dayElement: string | null): Round {
  const res = runSim({
    entrants: entrants.map((e) => ({ id: e.id, name: e.name, element: e.element, stats: e.stats, traits: e.traits, moves: e.moves })),
    seed,
    dayElement: dayElement ?? undefined,
  });
  return { seed, entrants, winnerId: res.winnerId ?? null, placements: res.placements, duration: res.duration };
}

async function runNow(ctx: MutationCtx, title: string, includeTest: boolean) {
  const now = Date.now();
  const recent = await ctx.db
    .query("monsters")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", now - DAY_MS))
    .order("desc")
    .take(600);
  // Jedes fertige Ei der letzten 24 Stunden kämpft mit (wer drei Eier gelegt hat, hat drei Monster im Rennen).
  // Testspieler nur auf Wunsch. Eier, deren Monster noch nicht fertig gebaut ist, bleiben bis zur nächsten Royale Eier.
  const owners = new Map<Id<"players">, Doc<"players"> | null>();
  const entrants: Entrant[] = [];
  for (const m of recent) {
    if (m.status !== "egg" || !m.ready || !m.genome) continue;
    if (!owners.has(m.playerId)) owners.set(m.playerId, await ctx.db.get("players", m.playerId));
    const owner = owners.get(m.playerId);
    if (!owner || (owner.isTest && !includeTest)) continue;
    entrants.push({
      id: m._id,
      playerId: m.playerId,
      name: m.name,
      element: m.element,
      stats: m.stats,
      traits: m.genome?.traits ?? null,
      moves: m.genome?.moves ?? null,
      genome: m.genome,
      photoId: m.photoId ?? null,
      ownerName: owner.name ?? null,
    });
  }
  if (entrants.length < 2) throw new ConvexError({ code: "too_few", message: "A royale needs at least 2 monsters." });

  let dayElement: string | null = null;
  for await (const drop of ctx.db.query("drops").withIndex("by_endsAt", (q) => q.gt("endsAt", now))) {
    if (drop.startsAt <= now) {
      dayElement = drop.element;
      break;
    }
  }

  const seed = hashString(`${title}:${now}`);
  const rand = mulberry(seed);
  entrants.sort((a, b) => (a.id < b.id ? -1 : 1));
  for (let i = entrants.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [entrants[i], entrants[j]] = [entrants[j], entrants[i]];
  }

  const heats: Round[] = [];
  let finalists = entrants;
  if (entrants.length > SINGLE_MAX) {
    const heatCount = Math.ceil(entrants.length / HEAT_SIZE);
    const groups: Entrant[][] = Array.from({ length: heatCount }, () => []);
    entrants.forEach((e, i) => groups[i % heatCount].push(e));
    const advance = Math.max(1, Math.ceil(8 / heatCount)); // das Finale hat mindestens etwa 8 Monster
    finalists = [];
    groups.forEach((group, i) => {
      const heat = simulate(group, hashString(`${seed}:heat:${i}`), dayElement);
      heats.push(heat);
      for (const id of heat.placements.slice(0, advance)) {
        const e = group.find((x) => x.id === id);
        if (e) finalists.push(e);
      }
    });
  }
  const final = simulate(finalists, hashString(`${seed}:final`), dayElement);
  const data: RoyaleData = { title, dayElement, entrantCount: entrants.length, heats, final };
  const championId = (final.winnerId as Id<"monsters"> | null) ?? undefined;
  const royaleId = await ctx.db.insert("royales", { startsAt: now, status: "done", rounds: data, championId });
  // Jetzt schlüpfen alle: Erst ab hier zeigen die Abfragen Namen und Aussehen der Monster
  for (const e of entrants) await ctx.db.patch("monsters", e.id, { status: "hatched", hatchedAt: now });
  return { royaleId, championId: championId ?? null, entrants: entrants.length, heats: heats.length, finalists: finalists.length };
}

// Per CLI: npx convex run royale:run '{"title":"Royale 4 PM"}'
export const run = internalMutation({
  args: { title: v.string(), includeTest: v.optional(v.boolean()) },
  handler: async (ctx, a) => await runNow(ctx, a.title, a.includeTest ?? false),
});

// Admin-Knopf auf der Beamer-Seite (Schlüssel = Convex-Umgebungsvariable ADMIN_KEY)
export const start = mutation({
  args: { key: v.string(), title: v.string(), includeTest: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    if (!process.env.ADMIN_KEY || a.key !== process.env.ADMIN_KEY) {
      throw new ConvexError({ code: "forbidden", message: "Wrong admin key." });
    }
    return await runNow(ctx, a.title, a.includeTest ?? false);
  },
});

async function publicRound(ctx: QueryCtx, round: Round, index: number) {
  const entrants = [];
  for (const e of round.entrants) {
    const g = e.genome as { photoUrl?: string } | null;
    entrants.push({
      id: e.id,
      name: e.name,
      element: e.element,
      stats: e.stats,
      traits: e.traits,
      moves: e.moves,
      genome: e.genome,
      ownerName: e.ownerName,
      photoUrl: e.photoId ? await ctx.storage.getUrl(e.photoId) : (g?.photoUrl ?? null),
    });
  }
  return { index, seed: round.seed, entrants, winnerId: round.winnerId, placements: round.placements, duration: round.duration };
}

async function latestRoyale(ctx: QueryCtx) {
  const r = await ctx.db.query("royales").order("desc").first();
  return r && r.rounds?.final ? { doc: r, data: r.rounds as RoyaleData } : null;
}

// Kleine Übersicht für den Arena-Tab (ohne die Teilnehmerlisten)
export const summary = query({
  args: {},
  handler: async (ctx) => {
    const r = await latestRoyale(ctx);
    if (!r) return null;
    const champ = r.data.final.entrants.find((e) => e.id === r.data.final.winnerId) ?? null;
    const g = champ?.genome as { photoUrl?: string } | null;
    return {
      _id: r.doc._id,
      startsAt: r.doc.startsAt,
      title: r.data.title,
      dayElement: r.data.dayElement,
      entrantCount: r.data.entrantCount,
      heatCount: r.data.heats.length,
      finalistCount: r.data.final.entrants.length,
      champion: champ
        ? {
            id: champ.id,
            name: champ.name,
            element: champ.element,
            genome: champ.genome,
            ownerName: champ.ownerName,
            photoUrl: champ.photoId ? await ctx.storage.getUrl(champ.photoId) : (g?.photoUrl ?? null),
          }
        : null,
    };
  },
});

// Eine Runde zum Abspielen: index -1 = Finale, sonst die Vorrunde mit diesem Index
export const round = query({
  args: { index: v.number() },
  handler: async (ctx, { index }) => {
    const r = await latestRoyale(ctx);
    if (!r) return null;
    const rd = index < 0 ? r.data.final : r.data.heats[index];
    if (!rd) return null;
    return { royaleId: r.doc._id, title: r.data.title, dayElement: r.data.dayElement, isFinal: index < 0, ...(await publicRound(ctx, rd, index)) };
  },
});

// Wie lief es für meine Monster in der letzten Royale? Oben steht das beste Ergebnis, entries listet alle eigenen Monster.
export const mine = query({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const r = await latestRoyale(ctx);
    if (!r) return null;
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!player) return { royaleId: r.doc._id, entered: false as const };
    const entries: {
      monsterId: Id<"monsters">; monsterName: string; heatIndex: number | null; heatPlace: number | null; heatSize: number | null;
      inFinal: boolean; finalPlace: number | null; finalSize: number; champion: boolean; score: number;
    }[] = [];
    const seen = new Set<string>();
    const add = (e: Entrant) => {
      if (seen.has(e.id)) return;
      seen.add(e.id);
      const heatIndex = r.data.heats.findIndex((h) => h.entrants.some((x) => x.id === e.id));
      const heat = heatIndex >= 0 ? r.data.heats[heatIndex] : null;
      const inFinal = r.data.final.entrants.some((x) => x.id === e.id);
      const finalPlace = inFinal ? r.data.final.placements.indexOf(e.id) + 1 : null;
      const heatPlace = heat ? heat.placements.indexOf(e.id) + 1 : null;
      entries.push({
        monsterId: e.id, monsterName: e.name, heatIndex: heatIndex >= 0 ? heatIndex : null, heatPlace, heatSize: heat ? heat.entrants.length : null,
        inFinal, finalPlace, finalSize: r.data.final.entrants.length, champion: r.data.final.winnerId === e.id,
        score: inFinal ? (finalPlace ?? 99) : 100 + (heatPlace ?? 99),
      });
    };
    for (const e of r.data.final.entrants) if (e.playerId === player._id) add(e);
    for (const h of r.data.heats) for (const e of h.entrants) if (e.playerId === player._id) add(e);
    if (!entries.length) return { royaleId: r.doc._id, entered: false as const };
    entries.sort((a, b) => a.score - b.score);
    const best = entries[0];
    return { royaleId: r.doc._id, entered: true as const, ...best, entries };
  },
});
