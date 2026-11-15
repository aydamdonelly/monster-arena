import { useSyncExternalStore } from 'react';

import { getItem, setItem } from '@/lib/kv';
import { setTestMode } from '@/lib/test-mode';

const KEY = 'snappymon.demo';
const listeners = new Set<() => void>();
let demoKey: string | null = null;

getItem(KEY).then((v) => {
  demoKey = v || null;
  listeners.forEach((l) => l());
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setDemoKey(key: string | null) {
  demoKey = key;
  setItem(KEY, key ?? '');
  setTestMode(!!key);
  listeners.forEach((l) => l());
}

export function useDemoKey() {
  return useSyncExternalStore(subscribe, () => demoKey, () => demoKey);
}
