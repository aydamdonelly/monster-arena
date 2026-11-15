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

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<{ deviceId: string; onboarded: boolean } | null>(null);
  const ensure = useMutation(api.players.ensure);

  useEffect(() => {
    Promise.all([getDeviceId(), getItem(ONBOARDED_KEY)]).then(async ([id, onboarded]) => {
      await ensure({ deviceId: id, source: Platform.OS }).catch(console.warn);
      setState({ deviceId: id, onboarded: onboarded === '1' });
    });
  }, [ensure]);

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
