import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import { api } from '@/convex/_generated/api';
import { royaleIsToday, royaleTimeToday, useNow } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { cancelRoyaleNotifications, syncRoyaleNotifications } from '@/lib/notifications';

export default function RoyaleNotifications() {
  const deviceId = useDeviceId();
  const mine = useQuery(api.monsters.listMine, deviceId ? { deviceId } : 'skip');
  useNow(30 * 1000);
  const royaleAt = royaleTimeToday();
  const today = royaleIsToday();
  const hasEgg = mine === undefined ? null : mine.some((m) => m.status === 'egg');

  useEffect(() => {
    if (!today) {
      cancelRoyaleNotifications().catch((e) => console.warn('cancel notifications failed', e));
      return;
    }
    if (hasEgg === null) return;
    syncRoyaleNotifications(royaleAt, hasEgg).catch((e) => console.warn('schedule notifications failed', e));
  }, [royaleAt, today, hasEgg]);

  return null;
}
