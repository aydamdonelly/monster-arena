// Royale: Alle fertigen Eier schlüpfen und kämpfen alle-gegen-alle (monster-kit/royale-sim.js).
// Der Server rechnet nur das Ergebnis aus. Clients spielen jede Runde aus seed + entrants bitgleich nach (monster-kit/arena.js).
// Bei mehr als 24 Monstern gibt es Vorrunden (Heats) und ein Finale.
//
// Zwei Arten:
// - "live": die echte Royale (Cron, Uhrzeit aus schedule.ts). Nur Eier echter Spieler. Sind es weniger als minEntrants,
//   füllen wilde Monster (Hausspieler WILD_DEVICE) die Arena auf. Läuft höchstens einmal in 20 Stunden.
// - "test": Probe. Nur Eier von Testspielern plus wilde Monster. Rührt kein echtes Ei an, öffentliche Abfragen zeigen sie nicht.
import { v, ConvexError } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { runSim } from "../monster-kit/royale-sim.js";
import { hashString } from "../monster-kit/battle.js";
import { FIGHT_SPEED, ROYALE_UTC_MIN, fightSpeed } from "./schedule";

const DAY_MS = 24 * 60 * 60 * 1000;
const EGG_WINDOW_MS = 3 * DAY_MS; // ein Ei, das zur Royale noch nicht fertig war, schlüpft in der nächsten
const LIVE_GAP_MS = 20 * 60 * 60 * 1000;
const SINGLE_MAX = 24; // bis hierhin eine einzige Arena (mit 24 im Hochformat geprüft: lesbar, knapp eine Minute Kampf)
const HEAT_SIZE = 16;
const MIN_ENTRANTS = 8;
const LATE_WINDOW_MS = 3 * 60 * 1000; // auf Eier warten, die in den letzten 3 Minuten gelegt wurden
const KICKOFF_WAIT_MS = 5000;
const KICKOFF_TRIES = 9; // höchstens 45 Sekunden Verzögerung
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

type RunArgs = { title: string; mode: "live" | "test"; minEntrants: number; force: boolean; onlyPlayer?: Id<"players"> };

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
    // Nur fertige Eier schlüpfen. Einträge ohne Status (alter Sofort-Ablauf) gibt es nicht mehr.
    if (m.status !== "egg" || m.ready !== true) continue;
    if (!owners.has(m.playerId)) owners.set(m.playerId, await ctx.db.get("players", m.playerId));
    const owner = owners.get(m.playerId);
    if (!owner || owner.deviceId === WILD_DEVICE) continue;
    if (a.mode === "live" ? owner.isTest : !owner.isTest) continue;
    if (a.onlyPlayer && m.playerId !== a.onlyPlayer) continue;
    hatching.push(m);
  }
  // Ohne ein einziges echtes Ei gibt es keine echte Royale (sonst würde eine zweite Auslösung das Ergebnis des Tages verdrängen)
  if (a.mode === "live" && hatching.length === 0) return { skipped: "no_eggs" as const, royaleId: null };

  const seed = hashString(`${a.title}:${now}`);
  const rand = mulberry(seed);
  // Gleiche Namen (die KI benennt jedes Ei für sich) beim Schlüpfen unterscheidbar machen: das zweite heißt "… II"
  const taken = new Map<string, number>();
  const ROMAN = ["", " II", " III", " IV", " V", " VI"];
  for (const m of [...hatching].sort((x, y) => x._creationTime - y._creationTime)) {
    const key = m.name.toLowerCase();
    const n = taken.get(key) ?? 0;
    taken.set(key, n + 1);
    if (n > 0) {
      m.name = `${m.name}${ROMAN[Math.min(n, ROMAN.length - 1)]}`;
      await ctx.db.patch("monsters", m._id, { name: m.name, genome: { ...m.genome, name: m.name } });
    }
  }
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

// Start durch den Cron (Uhrzeit aus schedule.ts). Wartet bis zu 45 Sekunden auf Eier echter Spieler, die in den letzten
// Minuten gelegt wurden und deren Monster noch gebaut wird, damit niemand knapp vor 17 Uhr leer ausgeht.
// Die Clients zeigen so lange "HATCHING…". dryRun sagt nur, was passieren würde (für Prüfungen vor dem Start).
export const kickoff = internalMutation({
  args: { title: v.string(), tries: v.optional(v.number()), dryRun: v.optional(v.boolean()) },
  handler: async (ctx, a): Promise<Record<string, unknown>> => {
    const now = Date.now();
    const tries = a.tries ?? 0;
    const unready = await ctx.db
      .query("monsters")
      .withIndex("by_status_and_ready", (q) => q.eq("status", "egg").eq("ready", false))
      .take(300);
    let late = 0;
    for (const m of unready) {
      if (!m.photoId || m._creationTime < now - LATE_WINDOW_MS) continue;
      const owner = await ctx.db.get("players", m.playerId);
      if (owner && !owner.isTest) late++;
    }
    if (late > 0 && tries < KICKOFF_TRIES) {
      if (!a.dryRun) await ctx.scheduler.runAfter(KICKOFF_WAIT_MS, internal.royale.kickoff, { title: a.title, tries: tries + 1 });
      return { waitingFor: late, tries, started: false };
    }
    if (a.dryRun) return { waitingFor: late, tries, wouldStart: true };
    return await runNow(ctx, { title: a.title, mode: "live", minEntrants: MIN_ENTRANTS, force: false });
  },
});

// CLI. Probe: npx convex run royale:run '{"title":"Probe","test":true}'
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

// ---------- Vorführmodus (für Jury und Bühne) ----------
// Ein Vorführgerät ist ein Testgerät: Seine Eier schlüpfen auf Knopfdruck sofort und kämpfen gegen wilde Monster.
// Das läuft als Probe-Royale, rührt kein echtes Ei an und ist öffentlich nicht sichtbar. Schlüssel = DEMO_KEY (oder ADMIN_KEY).
function checkDemoKey(key: string) {
  const ok = (process.env.DEMO_KEY && key === process.env.DEMO_KEY) || (process.env.ADMIN_KEY && key === process.env.ADMIN_KEY);
  if (!ok) throw new ConvexError({ code: "forbidden", message: "Wrong demo key." });
}

// Gerät zum Vorführgerät machen. Wird verweigert, solange auf dem Gerät ein echtes Ei auf die Royale wartet.
export const demoEnter = mutation({
  args: { key: v.string(), deviceId: v.string() },
  returns: v.null(),
  handler: async (ctx, a) => {
    checkDemoKey(a.key);
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", a.deviceId))
      .unique();
    if (!player) throw new ConvexError({ code: "no_player", message: "Open the app first." });
    if (player.isTest) return null;
    const mine = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(20);
    if (mine.some((m) => m.status === "egg")) {
      throw new ConvexError({ code: "real_egg", message: "This device has a real egg waiting for the royale. Use a private tab for demo mode." });
    }
    await ctx.db.patch("players", player._id, { isTest: true });
    return null;
  },
});

// Das neueste Ei dieses Vorführgeräts sofort schlüpfen lassen. Ist das Monster noch im Bau, kommt started: false zurück
// und das Gerät fragt nach zwei Sekunden einfach erneut.
export const demo = mutation({
  args: { key: v.string(), deviceId: v.string() },
  handler: async (ctx, a) => {
    checkDemoKey(a.key);
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", a.deviceId))
      .unique();
    if (!player) throw new ConvexError({ code: "no_player", message: "Open the app first." });
    if (!player.isTest) throw new ConvexError({ code: "not_demo", message: "This is not a demo device. Open the demo link in a private tab." });
    const mine = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(10);
    const egg = mine.find((m) => m.status === "egg");
    if (!egg) throw new ConvexError({ code: "no_egg", message: "Snap something first." });
    if (!egg.ready || !egg.genome) return { started: false, reason: "building" };
    const res = await runNow(ctx, { title: "Royale", mode: "test", minEntrants: MIN_ENTRANTS, force: true, onlyPlayer: player._id });
    return { started: res.skipped === null, reason: res.skipped ?? "ok" };
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
// Ohne royaleId die letzte Royale, mit royaleId eine frühere (Verlauf im Profil).
export const round = query({
  args: { index: v.number(), test: v.optional(v.boolean()), royaleId: v.optional(v.string()) },
  handler: async (ctx, { index, test, royaleId }) => {
    const r = await pickRoyale(ctx, royaleId, test ?? false);
    if (!r) return null;
    const rd = index < 0 ? r.data.final : r.data.heats[index];
    if (!rd) return null;
    return {
      royaleId: r.doc._id, startsAt: r.doc.startsAt, title: r.data.title, dayElement: r.data.dayElement, isFinal: index < 0,
      speed: fightSpeed(rd.duration), // Abspieltempo für die Apps: jeder Kampf dauert etwa gleich lang
      ...(await publicRound(ctx, rd, index)),
    };
  },
});

// Zeitplan für die Apps: Startzeit der täglichen Royale (Minuten nach Mitternacht UTC) und Abspieltempo der Kämpfe.
// Die Apps rechnen daraus Countdown und Uhrzeit-Anzeige; eine Änderung in schedule.ts kommt so ohne neues App-Build an.
export const clock = query({
  args: {},
  returns: v.object({ utcMin: v.number(), speed: v.number() }),
  handler: async () => ({ utcMin: ROYALE_UTC_MIN, speed: FIGHT_SPEED }),
});

type Entry = {
  monsterId: Id<"monsters">; monsterName: string; heatIndex: number | null; heatPlace: number | null; heatSize: number | null;
  inFinal: boolean; finalPlace: number | null; finalSize: number; champion: boolean; score: number;
};

// Ergebnisse der eigenen Monster (names: id -> Name) in einer Royale, das beste zuerst
function entriesOf(data: RoyaleData, names: Map<string, string>): Entry[] {
  const finalIds = roundIds(data.final);
  const entries: Entry[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    if (seen.has(id) || !names.has(id)) return;
    seen.add(id);
    const heatIndex = data.heats.findIndex((h) => roundIds(h).includes(id));
    const heat = heatIndex >= 0 ? data.heats[heatIndex] : null;
    const inFinal = finalIds.includes(id);
    const finalPlace = inFinal ? data.final.placements.indexOf(id) + 1 : null;
    const heatPlace = heat ? heat.placements.indexOf(id) + 1 : null;
    entries.push({
      monsterId: id as Id<"monsters">, monsterName: names.get(id) ?? "Monster", heatIndex: heatIndex >= 0 ? heatIndex : null, heatPlace,
      heatSize: heat ? roundIds(heat).length : null, inFinal, finalPlace, finalSize: finalIds.length, champion: data.final.winnerId === id,
      score: inFinal ? (finalPlace ?? 99) : 100 + (heatPlace ?? 99),
    });
  };
  for (const id of finalIds) add(id);
  for (const h of data.heats) for (const id of roundIds(h)) add(id);
  return entries.sort((x, y) => x.score - y.score);
}

// Ergebnis in Worten. Wer im Finale stand, hat seinen Platz unter allen Teilnehmern; sonst zählt der Platz in der Vorrunde.
function resultLabel(e: Entry, total: number) {
  if (e.champion) return "Champion";
  if (e.inFinal && e.finalPlace) return `#${e.finalPlace} of ${Math.max(total, e.finalSize)}`;
  if (e.heatPlace && e.heatSize && e.heatIndex != null) return `Heat ${e.heatIndex + 1} · #${e.heatPlace} of ${e.heatSize}`;
  return "Entered";
}

async function pickRoyale(ctx: QueryCtx, royaleId: string | undefined, includeTest: boolean) {
  if (!royaleId) return await latestRoyale(ctx, includeTest);
  const id = ctx.db.normalizeId("royales", royaleId);
  const doc = id ? await ctx.db.get("royales", id) : null;
  const data = doc?.rounds as RoyaleData | undefined;
  return doc && data?.final ? { doc, data } : null;
}

// Wie lief es für meine Monster in der letzten Royale (oder mit royaleId in einer früheren)?
// Oben steht das beste Ergebnis, entries listet alle eigenen Monster.
export const mine = query({
  args: { deviceId: v.string(), test: v.optional(v.boolean()), royaleId: v.optional(v.string()) },
  handler: async (ctx, { deviceId, test, royaleId }) => {
    const r = await pickRoyale(ctx, royaleId, test ?? false);
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
    const entries = entriesOf(r.data, names);
    if (!entries.length) return { royaleId: r.doc._id, entered: false as const };
    const best = entries[0];
    return { royaleId: r.doc._id, entered: true as const, ...best, total: r.data.entrantCount, result: resultLabel(best, r.data.entrantCount), entries };
  },
});

// Profil: Name, Zahlen und der Verlauf der eigenen Royales (neueste zuerst, höchstens 20), jeweils mit dem besten eigenen Monster.
// Für die Wiederholung: /arena/replay mit royale = royaleId und round = der hier gelieferte Wert (-1 = Finale, sonst Vorrunde).
export const profile = query({
  args: { deviceId: v.string(), test: v.optional(v.boolean()) },
  handler: async (ctx, { deviceId, test }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!player) return null;
    const mineAll = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(200);
    const hatched = mineAll.filter((m) => (m.status ?? "hatched") === "hatched" && !!m.genome);
    const byId = new Map<string, Doc<"monsters">>(hatched.map((m) => [m._id as string, m]));
    const names = new Map<string, string>(hatched.map((m) => [m._id as string, m.name]));
    const history: {
      royaleId: Id<"royales">; startsAt: number; title: string; entrants: number; monsterId: Id<"monsters">; monsterName: string;
      element: string | null; golden: boolean; result: string; champion: boolean; championName: string | null; round: number;
    }[] = [];
    let bestScore = Infinity;
    let best: string | null = null;
    if (hatched.length) {
      const rows = await ctx.db.query("royales").order("desc").take(30);
      for (const r of rows) {
        const data = r.rounds as RoyaleData | undefined;
        if (!data?.final || (data.test && !test)) continue;
        const entries = entriesOf(data, names);
        if (!entries.length) continue;
        const e = entries[0];
        const m = byId.get(e.monsterId);
        const champId = data.final.winnerId ? ctx.db.normalizeId("monsters", data.final.winnerId) : null;
        const champ = champId ? (byId.get(champId) ?? (await ctx.db.get("monsters", champId))) : null;
        const result = resultLabel(e, data.entrantCount);
        if (e.score < bestScore) { bestScore = e.score; best = result; }
        history.push({
          royaleId: r._id, startsAt: r.startsAt, title: data.title, entrants: data.entrantCount, monsterId: e.monsterId, monsterName: e.monsterName,
          element: m?.element ?? null, golden: !!(m?.golden ?? m?.genome?.golden), result, champion: e.champion, championName: champ?.name ?? null,
          round: e.inFinal || e.heatIndex == null ? -1 : e.heatIndex,
        });
        if (history.length >= 20) break;
      }
    }
    return {
      name: player.name ?? null,
      since: player._creationTime,
      stats: {
        monsters: hatched.length,
        eggs: mineAll.filter((m) => m.status === "egg").length,
        royales: history.length,
        wins: history.filter((h) => h.champion).length,
        best,
      },
      history,
    };
  },
});
