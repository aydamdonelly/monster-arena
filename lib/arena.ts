import { useEffect, useState } from 'react';

export type Entrant = {
  id: string;
  name: string;
  element: string;
  stats: { hp: number; atk: number; def: number; spd: number };
  traits?: unknown;
  moves?: unknown;
  genome: unknown;
  photoUrl?: string | null;
  ownerName?: string | null;
};

export type ArenaResult = { winnerId: string | null; placements: string[] };

const DAY_MS = 24 * 60 * 60 * 1000;
const GRACE_MS = 30 * 60 * 1000;
const PACIFIC_OFFSET_MIN = -8 * 60; // Winterzeit, wie der Cron im Backend

// Startzeit der täglichen Royale in Minuten nach Mitternacht UTC und Abspieltempo der Kämpfe.
// Beides kommt live vom Server (royale.clock, siehe components/RoyaleClock.tsx); bis die Antwort da ist, gelten diese Werte.
// 120 = 02:00 UTC = 18:00 Uhr Pacific.
let royaleUtcMin = 120;
let fightSpeed = 2;
let hatchPace = 1.5;
let themeToday = 'Anything';
let themeTomorrow = 'Something in your kitchen';

export function setRoyaleClock(c: { utcMin: number; speed: number; theme?: string; nextTheme?: string; hatchPace?: number }) {
  if (Number.isFinite(c.utcMin) && c.utcMin >= 0 && c.utcMin < 24 * 60) royaleUtcMin = c.utcMin;
  if (Number.isFinite(c.speed) && c.speed >= 0.5 && c.speed <= 4) fightSpeed = c.speed;
  if (typeof c.hatchPace === 'number' && c.hatchPace >= 0.5 && c.hatchPace <= 4) hatchPace = c.hatchPace;
  if (c.theme) themeToday = c.theme;
  if (c.nextTheme) themeTomorrow = c.nextTheme;
}

// Thema des Tages (was man fotografieren soll): heute und morgen, vom Server
export function royaleThemes() {
  return { today: themeToday, tomorrow: themeTomorrow };
}

// Schlüpfen vor dem Kampf: Zeit je Ei relativ zum Grundtempo
export function getHatchPace() {
  return hatchPace;
}

export function getFightSpeed() {
  return fightSpeed;
}

// Startzeit der letzten echten Royale (vom Server, siehe components/RoyaleClock.tsx)
let lastRoyaleAt = 0;

export function setLastRoyale(startsAt: number) {
  if (Number.isFinite(startsAt)) lastRoyaleAt = startsAt;
}

// Vorab-Kampf des Admins (Knopf "Admin: start fight"): Auf seinem Gerät gilt die heutige Royale danach als gelaufen,
// bis die echte Startzeit erreicht ist. So zeigt seine App schon "morgen", ohne dass sich für andere etwas ändert.
let previewAt = 0;

export function setRoyalePreview(at: number) {
  if (Number.isFinite(at)) previewAt = at;
}

function pacificMinutes() {
  return (((royaleUtcMin + PACIFIC_OFFSET_MIN) % 1440) + 1440) % 1440;
}

// Hat das Gerät zur Royale-Zeit dieselbe Uhrzeit wie die Pazifikküste?
function deviceIsPacific(local: Date) {
  return local.getHours() * 60 + local.getMinutes() === pacificMinutes();
}

// "6 PM" oder "6:30 PM" in Pacific-Zeit
function pacificLabel() {
  const m = pacificMinutes();
  const h = Math.floor(m / 60);
  const h12 = ((h + 11) % 12) + 1;
  const mm = m % 60;
  return `${h12}${mm ? `:${String(mm).padStart(2, '0')}` : ''} ${h < 12 ? 'AM' : 'PM'}`;
}

// Zeitpunkt der nächsten Royale als absoluter Moment, egal in welcher Zeitzone das Gerät steht.
// Sobald die heutige Royale gelaufen ist, zählt alles zur nächsten: Ein Ei, das eine Minute nach dem Kampf gelegt wird,
// schlüpft morgen. Solange sie noch nicht gestartet ist (der Start wartet kurz auf späte Eier), bleibt es bis zu 30 Minuten die heutige.
export function royaleTimeToday() {
  const now = Date.now();
  const d = new Date(now);
  d.setUTCHours(0, royaleUtcMin, 0, 0);
  let t = d.getTime();
  const previewed = previewAt > t - DAY_MS && previewAt < t && now < t;
  if (now > t + GRACE_MS || lastRoyaleAt >= t - 60 * 1000 || previewed) t += DAY_MS;
  return t;
}

// Beginn des laufenden Royale-Tages: der Moment der vorigen Royale. Alles danach wartet auf die nächste.
export function startOfToday() {
  return royaleTimeToday() - DAY_MS;
}

// Für Besucher außerhalb der Pacific-Zeit: die Royale in ihrer Ortszeit, z. B. "8:00 PM your time"
export function royaleLocalNote() {
  const local = new Date(royaleTimeToday());
  if (deviceIsPacific(local)) return null;
  return `${local.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} your time`;
}

// "6 PM" für Geräte in Pacific-Zeit, sonst "6 PM PT", damit niemand seine eigene Ortszeit annimmt
export function royaleHour() {
  return deviceIsPacific(new Date(royaleTimeToday())) ? pacificLabel() : `${pacificLabel()} PT`;
}

// Immer mit Zeitzone, für Texte, die das Gerät verlassen (Teilen)
export function royaleHourPT() {
  return `${pacificLabel()} PT`;
}

export function replayRound(mine: { entered: boolean; inFinal?: boolean; heatIndex?: number | null } | null | undefined) {
  return mine?.entered && !mine.inFinal && mine.heatIndex != null ? String(mine.heatIndex) : '-1';
}

export function royaleIsToday() {
  return royaleTimeToday() - Date.now() <= 12 * 60 * 60 * 1000;
}

export function formatCountdown(ms: number) {
  if (ms <= 0) return 'any moment now';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
}

export function clock(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function bornFrom(genome: unknown) {
  const object = (genome as { object?: string } | null)?.object;
  return object ? `born from ${object.toLowerCase()}` : null; // der Artikel (a/an) kommt schon richtig von der KI
}
