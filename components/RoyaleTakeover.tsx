import { useQuery } from 'convex/react';
import { router, usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { api } from '@/convex/_generated/api';
import { replayRound, royaleTimeToday, useNow } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { getItem, setItem } from '@/lib/kv';
import { photoFlowActive } from '@/lib/photo';
import { testArgs, useTestMode } from '@/lib/test-mode';

const TAKEOVER_WINDOW_MS = 15 * 60 * 1000;

export default function RoyaleTakeover() {
  const deviceId = useDeviceId();
  const pathname = usePathname();
  const testMode = useTestMode();
  const summary = useQuery(api.royale.summary, testArgs(testMode));
  const mine = useQuery(api.royale.mine, deviceId ? { deviceId, ...testArgs(testMode) } : 'skip');
  const now = useNow(2000);
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!summary || mine === undefined || handled.current === summary._id) return;
    if (now - summary.startsAt > TAKEOVER_WINDOW_MS) return;
    if (pathname.startsWith('/tv') || pathname.startsWith('/arena/replay') || photoFlowActive()) return;
    handled.current = summary._id;
    const key = `snappymon.watched.${summary._id}`;
    getItem(key).then((v) => {
      if (v === '1') return;
      setItem(key, '1');
      router.push({ pathname: '/arena/replay', params: { round: replayRound(mine), live: '1' } });
    });
  }, [summary, mine, now, pathname]);

  return null;
}

export function useLiveRoyale() {
  const deviceId = useDeviceId();
  const testMode = useTestMode();
  const summary = useQuery(api.royale.summary, testArgs(testMode));
  const mine = useQuery(api.royale.mine, deviceId ? { deviceId, ...testArgs(testMode) } : 'skip');
  const live = !!summary && summary.startsAt >= royaleTimeToday() - 5 * 60 * 1000;
  const watch = () => {
    if (!summary) return;
    setItem(`snappymon.watched.${summary._id}`, '1');
    router.push({ pathname: '/arena/replay', params: { round: replayRound(mine), live: '1' } });
  };
  return { live, watch };
}
