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
    // Für die Zahlen (convex/stats.ts). Alles ohne persönliche Daten.
    eggs: v.optional(v.number()), // gelegte Eier insgesamt
    rejects: v.optional(v.number()), // davon abgelehnt (Menschen, Privates)
    firstEggAt: v.optional(v.number()),
    opens: v.optional(v.number()), // Seitenaufrufe
    lastSeen: v.optional(v.number()),
    app: v.optional(v.string()), // tiktok | instagram | youtube | facebook | browser (In-App-Browser)
    dev: v.optional(v.string()), // iphone | android | ipad | mac | windows | other
    ref: v.optional(v.string()), // Herkunftsseite (nur der Hostname)
    utm: v.optional(v.string()), // ?s= oder ?utm_source=
    tz: v.optional(v.string()), // Zeitzone des Geräts, z. B. America/Los_Angeles
    lang: v.optional(v.string()),
  }).index("by_deviceId", ["deviceId"]),

  // Ein Zähler pro Name (z. B. "eggsWaiting"), damit Seiten eine Zahl zeigen können, ohne alle Eier zu lesen
  counters: defineTable({ name: v.string(), n: v.number() }).index("by_name", ["name"]),

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
    thumbId: v.optional(v.id("_storage")), // kleines Vorschaubild für Listen und die Arena (spart Datenvolumen)
    // Ei-Ablauf: Nach dem Foto ist der Eintrag ein Ei. Das Monster entsteht verdeckt (ready) und schlüpft erst in der Royale.
    status: v.optional(v.string()), // "egg" | "hatched" | "rejected"; fehlt bei alten Einträgen = geschlüpft
    ready: v.optional(v.boolean()),
    golden: v.optional(v.boolean()),
    hatchedAt: v.optional(v.number()),
    attempts: v.optional(v.number()),
    genAt: v.optional(v.number()), // letzter (geplanter) Bauversuch, für den Aufräum-Cron
  })
    .index("by_playerId", ["playerId"])
    .index("by_status_and_ready", ["status", "ready"]),

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
