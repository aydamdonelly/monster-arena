import { Platform, Share } from 'react-native';

import { webUrl } from '@/lib/theme';

export function monsterUrl(id: string) {
  return `${webUrl}/m/${id}`;
}

export async function shareMonster(id: string, name: string): Promise<'shared' | 'copied' | 'failed'> {
  const url = monsterUrl(id);
  const text = `I hatched ${name} on Snappymon! Snap anything, hatch a monster.`;
  if (Platform.OS !== 'web') {
    await Share.share({ message: `${text} ${url}`, url });
    return 'shared';
  }
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share({ title: `${name} · Snappymon`, text, url });
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
