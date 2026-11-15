import { useGlobalSearchParams } from 'expo-router';
import { useEffect, useSyncExternalStore } from 'react';

import { getItem, setItem } from '@/lib/kv';

const KEY = 'snappymon.test';
const listeners = new Set<() => void>();
let stored = false;

getItem(KEY).then((v) => {
  stored = v === '1';
  listeners.forEach((l) => l());
});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function setTestMode(on: boolean) {
  stored = on;
  setItem(KEY, on ? '1' : '0');
  listeners.forEach((l) => l());
}

export function useTestMode() {
  const { test } = useGlobalSearchParams<{ test?: string }>();
  const on = useSyncExternalStore(subscribe, () => stored, () => stored);

  useEffect(() => {
    if (test === '1' || test === '0') setTestMode(test === '1');
  }, [test]);

  return test === '1' || (test !== '0' && on);
}

export function testArgs(on: boolean) {
  return on ? { test: true } : {};
}
