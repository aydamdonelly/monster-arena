// Goldenes Ei (0,99 $): ein Extra-Fang über das Tageslimit hinaus, das Monster schlüpft golden (siehe hatch.ts).
// Hier liegt nur die Gutschrift. Bezahlung (Whop-Checkout und Webhook) ruft golden.credit auf.
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

export const PRICE_USD = 0.99;

// Vom Zahlungs-Webhook aufzurufen: schreibt ein Goldenes Ei gut. Jede Zahlung zählt genau einmal (paymentId).
// playerId kommt als String aus den Zahlungs-Metadaten.
export const credit = internalMutation({
  args: { playerId: v.string(), paymentId: v.string(), amountUsd: v.number(), environment: v.string() },
  returns: v.union(v.literal("credited"), v.literal("duplicate"), v.literal("unknown_player")),
  handler: async (ctx, a) => {
    const seen = await ctx.db
      .query("purchases")
      .withIndex("by_paymentId", (q) => q.eq("paymentId", a.paymentId))
      .first();
    if (seen) return "duplicate";
    const pid = ctx.db.normalizeId("players", a.playerId);
    const player = pid ? await ctx.db.get("players", pid) : null;
    if (!pid || !player) return "unknown_player";
    await ctx.db.insert("purchases", {
      playerId: pid,
      provider: "whop",
      paymentId: a.paymentId,
      kind: "golden_egg",
      amountUsd: a.amountUsd,
      environment: a.environment,
    });
    await ctx.db.patch("players", pid, { goldenEggs: (player.goldenEggs ?? 0) + 1 });
    await ctx.db.insert("events", { playerId: pid, type: "golden_purchase", meta: { paymentId: a.paymentId, amountUsd: a.amountUsd } });
    return "credited";
  },
});

// Für Tests und Kulanz: npx convex run golden:grant '{"deviceId":"…","eggs":1}'
export const grant = internalMutation({
  args: { deviceId: v.string(), eggs: v.number() },
  returns: v.number(),
  handler: async (ctx, a) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", a.deviceId))
      .unique();
    if (!player) return -1;
    const eggs = Math.max(0, (player.goldenEggs ?? 0) + a.eggs);
    await ctx.db.patch("players", player._id, { goldenEggs: eggs });
    return eggs;
  },
});
