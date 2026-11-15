import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery } from 'convex/react';
import { ConvexError } from 'convex/values';
import { Image } from 'expo-image';
import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import CameraButton from '@/components/CameraButton';
import Egg from '@/components/Egg';
import EggScreen, { type Entry } from '@/components/EggScreen';
import GoldenEggSheet from '@/components/GoldenEggSheet';
import Landing from '@/components/Landing';
import MonsterSnapshots from '@/components/MonsterSnapshots';
import { Appear, HardShadow, InkSticker, OutlineButton, PrimaryButton, StageBlock } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { clock, royaleHour, royaleTimeToday, useNow } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { celebrate, tap } from '@/lib/haptics';
import { pickPhoto, toThumbJpeg, toUploadJpeg, uploadJpeg } from '@/lib/photo';
import { useSnapshots } from '@/lib/snapshots';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

const DAY_MS = 24 * 60 * 60 * 1000;

type Phase =
  | { kind: 'idle' }
  | { kind: 'egg'; photoUri: string; eggId?: string }
  | { kind: 'error'; code: string; message: string };

const ERROR_COPY: Record<string, { title: string; icon: keyof typeof Ionicons.glyphMap }> = {
  no_photo: { title: "We couldn't see a photo", icon: 'image-outline' },
  no_player: { title: 'Who goes there?', icon: 'person-outline' },
};

export default function CatchScreen() {
  const deviceId = useDeviceId();
  const navigation = useNavigation();
  const generateUploadUrl = useMutation(api.hatch.generateUploadUrl);
  const lay = useMutation(api.eggs.lay);
  const [now] = useState(() => Date.now());
  const mine = useQuery(api.monsters.listMine, { deviceId });
  const me = useQuery(api.players.me, { deviceId, now });
  const [phase, setPhase] = useState<Phase>({ kind: 'idle' });
  const [sheet, setSheet] = useState(false);
  const { golden } = useLocalSearchParams<{ golden?: string }>();
  const goldenReady = !!me && me.goldenEggs > 0;
  const goldenSettled = !!me && !goldenReady && !me.canGolden;
  const returning = golden === '1' && !goldenSettled;
  const firstVisit = phase.kind === 'idle' && mine?.length === 0;
  const atLimit = !!me && me.hatchesLeft === 0 && (me.goldenEggs === 0 || !me.canGolden);
  const fullScreen = firstVisit || phase.kind === 'egg';

  useEffect(() => {
    navigation.setOptions({ tabBarStyle: fullScreen ? { display: 'none' } : undefined } as object);
  }, [navigation, fullScreen]);

  const onCatch = async (source: 'camera' | 'library') => {
    tap();
    const photo = await pickPhoto(source).catch(() => null);
    if (!photo) return;
    setPhase({ kind: 'egg', photoUri: photo.uri });
    try {
      const jpeg = await toUploadJpeg(photo);
      // Foto und Vorschaubild gleichzeitig hochladen. Scheitert das Vorschaubild, geht es ohne weiter.
      const [storageId, thumbId] = await Promise.all([
        generateUploadUrl().then((url) => uploadJpeg(url, jpeg)),
        toThumbJpeg(photo)
          .then(async (thumb) => uploadJpeg(await generateUploadUrl(), thumb))
          .catch(() => undefined),
      ]);
      const { eggId } = await lay({
        deviceId,
        storageId: storageId as Id<'_storage'>,
        ...(thumbId ? { thumbId: thumbId as Id<'_storage'> } : {}),
      });
      celebrate();
      setPhase({ kind: 'egg', photoUri: photo.uri, eggId });
    } catch (e) {
      const data = e instanceof ConvexError ? (e.data as { code?: string; message?: string }) : null;
      if (data?.code === 'limit') {
        setPhase({ kind: 'idle' });
        setSheet(true);
        return;
      }
      setPhase({
        kind: 'error',
        code: data?.code ?? 'unknown',
        message: data?.message ?? 'Something went wrong while laying your egg. Check your connection and try again.',
      });
    }
  };

  // Zurück vom Whop-Checkout (?golden=1): warten, bis der Webhook das Ei gutschreibt. Ist es schon gelegt, Adresse aufräumen.
  useEffect(() => {
    if (golden && goldenSettled) router.setParams({ golden: undefined });
  }, [golden, goldenSettled]);

  const reset = () => setPhase({ kind: 'idle' });

  if (firstVisit) return <Landing onCatch={() => onCatch('camera')} />;

  return (
    <SafeAreaView style={styles.safe} edges={fullScreen ? ['top', 'bottom'] : ['top']}>
      {phase.kind === 'egg' ? (
        <EggScreen
          eggId={phase.eggId ?? ''}
          entry={mine?.find((m) => m._id === phase.eggId)}
          photoUri={phase.photoUri}
          layIn
          onClose={reset}
        />
      ) : (
        <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={styles.wordmark}>snappymon</Text>
          </View>

          {phase.kind === 'idle' && (!mine || !me) ? <ActivityIndicator color={Palette.ink} style={styles.loading} /> : null}
          {phase.kind === 'idle' && returning && me ? (
            <GoldenReturn
              ready={goldenReady}
              onSnap={() => {
                router.setParams({ golden: undefined });
                onCatch('camera');
              }}
            />
          ) : null}
          {phase.kind === 'idle' && !returning && mine && me && atLimit ? <Limit mine={mine} now={now} canGolden={me.canGolden} onGolden={() => setSheet(true)} /> : null}
          {phase.kind === 'idle' && !returning && mine && me && !atLimit ? (
            <Idle
              onCatch={onCatch}
              hatchesLeft={me.hatchesLeft}
              dailyLimit={me.dailyLimit}
              goldenEggs={me.goldenEggs}
              eggs={mine.filter((m) => m.status === 'egg')}
            />
          ) : null}

          {phase.kind === 'error' ? (
            <Appear style={styles.lane}>
              <HardShadow offset={5} radius={Radii.card}>
                <View style={styles.errorCard}>
                  <View style={styles.errorIcon}>
                    <Ionicons name={ERROR_COPY[phase.code]?.icon ?? 'sad-outline'} size={30} color={Palette.ink} />
                  </View>
                  <Text style={[Type.heading, styles.centerText]}>{ERROR_COPY[phase.code]?.title ?? 'Oops, no egg this time'}</Text>
                  <Text style={[Type.muted, styles.centerText]}>{phase.message}</Text>
                  <PrimaryButton label="Try another photo" onPress={reset} style={styles.errorButton} />
                </View>
              </HardShadow>
            </Appear>
          ) : null}
        </ScrollView>
      )}
      <GoldenEggSheet visible={sheet} from="home" onClose={() => setSheet(false)} />
    </SafeAreaView>
  );
}

function Idle({
  onCatch,
  hatchesLeft,
  dailyLimit,
  goldenEggs,
  eggs,
}: {
  onCatch: (source: 'camera' | 'library') => void;
  hatchesLeft: number;
  dailyLimit: number;
  goldenEggs: number;
  eggs: Entry[];
}) {
  const { height } = useWindowDimensions();
  const size = Math.min(155, Math.max(124, Math.round(height * 0.184)));
  return (
    <View style={styles.idle}>
      <Appear style={styles.lane}>
        <DropCard />
      </Appear>
      <Appear delay={120} style={styles.cameraArea}>
        <Image source={require('@/assets/images/renders/bp-cuddlebara.png')} style={styles.mascot} contentFit="contain" />
        <View>
          <CameraButton size={size} onPress={() => onCatch('camera')} />
          {goldenEggs > 0 ? <InkSticker label="Golden egg ready" rotate={6} style={styles.goldenReady} /> : null}
        </View>
        <Text style={Type.label}>{hatchesLeft === 0 && goldenEggs > 0 ? 'Your golden egg is ready. Snap it.' : 'One egg per royale. Make it count.'}</Text>
      </Appear>
      {eggs.length > 0 ? (
        <Appear delay={180} style={styles.yourEggs}>
          <Text style={[Type.label, styles.yourEggsLabel]}>Your eggs</Text>
          <View style={styles.eggTiles}>
            {eggs.slice(0, 3).map((e) => (
              <EggTile key={e._id} entry={e} />
            ))}
          </View>
        </Appear>
      ) : null}
    </View>
  );
}

function EggTile({ entry }: { entry: Entry }) {
  return (
    <Pressable accessibilityRole="button" onPress={() => router.push(`/egg/${entry._id}`)} style={styles.eggTile}>
      <Egg seed={entry._id} width={58} golden={entry.golden} rotate={-4} />
      <InkSticker label={royaleHour()} rotate={-4} fontSize={12} style={styles.tileSticker} />
      {entry.photoUrl ? (
        <View style={styles.tilePhoto}>
          <HardShadow offset={3} radius={6} rotate={8}>
            <View style={styles.tilePolaroid}>
              <Image source={{ uri: entry.photoUrl }} style={styles.tilePhotoImage} contentFit="cover" />
            </View>
          </HardShadow>
        </View>
      ) : null}
    </Pressable>
  );
}

function Limit({ mine, now, canGolden, onGolden }: { mine: Entry[]; now: number; canGolden: boolean; onGolden: () => void }) {
  const today = mine.filter((m) => m._creationTime > now - DAY_MS && m.status !== 'rejected').slice(0, 3);
  const { pending, onSnapshot, snapshot } = useSnapshots(today.flatMap((m) => (m.status === 'hatched' ? [m] : [])));
  return (
    <View style={styles.limit}>
      <MonsterSnapshots items={pending} onSnapshot={onSnapshot} dom={{ style: styles.snapshotter }} />
      <Appear style={styles.thumbs}>
        {today.map((m) => (
          <StageBlock key={m._id} radius={Radii.tile} style={styles.thumb}>
            {m.status === 'hatched' ? (
              snapshot(m._id) ? <Image source={{ uri: snapshot(m._id) }} style={styles.thumbImage} contentFit="cover" transition={200} /> : null
            ) : (
              <Egg seed={m._id} width={today.length > 1 ? 80 : 104} golden={m.golden} photoUrl={m.photoUrl} rotate={-4} />
            )}
          </StageBlock>
        ))}
        {canGolden ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Golden Egg" onPress={onGolden} style={styles.goldenSlot}>
            <Egg seed="golden-offer" width={52} golden rotate={4} />
            <InkSticker label="$1" rotate={-6} fontSize={12} style={styles.tileSticker} />
          </Pressable>
        ) : null}
      </Appear>
      <Appear delay={200} style={styles.limitCopy}>
        <Text style={styles.limitTitle}>{canGolden ? 'Your egg is in.' : 'Both eggs are in.'}</Text>
        <HatchClock />
        <Text style={Type.muted}>
          {canGolden ? 'One egg per royale. Want a second one in the fight?' : 'See you in the arena.'}
        </Text>
      </Appear>
      <Appear delay={260} style={styles.limitActions}>
        {canGolden ? <PrimaryButton
          label="Golden Egg · $1"
          icon={
            <Svg width={18} height={22} viewBox="0 0 18 22">
              <Path d="M9 1.5C5 1.5 1.5 8.5 1.5 13.2c0 4.3 3.3 7.3 7.5 7.3s7.5-3 7.5-7.3C16.5 8.5 13 1.5 9 1.5z" fill={Palette.ground} stroke={Palette.ink} strokeWidth={2.2} />
            </Svg>
          }
          onPress={onGolden}
        /> : null}
        <OutlineButton label="Watch the arena" onPress={() => router.navigate('/arena')} style={styles.arenaButton} labelStyle={styles.arenaLabel} />
      </Appear>
    </View>
  );
}

const GOLDEN_SLOW_MS = 60_000;

function GoldenReturn({ ready, onSnap }: { ready: boolean; onSnap: () => void }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), GOLDEN_SLOW_MS);
    return () => clearTimeout(t);
  }, []);
  return (
    <Appear style={styles.lane}>
      <View style={styles.goldenReturn}>
        {ready ? (
          <>
            <Image source={require('@/assets/images/renders/bp-golden-capyboogey.png')} style={styles.goldenRender} contentFit="contain" />
            <Text style={[styles.limitTitle, styles.centerText]}>Your Golden Egg is ready</Text>
            <PrimaryButton label="Snap your golden egg" onPress={onSnap} style={styles.goldenSnap} />
          </>
        ) : (
          <>
            <Egg seed="golden-offer" width={72} golden rotate={-4} />
            <ActivityIndicator color={Palette.ink} />
            <Text style={[Type.heading, styles.centerText]}>{slow ? 'Still confirming. Your egg will appear here.' : 'Confirming your payment…'}</Text>
          </>
        )}
      </View>
    </Appear>
  );
}

// Countdown bis zum Schlüpfen, groß und ohne Erklärung
function HatchClock() {
  const now = useNow();
  const left = royaleTimeToday() - now;
  return (
    <View style={styles.hatchClock}>
      <Text style={styles.hatchClockTime}>{left > 0 ? clock(left) : 'LIVE'}</Text>
      <Text style={[Type.label, styles.mutedLabel]}>{left > 0 ? `until it hatches · ${royaleHour()}` : 'in the arena now'}</Text>
    </View>
  );
}

function DropCard() {
  const now = useNow();
  const left = royaleTimeToday() - now;
  return (
    <HardShadow offset={5} radius={Radii.card}>
      <View style={styles.drop}>
        <View style={styles.dropTop}>
          <Text style={Type.label}>{"Today's drop"}</Text>
          <Text style={styles.timer}>{left > 0 ? `royale in ${clock(left)}` : 'royale live now'}</Text>
        </View>
        <Text style={styles.dropTitle}>Anything</Text>
        <Text style={styles.dropLine}>Snap it. Get an egg. It hatches at {royaleHour()}.</Text>
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  hatchClock: { flexDirection: 'row', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' },
  hatchClockTime: { fontFamily: Fonts.black, fontSize: 46, lineHeight: 50, letterSpacing: -1.6, color: Palette.ink, fontVariant: ['tabular-nums'] },
  safe: { flex: 1, backgroundColor: Palette.ground },
  container: { paddingBottom: 24, flexGrow: 1, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { paddingHorizontal: 24, paddingTop: 14 },
  wordmark: { fontFamily: Fonts.black, fontSize: 28, lineHeight: 32, letterSpacing: -1.1, color: Palette.ink },
  loading: { marginTop: 80 },
  lane: { paddingHorizontal: 20, paddingTop: 22 },
  centerText: { textAlign: 'center' },
  idle: { flexGrow: 1 },
  drop: {
    backgroundColor: Palette.primary,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.card,
    paddingTop: 16,
    paddingBottom: 18,
    paddingHorizontal: 20,
    gap: 6,
  },
  dropTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  timer: {
    fontFamily: Fonts.semibold,
    fontSize: 13,
    lineHeight: 16,
    letterSpacing: 0.52,
    color: Palette.ink,
    fontVariant: ['tabular-nums'],
  },
  dropTitle: { fontFamily: Fonts.black, fontSize: 52, lineHeight: 50, letterSpacing: -2.08, color: Palette.ink },
  dropLine: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 20, color: Palette.ink },
  cameraArea: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingHorizontal: 24,
    paddingVertical: 20,
    overflow: 'hidden',
  },
  mascot: { position: 'absolute', width: 150, height: 150, right: -46, top: 22, transform: [{ rotate: '-12deg' }] },
  goldenReady: { position: 'absolute', top: -6, right: -38 },
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
  yourEggs: { gap: 10, paddingHorizontal: 20, paddingBottom: 18 },
  yourEggsLabel: { paddingHorizontal: 4 },
  eggTiles: { flexDirection: 'row', gap: 12 },
  eggTile: { flex: 1, height: 112, borderRadius: 20, backgroundColor: Palette.stage, alignItems: 'center', justifyContent: 'center' },
  tileSticker: { position: 'absolute', top: 10, left: 10 },
  tilePhoto: { position: 'absolute', bottom: 10, right: 12 },
  tilePolaroid: { backgroundColor: Palette.ground, borderWidth: 2, borderColor: Palette.ink, borderRadius: 6, padding: 3, paddingBottom: 6 },
  tilePhotoImage: { width: 26, height: 26, borderRadius: 2 },
  moreSlot: {
    flex: 1,
    height: 112,
    borderRadius: 20,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Palette.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  limit: { flexGrow: 1 },
  goldenSlot: {
    flex: 1,
    height: 104,
    borderRadius: Radii.tile,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goldenReturn: {
    alignItems: 'center',
    gap: 14,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.card,
    paddingVertical: 24,
    paddingHorizontal: 20,
  },
  goldenRender: { width: 160, height: 160, marginVertical: -12 },
  goldenSnap: { alignSelf: 'stretch' },
  snapshotter: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  mutedLabel: { color: Palette.muted },
  thumbs: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 20 },
  thumb: { flex: 1, height: 176, alignItems: 'center', justifyContent: 'center' },
  thumbImage: { width: 112, height: 112 },
  limitEggs: { paddingHorizontal: 24, paddingTop: 16 },
  limitCopy: { gap: 8, paddingHorizontal: 24, paddingTop: 22 },
  limitTitle: { fontFamily: Fonts.black, fontSize: 42, lineHeight: 40, letterSpacing: -1.47, color: Palette.ink },
  limitActions: { gap: 12, paddingHorizontal: 20, paddingTop: 22 },
  arenaButton: { height: 52 },
  arenaLabel: { fontSize: 17, lineHeight: 20 },
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
