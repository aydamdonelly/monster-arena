// Foto -> Monster: Upload-URL, KI-Genom (OpenAI Responses API mit striktem JSON-Schema), Speichern.
import { v, ConvexError } from "convex/values";
import { action, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
// Reine JS-Module aus monster-kit (ohne three.js), dieselben wie in der App und im Test-Skript
import { GENOME_SCHEMA, genomeInstructions, genomeFromAI } from "../monster-kit/genome-spec.js";
import { statsFromTraits, hashString } from "../monster-kit/battle.js";

const MODEL = "gpt-6-luna";
const DAILY_LIMIT = 1;
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

// Der alte Sofort-Ablauf (Monster direkt nach dem Foto) ist abgeschaltet: Monster entstehen nur noch über eggs.lay und
// schlüpfen in der Royale. Geräte mit einem alten Seitenstand bekommen den Hinweis, neu zu laden.
export const hatch = action({
  args: { deviceId: v.string(), storageId: v.id("_storage") },
  returns: v.object({ monsterId: v.id("monsters"), genome: v.any() }),
  handler: async (): Promise<{ monsterId: Id<"monsters">; genome: any }> => {
    throw new ConvexError({ code: "ai", message: "Snappymon just got an update. Reload the page and snap again!" });
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
