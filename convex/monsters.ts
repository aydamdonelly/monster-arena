import { v } from "convex/values";
import { mutation, query, QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { playerByDevice } from "./players";

const STAT_BUDGET = 300;
const STAT_KEYS = ["hp", "atk", "def", "spd"] as const;
type Stats = Record<(typeof STAT_KEYS)[number], number>;
type Genome = {
  name?: string;
  body?: { shape?: string; color?: string };
  face?: { eyes?: string; mouth?: string };
  limbs?: { style?: string; pose?: string };
  parts?: { type?: string }[];
};

const TRAIT_WEIGHTS: Record<string, Partial<Stats>> = {
  "shape:blob": { hp: 3 },
  "shape:egg": { hp: 2, def: 1 },
  "shape:drop": { spd: 2, hp: 1 },
  "shape:cylinder": { def: 2, hp: 1 },
  "shape:box": { def: 3 },
  "shape:cactus": { atk: 2, def: 1 },
  "shape:strawberry": { spd: 1, hp: 2 },
  "eyes:big": { spd: 1 },
  "eyes:wink": { atk: 1 },
  "eyes:happy": { hp: 1 },
  "eyes:dot": { def: 1 },
  "mouth:fang": { atk: 2 },
  "mouth:open": { atk: 1 },
  "mouth:o": { def: 1 },
  "mouth:smile": { hp: 1 },
  "limbs:stick": { spd: 2 },
  "limbs:stub": { def: 1, hp: 1 },
  "part:horns": { atk: 2 },
  "part:spikes": { def: 2, atk: 1 },
  "part:wings": { spd: 3 },
  "part:tail": { spd: 1 },
  "part:antenna": { spd: 1 },
  "part:ears": { spd: 1 },
  "part:leafCrown": { hp: 1 },
  "part:flower": { hp: 1 },
  "part:steam": { atk: 1 },
  "part:seeds": { hp: 1 },
  "part:handle": { def: 1 },
  "part:coffee": { atk: 1 },
};

const ELEMENT_TRAITS: Record<string, string> = {
  "part:steam": "fire",
  "part:coffee": "fire",
  "mouth:fang": "fire",
  "shape:drop": "water",
  "shape:egg": "water",
  "shape:cactus": "leaf",
  "shape:strawberry": "leaf",
  "part:leafCrown": "leaf",
  "part:flower": "leaf",
  "part:antenna": "spark",
  "part:wings": "spark",
  "shape:box": "rock",
  "part:spikes": "rock",
};

function traitsOf(genome: Genome): string[] {
  return [
    `shape:${genome.body?.shape ?? "blob"}`,
    `eyes:${genome.face?.eyes ?? "dot"}`,
    `mouth:${genome.face?.mouth ?? "smile"}`,
    `limbs:${genome.limbs?.style ?? "stub"}`,
    ...(genome.parts ?? []).map((p) => `part:${p.type}`),
  ];
}

export function statsFromGenome(genome: Genome): Stats {
  const weights: Stats = { hp: 2, atk: 2, def: 2, spd: 2 };
  for (const trait of traitsOf(genome)) {
    const w = TRAIT_WEIGHTS[trait];
    if (!w) continue;
    for (const k of STAT_KEYS) weights[k] += w[k] ?? 0;
  }
  const total = STAT_KEYS.reduce((s, k) => s + weights[k], 0);
  const stats = Object.fromEntries(
    STAT_KEYS.map((k) => [k, Math.floor((weights[k] / total) * STAT_BUDGET)]),
  ) as Stats;
  const remainder = STAT_BUDGET - STAT_KEYS.reduce((s, k) => s + stats[k], 0);
  const order = [...STAT_KEYS].sort((a, b) => weights[b] - weights[a]);
  for (let i = 0; i < remainder; i++) stats[order[i % order.length]] += 1;
  return stats;
}

export function elementFromGenome(genome: Genome): string {
  for (const trait of traitsOf(genome)) {
    if (ELEMENT_TRAITS[trait]) return ELEMENT_TRAITS[trait];
  }
  return "normal";
}

const monsterDoc = v.object({
  _id: v.id("monsters"),
  _creationTime: v.number(),
  playerId: v.id("players"),
  genome: v.any(),
  name: v.string(),
  element: v.string(),
  stats: v.object({ hp: v.number(), atk: v.number(), def: v.number(), spd: v.number() }),
  stage: v.number(),
  photoId: v.optional(v.id("_storage")),
  thumbId: v.optional(v.id("_storage")),
  status: v.optional(v.string()),
  ready: v.optional(v.boolean()),
  golden: v.optional(v.boolean()),
  hatchedAt: v.optional(v.number()),
  attempts: v.optional(v.number()),
  genAt: v.optional(v.number()),
});

export const create = mutation({
  args: {
    deviceId: v.string(),
    genome: v.any(),
    name: v.optional(v.string()),
    photoId: v.optional(v.id("_storage")),
  },
  returns: monsterDoc,
  handler: async (ctx, args) => {
    const player = await playerByDevice(ctx, args.deviceId);
    if (!player) throw new Error("Unknown device, call players.ensure first");
    const genome = args.genome as Genome;
    const id = await ctx.db.insert("monsters", {
      playerId: player._id,
      genome: args.genome,
      name: args.name ?? genome.name ?? "Monster",
      element: elementFromGenome(genome),
      stats: statsFromGenome(genome),
      stage: 1,
      photoId: args.photoId,
    });
    await ctx.db.insert("events", { playerId: player._id, type: "monster_created", meta: { monsterId: id } });
    const monster = await ctx.db.get("monsters", id);
    return monster!;
  },
});

const monsterView = v.object({
  _id: v.id("monsters"),
  _creationTime: v.number(),
  playerId: v.id("players"),
  genome: v.any(),
  name: v.string(),
  element: v.string(),
  stats: v.object({ hp: v.number(), atk: v.number(), def: v.number(), spd: v.number() }),
  stage: v.number(),
  photoId: v.optional(v.id("_storage")),
  thumbId: v.optional(v.id("_storage")),
  photoUrl: v.union(v.string(), v.null()),
  ownerName: v.union(v.string(), v.null()),
  status: v.string(), // "egg" | "hatched" | "rejected"
  golden: v.boolean(),
  ready: v.optional(v.boolean()),
  hatchedAt: v.optional(v.number()),
  attempts: v.optional(v.number()),
  genAt: v.optional(v.number()),
});

// Monster plus Foto-URL und Trainername (Testmonster tragen ihr Foto im Genom)
// Das Foto kommt als kleines Vorschaubild, wenn es eines gibt (spart Datenvolumen).
// publicList: In Listen für alle ist das Foto eines Eis erst sichtbar, wenn die KI es geprüft hat (ready).
async function view(ctx: QueryCtx, m: Doc<"monsters">, owner?: Doc<"players"> | null, publicList = false) {
  const player = owner === undefined ? await ctx.db.get("players", m.playerId) : owner;
  const status = m.status ?? "hatched";
  const photoId = m.thumbId ?? m.photoId;
  const hidden = publicList && status !== "hatched" && !m.ready;
  const photoUrl = hidden ? null : photoId ? await ctx.storage.getUrl(photoId) : ((m.genome?.photoUrl as string | undefined) ?? null);
  const golden = m.golden ?? !!m.genome?.golden;
  // Ein Ei verrät nichts über sein Monster: kein Genom, kein Name, keine Werte
  if (status !== "hatched") {
    return { ...m, genome: null, name: "Egg", element: "unknown", stats: { hp: 0, atk: 0, def: 0, spd: 0 }, ready: undefined, photoUrl, ownerName: player?.name ?? null, status, golden };
  }
  return { ...m, photoUrl, ownerName: player?.name ?? null, status, golden };
}

export const listMine = query({
  args: { deviceId: v.string() },
  returns: v.array(monsterView),
  handler: async (ctx, args) => {
    const player = await ctx.db
      .query("players")
      .withIndex("by_deviceId", (q) => q.eq("deviceId", args.deviceId))
      .unique();
    if (!player) return [];
    const monsters = await ctx.db
      .query("monsters")
      .withIndex("by_playerId", (q) => q.eq("playerId", player._id))
      .order("desc")
      .take(200);
    return await Promise.all(monsters.map((m) => view(ctx, m, player)));
  },
});

export const listToday = query({
  args: { since: v.number(), includeTest: v.optional(v.boolean()) },
  returns: v.array(monsterView),
  handler: async (ctx, args) => {
    const monsters = await ctx.db
      .query("monsters")
      .withIndex("by_creation_time", (q) => q.gte("_creationTime", args.since))
      .order("desc")
      .take(60);
    // Nur die neuesten 30 als Kacheln. Die Gesamtzahl kommt aus eggs.waiting (Zähler), nicht aus dieser Liste.
    const out = [];
    for (const m of monsters) {
      if (out.length >= 30) break;
      const owner = await ctx.db.get("players", m.playerId);
      if (owner?.isTest && !args.includeTest) continue;
      if (m.status === "rejected") continue;
      out.push(await view(ctx, m, owner, true));
    }
    return out;
  },
});

export const get = query({
  args: { id: v.id("monsters") },
  returns: v.union(monsterView, v.null()),
  handler: async (ctx, args) => {
    const m = await ctx.db.get("monsters", args.id);
    return m ? await view(ctx, m) : null;
  },
});
