import { v } from "convex/values";
import { internalMutation, mutation, MutationCtx, query } from "./_generated/server";

export async function playerByDevice(ctx: MutationCtx, deviceId: string) {
  return await ctx.db
    .query("players")
    .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
    .unique();
}

export const ensure = mutation({
  args: {
    deviceId: v.string(),
    name: v.optional(v.string()),
    source: v.optional(v.string()),
    isTest: v.optional(v.boolean()),
  },
  returns: v.id("players"),
  handler: async (ctx, args) => {
    const existing = await playerByDevice(ctx, args.deviceId);
    if (existing) return existing._id;
    return await ctx.db.insert("players", {
      deviceId: args.deviceId,
      name: args.name,
      source: args.source,
      isTest: args.isTest ?? false,
    });
  },
});

// Onboarding: Trainername und "Woher kennst du uns?"
export const setProfile = mutation({
  args: { deviceId: v.string(), name: v.optional(v.string()), source: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await playerByDevice(ctx, args.deviceId);
    if (!player) return null;
    const patch: { name?: string; source?: string; isTest?: boolean } = {};
    if (args.name !== undefined) patch.name = args.name.trim().slice(0, 24);
    if (/^qa\b/i.test(args.name ?? "") && !player.isTest) {
      // Testläufe der Agenten heißen "QA …" und zählen nicht mit. Ihre schon gelegten Eier aus dem Zähler nehmen.
      patch.isTest = true;
      const theirs = await ctx.db
        .query("monsters")
        .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
        .take(50);
      const waiting = theirs.filter((m) => m.status === "egg").length;
      if (waiting) await bumpCounter(ctx, "eggsWaiting", -waiting);
    }
    if (args.source !== undefined) patch.source = args.source.slice(0, 80); // z. B. "Some guy approached me on the street about it"
    await ctx.db.patch("players", player._id, patch);
    return null;
  },
});

// Eigene Geräte als Test markieren (zählen nicht in den Zahlen, kein Tageslimit): npx convex run players:setTest
export const setTest = internalMutation({
  args: { deviceId: v.string(), isTest: v.boolean() },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await playerByDevice(ctx, args.deviceId);
    if (player) await ctx.db.patch("players", player._id, { isTest: args.isTest });
    return null;
  },
});

import { DAILY_LIMIT, GOLDEN_LIMIT, bumpCounter, royaleDayStart } from "./eggs";
import { isOwnerDevice } from "./schedule";

// Mein Stand für den Catch-Screen: Fänge heute, Tageslimit, Goldene Eier
export const me = query({
  args: { deviceId: v.string(), now: v.number() },
  returns: v.union(
    v.null(),
    v.object({
      name: v.union(v.string(), v.null()),
      hatchedToday: v.number(),
      dailyLimit: v.number(),
      hatchesLeft: v.number(),
      goldenEggs: v.number(),
      goldenToday: v.number(),
      canGolden: v.boolean(),
      unlimited: v.boolean(),
      admin: v.boolean(),
    }),
  ),
  handler: async (ctx, { deviceId, now }) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!player) return null;
    const mine = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(30);
    const dayStart = royaleDayStart(now);
    const today = mine.filter((m) => m._creationTime >= dayStart && m.status !== "rejected" && !m.sample);
    const hatchedToday = today.filter((m) => !(m.golden ?? m.genome?.golden)).length;
    const goldenToday = today.length - hatchedToday;
    return {
      name: player.name ?? null,
      hatchedToday,
      dailyLimit: DAILY_LIMIT,
      hatchesLeft: Math.max(0, DAILY_LIMIT - hatchedToday),
      goldenEggs: player.goldenEggs ?? 0,
      goldenToday,
      canGolden: goldenToday < GOLDEN_LIMIT, // darf heute noch ein Goldenes Ei legen bzw. kaufen
      unlimited: player.isTest || isOwnerDevice(deviceId), // Testspieler und der Gründer dürfen beliebig viele Eier legen
      admin: isOwnerDevice(deviceId), // eigenes Gerät des Gründers: sieht den Knopf "Admin: start fight"
    };
  },
});
