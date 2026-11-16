import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, StyleSheet } from 'react-native';

import { OutlineButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { useDeviceId } from '@/lib/device';
import { setRoyalePreview } from '@/lib/arena';
import { setItem } from '@/lib/kv';

const TITLE = 'Start the fight now?';
const TEXT = 'Your newest egg hatches and fights now. Only you see this fight. The real royale still runs at its normal time.';

function confirmStart(): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(window.confirm(`${TITLE}\n\n${TEXT}`));
  return new Promise((resolve) =>
    Alert.alert(TITLE, TEXT, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Start', style: 'destructive', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) }),
  );
}

function showError(message: string) {
  if (Platform.OS === 'web') window.alert(message);
  else Alert.alert("Couldn't start the fight", message);
}

export default function AdminStartButton({ onStarted }: { onStarted?: () => void }) {
  const deviceId = useDeviceId();
  const adminStart = useMutation(api.royale.adminStart);
  const [busy, setBusy] = useState(false);

  const onPress = async () => {
    if (busy || !(await confirmStart())) return;
    setBusy(true);
    try {
      const { royaleId, round } = await adminStart({ deviceId });
      await setItem(`snappymon.watched.${royaleId}`, '1');
      // Auf diesem Gerät gilt die heutige Royale ab jetzt als gelaufen (der Server merkt es sich, siehe RoyaleClock)
      setRoyalePreview(Date.now());
      onStarted?.();
      router.push({ pathname: '/arena/replay', params: { royale: royaleId, round: String(round), live: '1' } });
    } catch (e) {
      const message = e instanceof ConvexError ? (e.data as { message?: string })?.message : undefined;
      showError(message ?? 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return <OutlineButton small label={busy ? 'Starting...' : 'Admin: start fight'} onPress={onPress} disabled={busy} style={styles.button} />;
}

const styles = StyleSheet.create({
  button: { alignSelf: 'center' },
});
