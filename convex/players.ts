import { v } from "convex/values";
import { mutation, MutationCtx } from "./_generated/server";

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
