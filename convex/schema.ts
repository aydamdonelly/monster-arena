import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export const stats = v.object({
  hp: v.number(),
  atk: v.number(),
  def: v.number(),
  spd: v.number(),
});

export default defineSchema({
  players: defineTable({
    deviceId: v.string(),
    name: v.optional(v.string()),
    source: v.optional(v.string()),
    isTest: v.boolean(),
    goldenEggs: v.optional(v.number()), // gekaufte, noch nicht benutzte Goldene Eier
  }).index("by_deviceId", ["deviceId"]),

  // Käufe über Whop (ein Eintrag pro Zahlung, damit ein doppelt zugestellter Webhook nichts doppelt gutschreibt)
  purchases: defineTable({
    playerId: v.id("players"),
    provider: v.string(),
    paymentId: v.string(),
    kind: v.string(),
    amountUsd: v.number(),
    environment: v.string(),
  }).index("by_paymentId", ["paymentId"]),

  monsters: defineTable({
    playerId: v.id("players"),
    genome: v.any(),
    name: v.string(),
    element: v.string(),
    stats,
    stage: v.number(),
    photoId: v.optional(v.id("_storage")),
  }).index("by_playerId", ["playerId"]),

  drops: defineTable({
    title: v.string(),
    element: v.string(),
    startsAt: v.number(),
    endsAt: v.number(),
  }).index("by_endsAt", ["endsAt"]),

  battles: defineTable({
    aId: v.id("monsters"),
    bId: v.id("monsters"),
    seed: v.number(),
    events: v.any(),
    winnerId: v.id("monsters"),
    royaleId: v.optional(v.id("royales")),
  }),

  royales: defineTable({
    startsAt: v.number(),
    status: v.string(),
    rounds: v.any(),
    championId: v.optional(v.id("monsters")),
  }),

  events: defineTable({
    playerId: v.id("players"),
    type: v.string(),
    meta: v.optional(v.any()),
  }),
});
