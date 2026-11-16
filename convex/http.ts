// HTTP-Endpunkte. /whop: Webhook von Whop (payment.succeeded) für das Goldene Ei. /keiki/: Webhook-Tools des Keiki-Agenten.
import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();

function toBase64(bytes: Uint8Array) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function sameString(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}
async function hmacBase64(keyBytes: Uint8Array, message: string) {
  const key = await crypto.subtle.importKey("raw", keyBytes as BufferSource, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return toBase64(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(message))));
}

// Standard Webhooks: HMAC-SHA256 über "{webhook-id}.{webhook-timestamp}.{roher Body}", Header "v1,<base64>".
// Schlüssel ist das ws_-Secret so, wie Whop es anzeigt.
async function verify(secret: string, id: string, timestamp: string, body: string, header: string) {
  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > 300) return false;
  const expected = await hmacBase64(new TextEncoder().encode(secret), `${id}.${timestamp}.${body}`);
  return header.split(" ").some((part) => {
    const sig = part.includes(",") ? part.slice(part.indexOf(",") + 1) : part;
    return sameString(sig, expected);
  });
}

// Whop liefert Beträge je nach API-Version als Zahl oder als { amount: "1.00", currency, decimals }.
function usd(value: unknown) {
  const raw = typeof value === "object" && value !== null ? (value as { amount?: unknown }).amount : value;
  const n = typeof raw === "string" ? Number(raw) : raw;
  return typeof n === "number" && Number.isFinite(n) ? n : undefined;
}

http.route({
  path: "/whop",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const secret = process.env.WHOP_WEBHOOK_SECRET;
    const body = await req.text();
    const id = req.headers.get("webhook-id") ?? "";
    const timestamp = req.headers.get("webhook-timestamp") ?? "";
    const signature = req.headers.get("webhook-signature") ?? "";
    if (!secret || !(await verify(secret, id, timestamp, body, signature))) {
      console.warn("whop webhook: signature rejected");
      return new Response("invalid signature", { status: 401 });
    }
    let event: unknown;
    try {
      event = JSON.parse(body);
    } catch {
      return new Response("bad json", { status: 400 });
    }
    const e = event as { type?: unknown; data?: { id?: unknown; metadata?: Record<string, unknown> | null; usd_total?: unknown; total?: unknown } };
    if (e.type === "payment.succeeded" && typeof e.data?.id === "string") {
      const meta = e.data.metadata ?? {};
      if (meta.kind === "golden_egg" && typeof meta.playerId === "string") {
        const amount = usd(e.data.usd_total) ?? usd(e.data.total) ?? 0;
        const result = await ctx.runMutation(internal.golden.credit, {
          playerId: meta.playerId,
          paymentId: e.data.id,
          amountUsd: amount,
          environment: process.env.WHOP_ENVIRONMENT === "production" ? "production" : "sandbox",
        });
        console.log("whop payment", e.data.id, result);
      }
    }
    return new Response("OK", { status: 200 });
  }),
});

// Keiki-Webhook-Tools: POST /keiki/<KEIKI_TOOL_TOKEN>/link_player und /keiki/<KEIKI_TOOL_TOKEN>/unlink_player
// Keiki schickt { input, context }; context.phone ist der Kontakt, der gerade schreibt.
http.route({
  pathPrefix: "/keiki/",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    const [token = "", tool = ""] = new URL(req.url).pathname.slice("/keiki/".length).split("/");
    const expected = process.env.KEIKI_TOOL_TOKEN ?? "";
    if (expected.length < 32 || !sameString(token, expected)) return new Response("Not found", { status: 404 });

    const body = (await req.json().catch(() => null)) as { input?: unknown; context?: unknown } | null;
    const input = (body?.input ?? {}) as { code?: unknown };
    const context = (body?.context ?? {}) as { phone?: unknown };
    const phone = typeof context.phone === "string" ? context.phone.trim() : "";
    if (!phone) return Response.json({ ok: false, error: "No contact phone in the tool context." }, { status: 400 });

    if (tool === "link_player") {
      if (typeof input.code !== "string" || !input.code.trim()) {
        return Response.json({ ok: false, error: "Pass the SNAP-XXXXX code as code." }, { status: 400 });
      }
      return Response.json(await ctx.runMutation(internal.keiki.link, { code: input.code, phone }));
    }
    if (tool === "unlink_player") return Response.json(await ctx.runMutation(internal.keiki.unlink, { phone }));
    return new Response("Not found", { status: 404 });
  }),
});

export default http;
