import { useMutation } from 'convex/react';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { getItem, setItem } from '@/lib/kv';
import { Palette } from '@/lib/theme';

import { getDeviceId } from './device-id';

const ONBOARDED_KEY = 'snappymon.onboarded';

type DeviceState = { deviceId: string; onboarded: boolean; finishOnboarding: () => void };

const DeviceContext = createContext<DeviceState | null>(null);

// Woher kommt dieser Besuch? Für die Zahlen (Wiederkehrer, TikTok-Anteil), ohne persönliche Daten.
function openMeta(): Record<string, string> {
  const meta: Record<string, string> = { os: Platform.OS };
  if (Platform.OS !== 'web' || typeof window === 'undefined') return meta;
  try {
    const q = new URLSearchParams(window.location.search);
    const s = q.get('s') || q.get('utm_source');
    if (s) meta.s = s.slice(0, 32);
    if (document.referrer) meta.ref = new URL(document.referrer).hostname.slice(0, 64);
    const ua = navigator.userAgent;
    meta.dev = /iPhone/i.test(ua)
      ? 'iphone'
      : /iPad/i.test(ua)
        ? 'ipad'
        : /Android/i.test(ua)
          ? 'android'
          : /Macintosh/i.test(ua)
            ? 'mac'
            : /Windows/i.test(ua)
              ? 'windows'
              : 'other';
    if (navigator.webdriver || /Headless|bot|crawler|spider/i.test(ua)) meta.wd = '1';
    meta.lang = (navigator.language || '').slice(0, 12);
    meta.tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    meta.app = /TikTok|musical_ly|Bytedance/i.test(ua)
      ? 'tiktok'
      : /Instagram/i.test(ua)
        ? 'instagram'
        : /YouTube/i.test(ua)
          ? 'youtube'
          : /FBAN|FBAV/i.test(ua)
            ? 'facebook'
            : 'browser';
  } catch {}
  return meta;
}

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ deviceId: string; onboarded: boolean } | null>(null);
  const ensure = useMutation(api.players.ensure);
  const logEvent = useMutation(api.events.log);

  useEffect(() => {
    Promise.all([getDeviceId(), getItem(ONBOARDED_KEY)]).then(async ([id, onboarded]) => {
      await ensure({ deviceId: id, source: Platform.OS }).catch(console.warn);
      logEvent({ deviceId: id, type: 'open', meta: openMeta() }).catch(() => {});
      setState({ deviceId: id, onboarded: onboarded === '1' });
    });
  }, [ensure, logEvent]);

  if (!state) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.bg }}>
        <ActivityIndicator color={Palette.ink} />
      </View>
    );
  }

  const finishOnboarding = () => {
    setItem(ONBOARDED_KEY, '1');
    setState({ ...state, onboarded: true });
  };

  return <DeviceContext.Provider value={{ ...state, finishOnboarding }}>{children}</DeviceContext.Provider>;
}

function useDevice(): DeviceState {
  const value = useContext(DeviceContext);
  if (!value) throw new Error('useDevice must be used inside DeviceProvider');
  return value;
}

export function useDeviceId(): string {
  return useDevice().deviceId;
}

export function useOnboarding() {
  const { onboarded, finishOnboarding } = useDevice();
  return { onboarded, finishOnboarding };
}
