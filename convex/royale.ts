// Royale: Alle fertigen Eier schlüpfen und kämpfen alle-gegen-alle (monster-kit/royale-sim.js).
// Der Server rechnet nur das Ergebnis aus. Clients spielen jede Runde aus seed + entrants bitgleich nach (monster-kit/arena.js).
// Bei mehr als 24 Monstern gibt es Vorrunden (Heats) und ein Finale.
//
// Zwei Arten:
// - "live": die echte Royale (Cron, Uhrzeit aus schedule.ts). Nur Eier echter Spieler. Sind es weniger als minEntrants,
//   füllen wilde Monster (Hausspieler WILD_DEVICE) die Arena auf. Läuft höchstens einmal in 20 Stunden.
// - "test": Probe. Nur Eier von Testspielern plus wilde Monster. Rührt kein echtes Ei an, öffentliche Abfragen zeigen sie nicht.
import { v, ConvexError } from "convex/values";
import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { runSim } from "../monster-kit/royale-sim.js";
import { hashString, statsFromTraits } from "../monster-kit/battle.js";
import { FIGHT_SPEED, HATCH_PACE, ROYALE_UTC_MIN, THEME_TODAY, THEME_TOMORROW, fightSpeed, isOwnerDevice } from "./schedule";

const DAY_MS = 24 * 60 * 60 * 1000;
const EGG_WINDOW_MS = 3 * DAY_MS; // ein Ei, das zur Royale noch nicht fertig war, schlüpft in der nächsten
const LIVE_GAP_MS = 20 * 60 * 60 * 1000;
const SINGLE_MAX = 24; // bis hierhin eine einzige Arena (mit 24 im Hochformat geprüft: lesbar, knapp eine Minute Kampf)
const HEAT_SIZE = 16;
const MIN_ENTRANTS = 8;
const DEMO_ARENA = 14; // Vorführmodus nach der echten Royale: das eigene Ei plus 13 Monster dieser Royale
// Vorab-Kampf des Admins: alle fertigen echten Eier in einer einzigen Arena (Convex-Umgebungsvariable ADMIN_ARENA senkt die Zahl)
function adminArena() {
  const n = Number(process.env.ADMIN_ARENA ?? 60);
  return Number.isFinite(n) ? Math.min(60, Math.max(8, Math.round(n))) : 60;
}
const LATE_WINDOW_MS = 3 * 60 * 1000; // auf Eier warten, die in den letzten 3 Minuten gelegt wurden
const KICKOFF_WAIT_MS = 5000;
const KICKOFF_TRIES = 9; // höchstens 45 Sekunden Verzögerung
export const WILD_DEVICE = "house-wild";

type Stats = { hp: number; atk: number; def: number; spd: number };
export type Fighter = { id: Id<"monsters">; name: string; element: string; stats: Stats; traits: unknown; moves: unknown };
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
  preview?: boolean; // Vorab-Kampf des Admins (nur für sein Gerät): steht in seinem Profil, sonst nirgends
  sample?: boolean; // Beispiel-Royale eines Vorführkontos (dev.seedSample): nur über ihre ID und im Profil des Besitzers sichtbar
  heats: Round[];
  final: Round;
};

export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle<T>(list: T[], rand: () => number) {
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

// includeOwner: Das Ei von onlyPlayer schlüpft auch dann, wenn der Spieler kein Testspieler ist (Zusatzkampf des Admins)
// onlyEgg: von onlyPlayer schlüpft nur dieses eine Ei. preview: Vorab-Kampf des Admins, Gegner sind die fertigen echten Eier (nur gelesen).
type RunArgs = {
  title: string; mode: "live" | "test"; minEntrants: number; force: boolean;
  onlyPlayer?: Id<"players">; includeOwner?: boolean; onlyEgg?: Id<"monsters">; preview?: boolean;
};

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
  const waitingReal: Doc<"monsters">[] = [];
  for (const m of recent) {
    if (!m.genome) continue;
    // Nur fertige Eier schlüpfen. Einträge ohne Status (alter Sofort-Ablauf) gibt es nicht mehr.
    if (m.status !== "egg" || m.ready !== true) continue;
    if (!owners.has(m.playerId)) owners.set(m.playerId, await ctx.db.get("players", m.playerId));
    const owner = owners.get(m.playerId);
    if (!owner || owner.deviceId === WILD_DEVICE) continue;
    const ownEgg = !!a.includeOwner && m.playerId === a.onlyPlayer;
    if (!ownEgg && (a.mode === "live" ? owner.isTest : !owner.isTest)) {
      if (a.mode === "test" && !owner.isTest) waitingReal.push(m); // fertige Eier echter Spieler: mögliche Gegner im Vorab-Kampf
      continue;
    }
    if (a.onlyPlayer && m.playerId !== a.onlyPlayer) continue;
    if (a.onlyEgg && m._id !== a.onlyEgg) continue;
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
  if (a.onlyPlayer) {
    // Vorführmodus: Das Ei des Vorführgeräts kämpft gegen die Monster der letzten echten Royale (zusammen 14, eine Arena).
    // Die echten Monster werden nur gelesen. Gibt es noch keine echte Royale, füllen unten wie bisher wilde Monster auf.
    const live = await latestRoyale(ctx, false);
    if (live) {
      const ids = [...new Set([...roundIds(live.data.final), ...live.data.heats.flatMap(roundIds)])].sort();
      const real: Doc<"monsters">[] = [];
      const rest: Doc<"monsters">[] = [];
      for (const raw of ids) {
        const id = ctx.db.normalizeId("monsters", raw);
        const m = id ? await ctx.db.get("monsters", id) : null;
        if (!m?.genome || m.sample || hatching.some((h) => h._id === m._id)) continue;
        if (!owners.has(m.playerId)) owners.set(m.playerId, await ctx.db.get("players", m.playerId));
        const owner = owners.get(m.playerId);
        (owner && !owner.isTest && owner.deviceId !== WILD_DEVICE ? real : rest).push(m);
      }
      const room = Math.max(0, DEMO_ARENA - fighters.length);
      // Echte Monster zuerst; wilde und Test-Monster der Royale nur, wenn es sonst nicht reicht.
      // DEMO_FEATURED (Convex-Umgebungsvariable, Monster-IDs kommagetrennt): diese Monster sind in jedem Vorführ-Kampf dabei.
      const featured = new Set((process.env.DEMO_FEATURED ?? "").split(",").map((x: string) => x.trim()).filter(Boolean));
      const order = [...shuffle(real, rand), ...shuffle(rest, rand)];
      const picked = [...order.filter((m) => featured.has(m._id)), ...order.filter((m) => !featured.has(m._id))].slice(0, room);
      for (const m of picked) {
        if (owners.get(m.playerId)?.deviceId === WILD_DEVICE) wildCount++;
        fighters.push(fighterOf(m));
      }
    } else if (a.preview) {
      // Vor der echten Royale: Gegner sind die fertigen Eier echter Spieler, Stand jetzt. Sie werden nur gelesen,
      // bleiben Eier und schlüpfen wie geplant in der echten Royale.
      const featured = new Set((process.env.DEMO_FEATURED ?? "").split(",").map((x: string) => x.trim()).filter(Boolean));
      const order = shuffle([...waitingReal].sort((x, y) => (x._id < y._id ? -1 : 1)), rand);
      const room = Math.max(0, adminArena() - fighters.length);
      const picked = [...order.filter((m) => featured.has(m._id)), ...order.filter((m) => !featured.has(m._id))].slice(0, room);
      for (const m of picked) fighters.push(fighterOf(m));
    }
  }
  if (fighters.length < a.minEntrants) {
    const have = new Set<string>(fighters.map((f) => f.id));
    const pool = shuffle((await wildPool(ctx)).filter((m) => !have.has(m._id)), rand).slice(0, a.minEntrants - fighters.length);
    wildCount += pool.length;
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
  if (fighters.length > SINGLE_MAX && !a.preview) { // der Vorab-Kampf des Admins bleibt eine einzige Arena
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
  const data: RoyaleData = { title: a.title, dayElement, entrantCount: fighters.length, wildCount, test: a.mode === "test", ...(a.preview ? { preview: true } : {}), heats, final };
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
      if (!r || !r.rounds || r.rounds.test || r.rounds.sample) continue;
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
    if (!data?.final || data.sample) continue; // Beispiel-Royales eines Vorführkontos sind nie "die letzte Royale"
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
      hatchPace: HATCH_PACE, // Schlüpfen vor dem Kampf: Zeit je Ei
      ...(await publicRound(ctx, rd, index)),
    };
  },
});

// Zeitplan für die Apps: Startzeit der täglichen Royale (Minuten nach Mitternacht UTC) und Abspieltempo der Kämpfe.
// Die Apps rechnen daraus Countdown und Uhrzeit-Anzeige; eine Änderung in schedule.ts kommt so ohne neues App-Build an.
export const clock = query({
  args: {},
  returns: v.object({ utcMin: v.number(), speed: v.number(), theme: v.string(), nextTheme: v.string(), hatchPace: v.number() }),
  handler: async () => ({ utcMin: ROYALE_UTC_MIN, speed: FIGHT_SPEED, theme: THEME_TODAY, nextTheme: THEME_TOMORROW, hatchPace: HATCH_PACE }),
});

// Der Gründer startet einen Kampf von Hand (Knopf "Admin: start fight", nur auf seinen Geräten, siehe schedule.isOwnerDevice).
// Das ist nie die echte Royale: Sein neuestes Ei schlüpft und kämpft in einem eigenen Kampf, den nur sein Gerät sieht.
// Vor der echten Royale sind die Gegner die fertigen Eier echter Spieler (nur gelesen, sie schlüpfen weiter wie geplant),
// danach Monster der echten Royale. Die echte Royale läuft unverändert nach Zeitplan.
export const adminStart = mutation({
  args: { deviceId: v.string() },
  returns: v.object({ royaleId: v.id("royales"), live: v.boolean(), round: v.number(), entrants: v.number() }),
  handler: async (ctx, { deviceId }) => {
    if (!isOwnerDevice(deviceId)) throw new ConvexError({ code: "forbidden", message: "Admins only." });
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!player) throw new ConvexError({ code: "no_player", message: "Open the app once first." });
    const mine = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(200);
    const now = Date.now();
    // Das eigene, eben gelegte Ei soll mitkämpfen: erst starten, wenn sein Monster fertig gebaut ist
    if (mine.some((m) => m.status === "egg" && m.ready !== true && m._creationTime > now - 5 * 60 * 1000)) {
      throw new ConvexError({ code: "building", message: "Your egg is still being built. Try again in a few seconds." });
    }
    const egg = mine.find((m) => m.status === "egg" && m.ready === true && !!m.genome && !m.sample); // das neueste fertige eigene Ei
    if (!egg) throw new ConvexError({ code: "no_egg", message: "Snap something first, then start the fight." });
    const res = await runNow(ctx, {
      title: "Royale", mode: "test", minEntrants: MIN_ENTRANTS, force: true,
      onlyPlayer: player._id, includeOwner: true, onlyEgg: egg._id, preview: true,
    });
    if (res.skipped !== null || !res.royaleId) {
      throw new ConvexError({ code: res.skipped ?? "failed", message: "The fight could not start. Try again." });
    }
    await ctx.db.patch("players", player._id, { previewAt: now }); // sein Gerät zeigt die heutige Royale ab jetzt als gelaufen
    const doc = await ctx.db.get("royales", res.royaleId);
    const data = doc?.rounds as RoyaleData;
    const names = new Map<string, string>(mine.map((m) => [m._id as string, m.name]));
    const best = entriesOf(data, names)[0];
    // Welche Runde soll der Admin sehen: die seines besten Monsters (Finale oder Vorrunde), sonst das Finale
    const round = best && !best.inFinal && best.heatIndex != null ? best.heatIndex : -1;
    return { royaleId: res.royaleId, live: false, round, entrants: res.entrants ?? 0 };
  },
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
function ordinal(n: number) {
  const t = n % 100;
  if (t >= 11 && t <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
}

function resultLabel(e: Entry, total: number) {
  if (e.champion) return "Champion";
  if (e.inFinal && e.finalPlace) return `${ordinal(e.finalPlace)} place of ${Math.max(total, e.finalSize)}`;
  if (e.heatPlace && e.heatSize && e.heatIndex != null) return `Heat ${e.heatIndex + 1} · ${ordinal(e.heatPlace)} of ${e.heatSize}`;
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
      sample: boolean; score: number; photoUrl: string | null; snapUrl: string | null;
    }[] = [];
    // Ein Monster schlüpft genau zum Startzeitpunkt seiner Royale: Darüber finden wir die eigenen Royales direkt (Index),
    // ohne alle Royales zu lesen. Nur für alte Monster ohne Schlüpfzeit schauen wir zusätzlich in die letzten 30.
    const rows: Doc<"royales">[] = [];
    const times = [...new Set(hatched.map((m) => m.hatchedAt).filter((t): t is number => typeof t === "number"))].sort((x, y) => y - x).slice(0, 40);
    for (const t of times) {
      rows.push(
        ...(await ctx.db
          .query("royales")
          .withIndex("by_startsAt", (q) => q.eq("startsAt", t))
          .take(3)),
      );
    }
    if (hatched.some((m) => typeof m.hatchedAt !== "number")) {
      const seen = new Set<string>(rows.map((r) => r._id));
      for (const r of await ctx.db.query("royales").order("desc").take(30)) if (!seen.has(r._id)) rows.push(r);
    }
    for (const r of rows) {
      const data = r.rounds as RoyaleData | undefined;
      if (!data?.final || (data.test && !test && !data.preview)) continue;
      const entries = entriesOf(data, names);
      if (!entries.length) continue;
      const e = entries[0];
      const m = byId.get(e.monsterId);
      const champId = data.final.winnerId ? ctx.db.normalizeId("monsters", data.final.winnerId) : null;
      const champ = champId ? (byId.get(champId) ?? (await ctx.db.get("monsters", champId))) : null;
      history.push({
        royaleId: r._id, startsAt: r.startsAt, title: data.title, entrants: data.entrantCount, monsterId: e.monsterId, monsterName: e.monsterName,
        element: m?.element ?? null, golden: !!(m?.golden ?? m?.genome?.golden),
        // Beispiel-Royales eines Vorführkontos sind über das Feld sample erkennbar und in README und Abgabetext ausgewiesen
        result: resultLabel(e, data.entrantCount), champion: e.champion,
        championName: champ?.name ?? null, round: e.inFinal || e.heatIndex == null ? -1 : e.heatIndex,
        sample: !!data.sample, score: e.score,
        // Bilder für die Karte im Profil: das Foto, aus dem das Monster entstand, und das fertige Bild des Monsters
        photoUrl: m && (m.thumbId ?? m.photoId) ? await ctx.storage.getUrl((m.thumbId ?? m.photoId)!) : ((m?.genome?.photoUrl as string | undefined) ?? null),
        snapUrl: m?.snapId ? await ctx.storage.getUrl(m.snapId) : null,
      });
    }
    history.sort((x, y) => y.startsAt - x.startsAt);
    history.splice(20);
    // Bestes Ergebnis: ein echtes, sobald es eines gibt; sonst das beste Beispiel (mit Kennzeichnung)
    const counted = history.some((h) => !h.sample) ? history.filter((h) => !h.sample) : history;
    const bestEntry = counted.reduce<(typeof history)[number] | null>((b, h) => (!b || h.score < b.score ? h : b), null);
    return {
      name: player.name ?? null,
      since: Math.min(player._creationTime, ...history.map((h) => h.startsAt)),
      stats: {
        monsters: hatched.length,
        eggs: mineAll.filter((m) => m.status === "egg").length,
        royales: history.length,
        wins: history.filter((h) => h.champion).length,
        best: bestEntry?.result ?? null,
      },
      history: history.map((h) => ({
        royaleId: h.royaleId, startsAt: h.startsAt, title: h.title, entrants: h.entrants, monsterId: h.monsterId, monsterName: h.monsterName,
        element: h.element, golden: h.golden, result: h.result, champion: h.champion, championName: h.championName, round: h.round, sample: h.sample,
        photoUrl: h.photoUrl, snapUrl: h.snapUrl,
      })),
    };
  },
});

// ---------- Beispieldaten für ein Vorführkonto (dev.seedSample) ----------
// Vier frühere Royales mit je einem eigenen Monster, damit Sammlung, Zahlen und Verlauf im Vorführvideo den täglichen
// Ablauf zeigen, obwohl es das Spiel erst seit heute gibt. Alles trägt sample: true (Monster) bzw. rounds.sample (Royale):
// Es erscheint nur in der eigenen Sammlung und im eigenen Profil, nie als "letzte Royale", in keiner öffentlichen Liste,
// keinem Zähler, keinem Tageslimit und nicht in den Zahlen. Die Kämpfe sind echt gerechnet (gleiche Simulation wie runNow).
// Zeiten in Pacific: Mi 11.11. 19:40, Do 12.11. 12:15, Fr 13.11. 21:05, Sa 14.11. 16:30. place = angestrebter Platz.
export const SAMPLE_DAYS = [
  { at: Date.UTC(2026, 10, 12, 3, 40), place: 3, opponents: 11 },
  { at: Date.UTC(2026, 10, 12, 20, 15), place: 6, opponents: 9 },
  { at: Date.UTC(2026, 10, 14, 5, 5), place: 4, opponents: 13 },
  { at: Date.UTC(2026, 10, 15, 0, 30), place: 2, opponents: 10 },
];
// Bevorzugte Vorlagen: Monster aus Adams eigenen Beispielfotos (Auto, Roller, Parkautomat), dann weitere gut erkennbare Dinge.
// Kein Capybara: Sein echtes Capybara-Ei schlüpft in der echten Royale.
const SAMPLE_PREFER = [/\bcar\b|crossover|\bsuv\b/i, /scooter/i, /parking|pay station|\bmeter\b/i, /hydrant/i, /traffic cone/i, /teapot/i];
const SAMPLE_AVOID = /capy/i;

export type SamplePrep = {
  existing: boolean;
  monsters: { id: Id<"monsters">; at: number; place: number; opponents: number; fighter: Fighter }[];
  wild: Fighter[];
};

async function sampleRoyalesOf(ctx: QueryCtx, m: Doc<"monsters">) {
  if (typeof m.hatchedAt !== "number") return [];
  const rows = await ctx.db
    .query("royales")
    .withIndex("by_startsAt", (q) => q.eq("startsAt", m.hatchedAt!))
    .take(5);
  return rows.filter((r) => (r.rounds as RoyaleData | undefined)?.sample && roundIds((r.rounds as RoyaleData).final).includes(m._id));
}

// Beispiel-Monster eines Spielers samt ihrer Beispiel-Royales löschen. Die Fotos bleiben: Sie gehören den Vorlagen.
export async function clearSampleFor(ctx: MutationCtx, deviceId: string) {
  const player = await ctx.db
    .query("players")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
  if (!player) throw new Error("Unknown deviceId.");
  const mine = await ctx.db
    .query("monsters")
    .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
    .take(300);
  let monsters = 0, royales = 0;
  for (const m of mine) {
    if (!m.sample) continue;
    for (const r of await sampleRoyalesOf(ctx, m)) {
      await ctx.db.delete("royales", r._id);
      royales++;
    }
    await ctx.db.delete("monsters", m._id);
    monsters++;
  }
  return { monsters, royales };
}

// Schritt 1 von dev.seedSample: die vier Beispiel-Monster anlegen (Kopien vorhandener Monster von Testspielern,
// nie von echten Nutzern) und alles zurückgeben, was die Suche nach passenden Kämpfen braucht.
export const sampleMonsters = internalMutation({
  args: { deviceId: v.string(), replace: v.optional(v.boolean()), sourceIds: v.optional(v.array(v.id("monsters"))) },
  handler: async (ctx, a): Promise<SamplePrep> => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", a.deviceId))
      .unique();
    if (!player) throw new Error("Unknown deviceId. Open the app on that device first.");
    if (player.deviceId === WILD_DEVICE) throw new Error("Not for the house player.");
    const mine = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .take(300);
    if (mine.some((m) => m.sample)) {
      if (!a.replace) return { existing: true, monsters: [], wild: [] };
      await clearSampleFor(ctx, a.deviceId);
    }

    const pool = await wildPool(ctx);
    const picked: Doc<"monsters">[] = [];
    const cleanName = (name: string) => name.replace(/ (II|III|IV|V|VI)$/, "");
    const taken = (m: Doc<"monsters">) => picked.some((p) => p._id === m._id || cleanName(p.name).toLowerCase() === cleanName(m.name).toLowerCase());
    if (a.sourceIds) {
      for (const id of a.sourceIds) {
        const m = await ctx.db.get("monsters", id);
        if (!m?.genome) throw new Error(`Source ${id} has no monster.`);
        const owner = await ctx.db.get("players", m.playerId);
        if (!owner?.isTest) throw new Error(`Source ${id} belongs to a real player.`);
        if (!taken(m)) picked.push(m);
      }
    } else {
      const recent = await ctx.db.query("monsters").order("desc").take(600);
      const owners = new Map<Id<"players">, Doc<"players"> | null>();
      const cands: Doc<"monsters">[] = [];
      for (const m of recent) {
        if ((m.status ?? "hatched") !== "hatched" || m.sample || m.golden || m.genome?.golden) continue;
        if (!m.genome?.blueprint?.parts?.length || !(m.photoId || m.thumbId)) continue;
        if (SAMPLE_AVOID.test(String(m.genome.object ?? "")) || SAMPLE_AVOID.test(m.name)) continue;
        if (!owners.has(m.playerId)) owners.set(m.playerId, await ctx.db.get("players", m.playerId));
        const owner = owners.get(m.playerId);
        if (!owner?.isTest || owner.deviceId === WILD_DEVICE) continue; // nur Testspieler: nie das Foto eines echten Nutzers kopieren
        cands.push(m);
      }
      const parts = (m: Doc<"monsters">) => m.genome.blueprint.parts.length as number;
      cands.sort((x, y) => parts(y) - parts(x) || y._creationTime - x._creationTime);
      for (const re of SAMPLE_PREFER) {
        if (picked.length >= SAMPLE_DAYS.length) break;
        const best = cands.find((m) => re.test(String(m.genome.object ?? "")) && !taken(m));
        if (best) picked.push(best);
      }
      for (const m of cands) {
        if (picked.length >= SAMPLE_DAYS.length) break;
        if (SAMPLE_PREFER.some((re) => re.test(String(m.genome.object ?? ""))) || taken(m)) continue; // diese Art ist schon vertreten
        picked.push(m);
      }
    }
    // Reichen die Vorlagen mit Foto nicht, füllen wilde Monster auf (ohne Foto)
    for (const m of pool) {
      if (picked.length >= SAMPLE_DAYS.length) break;
      if (!taken(m) && !SAMPLE_AVOID.test(m.name)) picked.push(m);
    }
    if (picked.length < SAMPLE_DAYS.length) throw new Error("Not enough monsters to copy from.");

    const monsters: SamplePrep["monsters"] = [];
    for (const [i, src] of picked.slice(0, SAMPLE_DAYS.length).entries()) {
      const day = SAMPLE_DAYS[i];
      const name = cleanName(src.name);
      const genome: Record<string, unknown> = { ...(src.genome as Record<string, unknown>), name };
      delete genome.golden; // ein Beispiel-Monster ist nie ein Goldenes Ei (das würde das Kauflimit des Tages berühren)
      const id = await ctx.db.insert("monsters", {
        playerId: player._id,
        genome,
        name,
        element: src.element,
        stats: statsFromTraits(src.genome.traits), // volle Werte (wilde Vorlagen kämpfen sonst abgeschwächt)
        stage: src.stage || 1,
        photoId: src.photoId,
        thumbId: src.thumbId,
        status: "hatched",
        ready: true,
        sample: true,
        hatchedAt: day.at,
      });
      const doc = await ctx.db.get("monsters", id);
      monsters.push({ id, at: day.at, place: day.place, opponents: day.opponents, fighter: fighterOf(doc!) });
    }
    return { existing: false, monsters, wild: pool.map(fighterOf) };
  },
});

// Schritt 2 von dev.seedSample: je Beispiel-Monster eine frühere Royale anlegen. Der Kampf wird hier mit derselben
// Simulation wie in runNow gerechnet (ids in Kampfreihenfolge, seed aus der Suche in dev.seedSample).
export const sampleRoyales = internalMutation({
  args: {
    deviceId: v.string(),
    rows: v.array(v.object({ monsterId: v.id("monsters"), ids: v.array(v.id("monsters")), seed: v.number(), at: v.number() })),
  },
  handler: async (ctx, a) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", a.deviceId))
      .unique();
    if (!player) throw new Error("Unknown deviceId.");
    const out: { royaleId: Id<"royales">; at: number; monster: string; place: number; of: number }[] = [];
    for (const row of a.rows) {
      const mon = await ctx.db.get("monsters", row.monsterId);
      if (!mon || !mon.sample || mon.playerId !== player._id) throw new Error("Not a sample monster of this player.");
      if (!row.ids.includes(row.monsterId)) throw new Error("The sample monster is not among the entrants.");
      if (mon.hatchedAt !== row.at) await ctx.db.patch("monsters", mon._id, { hatchedAt: row.at });
      if ((await sampleRoyalesOf(ctx, { ...mon, hatchedAt: row.at })).length) continue; // gibt es schon
      const fighters: Fighter[] = [];
      for (const id of row.ids) {
        const m = await ctx.db.get("monsters", id);
        if (!m?.genome) throw new Error(`Entrant ${id} is missing.`);
        fighters.push(fighterOf(m));
      }
      const final = simulate(fighters, row.seed, null);
      const data: RoyaleData = { title: "Royale", dayElement: null, entrantCount: fighters.length, wildCount: fighters.length - 1, sample: true, heats: [], final };
      const championId = (final.winnerId as Id<"monsters"> | null) ?? undefined;
      const royaleId = await ctx.db.insert("royales", { startsAt: row.at, status: "done", rounds: data, championId });
      out.push({ royaleId, at: row.at, monster: mon.name, place: final.placements.indexOf(mon._id) + 1, of: fighters.length });
    }
    return out;
  },
});

// Was ein Vorführkonto an Beispieldaten hat (für die Ausgabe von dev.seedSample)
export const sampleList = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!player) return [];
    const mine = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .take(300);
    const out: { when: string; monster: string; object: string | null; result: string | null; monsterId: Id<"monsters">; royaleId: Id<"royales"> | null }[] = [];
    for (const m of mine) {
      if (!m.sample) continue;
      const r = (await sampleRoyalesOf(ctx, m))[0];
      const e = r ? entriesOf(r.rounds as RoyaleData, new Map([[m._id as string, m.name]]))[0] : null;
      out.push({
        when: new Date((m.hatchedAt ?? m._creationTime) - 8 * 3600 * 1000).toISOString().slice(0, 16).replace("T", " ") + " PST",
        monster: m.name,
        object: (m.genome?.object as string | undefined) ?? null,
        result: r && e ? resultLabel(e, (r.rounds as RoyaleData).entrantCount) : null,
        monsterId: m._id,
        royaleId: r?._id ?? null,
      });
    }
    return out.sort((x, y) => (x.when < y.when ? -1 : 1));
  },
});
