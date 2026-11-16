// Zahlen für die Seite /analytics: nur echte Nutzer (ohne Testspieler, ohne wilde Monster).
// Liest ausschließlich die schlanken Spieler-Einträge; Besuchsdaten und Ei-Zähler werden dort mitgeschrieben
// (events.log, eggs.lay). Zugang per STATS_KEY oder ADMIN_KEY (Convex-Umgebungsvariablen).
import { v, ConvexError } from "convex/values";
import { query } from "./_generated/server";

const BUCKET_MS = 15 * 60 * 1000;
const DEFAULT_SOURCES = new Set(["web", "ios", "android", "seed", "house"]); // gesetzt beim ersten Aufruf, keine Antwort des Nutzers

function bump(map: Record<string, number>, key: string, by = 1) {
  map[key] = (map[key] ?? 0) + by;
}

function sorted(map: Record<string, number>, top = 12) {
  return Object.entries(map)
    .map(([label, n]) => ({ label, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, top);
}

export const overview = query({
  args: { key: v.string(), since: v.number() },
  handler: async (ctx, { key, since }) => {
    const ok = (process.env.STATS_KEY && key === process.env.STATS_KEY) || (process.env.ADMIN_KEY && key === process.env.ADMIN_KEY);
    if (!ok) throw new ConvexError({ code: "forbidden", message: "Wrong key." });

    const rows = await ctx.db
      .query("players")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", since))
      .order("desc")
      .take(8000);
    // Die native App ist noch nicht öffentlich: Dort laufen nur unser eigenes Handy und die Cloud-Geräte von Revyl.
    // Sie zählen nicht als Besucher, werden aber getrennt ausgewiesen.
    const isNative = (p: (typeof rows)[number]) => (p.plat ? p.plat !== "web" : p.source === "ios" || p.source === "android");
    // Die eigenen Geräte des Gründers (Convex-Umgebungsvariable OWNER_DEVICES, kommagetrennt) zählen nicht als Besucher
    const owners = new Set((process.env.OWNER_DEVICES ?? "").split(",").map((x: string) => x.trim()).filter(Boolean));
    const real = rows.filter((p) => !p.isTest && !isNative(p) && !owners.has(p.deviceId));
    const ownerCount = rows.filter((p) => !p.isTest && !isNative(p) && owners.has(p.deviceId)).length;
    const nativeSessions = rows.filter((p) => !p.isTest && isNative(p)).length;

    const sourcesAll: Record<string, number> = {};
    const sourcesSnap: Record<string, number> = {};
    const apps: Record<string, number> = {};
    const devices: Record<string, number> = {};
    const zones: Record<string, number> = {};
    const langs: Record<string, number> = {};
    const refs: Record<string, number> = {};
    const buckets: Record<string, { visitors: number; snappers: number }> = {};
    let snappers = 0, eggs = 0, rejected = 0, answered = 0, named = 0, returning = 0, goldenCredits = 0;

    for (const p of real) {
      const laid = p.eggs ?? 0;
      const isSnapper = laid > 0;
      const src = p.source && !DEFAULT_SOURCES.has(p.source) ? p.source : "(not answered)";
      if (src !== "(not answered)") answered++;
      bump(sourcesAll, src);
      if (isSnapper) {
        snappers++;
        bump(sourcesSnap, src);
      }
      eggs += laid;
      rejected += p.rejects ?? 0;
      if (p.name) named++;
      goldenCredits += p.goldenEggs ?? 0;
      // Wiederkehrer: später als 30 Minuten nach dem ersten Besuch noch einmal da gewesen
      if ((p.lastSeen ?? 0) - p._creationTime > 30 * 60 * 1000) returning++;
      bump(apps, p.app ?? "unknown");
      bump(devices, p.dev ?? "unknown");
      bump(zones, p.tz ?? "unknown");
      bump(langs, p.lang ?? "unknown");
      if (p.ref) bump(refs, p.ref);
      const b = String(Math.floor(p._creationTime / BUCKET_MS) * BUCKET_MS);
      buckets[b] ??= { visitors: 0, snappers: 0 };
      buckets[b].visitors++;
      if (p.firstEggAt) {
        const e = String(Math.floor(p.firstEggAt / BUCKET_MS) * BUCKET_MS);
        buckets[e] ??= { visitors: 0, snappers: 0 };
        buckets[e].snappers++;
      }
    }

    // Eier, deren Monster gerade noch gebaut wird (kleine Einträge über den Index)
    const building = await ctx.db
      .query("monsters")
      .withIndex("by_status_and_ready", (q) => q.eq("status", "egg").eq("ready", false))
      .take(500);
    // Wer hat "Golden Egg" angetippt und ist bis zur Bezahlseite gekommen? (echte Besucher, jede Person einmal)
    const realIds = new Set<string>(real.map((p) => p._id));
    const recentEvents = await ctx.db.query("events").order("desc").take(3000);
    const atCheckout = new Set<string>();
    for (const e of recentEvents) if (e.type === "golden_checkout" && e._creationTime >= since && realIds.has(e.playerId)) atCheckout.add(e.playerId);
    const purchases = await ctx.db.query("purchases").order("desc").take(500);
    // Verkauft zählt nur echtes Geld. Käufe aus der Whop-Sandbox (Testkarte) werden getrennt ausgewiesen.
    const recent = purchases.filter((x) => x._creationTime >= since);
    const paid = recent.filter((x) => x.environment === "production");

    return {
      since,
      truncated: rows.length >= 8000,
      visitors: real.length,
      testVisitors: rows.length - real.length - nativeSessions - ownerCount,
      nativeSessions,
      snappers,
      eggs,
      rejected,
      answered,
      named,
      returning,
      building: building.length,
      checkouts: atCheckout.size,
      purchases: paid.length,
      sandboxPurchases: recent.length - paid.length,
      revenueUsd: paid.reduce((sum, x) => sum + x.amountUsd, 0),
      goldenCredits,
      sources: sorted(sourcesAll).map((s) => ({ ...s, snappers: sourcesSnap[s.label] ?? 0 })),
      apps: sorted(apps),
      devices: sorted(devices),
      zones: sorted(zones, 10),
      langs: sorted(langs, 8),
      refs: sorted(refs, 8),
      timeline: Object.entries(buckets)
        .map(([t, x]) => ({ t: Number(t), ...x }))
        .sort((a, b) => a.t - b.t),
      latest: real.slice(0, 30).map((p) => ({
        at: p._creationTime,
        source: p.source && !DEFAULT_SOURCES.has(p.source) ? p.source : null,
        app: p.app ?? null,
        dev: p.dev ?? null,
        tz: p.tz ?? null,
        eggs: p.eggs ?? 0,
        name: p.name ?? null,
        opens: p.opens ?? 0,
      })),
    };
  },
});
