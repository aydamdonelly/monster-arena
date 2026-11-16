// Ei-Ablauf: Foto -> Ei (sofort). Das Monster entsteht verdeckt im Hintergrund und schlüpft erst in der täglichen Royale.
// Dadurch darf die KI sich Zeit lassen (großes Modell, 20 bis 30 s) und baut das Monster frei aus Bauteilen (Blueprint).
import { v, ConvexError } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { GENOME_SCHEMA, genomeInstructions, genomeFromAI } from "../monster-kit/genome-spec.js";
import { statsFromTraits, hashString } from "../monster-kit/battle.js";
import { ROYALE_UTC_MIN } from "./schedule";

const MODELS = ["gpt-6.1-sol", "gpt-6-luna"]; // erst das große Modell, bei Fehlern das schnelle
export const DAILY_LIMIT = 1; // ein Ei pro Royale; ein zweites gibt es nur als Goldenes Ei (gekauft)
export const GOLDEN_LIMIT = 1;
const FLOOD_LIMIT = 150; // Eier in 10 Minuten über alle Spieler
const RUSH_MS = 3 * 60 * 1000; // so kurz vor der Royale zählt Tempo mehr als das letzte Detail

// Zeitpunkt der nächsten Royale (Uhrzeit aus schedule.ts)
export function nextRoyale(now: number) {
  return royaleDayStart(now) + 24 * 60 * 60 * 1000;
}
const DAY_MS = 24 * 60 * 60 * 1000;

// Beginn des laufenden Royale-Tages: der letzte Royale-Zeitpunkt (Uhrzeit aus schedule.ts).
// Eier, die danach gelegt werden, warten auf die nächste Royale.
export function royaleDayStart(now: number) {
  const d = new Date(now);
  d.setUTCHours(0, ROYALE_UTC_MIN, 0, 0);
  return d.getTime() > now ? d.getTime() - DAY_MS : d.getTime();
}
const MAX_ATTEMPTS = 8;
// Wartezeit vor dem nächsten Versuch in Sekunden (bei Andrang antwortet die KI mit "zu viele Anfragen")
const RETRY_AFTER_S = [5, 15, 30, 60, 120, 240, 300, 300];
const STALE_MS = 7 * 60 * 1000; // so lange ohne Lebenszeichen = hängen geblieben, der Aufräum-Cron stößt neu an

// Zähler für Seiten, die nur eine Zahl brauchen (Startseite, Arena, Beamer)
export async function bumpCounter(ctx: MutationCtx, name: string, by: number) {
  const row = await ctx.db
    .query("counters")
    .withIndex("by_name", (q) => q.eq("name", name))
    .unique();
  if (row) await ctx.db.patch("counters", row._id, { n: Math.max(0, row.n + by) });
  else await ctx.db.insert("counters", { name, n: Math.max(0, by) });
}

// Ei ablehnen: Foto löschen, Goldenes Ei zurückgeben, Zähler nachziehen
async function rejectEgg(ctx: MutationCtx, egg: Doc<"monsters">) {
  if (egg.status !== "egg") return;
  if (egg.photoId) await ctx.storage.delete(egg.photoId);
  if (egg.thumbId) await ctx.storage.delete(egg.thumbId);
  await ctx.db.patch("monsters", egg._id, { status: "rejected", photoId: undefined, thumbId: undefined });
  const player = await ctx.db.get("players", egg.playerId);
  if (!player) return;
  await ctx.db.patch("players", player._id, {
    rejects: (player.rejects ?? 0) + 1,
    ...(egg.golden ? { goldenEggs: (player.goldenEggs ?? 0) + 1 } : {}),
  });
  if (!player.isTest) await bumpCounter(ctx, "eggsWaiting", -1);
}

// Wie viele Eier warten auf die nächste Royale? (ohne Testspieler)
export const waiting = query({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const row = await ctx.db
      .query("counters")
      .withIndex("by_name", (q) => q.eq("name", "eggsWaiting"))
      .unique();
    return row?.n ?? 0;
  },
});

export const lay = mutation({
  args: { deviceId: v.string(), storageId: v.id("_storage"), thumbId: v.optional(v.id("_storage")) },
  returns: v.object({ eggId: v.id("monsters"), golden: v.boolean() }),
  handler: async (ctx, { deviceId, storageId, thumbId }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!player) throw new ConvexError({ code: "no_player", message: "Please restart the app and try again." });
    const now = Date.now();
    const mine = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(40);
    // Notbremse: Schickt jemand massenhaft Eier (jedes kostet einen KI-Aufruf), ist das Nest kurz voll
    if (!player.isTest) {
      const burst = await ctx.db
        .query("monsters")
        .withIndex("by_creation_time", (q) => q.gte("_creationTime", now - 10 * 60 * 1000))
        .take(FLOOD_LIMIT + 1);
      if (burst.length > FLOOD_LIMIT) {
        throw new ConvexError({ code: "busy", message: "The nest is packed right now. Try again in a few minutes!" });
      }
    }
    const dayStart = royaleDayStart(now);
    const mineToday = mine.filter((m) => m._creationTime >= dayStart && m.status !== "rejected" && !m.sample);
    const freeToday = mineToday.filter((m) => !(m.golden ?? m.genome?.golden)).length;
    const goldenToday = mineToday.length - freeToday;
    // Das erste Ei ist frei. Danach wird ein gekauftes Goldenes Ei benutzt (höchstens eines pro Royale).
    const golden = freeToday >= DAILY_LIMIT && (player.goldenEggs ?? 0) > 0;
    if (!player.isTest) {
      if (golden && goldenToday >= GOLDEN_LIMIT) {
        throw new ConvexError({ code: "limit", message: "Both your eggs are in. See you in the arena." });
      }
      if (!golden && freeToday >= DAILY_LIMIT) {
        throw new ConvexError({ code: "limit", message: "One egg per royale. Crack a Golden Egg for a second one." });
      }
    }
    await ctx.db.patch("players", player._id, {
      eggs: (player.eggs ?? 0) + 1,
      firstEggAt: player.firstEggAt ?? now,
      ...(golden ? { goldenEggs: (player.goldenEggs ?? 1) - 1 } : {}),
    });
    if (!player.isTest) await bumpCounter(ctx, "eggsWaiting", 1);
    const eggId = await ctx.db.insert("monsters", {
      playerId: player._id,
      genome: null,
      name: "Egg",
      element: "unknown",
      stats: { hp: 0, atk: 0, def: 0, spd: 0 },
      stage: 0,
      photoId: storageId,
      thumbId,
      status: "egg",
      ready: false,
      golden,
      attempts: 0,
      genAt: now,
    });
    await ctx.db.insert("events", { playerId: player._id, type: "egg", meta: { eggId, golden } });
    await ctx.scheduler.runAfter(0, internal.eggs.generate, { eggId });
    return { eggId, golden };
  },
});

// Abgelehntes Ei wegräumen (nur das eigene)
export const remove = mutation({
  args: { deviceId: v.string(), eggId: v.id("monsters") },
  returns: v.null(),
  handler: async (ctx, { deviceId, eggId }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    const egg = await ctx.db.get("monsters", eggId);
    if (!player || !egg || egg.playerId !== player._id || egg.status !== "rejected") return null;
    await ctx.db.delete("monsters", eggId);
    return null;
  },
});

type EggInfo = { photoId: Id<"_storage"> | null; attempts: number; golden: boolean; status: string; ready: boolean } | null;

export const info = internalQuery({
  args: { eggId: v.id("monsters") },
  handler: async (ctx, { eggId }): Promise<EggInfo> => {
    const egg = await ctx.db.get("monsters", eggId);
    if (!egg) return null;
    return { photoId: egg.photoId ?? null, attempts: egg.attempts ?? 0, golden: egg.golden ?? false, status: egg.status ?? "hatched", ready: egg.ready ?? false };
  },
});

// Monster-Wörter für die Namen: Jedes Ei bekommt eines vorgeschlagen, damit nicht die halbe Arena auf "gremlin" endet
const NAME_WORDS = ["zilla", "saurus", "goblin", "imp", "ogre", "troll", "geist", "fang", "beast", "wyrm", "moth", "pup", "bot", "rex", "tron", "ling", "fiend", "yeti", "hydra", "sprite", "golem", "drake", "kraken", "shade", "bug", "conda", "dactyl", "mander", "nado", "claw", "puff", "snout"];

async function askModel(model: string, imageUrl: string, nameWord: string): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: genomeInstructions("anything", nameWord) },
            { type: "input_image", image_url: imageUrl },
          ],
        },
      ],
      text: { format: { type: "json_schema", name: "monster_genome", schema: GENOME_SCHEMA, strict: true } },
    }),
  });
  const body: any = await res.json();
  if (!res.ok) throw new Error(`openai ${model} ${res.status} ${JSON.stringify(body).slice(0, 300)}`);
  const text: string | undefined =
    body.output_text ?? body.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text;
  return JSON.parse(text ?? "");
}

// Baut das Monster zum Ei. Läuft im Hintergrund, mit Wiederholungen.
export const generate = internalAction({
  args: { eggId: v.id("monsters") },
  returns: v.null(),
  handler: async (ctx, { eggId }) => {
    const egg: EggInfo = await ctx.runQuery(internal.eggs.info, { eggId });
    if (!egg || egg.status !== "egg" || egg.ready || !egg.photoId) return null;
    const imageUrl = await ctx.storage.getUrl(egg.photoId);
    if (!imageUrl) return null;
    const t0 = Date.now();
    try {
      // In den letzten Minuten vor der Royale baut das schnelle Modell (wenige Sekunden statt rund 30),
      // damit auch ein spät gelegtes Ei noch mitkämpft. Sonst erst das große Modell, nach zwei Fehlschlägen das schnelle.
      const rush = nextRoyale(t0) - t0 < RUSH_MS;
      const nameWord = NAME_WORDS[(hashString(eggId) + egg.attempts) % NAME_WORDS.length];
      const ai = await askModel(MODELS[rush || egg.attempts >= 2 ? 1 : 0], imageUrl, nameWord);
      if (!ai.safe) {
        await ctx.runMutation(internal.eggs.reject, { eggId });
        return null;
      }
      const genome = { ...genomeFromAI(ai, hashString(eggId)), ...(egg.golden ? { golden: true } : {}) };
      await ctx.runMutation(internal.eggs.saveGenome, { eggId, genome, ms: Date.now() - t0 });
    } catch (e) {
      console.error("egg generate failed", eggId, String(e).slice(0, 300));
      const attempts = egg.attempts + 1;
      const waitMs = RETRY_AFTER_S[Math.min(attempts, RETRY_AFTER_S.length) - 1] * 1000;
      await ctx.runMutation(internal.eggs.bumpAttempts, { eggId, attempts, genAt: Date.now() + waitMs });
      // Nach MAX_ATTEMPTS übernimmt der Aufräum-Cron (eggs.sweep)
      if (attempts < MAX_ATTEMPTS) await ctx.scheduler.runAfter(waitMs, internal.eggs.generate, { eggId });
    }
    return null;
  },
});

export const saveGenome = internalMutation({
  args: { eggId: v.id("monsters"), genome: v.any(), ms: v.number() },
  returns: v.null(),
  handler: async (ctx, { eggId, genome, ms }) => {
    const egg = await ctx.db.get("monsters", eggId);
    if (!egg || egg.status !== "egg" || egg.ready) return null;
    await ctx.db.patch("monsters", eggId, {
      genome,
      name: genome.name ?? "Monster",
      element: genome.element ?? "spirit",
      stats: statsFromTraits(genome.traits),
      stage: 1,
      ready: true,
    });
    await ctx.db.insert("events", { playerId: egg.playerId, type: "egg_ready", meta: { eggId, ms, parts: genome.blueprint?.parts?.length ?? 0 } });
    return null;
  },
});

export const bumpAttempts = internalMutation({
  args: { eggId: v.id("monsters"), attempts: v.number(), genAt: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch("monsters", a.eggId, { attempts: a.attempts, genAt: a.genAt });
    return null;
  },
});

// Aufräum-Cron (alle 3 Minuten): Eier, deren Monster-Bau hängen geblieben ist (Zeitüberschreitung, alle Versuche verbraucht),
// neu anstoßen. Gestaffelt, damit bei Andrang nicht alles gleichzeitig bei der KI anklopft.
export const sweep = internalMutation({
  args: {},
  returns: v.number(),
  handler: async (ctx) => {
    const now = Date.now();
    // Über den Index kommen nur unfertige Eier (kleine Einträge ohne Monster)
    const recent = await ctx.db
      .query("monsters")
      .withIndex("by_status_and_ready", (q) => q.eq("status", "egg").eq("ready", false))
      .take(600);
    let n = 0;
    for (const m of recent) {
      if (!m.photoId || m._creationTime < now - 3 * DAY_MS) continue;
      if ((m.genAt ?? m._creationTime) > now - STALE_MS) continue;
      // Ab Versuch 2 baut das schnelle Modell
      await ctx.db.patch("monsters", m._id, { attempts: 2, genAt: now });
      await ctx.scheduler.runAfter(n * 700, internal.eggs.generate, { eggId: m._id });
      n++;
      if (n >= 120) break;
    }
    return n;
  },
});

export const reject = internalMutation({
  args: { eggId: v.id("monsters") },
  returns: v.null(),
  handler: async (ctx, { eggId }) => {
    const egg = await ctx.db.get("monsters", eggId);
    if (!egg) return null;
    await rejectEgg(ctx, egg);
    return null;
  },
});

// Für uns (CLI): Übersicht der Eier mit dem, was drin ist. npx convex run eggs:adminList
export const adminList = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("monsters").order("desc").take(limit ?? 60);
    const out = [];
    for (const m of rows) {
      if ((m.status ?? "hatched") === "hatched") continue;
      const owner = await ctx.db.get("players", m.playerId);
      out.push({
        id: m._id,
        at: new Date(m._creationTime).toISOString().slice(11, 19),
        status: m.status,
        ready: m.ready ?? false,
        attempts: m.attempts ?? 0,
        golden: m.golden ?? false,
        name: m.ready ? m.name : null,
        object: m.genome?.object ?? null,
        parts: m.genome?.blueprint?.parts?.length ?? 0,
        owner: owner?.name ?? null,
        test: owner?.isTest ?? false,
      });
    }
    return out;
  },
});

// Ei neu bauen lassen (wenn ein Modell misslungen ist): npx convex run eggs:regenerate '{"eggId":"…"}'
export const regenerate = internalMutation({
  args: { eggId: v.id("monsters") },
  returns: v.null(),
  handler: async (ctx, { eggId }) => {
    const egg = await ctx.db.get("monsters", eggId);
    if (!egg || egg.status !== "egg") return null;
    await ctx.db.patch("monsters", eggId, { ready: false, attempts: 0, genAt: Date.now() });
    await ctx.scheduler.runAfter(0, internal.eggs.generate, { eggId });
    return null;
  },
});

// ---------- Kontrolle vor dem Schlüpfen (Seite monster-kit/admin.html, Schlüssel = ADMIN_KEY) ----------
function checkKey(key: string) {
  if (!process.env.ADMIN_KEY || key !== process.env.ADMIN_KEY) throw new ConvexError({ code: "forbidden", message: "Wrong admin key." });
}

// Alle Einträge der letzten 24 Stunden mit Foto und dem versteckten Monster
export const adminGallery = query({
  args: { key: v.string(), since: v.number() },
  handler: async (ctx, { key, since }) => {
    checkKey(key);
    const rows = await ctx.db
      .query("monsters")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", since))
      .order("desc")
      .take(300);
    const out = [];
    for (const m of rows) {
      if (m.sample) continue; // Beispieldaten eines Vorführkontos sind keine Einträge von heute
      const owner = await ctx.db.get("players", m.playerId);
      out.push({
        id: m._id,
        createdAt: m._creationTime,
        status: m.status ?? "hatched",
        ready: m.ready ?? true,
        attempts: m.attempts ?? 0,
        golden: m.golden ?? false,
        name: m.name,
        genome: m.genome,
        photoUrl: m.photoId ? await ctx.storage.getUrl(m.photoId) : ((m.genome?.photoUrl as string | undefined) ?? null),
        owner: owner?.name ?? null,
        source: owner?.source ?? null,
        isTest: owner?.isTest ?? false,
      });
    }
    return out;
  },
});

// Monster neu bauen lassen oder ein Ei von Hand ablehnen
export const adminAction = mutation({
  args: {
    key: v.string(),
    eggId: v.id("monsters"),
    action: v.union(v.literal("regenerate"), v.literal("reject"), v.literal("ownerTest"), v.literal("ownerReal")),
  },
  returns: v.null(),
  handler: async (ctx, { key, eggId, action }) => {
    checkKey(key);
    const egg = await ctx.db.get("monsters", eggId);
    if (!egg) return null;
    // Besitzer als Test markieren (Probeläufe): seine Eier kämpfen nicht in der echten Royale und zählen in keiner Zahl
    if (action === "ownerTest" || action === "ownerReal") {
      const owner = await ctx.db.get("players", egg.playerId);
      const toTest = action === "ownerTest";
      if (!owner || owner.isTest === toTest) return null;
      await ctx.db.patch("players", egg.playerId, { isTest: toTest });
      // Zähler "Eier warten" nachziehen: Er zählt nur Eier echter Spieler
      const theirs = await ctx.db
        .query("monsters")
        .withIndex("by_playerId", (q) => q.eq("playerId", egg.playerId))
        .take(50);
      const waiting = theirs.filter((m) => m.status === "egg").length;
      if (waiting) await bumpCounter(ctx, "eggsWaiting", toTest ? -waiting : waiting);
      return null;
    }
    if (egg.status !== "egg") return null;
    if (action === "regenerate") {
      await ctx.db.patch("monsters", eggId, { ready: false, attempts: 0, genAt: Date.now() });
      await ctx.scheduler.runAfter(0, internal.eggs.generate, { eggId });
    } else {
      await rejectEgg(ctx, egg);
    }
    return null;
  },
});
