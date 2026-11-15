// Goldenes Ei kaufen (1 $) über Whop: Checkout-Link erzeugen. Die Gutschrift macht der Webhook in http.ts (golden.credit).
// Umgebungsvariablen in Convex: WHOP_API_KEY, WHOP_WEBHOOK_SECRET, WHOP_ENVIRONMENT (sandbox | production), optional WEB_URL.
import { v, ConvexError } from "convex/values";
import { action, internalMutation, internalQuery } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { GOLDEN_LIMIT, royaleDayStart } from "./eggs";
import { PRICE_USD } from "./golden";

const API_VERSION_DATE = "2026-11-04-1";

function whopBase() {
  return process.env.WHOP_ENVIRONMENT === "production" ? "https://api.whop.com/api/v1" : "https://sandbox-api.whop.com/api/v1";
}

type Buyer = { playerId: Id<"players">; credits: number; goldenToday: number } | null;

export const buyer = internalQuery({
  args: { deviceId: v.string(), now: v.number() },
  handler: async (ctx, { deviceId, now }): Promise<Buyer> => {
    const p = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!p) return null;
    const mine = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", p._id))
      .order("desc")
      .take(30);
    const dayStart = royaleDayStart(now);
    const goldenToday = mine.filter((m) => m._creationTime >= dayStart && m.status !== "rejected" && (m.golden ?? m.genome?.golden)).length;
    return { playerId: p._id, credits: p.goldenEggs ?? 0, goldenToday };
  },
});

// Erstellt einen Whop-Checkout für genau diesen Spieler und liefert die Bezahl-URL.
export const checkout = action({
  args: { deviceId: v.string(), returnUrl: v.optional(v.string()) },
  returns: v.object({ purchaseUrl: v.string(), priceUsd: v.number(), sandbox: v.boolean() }),
  handler: async (ctx, { deviceId, returnUrl }): Promise<{ purchaseUrl: string; priceUsd: number; sandbox: boolean }> => {
    const key = process.env.WHOP_API_KEY;
    if (!key) throw new ConvexError({ code: "not_configured", message: "The egg shop opens in a few minutes." });
    const b: Buyer = await ctx.runQuery(internal.whop.buyer, { deviceId, now: Date.now() });
    if (!b) throw new ConvexError({ code: "no_player", message: "Please restart the app and try again." });
    if (b.credits > 0) throw new ConvexError({ code: "has_egg", message: "You already have a Golden Egg. Snap it!" });
    if (b.goldenToday >= GOLDEN_LIMIT) throw new ConvexError({ code: "limit", message: "Both your eggs are in. See you in the arena." });

    const web = process.env.WEB_URL ?? "https://snappymon.com";
    const okReturn = returnUrl && (returnUrl.startsWith(web) || returnUrl.startsWith("snappymon://") || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(returnUrl));
    const redirect = okReturn ? returnUrl! : `${web}/`;
    const res = await fetch(`${whopBase()}/checkout_configurations`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Api-Version-Date": API_VERSION_DATE },
      body: JSON.stringify({
        variant: {
          title: "Golden Egg",
          description: "A second egg in today's Snappymon royale. Hatches golden, crown included.",
          billing_type: "one_time",
          initial_price: PRICE_USD,
          currency: "usd",
        },
        metadata: { kind: "golden_egg", playerId: b.playerId },
        redirect_url: redirect,
      }),
    });
    const body: any = await res.json().catch(() => null);
    if (!res.ok || !body?.purchase_url) {
      console.error("whop checkout", res.status, JSON.stringify(body).slice(0, 500));
      throw new ConvexError({ code: "checkout", message: "The egg shop is jammed. Try again in a moment!" });
    }
    await ctx.runMutation(internal.whop.logCheckout, { playerId: b.playerId });
    return { purchaseUrl: body.purchase_url as string, priceUsd: PRICE_USD, sandbox: process.env.WHOP_ENVIRONMENT !== "production" };
  },
});

export const logCheckout = internalMutation({
  args: { playerId: v.id("players") },
  returns: v.null(),
  handler: async (ctx, a) => {
    await ctx.db.insert("events", { playerId: a.playerId, type: "golden_checkout" });
    return null;
  },
});
