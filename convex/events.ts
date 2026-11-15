import { v } from "convex/values";
import { mutation } from "./_generated/server";
import { playerByDevice } from "./players";

const short = (x: unknown, n: number) => (typeof x === "string" && x ? x.slice(0, n) : undefined);

export const log = mutation({
  args: { deviceId: v.string(), type: v.string(), meta: v.optional(v.any()) },
  returns: v.null(),
  handler: async (ctx, args) => {
    const player = await playerByDevice(ctx, args.deviceId);
    if (!player) return null;
    await ctx.db.insert("events", { playerId: player._id, type: args.type, meta: args.meta });
    if (args.type === "open") {
      // Besuch am Spieler vermerken: Die Zahlenseite liest nur die schlanken Spieler-Einträge
      const m = (args.meta ?? {}) as Record<string, unknown>;
      const patch: Record<string, unknown> = { opens: (player.opens ?? 0) + 1, lastSeen: Date.now() };
      if (!player.app && short(m.app, 16)) patch.app = short(m.app, 16);
      if (!player.dev && short(m.dev, 16)) patch.dev = short(m.dev, 16);
      if (!player.ref && short(m.ref, 64)) patch.ref = short(m.ref, 64);
      if (!player.utm && short(m.s, 32)) patch.utm = short(m.s, 32);
      if (!player.tz && short(m.tz, 40)) patch.tz = short(m.tz, 40);
      if (!player.lang && short(m.lang, 12)) patch.lang = short(m.lang, 12);
      // Automatisierte Browser (Probeläufe der Agenten) und ?s=qa zählen nicht als echte Nutzer
      if (!player.isTest && (m.wd === "1" || m.s === "qa")) patch.isTest = true;
      await ctx.db.patch("players", player._id, patch);
    }
    return null;
  },
});
