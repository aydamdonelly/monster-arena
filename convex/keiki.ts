// Keiki iMessage back channel: players link their phone with a short code, our Keiki agent texts them
// a reminder before the daily hatch and royale and their result afterwards. Photos still go through the app.
import { v, ConvexError } from "convex/values";
import { internalAction, internalMutation, internalQuery, mutation } from "./_generated/server";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { ROYALE_UTC_MIN } from "./schedule";

const KEIKI_API = "https://onkeiki.com/api/v1/developer/agents";
const WEB_URL = "https://snappymon.com";
const CODE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// Uhrzeit der Royale aus schedule.ts in Pacific, z. B. "6 PM PT"
function royaleHourPT() {
  const at = new Date(Date.UTC(2000, 0, 1, 0, ROYALE_UTC_MIN));
  const label = at.toLocaleTimeString("en-US", { timeZone: "America/Los_Angeles", hour: "numeric", minute: "2-digit" });
  return `${label.replace(":00", "")} PT`;
}

function newCode() {
  let code = "SNAP-";
  for (let i = 0; i < 5; i++) code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return code;
}

// App: "Text me the royale result" holt sich hier den Code und die Nummer für die vorbereitete Nachricht
export const linkCode = mutation({
  args: { deviceId: v.string() },
  returns: v.object({ code: v.string(), number: v.string(), joinCode: v.string() }),
  handler: async (ctx, { deviceId }) => {
    const number = process.env.KEIKI_SHARED_NUMBER;
    const joinCode = process.env.KEIKI_JOIN_CODE;
    if (!number || !joinCode) throw new ConvexError({ code: "not_configured", message: "Texting is not set up yet." });
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
      .unique();
    if (!player) throw new ConvexError({ code: "no_player", message: "Snap a photo first to get an egg." });
    const now = Date.now();
    const existing = await ctx.db
      .query("keikiLinkCodes")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .first();
    if (existing && existing.expiresAt > now + CODE_TTL_MS / 2) return { code: existing.code, number, joinCode };
    let code = newCode();
    while (await ctx.db.query("keikiLinkCodes").withIndex("by_code", (q) => q.eq("code", code)).first()) code = newCode();
    await ctx.db.insert("keikiLinkCodes", { code, playerId: player._id, expiresAt: now + CODE_TTL_MS });
    return { code, number, joinCode };
  },
});

// Webhook-Tool link_player (convex/http.ts): verbindet die Nummer aus dem Keiki-Kontext mit dem Spieler.
// Gibt bewusst nichts über das Monster zurück: vor 17 Uhr ist es noch ein Ei.
export const link = internalMutation({
  args: { code: v.string(), phone: v.string() },
  returns: v.union(
    v.object({ ok: v.literal(true), trainer: v.union(v.string(), v.null()), hatchesAt: v.string() }),
    v.object({ ok: v.literal(false), error: v.string() }),
  ),
  handler: async (ctx, { code, phone }) => {
    const normalized = code.trim().toUpperCase();
    const row = await ctx.db
      .query("keikiLinkCodes")
      .withIndex("by_code", (q) => q.eq("code", normalized))
      .first();
    if (!row || row.expiresAt < Date.now()) {
      return { ok: false as const, error: "Unknown or expired code. Tap the Text me button in the app for a fresh one." };
    }
    const player = await ctx.db.get("players", row.playerId);
    if (!player) return { ok: false as const, error: "This code no longer belongs to a player." };
    const contact = await ctx.db
      .query("keikiContacts")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    if (contact) await ctx.db.patch("keikiContacts", contact._id, { playerId: player._id });
    else await ctx.db.insert("keikiContacts", { phone, playerId: player._id });
    return { ok: true as const, trainer: player.name ?? null, hatchesAt: royaleHourPT() };
  },
});

// Webhook-Tool unlink_player (STOP)
export const unlink = internalMutation({
  args: { phone: v.string() },
  returns: v.object({ ok: v.literal(true), wasLinked: v.boolean() }),
  handler: async (ctx, { phone }) => {
    const contact = await ctx.db
      .query("keikiContacts")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    if (contact) await ctx.db.delete("keikiContacts", contact._id);
    return { ok: true as const, wasLinked: !!contact };
  },
});

async function sendNotice(text: string, phone?: string) {
  const agentId = process.env.KEIKI_AGENT_ID;
  const apiKey = process.env.KEIKI_API_KEY;
  if (!agentId || !apiKey) throw new Error("Set KEIKI_AGENT_ID and KEIKI_API_KEY in the Convex env.");
  const res = await fetch(`${KEIKI_API}/${encodeURIComponent(agentId)}/notice`, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(phone ? { text, phone } : { text }),
  });
  const body = await res.text();
  if (!res.ok) throw new Error(`Keiki notice failed (${res.status}): ${body.slice(0, 300)}`);
  return JSON.parse(body) as { conversations?: number; ran?: number; queued?: number; unavailable?: number };
}

// Vor der Royale an alle: npx convex run keiki:remindRoyale '{"title":"Royale","minutes":15}'
export const remindRoyale = internalAction({
  args: { title: v.string(), minutes: v.number() },
  handler: async (_ctx, { title, minutes }) => {
    const text = [
      `Reminder: in ${minutes} minutes, at ${royaleHourPT()}, every egg hatches live in the arena and the ${title} starts right after.`,
      `Watch your egg hatch: ${WEB_URL}/arena`,
    ].join(" ");
    return await sendNotice(text);
  },
});

// royale.ts speichert je Runde nur die Monster-IDs (ältere Einträge die ganzen Teilnehmer)
type Round = { ids?: Id<"monsters">[]; entrants?: { id: Id<"monsters"> }[]; placements: string[]; winnerId: string | null };
type RoyaleData = { title: string; entrantCount: number; test?: boolean; heats: Round[]; final: Round };

function roundIds(round: Round): string[] {
  return round.ids ?? (round.entrants ?? []).map((e) => e.id);
}

// Bestes Ergebnis des Spielers (wer mehrere Eier gelegt hat, hat mehrere Monster im Rennen): Finale vor Vorrunde
function resultText(data: RoyaleData, trainer: string | null, mine: Map<string, string>, champion: string) {
  const who = trainer ? `${trainer}, ` : "";
  const fought = `${data.entrantCount} fought`;
  const finalIds = roundIds(data.final);
  const entered = new Set([...finalIds, ...data.heats.flatMap(roundIds)].filter((id) => mine.has(id)));
  const ofMine = entered.size > 1 ? ` (your best of ${entered.size})` : "";
  const finalist = finalIds
    .filter((id) => mine.has(id))
    .map((id) => ({ id, place: data.final.placements.indexOf(id) + 1 }))
    .sort((a, b) => a.place - b.place)[0];
  if (finalist) {
    const name = mine.get(finalist.id);
    const replay = `${WEB_URL}/arena/replay?round=-1`;
    if (finalist.place === 1) return `${who}${name} WON the ${data.title}${ofMine}! Champion of ${data.entrantCount}. Replay: ${replay}`;
    const where = data.heats.length ? `in the final (${finalIds.length} finalists, ${fought})` : `of ${data.entrantCount}`;
    return `${who}${name} finished #${finalist.place} ${where} in the ${data.title}${ofMine}. ${champion} won. Replay: ${replay}`;
  }
  const best = data.heats
    .flatMap((h, heatIndex) => {
      const ids = roundIds(h);
      return ids.filter((id) => mine.has(id)).map((id) => ({ id, heatIndex, place: h.placements.indexOf(id) + 1, size: ids.length }));
    })
    .sort((a, b) => a.place / a.size - b.place / b.size)[0];
  if (best) {
    return `${who}${mine.get(best.id)} finished #${best.place} of ${best.size} in heat ${best.heatIndex + 1} of the ${data.title}${ofMine} (${fought}) and just missed the final. ${champion} won. Replay: ${WEB_URL}/arena/replay?round=${best.heatIndex}`;
  }
  return `${who}you had no egg in the ${data.title}. ${champion} won. Watch the final: ${WEB_URL}/arena/replay?round=-1 and snap a photo before ${royaleHourPT()} tomorrow to get an egg in.`;
}

// Ohne royaleId: die neueste echte Royale (die, die /arena/replay zeigt). Probe-Royales nur mit expliziter royaleId.
export const resultNotices = internalQuery({
  args: { royaleId: v.optional(v.id("royales")) },
  handler: async (ctx, { royaleId }) => {
    let royale: Doc<"royales"> | null = royaleId ? await ctx.db.get("royales", royaleId) : null;
    if (!royaleId) {
      for (const r of await ctx.db.query("royales").order("desc").take(40)) {
        if (r.rounds?.final && !r.rounds.test) {
          royale = r;
          break;
        }
      }
    }
    if (!royale?.rounds?.final) throw new Error("No finished royale found.");
    const data = royale.rounds as RoyaleData;
    const winner = data.final.winnerId ? await ctx.db.get("monsters", data.final.winnerId as Id<"monsters">) : null;
    const champion = winner?.name ?? "Nobody";
    const notices = [];
    for await (const contact of ctx.db.query("keikiContacts")) {
      if (contact.lastResultRoyaleId === royale._id) continue;
      const player = await ctx.db.get("players", contact.playerId);
      if (!player) continue;
      const monsters = await ctx.db
        .query("monsters")
        .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
        .order("desc")
        .take(60);
      const mine = new Map(monsters.map((m) => [m._id as string, m.name]));
      notices.push({ phone: contact.phone, text: resultText(data, player.name ?? null, mine, champion) });
    }
    return { royaleId: royale._id, notices };
  },
});

export const markResultSent = internalMutation({
  args: { royaleId: v.id("royales"), phone: v.string() },
  returns: v.null(),
  handler: async (ctx, { royaleId, phone }) => {
    const contact = await ctx.db
      .query("keikiContacts")
      .withIndex("by_phone", (q) => q.eq("phone", phone))
      .unique();
    if (contact) await ctx.db.patch("keikiContacts", contact._id, { lastResultRoyaleId: royaleId });
    return null;
  },
});

// Nach der Royale an jeden verbundenen Kontakt einzeln: npx convex run keiki:sendRoyaleResults
// Ein zweiter Lauf schickt nur an Kontakte, die das Ergebnis dieser Royale noch nicht bekommen haben.
export const sendRoyaleResults = internalAction({
  args: { royaleId: v.optional(v.id("royales")) },
  handler: async (ctx, { royaleId }): Promise<{ royaleId: Id<"royales">; contacts: number; sent: number; failed: { phone: string; error: string }[] }> => {
    const { royaleId: id, notices }: { royaleId: Id<"royales">; notices: { phone: string; text: string }[] } = await ctx.runQuery(
      internal.keiki.resultNotices,
      { royaleId },
    );
    let sent = 0;
    const failed: { phone: string; error: string }[] = [];
    for (let i = 0; i < notices.length; i += 8) {
      await Promise.all(
        notices.slice(i, i + 8).map(async (n) => {
          try {
            await sendNotice(n.text, n.phone);
            await ctx.runMutation(internal.keiki.markResultSent, { royaleId: id, phone: n.phone });
            sent++;
          } catch (e) {
            failed.push({ phone: n.phone.slice(0, 4) + "…", error: (e as Error).message });
          }
        }),
      );
    }
    return { royaleId: id, contacts: notices.length, sent, failed };
  },
});
