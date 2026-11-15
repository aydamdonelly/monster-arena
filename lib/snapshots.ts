import { useMemo, useState } from 'react';

const cache = new Map<string, string>();

export function useSnapshots(monsters: { _id: string; genome: unknown }[] | undefined) {
  const [, setVersion] = useState(0);
  const pending = useMemo(
    () => (monsters ?? []).filter((m) => !cache.has(m._id)).map((m) => ({ id: m._id, genome: m.genome as Record<string, unknown> })),
    [monsters],
  );
  const onSnapshot = async (id: string, uri: string) => {
    cache.set(id, uri);
    setVersion((v) => v + 1);
  };
  return { pending, onSnapshot, snapshot: (id: string) => cache.get(id) };
}
