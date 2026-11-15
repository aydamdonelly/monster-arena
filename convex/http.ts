// HTTP-Endpunkte. /whop: Webhook von Whop (payment.succeeded) für das Goldene Ei.
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
        const amount = typeof e.data.usd_total === "number" ? e.data.usd_total : typeof e.data.total === "number" ? e.data.total : 0;
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

export default http;
