import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";

const dropDoc = v.object({
  _id: v.id("drops"),
  _creationTime: v.number(),
  title: v.string(),
  element: v.string(),
  startsAt: v.number(),
  endsAt: v.number(),
});

export const current = query({
  args: { now: v.number() },
  returns: v.union(dropDoc, v.null()),
  handler: async (ctx, args) => {
    for await (const drop of ctx.db
      .query("drops")
      .withIndex("by_endsAt", (q) => q.gt("endsAt", args.now))) {
      if (drop.startsAt <= args.now) return drop;
    }
    return null;
  },
});

export const seed = internalMutation({
  args: { title: v.string(), element: v.string(), startsAt: v.number(), endsAt: v.number() },
  returns: v.id("drops"),
  handler: async (ctx, args) => await ctx.db.insert("drops", args),
});
