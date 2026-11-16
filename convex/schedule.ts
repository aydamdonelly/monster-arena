// Eine Stelle für alles, was den Zeitplan der täglichen Royale bestimmt: Cron (crons.ts), Tagesgrenze (eggs.ts)
// und die Anzeige in den Apps (royale.clock). Wer die Uhrzeit ändert, ändert nur diese Zahl und rollt das Backend aus;
// Web und iPhone-App holen sich den Wert live.

// Startzeit in Minuten nach Mitternacht UTC. 18:00 Uhr Pacific (Winterzeit) = 02:00 UTC.
export const ROYALE_UTC_MIN = 120;

// Abspieltempo der Kämpfe in den Apps. Die Simulation bleibt dieselbe (gleicher Seed, gleiches Ergebnis),
// sie läuft nur schneller ab. Jede Runde bekommt das Tempo, mit dem ihr Kampf etwa FIGHT_SECONDS dauert;
// mit dem Schlüpfen davor sind das knapp 30 Sekunden statt über einer Minute.
export const FIGHT_SECONDS = 21;
export const FIGHT_SPEED = 2.5; // Ausgangswert, solange die Dauer einer Runde nicht bekannt ist

export function fightSpeed(simSeconds: number | undefined) {
  if (!simSeconds || !Number.isFinite(simSeconds)) return FIGHT_SPEED;
  return Math.round(Math.min(3.2, Math.max(1.5, simSeconds / FIGHT_SECONDS)) * 100) / 100;
}

// Thema des Tages (was man fotografieren soll) für heute und morgen. Die Apps zeigen es auf der Startseite.
export const THEME_TODAY = "Anything";
export const THEME_TOMORROW = "Something in your kitchen";

// Schlüpfen vor dem Kampf: Zeit je Ei relativ zum Grundtempo (1 = rund 0,3 s je Ei, 1,5 = etwas ruhiger)
export const HATCH_PACE = 1.5;

// Eigene Geräte des Gründers (Convex-Umgebungsvariable OWNER_DEVICES, kommagetrennt): zählen nicht in den Zahlen
// und dürfen die Royale von Hand starten (royale.adminStart).
export function isOwnerDevice(deviceId: string) {
  return (process.env.OWNER_DEVICES ?? "")
    .split(",")
    .map((x: string) => x.trim())
    .filter(Boolean)
    .includes(deviceId);
}

export function royaleCron() {
  return `${ROYALE_UTC_MIN % 60} ${Math.floor(ROYALE_UTC_MIN / 60)} * * *`;
}
