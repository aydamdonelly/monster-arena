// Ei-Ablauf: Foto -> Ei (sofort). Das Monster entsteht verdeckt im Hintergrund und schlüpft erst in der Royale um 17 Uhr.
// Dadurch darf die KI sich Zeit lassen (großes Modell, 20 bis 30 s) und baut das Monster frei aus Bauteilen (Blueprint).
import { v, ConvexError } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { GENOME_SCHEMA, genomeInstructions, genomeFromAI } from "../monster-kit/genome-spec.js";
import { statsFromTraits, hashString } from "../monster-kit/battle.js";

const MODELS = ["gpt-6.1-sol", "gpt-6-luna"]; // erst das große Modell, bei Fehlern das schnelle
const DAILY_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_ATTEMPTS = 4;

export const lay = mutation({
  args: { deviceId: v.string(), storageId: v.id("_storage") },
  returns: v.object({ eggId: v.id("monsters"), golden: v.boolean() }),
  handler: async (ctx, { deviceId, storageId }) => {
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
    const today = mine.filter((m) => m._creationTime > now - DAY_MS && m.status !== "rejected" && !(m.golden ?? m.genome?.golden)).length;
    // Ein Goldenes Ei wird beim nächsten Foto benutzt und zählt nicht zum Tageslimit
    const golden = (player.goldenEggs ?? 0) > 0;
    if (!golden && !player.isTest && today >= DAILY_LIMIT) {
      throw new ConvexError({ code: "limit", message: `That's ${DAILY_LIMIT} eggs for today. Come back tomorrow, or crack a Golden Egg for one more.` });
    }
    if (golden) await ctx.db.patch("players", player._id, { goldenEggs: (player.goldenEggs ?? 1) - 1 });
    const eggId = await ctx.db.insert("monsters", {
      playerId: player._id,
      genome: null,
      name: "Egg",
      element: "unknown",
      stats: { hp: 0, atk: 0, def: 0, spd: 0 },
      stage: 0,
      photoId: storageId,
      status: "egg",
      ready: false,
      golden,
      attempts: 0,
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

type EggInfo = { photoId: Id<"_storage"> | null; attempts: number; golden: boolean; status: string } | null;

export const info = internalQuery({
  args: { eggId: v.id("monsters") },
  handler: async (ctx, { eggId }): Promise<EggInfo> => {
    const egg = await ctx.db.get("monsters", eggId);
    if (!egg) return null;
    return { photoId: egg.photoId ?? null, attempts: egg.attempts ?? 0, golden: egg.golden ?? false, status: egg.status ?? "hatched" };
  },
});

async function askModel(model: string, imageUrl: string): Promise<any> {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: genomeInstructions("anything") },
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
    if (!egg || egg.status !== "egg" || !egg.photoId) return null;
    const imageUrl = await ctx.storage.getUrl(egg.photoId);
    if (!imageUrl) return null;
    const t0 = Date.now();
    try {
      const ai = await askModel(MODELS[egg.attempts < 2 ? 0 : 1], imageUrl);
      if (!ai.safe) {
        await ctx.runMutation(internal.eggs.reject, { eggId });
        return null;
      }
      const genome = { ...genomeFromAI(ai, hashString(eggId)), ...(egg.golden ? { golden: true } : {}) };
      await ctx.runMutation(internal.eggs.saveGenome, { eggId, genome, ms: Date.now() - t0 });
    } catch (e) {
      console.error("egg generate failed", eggId, String(e).slice(0, 300));
      const attempts = egg.attempts + 1;
      await ctx.runMutation(internal.eggs.bumpAttempts, { eggId, attempts });
      if (attempts < MAX_ATTEMPTS) await ctx.scheduler.runAfter(4000 * attempts, internal.eggs.generate, { eggId });
    }
    return null;
  },
});

export const saveGenome = internalMutation({
  args: { eggId: v.id("monsters"), genome: v.any(), ms: v.number() },
  returns: v.null(),
  handler: async (ctx, { eggId, genome, ms }) => {
    const egg = await ctx.db.get("monsters", eggId);
    if (!egg || egg.status !== "egg") return null;
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
  args: { eggId: v.id("monsters"), attempts: v.number() },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.patch("monsters", a.eggId, { attempts: a.attempts });
    return null;
  },
});

export const reject = internalMutation({
  args: { eggId: v.id("monsters") },
  returns: v.null(),
  handler: async (ctx, { eggId }) => {
    const egg = await ctx.db.get("monsters", eggId);
    if (!egg) return null;
    if (egg.photoId) await ctx.storage.delete(egg.photoId);
    await ctx.db.patch("monsters", eggId, { status: "rejected", photoId: undefined });
    // Ein verbrauchtes Goldenes Ei zurückgeben
    if (egg.golden) {
      const player = await ctx.db.get("players", egg.playerId);
      if (player) await ctx.db.patch("players", player._id, { goldenEggs: (player.goldenEggs ?? 0) + 1 });
    }
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
    await ctx.db.patch("monsters", eggId, { ready: false, attempts: 0 });
    await ctx.scheduler.runAfter(0, internal.eggs.generate, { eggId });
    return null;
  },
});
