import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { Image } from 'expo-image';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import Egg from '@/components/Egg';
import MonsterView from '@/components/MonsterView';
import ShareButton from '@/components/ShareButton';
import { Appear, HardShadow, InkSticker, PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { clock, replayRound, royaleHour, royaleTimeToday, startOfToday, useNow } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { getItem, setItem } from '@/lib/kv';
import { testArgs, useTestMode } from '@/lib/test-mode';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

type Summary = NonNullable<FunctionReturnType<typeof api.royale.summary>>;
type Mine = FunctionReturnType<typeof api.royale.mine> | undefined;

const GRID_MAX = 24;

function clockTime(time: number) {
  return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

export default function ArenaScreen() {
  const deviceId = useDeviceId();
  const [since] = useState(startOfToday);
  const testMode = useTestMode();
  const summary = useQuery(api.royale.summary, testArgs(testMode));
  const mine = useQuery(api.royale.mine, { deviceId, ...testArgs(testMode) });
  const today = summary && summary.startsAt >= since ? summary : null;
  const watchedKey = today ? `snappymon.watched.${today._id}` : null;
  const [watched, setWatched] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!watchedKey) return;
      getItem(watchedKey).then((v) => v === '1' && setWatched(watchedKey));
    }, [watchedKey]),
  );

  const markWatched = () => {
    if (!watchedKey) return;
    setItem(watchedKey, '1');
    setWatched(watchedKey);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {testMode ? <InkSticker label="Test" light fontSize={12} rotate={-3} style={styles.testTag} /> : null}
      {summary === undefined ? (
        <ActivityIndicator color={Palette.ink} style={styles.loading} />
      ) : today && watched === watchedKey ? (
        <RoyaleResult summary={today} mine={mine} />
      ) : today ? (
        <WatchLive
          summary={today}
          mine={mine}
          onWatch={() => {
            markWatched();
            router.push({ pathname: '/arena/replay', params: { round: replayRound(mine), live: '1' } });
          }}
          onSkip={markWatched}
        />
      ) : (
        <BeforeRoyale since={since} />
      )}
    </SafeAreaView>
  );
}

function BeforeRoyale({ since }: { since: number }) {
  const deviceId = useDeviceId();
  const now = useNow();
  const left = royaleTimeToday() - now;
  const eggs = useQuery(api.monsters.listToday, { since });
  const waiting = useQuery(api.eggs.waiting, {});
  const total = Math.max(waiting ?? 0, eggs?.length ?? 0);
  const myEntries = useQuery(api.monsters.listMine, { deviceId });
  const myIds = new Set(myEntries?.map((m) => m._id));
  const shown = eggs?.slice(0, GRID_MAX) ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Royale</Text>
        <InkSticker label={`${royaleHour()} sharp`} rotate={4} />
      </View>

      <View style={styles.countLane}>
        <HardShadow offset={5} radius={Radii.card}>
          <View style={styles.countBlock}>
            <Text style={Type.label}>{left > 0 ? 'Hatching in' : 'Hatching'}</Text>
            <Text style={[styles.countdown, left <= 0 && styles.countdownSoon]} numberOfLines={1} adjustsFontSizeToFit>
              {left > 0 ? clock(left) : 'HATCHING…'}
            </Text>
          </View>
        </HardShadow>
      </View>

      <View style={styles.waiting}>
        <Text style={styles.waitingCount}>
          {eggs && waiting !== undefined ? `${total.toLocaleString('en-US')} ${total === 1 ? 'egg' : 'eggs'} waiting` : ' '}
        </Text>
        <Text style={styles.waitingSub}>{"nobody knows what's inside"}</Text>
      </View>

      <View style={styles.grid}>
        {shown.map((e) => {
          const own = myIds.has(e._id);
          return (
            <Pressable
              key={e._id}
              disabled={!own}
              onPress={() => router.push({ pathname: '/egg/[id]', params: { id: e._id } })}
              style={[styles.eggTile, own && styles.ownTile]}>
              <Egg seed={e._id} width={40} golden={e.golden} rotate={-4} />
              {e.photoUrl ? (
                <View style={[styles.eggPhoto, { transform: [{ rotate: '8deg' }] }]}>
                  <Image source={{ uri: e.photoUrl }} style={styles.eggPhotoImage} contentFit="cover" />
                </View>
              ) : null}
              {own ? <InkSticker label="You" fontSize={12} rotate={-6} style={styles.youTag} /> : null}
            </Pressable>
          );
        })}
        {eggs && total > shown.length ? (
          <View style={[styles.eggTile, styles.moreTile]}>
            <Text style={styles.moreText}>+{(total - shown.length).toLocaleString('en-US')}</Text>
          </View>
        ) : null}
      </View>
      {eggs && waiting !== undefined && total === 0 ? <Text style={[Type.muted, styles.empty]}>No eggs yet today. Be the first.</Text> : null}

      <Text style={styles.footer}>At {royaleHour()} every egg hatches and they all fight. Last monster standing wins.</Text>
    </ScrollView>
  );
}

function WatchLive({ summary, mine, onWatch, onSkip }: { summary: Summary; mine: Mine; onWatch: () => void; onSkip: () => void }) {
  const where = !mine?.entered ? null : replayRound(mine) === '-1' ? 'the final' : `heat ${(mine.heatIndex ?? 0) + 1}`;
  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.resultTop}>
        <Text style={Type.label}>Royale · today {clockTime(summary.startsAt)}</Text>
        <Text style={[Type.label, styles.muted]}>{summary.entrantCount} fought</Text>
      </View>
      <Appear style={styles.resultTitle}>
        <Text style={styles.winner}>The eggs</Text>
        <Text style={styles.winner}>hatched.</Text>
      </Appear>
      <Appear delay={100} style={styles.resultStageLane}>
        <View style={[styles.resultStage, styles.eggRow]}>
          <Egg seed="left" width={72} rotate={-10} crack="middle" />
          <Egg seed="mid" width={96} rotate={0} crack="middle" />
          <Egg seed="right" width={72} rotate={9} crack="middle" />
        </View>
      </Appear>
      {where ? (
        <View style={styles.placeBlock}>
          <Text style={styles.watchLine}>Your egg hatched in {where}</Text>
        </View>
      ) : null}
      <View style={styles.watchActions}>
        <PrimaryButton label="Watch live" icon={<View style={styles.liveDot} />} onPress={onWatch} />
        <Pressable accessibilityRole="button" onPress={onSkip} hitSlop={12} style={styles.skip}>
          <Text style={styles.skipText}>Skip to the result</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function RoyaleResult({ summary, mine }: { summary: Summary; mine: Mine }) {
  const champ = summary.champion;
  const monster = useQuery(api.monsters.get, mine?.entered ? { id: mine.monsterId } : 'skip');
  const place = !mine?.entered ? null : mine.inFinal ? `#${mine.finalPlace} of ${mine.finalSize}` : `#${mine.heatPlace} of ${mine.heatSize}`;
  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.resultTop}>
        <InkSticker label={mine?.entered ? 'Your egg hatched!' : 'The eggs hatched!'} fontSize={14} rotate={-3} />
        <Text style={[Type.label, styles.muted]}>Royale · {clockTime(summary.startsAt)}</Text>
      </View>
      {mine?.entered ? (
        <>
          <Appear style={styles.resultStageLane}>
            <View style={styles.resultStage}>
              {monster?.genome ? (
                <MonsterView genome={monster.genome as Record<string, unknown>} burst dom={{ scrollEnabled: false, style: { flex: 1 } }} />
              ) : null}
              {monster ? <InkSticker label={monster.element} light fontSize={12} rotate={4} style={styles.elementTag} /> : null}
            </View>
          </Appear>
          <Appear delay={80} style={styles.resultTitle}>
            <Text style={styles.winner} numberOfLines={1} adjustsFontSizeToFit>
              {mine.monsterName}
            </Text>
          </Appear>
          <View style={styles.placeBlock}>
            <Text style={[Type.label, styles.muted]}>{mine.champion ? 'You won it all' : 'You finished'}</Text>
            <Text style={styles.place}>{mine.champion ? '#1' : place}</Text>
          </View>
        </>
      ) : (
        <Appear style={styles.placeBlock}>
          <Text style={styles.watchLine}>{"You weren't in this one"}</Text>
          <Text style={Type.muted}>{`Snap something before ${royaleHour()} to enter the next royale.`}</Text>
        </Appear>
      )}
      <View style={styles.resultActions}>
        <PrimaryButton
          label="Watch the replay"
          onPress={() => router.push({ pathname: '/arena/replay', params: { round: replayRound(mine) } })}
          style={styles.replayButton}
        />
        {mine?.entered ? (
          <ShareButton
            id={mine.monsterId}
            name={mine.monsterName}
            label="Share"
            variant="outline"
            style={styles.shareButton}
            labelStyle={styles.shareLabel}
          />
        ) : null}
      </View>
      {champ ? (
        <View style={styles.champLane}>
          <View style={styles.hairline} />
          <View style={styles.champRow}>
            <View style={styles.champThumb}>
              {champ.photoUrl ? <Image source={{ uri: champ.photoUrl }} style={styles.champImage} contentFit="cover" /> : null}
            </View>
            <View style={styles.shrink}>
              <Text style={styles.champName} numberOfLines={1}>
                Champion: {champ.name}
              </Text>
              {champ.ownerName ? <Text style={styles.champTrainer}>by {champ.ownerName}</Text> : null}
            </View>
          </View>
        </View>
      ) : null}
      <NextRoyale />
    </ScrollView>
  );
}

function NextRoyale() {
  const left = royaleTimeToday() - useNow();
  return <Text style={styles.next}>{left > 0 ? `Next royale in ${clock(left)}` : 'Next royale starting'}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.ground },
  loading: { marginTop: 80 },
  container: { paddingBottom: 28, width: '100%', maxWidth: 560, alignSelf: 'center' },
  muted: { color: Palette.muted },
  shrink: { flexShrink: 1, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 4 },
  title: { fontFamily: Fonts.black, fontSize: 44, lineHeight: 46, letterSpacing: -1.76, color: Palette.ink },
  countLane: { paddingHorizontal: 20, paddingTop: 16 },
  countBlock: {
    backgroundColor: Palette.primary,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.card,
    paddingVertical: 14,
    paddingHorizontal: 20,
  },
  countdown: { fontFamily: Fonts.black, fontSize: 60, lineHeight: 60, letterSpacing: -2, color: Palette.ink, fontVariant: ['tabular-nums'] },
  countdownSoon: { fontSize: 46, lineHeight: 50 },
  waiting: { gap: 2, paddingHorizontal: 24, paddingTop: 20 },
  waitingCount: { fontFamily: Fonts.extrabold, fontSize: 20, lineHeight: 24, color: Palette.ink },
  waitingSub: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 20, color: Palette.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingTop: 14 },
  eggTile: {
    width: 80,
    height: 88,
    borderRadius: 16,
    backgroundColor: Palette.stage,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ownTile: { borderWidth: 2, borderColor: Palette.ink },
  eggPhoto: {
    position: 'absolute',
    right: 7,
    bottom: 7,
    backgroundColor: Palette.ground,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: 5,
    padding: 2,
    paddingBottom: 5,
  },
  eggPhotoImage: { width: 20, height: 20, borderRadius: 2 },
  youTag: { position: 'absolute', top: 6, left: 6 },
  moreTile: { backgroundColor: Palette.ink },
  moreText: { fontFamily: Fonts.extrabold, fontSize: 22, lineHeight: 26, color: Palette.ground },
  empty: { paddingHorizontal: 24, paddingTop: 8 },
  footer: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 22, color: Palette.ink, paddingHorizontal: 24, paddingTop: 20 },
  eggRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 14, paddingBottom: 26 },
  skip: { alignSelf: 'center', paddingTop: 2 },
  skipText: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.muted, textDecorationLine: 'underline' },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.ink },
  hairline: { height: 2, backgroundColor: Palette.hairline },
  testTag: { alignSelf: 'flex-start', marginLeft: 24, marginTop: 6 },
  next: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 20, color: Palette.muted, fontVariant: ['tabular-nums'], paddingHorizontal: 24, paddingTop: 22 },
  resultTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 24, paddingTop: 8 },
  resultTitle: { gap: 10, paddingHorizontal: 24, paddingTop: 14 },
  winner: { fontFamily: Fonts.black, fontSize: 44, lineHeight: 44, letterSpacing: -1.76, color: Palette.ink },
  attacks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  resultStageLane: { paddingHorizontal: 20, paddingTop: 16 },
  resultStage: { height: 204, borderRadius: Radii.stage, overflow: 'hidden', backgroundColor: Palette.stage },
  elementTag: { position: 'absolute', top: 14, right: 14 },
  placeBlock: { gap: 2, paddingHorizontal: 24, paddingTop: 16 },
  place: { fontFamily: Fonts.black, fontSize: 56, lineHeight: 54, letterSpacing: -2.24, color: Palette.ink },
  watchLine: { fontFamily: Fonts.black, fontSize: 28, lineHeight: 32, letterSpacing: -0.56, color: Palette.ink, paddingTop: 4 },
  watchActions: { gap: 14, paddingHorizontal: 20, paddingTop: 20 },
  resultActions: { flexDirection: 'row', gap: 12, paddingHorizontal: 20, paddingTop: 20 },
  replayButton: { flex: 1.9 },
  shareButton: { flex: 1, height: 56 },
  shareLabel: { fontSize: 17, lineHeight: 20 },
  champLane: { gap: 16, paddingHorizontal: 24, paddingTop: 22 },
  champRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  champThumb: { width: 48, height: 48, borderRadius: 16, overflow: 'hidden', backgroundColor: Palette.stage },
  champImage: { width: 48, height: 48 },
  champName: { fontFamily: Fonts.extrabold, fontSize: 17, lineHeight: 22, color: Palette.ink },
  champTrainer: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 20, color: Palette.muted },
});
