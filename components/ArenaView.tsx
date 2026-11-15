'use dom';

import { useEffect, useEffectEvent, useRef } from 'react';

import { createArena } from '../monster-kit/arena.js';

type Entrant = {
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

type Props = {
  entrants: Entrant[];
  seed: number;
  dayElement?: string | null;
  camera?: 'auto' | 'tilt' | 'top' | 'follow';
  followId?: string | null;
  speed?: number;
  bottom?: number;
  intro?: number;
  title?: string;
  controls?: boolean;
  onEnd?: (result: { winnerId: string | null; placements: string[] }) => Promise<void>;
  dom?: import('expo/dom').DOMProps;
};

type Arena = ReturnType<typeof createArena>;

export default function ArenaView({ entrants, seed, dayElement, camera = 'auto', followId, speed = 1, bottom = 0, intro = 3, title, controls = true, onEnd }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const arena = useRef<Arena | null>(null);
  const entrantsKey = JSON.stringify(entrants);

  const handleEnd = useEffectEvent((r: { winnerId?: string | null; placements: string[] }) => {
    onEnd?.({ winnerId: r.winnerId ?? null, placements: r.placements });
  });
  const mount = useEffectEvent((host: HTMLDivElement) =>
    createArena(host, {
      entrants: JSON.parse(entrantsKey),
      seed,
      dayElement: dayElement ?? undefined,
      camera,
      followId: followId ?? null,
      speed,
      bottom,
      intro,
      title,
      controls,
      onEnd: handleEnd,
    }),
  );

  useEffect(() => {
    const host = ref.current;
    if (!host) return;
    try {
      const a = mount(host);
      arena.current = a;
      return () => {
        arena.current = null;
        a.dispose();
      };
    } catch (e) {
      host.textContent = String(e);
    }
  }, [entrantsKey, seed, dayElement, intro, title, controls]);

  useEffect(() => arena.current?.setCamera(camera), [camera]);
  useEffect(() => arena.current?.setFollow(followId ?? null), [followId]);
  useEffect(() => arena.current?.setSpeed(speed), [speed]);
  useEffect(() => arena.current?.setBottom(bottom), [bottom]);

  const inWebView = typeof window !== 'undefined' && 'ReactNativeWebView' in window;

  return (
    <>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&display=swap" precedence="default" />
      {inWebView ? <style>{'html, body, #root, body > div { margin: 0; height: 100%; background: #cfeaf0; overflow: hidden; }'}</style> : null}
      <div ref={ref} style={{ position: 'relative', width: '100%', height: '100%', minHeight: 200, background: '#cfeaf0', font: '12px sans-serif' }} />
    </>
  );
}
