import { Platform, Share } from 'react-native';

import { royaleHourPT } from '@/lib/arena';
import { webUrl } from '@/lib/theme';

export function monsterUrl(id: string) {
  return `${webUrl}/m/${id}`;
}

export function shareMonster(id: string, name: string) {
  return share(monsterUrl(id), `${name} · Snappymon`, `I hatched ${name} on Snappymon! Snap anything, hatch a monster.`);
}

export function shareEgg() {
  return share(webUrl, 'Snappymon', `My egg hatches at ${royaleHourPT()}, live in the Snappymon royale. Snap anything and lay yours.`);
}

async function share(url: string, title: string, text: string): Promise<'shared' | 'copied' | 'failed'> {
  if (Platform.OS !== 'web') {
    await Share.share({ message: `${text} ${url}`, url });
    return 'shared';
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title, text, url });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared';
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    return 'copied';
  } catch {
    return 'failed';
  }
}
