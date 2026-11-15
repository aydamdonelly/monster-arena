import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useGlobalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Alert, Platform, StyleSheet, Text } from 'react-native';

import { PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { setDemoKey, useDemoKey } from '@/lib/demo';
import { useDeviceId } from '@/lib/device';
import { Fonts, Palette } from '@/lib/theme';

function errorMessage(e: unknown) {
  const data = e instanceof ConvexError ? (e.data as { code?: string; message?: string }) : null;
  return { code: data?.code, message: data?.message ?? 'Something went wrong. Try again.' };
}

function notify(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert(message);
}

function readRequestedKey(param: string | undefined) {
  if (Platform.OS !== 'web') return param ?? null;
  const match = window.location.hash.match(/^#demo=(.*)$/);
  if (!match) return null;
  window.history.replaceState(null, '', window.location.pathname + window.location.search);
  return decodeURIComponent(match[1]);
}

export function DemoEntry() {
  const deviceId = useDeviceId();
  const { demo } = useGlobalSearchParams<{ demo?: string }>();
  const enter = useMutation(api.royale.demoEnter);
  const requested = useRef<string | null>(null);

  useEffect(() => {
    const key = readRequestedKey(demo);
    if (key) requested.current = key;
  }, [demo]);

  useEffect(() => {
    const key = requested.current;
    if (!key || !deviceId) return;
    requested.current = null;
    if (key === 'off') {
      setDemoKey(null);
      return;
    }
    let cancelled = false;
    const attempt = async (tries: number) => {
      try {
        await enter({ key, deviceId });
        if (!cancelled) setDemoKey(key);
      } catch (e) {
        const { code, message } = errorMessage(e);
        if (code === 'no_player' && tries > 0 && !cancelled) {
          setTimeout(() => attempt(tries - 1), 1500);
          return;
        }
        notify(message);
      }
    };
    attempt(5);
    return () => {
      cancelled = true;
    };
  }, [deviceId, demo, enter]);

  return null;
}

export function HatchNowButton() {
  const key = useDemoKey();
  const deviceId = useDeviceId();
  const demo = useMutation(api.royale.demo);
  const [building, setBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const press = async () => {
    if (!key) return;
    setBuilding(true);
    setError(null);
    const giveUpAt = Date.now() + 90 * 1000;
    try {
      while (true) {
        const res = await demo({ key, deviceId });
        if (res.started) return;
        if (res.reason !== 'building') {
          setError(`The arena could not start (${res.reason}). Try again.`);
          return;
        }
        if (Date.now() > giveUpAt) {
          setError('Your monster is still building. Try again in a moment.');
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    } catch (e) {
      setError(errorMessage(e).message);
    } finally {
      setBuilding(false);
    }
  };

  return (
    <>
      <PrimaryButton label={building ? 'Building your monster…' : 'Hatch now'} onPress={press} disabled={building} />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const styles = StyleSheet.create({
  error: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.ink, textAlign: 'center' },
});
