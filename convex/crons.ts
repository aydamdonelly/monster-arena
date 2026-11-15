// Feste Zeiten. Die Royale läuft jeden Tag um 17:00 Uhr Pacific (01:00 UTC im Winter): Dann schlüpfen alle Eier und kämpfen.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

crons.cron("royale 5 pm pacific", "0 1 * * *", internal.royale.run, { title: "Royale" });
// Eier, deren Monster-Bau hängen geblieben ist, neu anstoßen
crons.interval("revive stuck eggs", { minutes: 3 }, internal.eggs.sweep, {});

export default crons;
