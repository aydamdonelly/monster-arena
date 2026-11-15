import Ionicons from '@expo/vector-icons/Ionicons';
import { useAction, useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { Image } from 'expo-image';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';

import Confetti from '@/components/Confetti';
import Hatching from '@/components/Hatching';
import MonsterDetails, { MonsterTopBar } from '@/components/MonsterDetails';
import ShareButton from '@/components/ShareButton';
import { Appear, ElementChip, HardShadow, OutlineButton, PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { useDeviceId } from '@/lib/device';
import { celebrate, tap } from '@/lib/haptics';
import { pickPhoto, toUploadJpeg, uploadJpeg } from '@/lib/photo';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

const DAILY_HATCHES = 3;
const DAY_MS = 24 * 60 * 60 * 1000;

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
        {phase.kind === 'idle' || phase.kind === 'error' ? (
          <View style={styles.header}>
            <Text style={styles.wordmark}>snappymon</Text>
          </View>
        ) : null}

        {phase.kind === 'idle' ? <Idle onCatch={onCatch} /> : null}

        {phase.kind === 'hatching' ? (
          <Hatching photoUri={phase.photoUri} ready={!!monster} onCracked={onCracked} />
        ) : null}

        {phase.kind === 'revealed' && monster ? (
          <View>
            <MonsterTopBar label="It hatched!" />
            <View style={styles.revealed}>
              <MonsterDetails monster={monster} photoUri={phase.photoUri} />
              <Appear delay={460} style={styles.actions}>
                <ShareButton id={monster._id} name={monster.name} style={styles.share} />
                <OutlineButton label="Catch another" onPress={reset} style={styles.another} />
              </Appear>
            </View>
          </View>
        ) : null}

        {phase.kind === 'error' ? (
          <Appear style={styles.lane}>
            <HardShadow offset={5} radius={Radii.card}>
              <View style={styles.errorCard}>
                <View style={styles.errorIcon}>
                  <Ionicons name={ERROR_COPY[phase.code]?.icon ?? 'sad-outline'} size={30} color={Palette.ink} />
                </View>
                <Text style={[Type.heading, styles.centerText]}>{ERROR_COPY[phase.code]?.title ?? 'Oops, no monster this time'}</Text>
                <Text style={[Type.muted, styles.centerText]}>{phase.message}</Text>
                <PrimaryButton label={phase.code === 'limit' ? 'Got it' : 'Try another photo'} onPress={reset} style={styles.errorButton} />
              </View>
            </HardShadow>
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
      <Appear style={styles.lane}>
        <DropCard />
      </Appear>
      <Appear delay={120} style={styles.cameraArea}>
        <Image source={require('@/assets/images/duckula.png')} style={styles.mascot} contentFit="contain" />
        <CameraButton onPress={() => onCatch('camera')} />
        <View style={styles.ctaText}>
          <Text style={[Type.heading, styles.centerText]}>Snap any object.</Text>
          <Text style={[Type.muted, styles.centerText]}>It hatches in 5 seconds.</Text>
        </View>
        <HatchesLeft />
        <Pressable accessibilityRole="button" onPress={() => onCatch('library')} hitSlop={12}>
          <Text style={styles.link}>or pick from your library</Text>
        </Pressable>
      </Appear>
    </View>
  );
}

function HatchesLeft() {
  const deviceId = useDeviceId();
  const mine = useQuery(api.monsters.listMine, { deviceId });
  const [now] = useState(() => Date.now());
  if (!mine) return <View style={styles.eggs} />;
  const left = Math.max(0, DAILY_HATCHES - mine.filter((m) => m._creationTime > now - DAY_MS).length);
  return (
    <View style={styles.eggs}>
      <View style={styles.eggRow}>
        {Array.from({ length: DAILY_HATCHES }, (_, i) => (
          <View key={i} style={[styles.egg, i < left && styles.eggFull]} />
        ))}
      </View>
      <Text style={Type.label}>{left ? `${left} of ${DAILY_HATCHES} hatches left today` : 'No hatches left today'}</Text>
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
    <HardShadow offset={5} radius={Radii.card}>
      <View style={styles.drop}>
        <View style={styles.dropTop}>
          <Text style={Type.label}>{"Today's drop"}</Text>
          {remaining !== null && remaining > 0 ? <Text style={styles.timer}>ends in {formatCountdown(remaining)}</Text> : null}
        </View>
        <Text style={styles.dropTitle}>{drop === undefined ? ' ' : drop ? drop.title : 'Snap anything'}</Text>
        {drop ? (
          <View style={styles.dropBonus}>
            <ElementChip element={drop.element} />
            <Text style={styles.bonusText}>+10% in the arena</Text>
          </View>
        ) : null}
      </View>
    </HardShadow>
  );
}

function formatCountdown(ms: number) {
  const total = Math.floor(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

function CameraButton({ onPress }: { onPress: () => void }) {
  const { height } = useWindowDimensions();
  const size = Math.min(180, Math.max(136, Math.round(height * 0.213)));
  const icon = Math.round(size * 0.42);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Take a photo"
      onPress={onPress}
      style={{ width: size + 10, height: size + 10 }}>
      {({ pressed }) => (
        <>
          <View style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]} />
          <View
            style={[
              styles.camera,
              { width: size, height: size, borderRadius: size / 2 },
              pressed && { transform: [{ translateX: 5 }, { translateY: 5 }] },
            ]}>
            <Svg width={icon} height={icon} viewBox="0 0 76 76">
              <Path
                d="M10 26a6 6 0 0 1 6-6h8l4-7h20l4 7h8a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z"
                fill="none"
                stroke={Palette.ground}
                strokeWidth={5}
                strokeLinejoin="round"
              />
              <Circle cx={38} cy={40} r={11} fill="none" stroke={Palette.ground} strokeWidth={5} />
            </Svg>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.ground },
  container: { paddingBottom: 24, flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 14 },
  wordmark: { fontFamily: Fonts.black, fontSize: 28, lineHeight: 32, letterSpacing: -1.1, color: Palette.ink },
  lane: { paddingHorizontal: 20, paddingTop: 22 },
  centerText: { textAlign: 'center' },
  idle: { flexGrow: 1 },
  drop: {
    backgroundColor: Palette.primary,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.card,
    paddingTop: 18,
    paddingBottom: 22,
    paddingHorizontal: 20,
    gap: 10,
  },
  dropTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timer: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.5,
    color: Palette.ink,
    fontVariant: ['tabular-nums'],
  },
  dropTitle: { fontFamily: Fonts.black, fontSize: 46, lineHeight: 44, letterSpacing: -1.6, color: Palette.ink, paddingTop: 4 },
  dropBonus: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  bonusText: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 20, color: Palette.ink, flexShrink: 1 },
  cameraArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 20,
    paddingHorizontal: 24,
    paddingTop: 24,
    overflow: 'hidden',
  },
  mascot: { position: 'absolute', width: 150, height: 150, right: -52, top: 72, transform: [{ rotate: '-2deg' }] },
  ring: {
    position: 'absolute',
    left: 10,
    top: 10,
    backgroundColor: Palette.ground,
    borderWidth: 2,
    borderColor: Palette.ink,
  },
  camera: { backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
  ctaText: { gap: 4, alignItems: 'center' },
  eggs: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 16 },
  eggRow: { flexDirection: 'row', gap: 5 },
  egg: {
    width: 12,
    height: 15,
    borderTopLeftRadius: 6,
    borderTopRightRadius: 6,
    borderBottomLeftRadius: 7,
    borderBottomRightRadius: 7,
    borderWidth: 2,
    borderColor: Palette.ink,
  },
  eggFull: { backgroundColor: Palette.ink },
  link: {
    fontFamily: Fonts.semibold,
    fontSize: 15,
    lineHeight: 20,
    color: Palette.muted,
    textDecorationLine: 'underline',
  },
  revealed: { paddingHorizontal: 20, gap: 16 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  share: { flex: 1 },
  another: { flex: 1.3 },
  errorCard: {
    backgroundColor: Palette.ground,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.card,
    padding: 22,
    alignItems: 'center',
    gap: 12,
  },
  errorIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorButton: { alignSelf: 'stretch', marginTop: 8 },
});
