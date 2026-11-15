// Foto -> Monster: Upload-URL, KI-Genom (OpenAI Responses API mit striktem JSON-Schema), Speichern.
import { v, ConvexError } from "convex/values";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
// Reine JS-Module aus monster-kit (ohne three.js), dieselben wie in der App und im Test-Skript
import { GENOME_SCHEMA, genomeInstructions, genomeFromAI } from "../monster-kit/genome-spec.js";
import { statsFromTraits, hashString } from "../monster-kit/battle.js";

const MODEL = "gpt-6-luna";
const DAILY_LIMIT = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => await ctx.storage.generateUploadUrl(),
});

type Precheck = { playerId: Id<"players">; isTest: boolean; countToday: number; goldenEggs: number; dropTitle: string } | null;

export const precheck = internalQuery({
  args: { deviceId: v.string(), now: v.number() },
  handler: async (ctx, { deviceId, now }): Promise<Precheck> => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!player) return null;
    const mine = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(20);
    let dropTitle = "anything";
    for await (const drop of ctx.db.query("drops").withIndex("by_endsAt", (q) => q.gt("endsAt", now))) {
      if (drop.startsAt <= now) {
        dropTitle = drop.title;
        break;
      }
    }
    return {
      playerId: player._id,
      isTest: player.isTest,
      // Goldene Monster zählen nicht zum Tageslimit
      countToday: mine.filter((m) => m._creationTime > now - DAY_MS && !m.genome?.golden).length,
      goldenEggs: player.goldenEggs ?? 0,
      dropTitle,
    };
  },
});

export const hatch = action({
  args: { deviceId: v.string(), storageId: v.id("_storage") },
  returns: v.object({ monsterId: v.id("monsters"), genome: v.any() }),
  handler: async (ctx, { deviceId, storageId }): Promise<{ monsterId: Id<"monsters">; genome: any }> => {
    const pre: Precheck = await ctx.runQuery(internal.hatch.precheck, { deviceId, now: Date.now() });
    if (!pre) throw new ConvexError({ code: "no_player", message: "Please restart the app and try again." });
    // Ein Goldenes Ei wird beim nächsten Fang benutzt: Das Monster wird golden und zählt nicht zum Tageslimit.
    const golden: boolean = pre.goldenEggs > 0;
    if (!golden && !pre.isTest && pre.countToday >= DAILY_LIMIT) {
      throw new ConvexError({
        code: "limit",
        message: `You hatched ${DAILY_LIMIT} monsters today. Come back tomorrow, or crack a Golden Egg for one more.`,
      });
    }
    const imageUrl = await ctx.storage.getUrl(storageId);
    if (!imageUrl) throw new ConvexError({ code: "no_photo", message: "The photo did not upload. Try again!" });

    const t0 = Date.now();
    const res = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {
            role: "user",
            content: [
              { type: "input_text", text: genomeInstructions(pre.dropTitle) },
              { type: "input_image", image_url: imageUrl },
            ],
          },
        ],
        text: { format: { type: "json_schema", name: "monster_genome", schema: GENOME_SCHEMA, strict: true } },
      }),
    });
    const body: any = await res.json();
    if (!res.ok) {
      console.error("openai", res.status, JSON.stringify(body).slice(0, 500));
      throw new ConvexError({ code: "ai", message: "The egg did not hatch. Try again!" });
    }
    const text: string | undefined =
      body.output_text ??
      body.output?.flatMap((o: any) => o.content || []).find((c: any) => c.type === "output_text")?.text;
    let ai: any;
    try {
      ai = JSON.parse(text ?? "");
    } catch {
      console.error("openai parse", String(text).slice(0, 300));
      throw new ConvexError({ code: "ai", message: "The egg did not hatch. Try again!" });
    }
    if (!ai.safe) {
      await ctx.storage.delete(storageId);
      throw new ConvexError({
        code: "unsafe",
        message: "Monsters only hatch from objects, not people. Try something else!",
      });
    }
    const genome: any = { ...genomeFromAI(ai, hashString(storageId)), ...(golden ? { golden: true } : {}) };
    const monsterId: Id<"monsters"> = await ctx.runMutation(internal.hatch.save, {
      playerId: pre.playerId,
      storageId,
      genome,
      matchesPrompt: typeof ai.matchesPrompt === "number" ? ai.matchesPrompt : 0,
      ms: Date.now() - t0,
    });
    return { monsterId, genome: { ...genome } };
  },
});

export const save = internalMutation({
  args: {
    playerId: v.id("players"),
    storageId: v.id("_storage"),
    genome: v.any(),
    matchesPrompt: v.number(),
    ms: v.number(),
  },
  returns: v.id("monsters"),
  handler: async (ctx, a) => {
    const genome = a.genome;
    if (genome.golden) {
      // Ei erst hier verbrauchen (gleiche Transaktion wie das Anlegen); ohne Guthaben wird das Monster normal
      const player = await ctx.db.get("players", a.playerId);
      const eggs = player?.goldenEggs ?? 0;
      if (eggs > 0) await ctx.db.patch("players", a.playerId, { goldenEggs: eggs - 1 });
      else delete genome.golden;
    }
    const monsterId = await ctx.db.insert("monsters", {
      playerId: a.playerId,
      genome,
      name: genome.name ?? "Monster",
      element: genome.element ?? "spirit",
      stats: statsFromTraits(genome.traits),
      stage: 1,
      photoId: a.storageId,
    });
    await ctx.db.insert("events", {
      playerId: a.playerId,
      type: "hatch",
      meta: { monsterId, ms: a.ms, matchesPrompt: a.matchesPrompt, golden: !!genome.golden },
    });
    return monsterId;
  },
});
