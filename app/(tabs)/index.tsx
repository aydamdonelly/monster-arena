import Ionicons from '@expo/vector-icons/Ionicons';
import { useAction, useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useCallback, useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Confetti from '@/components/Confetti';
import Hatching from '@/components/Hatching';
import MonsterDetails from '@/components/MonsterDetails';
import ShareButton from '@/components/ShareButton';
import { ElementTag } from '@/components/StatBar';
import { Appear, Button, Card, SectionLabel } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useDeviceId } from '@/lib/device';
import { celebrate, tap } from '@/lib/haptics';
import { pickPhoto, toUploadJpeg, uploadJpeg } from '@/lib/photo';
import { Fonts, Palette } from '@/lib/theme';

type Phase =
  | { kind: 'idle' }
  | { kind: 'hatching'; photoUri: string; monsterId?: Id<'monsters'> }
  | { kind: 'revealed'; photoUri: string; monsterId: Id<'monsters'> }
  | { kind: 'error'; code: string; message: string };

const ERROR_COPY: Record<string, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  limit: { title: 'No eggs left today', icon: 'hourglass-outline' },
  unsafe: { title: "Let's try another photo", icon: 'eye-off-outline' },
  ai: { title: 'The egg got stuck', icon: 'construct-outline' },
  no_photo: { title: "We couldn't see a photo", icon: 'image-outline' },
  no_player: { title: 'Who goes there?', icon: 'person-outline' },
};

export default function CatchScreen() {
  const deviceId = useDeviceId();
  const generateUploadUrl = useMutation(api.hatch.generateUploadUrl);
  const hatch = useAction(api.hatch.hatch);
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const monsterId = phase.kind === 'hatching' || phase.kind === 'revealed' ? phase.monsterId : undefined;
  const monster = useQuery(api.monsters.get, monsterId ? { id: monsterId } : 'skip');

  const onCatch = async (source: 'camera' | 'library') => {
    tap();
    const photo = await pickPhoto(source).catch(() => null);
    if (!photo) return;
    setPhase({ kind: 'hatching', photoUri: photo.uri });
    try {
      const jpeg = await toUploadJpeg(photo);
      const storageId = await uploadJpeg(await generateUploadUrl(), jpeg);
      const result = await hatch({ deviceId, storageId: storageId as Id<'_storage'> });
      setPhase({ kind: 'hatching', photoUri: photo.uri, monsterId: result.monsterId });
    } catch (e) {
      const data = e instanceof ConvexError ? (e.data as { code?: string; message?: string }) : null;
      setPhase({
        kind: 'error',
        code: data?.code ?? 'unknown',
        message: data?.message ?? 'Something went wrong while hatching. Check your connection and try again.',
      });
    }
  };

  const onCracked = useCallback(() => {
    celebrate();
    setPhase((p) => (p.kind === 'hatching' && p.monsterId ? { kind: 'revealed', photoUri: p.photoUri, monsterId: p.monsterId } : p));
  }, []);

  const reset = () => setPhase({ kind: 'idle' });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.wordmark}>Snappymon</Text>
        </View>

        {phase.kind === 'idle' ? <Idle onCatch={onCatch} /> : null}

        {phase.kind === 'hatching' ? (
          <Hatching photoUri={phase.photoUri} ready={!!monster} onCracked={onCracked} />
        ) : null}

        {phase.kind === 'revealed' && monster ? (
          <View style={styles.revealed}>
            <Appear>
              <Text style={styles.kicker}>It hatched!</Text>
            </Appear>
            <MonsterDetails monster={monster} photoUri={phase.photoUri} />
            <Appear delay={460} style={styles.actions}>
              <ShareButton id={monster._id} name={monster.name} style={styles.flex} />
              <Button label="Catch another" icon="camera" variant="secondary" onPress={reset} style={styles.flex} />
            </Appear>
          </View>
        ) : null}

        {phase.kind === 'error' ? (
          <Appear>
            <Card style={styles.errorCard}>
              <View style={styles.errorIcon}>
                <Ionicons name={ERROR_COPY[phase.code]?.icon ?? 'sad-outline'} size={34} color={Palette.ink} />
              </View>
              <Text style={styles.errorTitle}>{ERROR_COPY[phase.code]?.title ?? 'Oops, no monster this time'}</Text>
              <Text style={styles.errorMessage}>{phase.message}</Text>
              <Button
                label={phase.code === 'limit' ? 'Got it' : 'Try another photo'}
                icon={phase.code === 'limit' ? undefined : 'camera'}
                onPress={reset}
                style={styles.errorButton}
              />
            </Card>
          </Appear>
        ) : null}
      </ScrollView>
      {phase.kind === 'revealed' ? <Confetti key={phase.monsterId} /> : null}
    </SafeAreaView>
  );
}

function Idle({ onCatch }: { onCatch: (source: 'camera' | 'library') => void }) {
  return (
    <View style={styles.idle}>
      <Appear>
        <DropCard />
      </Appear>
      <Appear delay={120} style={styles.cameraWrap}>
        <CameraButton onPress={() => onCatch('camera')} />
        <Text style={styles.cta}>Snap anything</Text>
        <Text style={styles.hint}>A mug, your cat, a sandwich. Every photo hatches a one-of-a-kind monster.</Text>
        <Pressable accessibilityRole="button" onPress={() => onCatch('library')} hitSlop={12}>
          <Text style={styles.link}>or choose from library</Text>
        </Pressable>
      </Appear>
    </View>
  );
}

function DropCard() {
  const [now, setNow] = useState(() => Date.now());
  const [queryNow, setQueryNow] = useState(now);
  const drop = useQuery(api.drops.current, { now: queryNow });

  const endsAt = drop?.endsAt;
  useEffect(() => {
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (endsAt !== undefined && t >= endsAt) setQueryNow(t);
    }, 1000);
    return () => clearInterval(timer);
  }, [endsAt]);

  const remaining = drop ? drop.endsAt - now : null;

  return (
    <Card style={styles.drop}>
      <View style={styles.dropTop}>
        <SectionLabel>{"Today's drop"}</SectionLabel>
        {remaining !== null && remaining > 0 ? (
          <View style={styles.timer}>
            <Ionicons name="time-outline" size={13} color={Palette.ink} />
            <Text style={styles.timerText}>{formatCountdown(remaining)}</Text>
          </View>
        ) : null}
      </View>
      <Text style={styles.dropTitle}>{drop === undefined ? ' ' : drop ? drop.title : 'Today: snap anything'}</Text>
      {drop ? <ElementTag element={drop.element} /> : null}
    </Card>
  );
}

function formatCountdown(ms: number) {
  const total = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function CameraButton({ onPress }: { onPress: () => void }) {
  const { height } = useWindowDimensions();
  const size = Math.min(184, Math.max(132, Math.round(height * 0.22)));
  const pulse = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);
  return (
    <View style={[styles.cameraOuter, { width: size + 16, height: size + 16 }]}>
      <Animated.View
        style={[
          styles.ring,
          { width: size + 16, height: size + 16 },
          {
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.5, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.35] }) }],
          },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Take a photo"
        onPress={onPress}
        style={({ pressed }) => [styles.camera, { width: size, height: size }, pressed && { transform: [{ scale: 0.93 }] }]}>
        <View style={styles.cameraInner}>
          <Ionicons name="camera" size={Math.round(size * 0.35)} color="#fff" />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.bg },
  container: { padding: 20, paddingBottom: 40, gap: 18, flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { alignItems: 'center', paddingTop: 4 },
  wordmark: { fontFamily: Fonts.black, fontSize: 26, color: Palette.ink, letterSpacing: -0.5 },
  idle: { gap: 20, flexGrow: 1 },
  drop: { gap: 10 },
  dropTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  timer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Palette.sun,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  timerText: { fontFamily: Fonts.black, fontSize: 13, color: Palette.ink, fontVariant: ['tabular-nums'] },
  dropTitle: { fontFamily: Fonts.black, fontSize: 26, lineHeight: 31, color: Palette.ink },
  cameraWrap: { alignItems: 'center', gap: 12, flexGrow: 1, justifyContent: 'center', paddingVertical: 12 },
  cameraOuter: { alignItems: 'center', justifyContent: 'center', marginBottom: 8 },
  ring: { position: 'absolute', borderRadius: 999, backgroundColor: Palette.ink },
  camera: {
    borderRadius: 999,
    backgroundColor: '#fff',
    padding: 10,
    shadowColor: Palette.ink,
    shadowOpacity: 0.18,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 6,
  },
  cameraInner: { flex: 1, borderRadius: 999, backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
  cta: { fontFamily: Fonts.black, fontSize: 30, color: Palette.ink },
  hint: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22, color: Palette.muted, textAlign: 'center', maxWidth: 300 },
  link: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.ink, textDecorationLine: 'underline', paddingVertical: 6 },
  revealed: { gap: 14 },
  kicker: { fontFamily: Fonts.black, fontSize: 14, letterSpacing: 1.4, color: Palette.accent, textTransform: 'uppercase', textAlign: 'center' },
  actions: { gap: 10, marginTop: 6 },
  flex: { alignSelf: 'stretch' },
  errorCard: { alignItems: 'center', gap: 12, paddingVertical: 28, marginTop: 24 },
  errorIcon: { width: 72, height: 72, borderRadius: 36, backgroundColor: Palette.bg, alignItems: 'center', justifyContent: 'center' },
  errorTitle: { fontFamily: Fonts.black, fontSize: 24, color: Palette.ink, textAlign: 'center' },
  errorMessage: { fontFamily: Fonts.regular, fontSize: 16, lineHeight: 22, color: Palette.muted, textAlign: 'center' },
  errorButton: { alignSelf: 'stretch', marginTop: 8 },
});
