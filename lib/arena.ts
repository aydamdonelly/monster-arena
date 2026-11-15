import { useEffect, useState } from 'react';

import type { Doc } from '@/convex/_generated/dataModel';
import { statsFromTraits } from '@/monster-kit/battle.js';
import { randomGenome } from '@/monster-kit/monster.js';

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

type MonsterRow = Doc<'monsters'> & { photoUrl: string | null; ownerName: string | null };

const ELEMENTS = ['fire', 'water', 'plant', 'metal', 'fluff', 'spirit'];

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export function royaleTimeToday() {
  const d = new Date();
  d.setHours(16, 0, 0, 0);
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

export function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

export function toEntrant(m: MonsterRow): Entrant {
  const g = (m.genome ?? {}) as { traits?: unknown; moves?: unknown };
  return {
    id: m._id,
    name: m.name,
    element: m.element,
    stats: m.stats,
    traits: g.traits,
    moves: g.moves,
    genome: m.genome,
    photoUrl: m.photoUrl,
    ownerName: m.ownerName,
  };
}

export function bornFrom(genome: unknown) {
  const object = (genome as { object?: string } | null)?.object;
  return object ? `born from ${object.toLowerCase().replace(/^an? /, 'a ')}` : null;
}

export function practiceEntrants(mine: MonsterRow | undefined, today: MonsterRow[]): Entrant[] {
  const others = today.filter((m) => m._id !== mine?._id);
  for (let i = others.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [others[i], others[j]] = [others[j], others[i]];
  }
  const entrants = [...(mine ? [mine] : []), ...others.slice(0, 11)].map(toEntrant);
  while (entrants.length < 4) {
    const seed = Math.floor(Math.random() * 1_000_000_000);
    const genome = randomGenome(seed);
    entrants.push({
      id: `practice-${seed}`,
      name: genome.name,
      element: ELEMENTS[seed % ELEMENTS.length],
      stats: statsFromTraits({}),
      genome,
    });
  }
  return entrants;
}
