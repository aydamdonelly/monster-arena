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
const ROYALE_UTC_HOUR = 1; // 17:00 Uhr Pacific (Winterzeit) = 01:00 UTC, wie der Cron im Backend
const GRACE_MS = 30 * 60 * 1000;

// Zeitpunkt der Royale als absoluter Moment, egal in welcher Zeitzone das Gerät steht.
// Bis 30 Minuten danach bleibt es die heutige, dann zählt der Countdown zur nächsten.
export function royaleTimeToday() {
  const now = Date.now();
  const d = new Date(now);
  d.setUTCHours(ROYALE_UTC_HOUR, 0, 0, 0);
  let t = d.getTime();
  if (now > t + GRACE_MS) t += DAY_MS;
  return t;
}

// Beginn des laufenden Royale-Tages: der Moment der vorigen Royale. Alles danach wartet auf die nächste.
export function startOfToday() {
  return royaleTimeToday() - DAY_MS;
}

// Für Besucher außerhalb der Pacific-Zeit: die Royale in ihrer Ortszeit, z. B. "8:00 PM your time"
export function royaleLocalNote() {
  const local = new Date(royaleTimeToday());
  if (local.getHours() === 17 && local.getMinutes() === 0) return null;
  return `${local.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })} your time`;
}

// "5 PM" für Geräte in Pacific-Zeit, sonst "5 PM PT", damit niemand seine eigene Ortszeit annimmt
export function royaleHour() {
  const local = new Date(royaleTimeToday());
  return local.getHours() === 17 && local.getMinutes() === 0 ? '5 PM' : '5 PM PT';
}

export function replayRound(mine: { entered: boolean; inFinal?: boolean; heatIndex?: number | null } | null | undefined) {
  return mine?.entered && !mine.inFinal && mine.heatIndex != null ? String(mine.heatIndex) : '-1';
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
  return object ? `born from ${object.toLowerCase().replace(/^an? /, 'a ')}` : null;
}
