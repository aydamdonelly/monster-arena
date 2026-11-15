// Feste Zeiten. Die Royale läuft einmal am Tag zur Zeit aus schedule.ts: Dann schlüpfen alle Eier und kämpfen.
import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";
import { royaleCron } from "./schedule";

const crons = cronJobs();

// kickoff wartet kurz auf Eier, die in letzter Minute gelegt wurden, und startet dann die Royale
crons.cron("daily royale", royaleCron(), internal.royale.kickoff, { title: "Royale" });
// Eier, deren Monster-Bau hängen geblieben ist, neu anstoßen
crons.interval("revive stuck eggs", { minutes: 3 }, internal.eggs.sweep, {});

export default crons;
