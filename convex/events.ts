import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { playerByDevice } from "./players";

export const log = mutation({
  args: { deviceId: v.string(), type: v.string(), meta: v.optional(v.any()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await playerByDevice(ctx, args.deviceId);
    if (!player) return null;
    await ctx.db.insert("events", { playerId: player._id, type: args.type, meta: args.meta });
    return null;
  },
});
