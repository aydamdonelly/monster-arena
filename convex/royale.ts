// Royale: Alle fertigen Eier schlüpfen und kämpfen alle-gegen-alle (monster-kit/royale-sim.js).
// Der Server rechnet nur das Ergebnis aus. Clients spielen jede Runde aus seed + entrants bitgleich nach (monster-kit/arena.js).
// Bei mehr als 20 Monstern gibt es Vorrunden (Heats) und ein Finale.
//
// Zwei Arten:
// - "live": die echte Royale (Cron um 17:00 Uhr Pacific). Nur Eier echter Spieler. Sind es weniger als minEntrants,
//   füllen wilde Monster (Hausspieler WILD_DEVICE) die Arena auf. Läuft höchstens einmal in 20 Stunden.
// - "test": Probe. Nur Eier von Testspielern plus wilde Monster. Rührt kein echtes Ei an, öffentliche Abfragen zeigen sie nicht.
import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { runSim } from "../monster-kit/royale-sim.js";
import { hashString } from "../monster-kit/battle.js";

const DAY_MS = 24 * 60 * 60 * 1000;
const EGG_WINDOW_MS = 3 * DAY_MS; // ein Ei, das um 17 Uhr noch nicht fertig war, schlüpft in der nächsten Royale
const LIVE_GAP_MS = 20 * 60 * 60 * 1000;
const SINGLE_MAX = 20; // bis hierhin eine einzige Arena
const HEAT_SIZE = 16;
const MIN_ENTRANTS = 8;
export const WILD_DEVICE = "house-wild";

type Stats = { hp: number; atk: number; def: number; spd: number };
type Fighter = { id: Id<"monsters">; name: string; element: string; stats: Stats; traits: unknown; moves: unknown };
// Gespeichert werden nur die IDs in Kampfreihenfolge. Aussehen und Werte stehen am Monster und ändern sich nach dem Schlüpfen nicht mehr.
// Ältere Einträge (Format 1) tragen stattdessen die vollständigen Teilnehmer in `entrants`.
type OldEntrant = Fighter & { playerId: Id<"players">; genome: unknown; photoId: Id<"_storage"> | null; ownerName: string | null };
type Round = { seed: number; ids?: Id<"monsters">[]; entrants?: OldEntrant[]; winnerId: string | null; placements: string[]; duration: number };
type RoyaleData = {
  title: string;
  dayElement: string | null;
  entrantCount: number;
  wildCount?: number;
  test?: boolean;
  heats: Round[];
  final: Round;
};

function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(list: T[], rand: () => number) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function fighterOf(m: Doc<"monsters">): Fighter {
  return { id: m._id, name: m.name, element: m.element, stats: m.stats, traits: m.genome?.traits ?? null, moves: m.genome?.moves ?? null };
}

function simulate(fighters: Fighter[], seed: number, dayElement: string | null): Round {
  const res = runSim({ entrants: fighters, seed, dayElement: dayElement ?? undefined });
  return { seed, ids: fighters.map((f) => f.id), winnerId: res.winnerId ?? null, placements: res.placements, duration: res.duration };
}

function roundIds(round: Round): string[] {
  return round.ids ?? (round.entrants ?? []).map((e) => e.id);
}

async function wildPool(ctx: QueryCtx): Promise<Doc<"monsters">[]> {
  const house = await ctx.db
    .query("players")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", WILD_DEVICE))
    .unique();
  if (!house) return [];
  const pool = await ctx.db
    .query("monsters")
    .withIndex("by_playerId", (q) => q.eq("playerId", house._id))
    .take(80);
  return pool.filter((m) => !!m.genome);
}

type RunArgs = { title: string; mode: "live" | "test"; minEntrants: number; force: boolean };

async function runNow(ctx: MutationCtx, a: RunArgs) {
  const now = Date.now();
  if (a.mode === "live" && !a.force) {
    const last = await latestRoyale(ctx, false);
    if (last && now - last.doc.startsAt < LIVE_GAP_MS) return { skipped: "already_ran" as const, royaleId: last.doc._id };
  }

  const recent = await ctx.db
    .query("monsters")
    .withIndex("by_creation_time", (q) => q.gte("_creationTime", now - EGG_WINDOW_MS))
    .order("desc")
    .take(1500);
  const owners = new Map<Id<"players">, Doc<"players"> | null>();
  const hatching: Doc<"monsters">[] = [];
  for (const m of recent) {
    if (!m.genome) continue;
    const isEgg = m.status === "egg" && m.ready === true;
    // Monster aus dem alten Sofort-Ablauf (ohne status) von heute kämpfen einmal mit
    const isLegacy = a.mode === "live" && m.status === undefined && m._creationTime > now - DAY_MS;
    if (!isEgg && !isLegacy) continue;
    if (!owners.has(m.playerId)) owners.set(m.playerId, await ctx.db.get("players", m.playerId));
    const owner = owners.get(m.playerId);
    if (!owner || owner.deviceId === WILD_DEVICE) continue;
    if (a.mode === "live" ? owner.isTest : !owner.isTest) continue;
    hatching.push(m);
  }
  // Ohne ein einziges echtes Ei gibt es keine echte Royale (sonst würde eine zweite Auslösung das Ergebnis des Tages verdrängen)
  if (a.mode === "live" && hatching.length === 0) return { skipped: "no_eggs" as const, royaleId: null };

  const seed = hashString(`${a.title}:${now}`);
  const rand = mulberry(seed);
  const fighters: Fighter[] = hatching.map(fighterOf);
  let wildCount = 0;
  if (fighters.length < a.minEntrants) {
    const pool = shuffle(await wildPool(ctx), rand).slice(0, a.minEntrants - fighters.length);
    wildCount = pool.length;
    for (const m of pool) fighters.push(fighterOf(m));
  }
  if (fighters.length < 2) return { skipped: "too_few" as const, royaleId: null };

  let dayElement: string | null = null;
  for await (const drop of ctx.db.query("drops").withIndex("by_endsAt", (q) => q.gt("endsAt", now))) {
    if (drop.startsAt <= now) {
      dayElement = drop.element;
      break;
    }
  }

  fighters.sort((x, y) => (x.id < y.id ? -1 : 1));
  shuffle(fighters, rand);

  const heats: Round[] = [];
  let finalists = fighters;
  if (fighters.length > SINGLE_MAX) {
    const heatCount = Math.ceil(fighters.length / HEAT_SIZE);
    const groups: Fighter[][] = Array.from({ length: heatCount }, () => []);
    fighters.forEach((f, i) => groups[i % heatCount].push(f));
    const advance = Math.max(1, Math.ceil(8 / heatCount)); // das Finale hat mindestens etwa 8 Monster
    finalists = [];
    groups.forEach((group, i) => {
      const heat = simulate(group, hashString(`${seed}:heat:${i}`), dayElement);
      heats.push(heat);
      for (const id of heat.placements.slice(0, advance)) {
        const f = group.find((x) => x.id === id);
        if (f) finalists.push(f);
      }
    });
  }
  const final = simulate(finalists, hashString(`${seed}:final`), dayElement);
  const data: RoyaleData = { title: a.title, dayElement, entrantCount: fighters.length, wildCount, test: a.mode === "test", heats, final };
  const championId = (final.winnerId as Id<"monsters"> | null) ?? undefined;
  const royaleId = await ctx.db.insert("royales", { startsAt: now, status: "done", rounds: data, championId });
  // Jetzt schlüpfen alle: Erst ab hier zeigen die Abfragen Namen und Aussehen der Monster
  for (const m of hatching) await ctx.db.patch("monsters", m._id, { status: "hatched", hatchedAt: now });
  if (a.mode === "live") {
    // Zähler "Eier warten" neu setzen: Übrig sind nur Eier echter Spieler, deren Monster noch nicht fertig war
    const left = await ctx.db
      .query("monsters")
      .withIndex("by_status_and_ready", (q) => q.eq("status", "egg").eq("ready", false))
      .take(600);
    let waiting = 0;
    for (const m of left) {
      if (!owners.has(m.playerId)) owners.set(m.playerId, await ctx.db.get("players", m.playerId));
      if (owners.get(m.playerId)?.isTest === false) waiting++;
    }
    const row = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "eggsWaiting"))
      .unique();
    if (row) await ctx.db.patch("counters", row._id, { n: waiting });
    else await ctx.db.insert("counters", { name: "eggsWaiting", n: waiting });
  }
  return {
    skipped: null,
    royaleId,
    championId: championId ?? null,
    entrants: fighters.length,
    hatched: hatching.length,
    wild: wildCount,
    heats: heats.length,
    finalists: finalists.length,
  };
}

// Cron (17:00 Uhr Pacific) und CLI. Probe: npx convex run royale:run '{"title":"Probe","test":true}'
export const run = internalMutation({
  args: { title: v.string(), test: v.optional(v.boolean()), minEntrants: v.optional(v.number()), force: v.optional(v.boolean()) },
  handler: async (ctx, a) =>
    await runNow(ctx, { title: a.title, mode: a.test ? "test" : "live", minEntrants: a.minEntrants ?? MIN_ENTRANTS, force: a.force ?? false }),
});

// Admin-Knopf auf der Beamer-Seite (Schlüssel = Convex-Umgebungsvariable ADMIN_KEY). includeTest = Probe.
export const start = mutation({
  args: { key: v.string(), title: v.string(), includeTest: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    if (!process.env.ADMIN_KEY || a.key !== process.env.ADMIN_KEY) {
      throw new ConvexError({ code: "forbidden", message: "Wrong admin key." });
    }
    const res = await runNow(ctx, { title: a.title, mode: a.includeTest ? "test" : "live", minEntrants: MIN_ENTRANTS, force: false });
    if (res.skipped === "no_eggs" || res.skipped === "too_few") {
      throw new ConvexError({ code: "too_few", message: "No eggs are ready yet." });
    }
    return res;
  },
});

// Alte Proben als Test markieren, damit sie öffentlich nicht als Royale erscheinen: npx convex run royale:markTest '{}'
export const markTest = internalMutation({
  args: { royaleId: v.optional(v.id("royales")) },
  returns: v.number(),
  handler: async (ctx, { royaleId }) => {
    const rows = royaleId ? [await ctx.db.get("royales", royaleId)] : await ctx.db.query("royales").order("desc").take(100);
    let n = 0;
    for (const r of rows) {
      if (!r || !r.rounds || r.rounds.test) continue;
      await ctx.db.patch("royales", r._id, { rounds: { ...r.rounds, test: true } });
      n++;
    }
    return n;
  },
});

async function latestRoyale(ctx: QueryCtx, includeTest: boolean) {
  const rows = await ctx.db.query("royales").order("desc").take(40);
  for (const r of rows) {
    const data = r.rounds as RoyaleData | undefined;
    if (!data?.final) continue;
    if (data.test && !includeTest) continue;
    return { doc: r, data };
  }
  return null;
}

type PublicEntrant = Fighter & { genome: unknown; ownerName: string | null; photoUrl: string | null; wild: boolean };

async function publicEntrant(ctx: QueryCtx, m: Doc<"monsters">, owners: Map<Id<"players">, Doc<"players"> | null>): Promise<PublicEntrant> {
  if (!owners.has(m.playerId)) owners.set(m.playerId, await ctx.db.get("players", m.playerId));
  const owner = owners.get(m.playerId);
  const wild = owner?.deviceId === WILD_DEVICE;
  return {
    ...fighterOf(m),
    genome: m.genome,
    ownerName: wild ? "Wild" : (owner?.name ?? null),
    photoUrl: (m.thumbId ?? m.photoId)
      ? await ctx.storage.getUrl((m.thumbId ?? m.photoId)!)
      : wild
        ? null
        : ((m.genome?.photoUrl as string | undefined) ?? null),
    wild,
  };
}

async function publicRound(ctx: QueryCtx, round: Round, index: number) {
  const entrants: PublicEntrant[] = [];
  if (round.ids) {
    const owners = new Map<Id<"players">, Doc<"players"> | null>();
    for (const id of round.ids) {
      const m = await ctx.db.get("monsters", id);
      if (m) entrants.push(await publicEntrant(ctx, m, owners));
    }
  } else {
    for (const e of round.entrants ?? []) {
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
        wild: false,
      });
    }
  }
  return { index, seed: round.seed, entrants, winnerId: round.winnerId, placements: round.placements, duration: round.duration };
}

// Kleine Übersicht für den Arena-Tab (ohne die Teilnehmerlisten). test: true zeigt auch Proben.
export const summary = query({
  args: { test: v.optional(v.boolean()) },
  handler: async (ctx, a) => {
    const r = await latestRoyale(ctx, a.test ?? false);
    if (!r) return null;
    const winnerId = r.data.final.winnerId as Id<"monsters"> | null;
    const old = (r.data.final.entrants ?? []).find((e) => e.id === winnerId) ?? null;
    const doc = winnerId && !old ? await ctx.db.get("monsters", winnerId) : null;
    let champion = null;
    if (doc) {
      const c = await publicEntrant(ctx, doc, new Map());
      champion = { id: c.id, name: c.name, element: c.element, genome: c.genome, ownerName: c.ownerName, photoUrl: c.photoUrl, wild: c.wild };
    } else if (old) {
      const g = old.genome as { photoUrl?: string } | null;
      champion = {
        id: old.id,
        name: old.name,
        element: old.element,
        genome: old.genome,
        ownerName: old.ownerName,
        photoUrl: old.photoId ? await ctx.storage.getUrl(old.photoId) : (g?.photoUrl ?? null),
        wild: false,
      };
    }
    return {
      _id: r.doc._id,
      startsAt: r.doc.startsAt,
      title: r.data.title,
      dayElement: r.data.dayElement,
      entrantCount: r.data.entrantCount,
      wildCount: r.data.wildCount ?? 0,
      test: r.data.test ?? false,
      heatCount: r.data.heats.length,
      finalistCount: roundIds(r.data.final).length,
      champion,
    };
  },
});

// Eine Runde zum Abspielen: index -1 = Finale, sonst die Vorrunde mit diesem Index
export const round = query({
  args: { index: v.number(), test: v.optional(v.boolean()) },
  handler: async (ctx, { index, test }) => {
    const r = await latestRoyale(ctx, test ?? false);
    if (!r) return null;
    const rd = index < 0 ? r.data.final : r.data.heats[index];
    if (!rd) return null;
    return { royaleId: r.doc._id, startsAt: r.doc.startsAt, title: r.data.title, dayElement: r.data.dayElement, isFinal: index < 0, ...(await publicRound(ctx, rd, index)) };
  },
});

// Wie lief es für meine Monster in der letzten Royale? Oben steht das beste Ergebnis, entries listet alle eigenen Monster.
export const mine = query({
  args: { deviceId: v.string(), test: v.optional(v.boolean()) },
  handler: async (ctx, { deviceId, test }) => {
    const r = await latestRoyale(ctx, test ?? false);
    if (!r) return null;
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!player) return { royaleId: r.doc._id, entered: false as const };
    const myMonsters = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(200);
    const names = new Map<string, string>(myMonsters.map((m) => [m._id as string, m.name]));
    const finalIds = roundIds(r.data.final);
    const entries: {
      monsterId: Id<"monsters">; monsterName: string; heatIndex: number | null; heatPlace: number | null; heatSize: number | null;
      inFinal: boolean; finalPlace: number | null; finalSize: number; champion: boolean; score: number;
    }[] = [];
    const seen = new Set<string>();
    const add = (id: string) => {
      if (seen.has(id) || !names.has(id)) return;
      seen.add(id);
      const heatIndex = r.data.heats.findIndex((h) => roundIds(h).includes(id));
      const heat = heatIndex >= 0 ? r.data.heats[heatIndex] : null;
      const inFinal = finalIds.includes(id);
      const finalPlace = inFinal ? r.data.final.placements.indexOf(id) + 1 : null;
      const heatPlace = heat ? heat.placements.indexOf(id) + 1 : null;
      entries.push({
        monsterId: id as Id<"monsters">, monsterName: names.get(id) ?? "Monster", heatIndex: heatIndex >= 0 ? heatIndex : null, heatPlace,
        heatSize: heat ? roundIds(heat).length : null, inFinal, finalPlace, finalSize: finalIds.length, champion: r.data.final.winnerId === id,
        score: inFinal ? (finalPlace ?? 99) : 100 + (heatPlace ?? 99),
      });
    };
    for (const id of finalIds) add(id);
    for (const h of r.data.heats) for (const id of roundIds(h)) add(id);
    if (!entries.length) return { royaleId: r.doc._id, entered: false as const };
    entries.sort((x, y) => x.score - y.score);
    const best = entries[0];
    return { royaleId: r.doc._id, entered: true as const, ...best, entries };
  },
});
