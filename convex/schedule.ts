// Eine Stelle für alles, was den Zeitplan der täglichen Royale bestimmt: Cron (crons.ts), Tagesgrenze (eggs.ts)
// und die Anzeige in den Apps (royale.clock). Wer die Uhrzeit ändert, ändert nur diese Zahl und rollt das Backend aus;
// Web und iPhone-App holen sich den Wert live.

// Startzeit in Minuten nach Mitternacht UTC. 18:00 Uhr Pacific (Winterzeit) = 02:00 UTC.
export const ROYALE_UTC_MIN = 120;

// Abspieltempo der Kämpfe in den Apps. Die Simulation bleibt dieselbe (gleicher Seed, gleiches Ergebnis),
// sie läuft nur schneller ab: Ein Kampf dauert so 20 bis 30 Sekunden statt einer Minute.
export const FIGHT_SPEED = 2;

export function royaleCron() {
  return `${ROYALE_UTC_MIN % 60} ${Math.floor(ROYALE_UTC_MIN / 60)} * * *`;
}
