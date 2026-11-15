import { useGlobalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { getItem, setItem } from '@/lib/kv';

const KEY = 'snappymon.test';

export function useTestMode() {
  const { test } = useGlobalSearchParams<{ test?: string }>();
  const [stored, setStored] = useState(false);

  useEffect(() => {
    if (test === '1' || test === '0') {
      setItem(KEY, test);
      return;
    }
    getItem(KEY).then((v) => setStored(v === '1'));
  }, [test]);

  return test === '1' || (test !== '0' && stored);
}

export function testArgs(on: boolean) {
  return on ? { test: true } : {};
}
