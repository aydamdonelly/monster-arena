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

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function royaleTimeToday() {
  const d = new Date();
  d.setHours(17, 0, 0, 0);
  if (Date.now() > d.getTime() + 30 * 60 * 1000) d.setDate(d.getDate() + 1);
  return d.getTime();
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
