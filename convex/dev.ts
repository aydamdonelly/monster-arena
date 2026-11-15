// Nur für Tests: Testmonster aus monster-kit/test-genomes.json anlegen (Spieler mit isTest = true, zählen nirgends mit).
// npx convex run dev:seedTest "$(node -e "const r=require('./monster-kit/test-genomes.json');console.log(JSON.stringify({rows:r.map(({title,image,genome})=>({title,image,genome}))}))")"
import { v } from "convex/values";
import { internalMutation } from "./_generated/server";
import { genomeFromAI } from "../monster-kit/genome-spec.js";
import { statsFromTraits } from "../monster-kit/battle.js";

export const seedTest = internalMutation({
  args: { rows: v.array(v.object({ title: v.string(), image: v.string(), genome: v.any() })) },
  returns: v.number(),
  handler: async (ctx, { rows }) => {
    let n = 0;
    for (const [i, r] of rows.entries()) {
      const deviceId = `test-${r.title}`;
      const existing = await ctx.db
        .query("players")
        .withIndex("by_deviceId", (q) => q.eq("deviceId", deviceId))
        .unique();
      const playerId =
        existing?._id ??
        (await ctx.db.insert("players", { deviceId, name: `Test ${r.title.replace(/_/g, " ")}`, source: "seed", isTest: true }));
      const genome = { ...genomeFromAI(r.genome, 5000 + i), photoUrl: r.image };
      await ctx.db.insert("monsters", {
        playerId,
        genome,
        name: genome.name,
        element: genome.element,
        stats: statsFromTraits(genome.traits),
        stage: 1,
      });
      n++;
    }
    return n;
  },
});
