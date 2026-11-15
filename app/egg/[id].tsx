import { useQuery } from 'convex/react';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';

import EggScreen from '@/components/EggScreen';
import { api } from '@/convex/_generated/api';
import { useDeviceId } from '@/lib/device';
import { Palette } from '@/lib/theme';

export default function EggRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const deviceId = useDeviceId();
  const mine = useQuery(api.monsters.listMine, { deviceId });
  const close = () => (router.canGoBack() ? router.back() : router.replace('/collection'));
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: Palette.ground }} edges={['top', 'bottom']}>
      <EggScreen eggId={id} entry={mine?.find((m) => m._id === id)} onClose={close} />
    </SafeAreaView>
  );
}
