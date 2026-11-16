import * as Notifications from 'expo-notifications';

import { royaleHour } from '@/lib/arena';

const STEP_MS = 3 * 60 * 1000;
const MAX_COUNTDOWN = 40;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

let permission: Promise<boolean> | null = null;

function ensurePermission() {
  permission ??= (async () => {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  })().catch(() => false);
  return permission;
}

function schedule(date: number, body: string) {
  return Notifications.scheduleNotificationAsync({
    content: { title: 'Snappymon', body, sound: true },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date },
  });
}

export async function cancelRoyaleNotifications() {
  await Notifications.cancelAllScheduledNotificationsAsync();
}

export async function syncRoyaleNotifications(royaleAt: number, hasEgg: boolean) {
  if (!(await ensurePermission())) return;
  await cancelRoyaleNotifications();
  const now = Date.now();
  if (royaleAt <= now) return;
  const hour = royaleHour();
  const jobs: Promise<string>[] = [];
  for (let t = now + STEP_MS, n = 0; t < royaleAt && n < MAX_COUNTDOWN; t += STEP_MS, n++) {
    const min = Math.max(1, Math.round((royaleAt - t) / 60000));
    jobs.push(
      schedule(t, hasEgg ? `Your egg hatches in ${min} min. Don't miss the royale.` : `${min} min left to snap something. Every egg hatches at ${hour}.`),
    );
  }
  jobs.push(schedule(royaleAt, 'The royale is live. Your egg is hatching now.'));
  await Promise.all(jobs);
}
