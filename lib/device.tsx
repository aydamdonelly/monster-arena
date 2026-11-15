import { useMutation } from 'convex/react';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { Palette } from '@/lib/theme';

import { getDeviceId } from './device-id';

const DeviceContext = createContext<string | null>(null);

export function DeviceProvider({ children }: { children: ReactNode }) {
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const ensure = useMutation(api.players.ensure);

  useEffect(() => {
    getDeviceId().then(async (id) => {
      await ensure({ deviceId: id, source: Platform.OS }).catch(console.warn);
      setDeviceId(id);
    });
  }, [ensure]);

  if (!deviceId) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Palette.bg }}>
        <ActivityIndicator color={Palette.ink} />
      </View>
    );
  }
  return <DeviceContext.Provider value={deviceId}>{children}</DeviceContext.Provider>;
}

export function useDeviceId(): string {
  const id = useContext(DeviceContext);
  if (!id) throw new Error('useDeviceId must be used inside DeviceProvider');
  return id;
}
