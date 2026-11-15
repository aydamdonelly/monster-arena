import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import { api } from '@/convex/_generated/api';
import { setRoyaleClock } from '@/lib/arena';

// Holt Startzeit und Kampftempo der täglichen Royale live vom Server. So folgen Web und App einer Änderung
// des Zeitplans (convex/schedule.ts) ohne neues Build; die Countdown-Anzeigen rechnen jede Sekunde neu.
export default function RoyaleClock() {
  const clock = useQuery(api.royale.clock);
  useEffect(() => {
    if (clock) setRoyaleClock(clock);
  }, [clock]);
  return null;
}
