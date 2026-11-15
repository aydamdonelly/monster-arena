import { v } from "convex/values";
import { internalMutation, mutation, MutationCtx } from "./_generated/server";

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
    const patch: { name?: string; source?: string } = {};
    if (args.name !== undefined) patch.name = args.name.trim().slice(0, 24);
    if (args.source !== undefined) patch.source = args.source.slice(0, 24);
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
