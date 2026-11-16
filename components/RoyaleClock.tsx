import { useQuery } from 'convex/react';
import { useEffect } from 'react';

import { api } from '@/convex/_generated/api';
import { setLastRoyale, setRoyaleClock } from '@/lib/arena';

// Holt Startzeit und Kampftempo der täglichen Royale live vom Server. So folgen Web und App einer Änderung
// des Zeitplans (convex/schedule.ts) ohne neues Build; die Countdown-Anzeigen rechnen jede Sekunde neu.
// Dazu die Startzeit der letzten echten Royale: Ist die heutige gelaufen, zeigt die App sofort "morgen".
export default function RoyaleClock() {
  const clock = useQuery(api.royale.clock);
  const last = useQuery(api.royale.summary, {}); // nur echte Royales, auch im Probenmodus
  useEffect(() => {
    if (clock) setRoyaleClock(clock);
  }, [clock]);
  useEffect(() => {
    if (last) setLastRoyale(last.startsAt);
  }, [last]);
  return null;
}
