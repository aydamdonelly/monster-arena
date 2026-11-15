import { useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import EggArt from '@/components/EggArt';
import MonsterView from '@/components/MonsterView';
import ShareButton from '@/components/ShareButton';
import { Appear, InkSticker, OutlineButton, Polaroid, PrimaryButton, StageBlock } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { clock, royaleTimeToday, startOfToday, useNow } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { getItem, setItem } from '@/lib/kv';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

type Summary = NonNullable<FunctionReturnType<typeof api.royale.summary>>;
type Mine = FunctionReturnType<typeof api.royale.mine> | undefined;

const GRID_MAX = 24;

function clockTime(time: number) {
  return new Date(time).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function placeLine(mine: Mine) {
  if (!mine?.entered) return null;
  if (mine.champion) return { title: 'Your monster won it all', quip: `${mine.monsterName} is today's champion.` };
  if (mine.inFinal) return { title: `You finished #${mine.finalPlace} of ${mine.finalSize}`, quip: `${mine.monsterName} went down swinging in the final.` };
  return { title: `You finished #${mine.heatPlace} of ${mine.heatSize}`, quip: `${mine.monsterName} went down swinging in heat ${(mine.heatIndex ?? 0) + 1}.` };
}

function replayRound(mine: Mine) {
  return mine?.entered && !mine.inFinal && mine.heatIndex !== null ? String(mine.heatIndex) : '-1';
}

export default function ArenaScreen() {
  const deviceId = useDeviceId();
  const [since] = useState(startOfToday);
  const summary = useQuery(api.royale.summary, {});
  const mine = useQuery(api.royale.mine, { deviceId });
  const today = summary && summary.startsAt >= since ? summary : null;
  const watchedKey = today ? `snappymon.watched.${today._id}` : null;
  const [watched, setWatched] = useState<string | null>(null);

  useEffect(() => {
    if (!watchedKey) return;
    getItem(watchedKey).then((v) => v === '1' && setWatched(watchedKey));
  }, [watchedKey]);

  const markWatched = () => {
    if (!watchedKey) return;
    setItem(watchedKey, '1');
    setWatched(watchedKey);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
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
            router.push({ pathname: '/arena/replay', params: { round: replayRound(mine) } });
          }}
          onSkip={markWatched}
        />
      ) : (
        <BeforeRoyale since={since} last={summary} mine={mine} />
      )}
    </SafeAreaView>
  );
}

function BeforeRoyale({ since, last, mine }: { since: number; last: Summary | null; mine: Mine }) {
  const deviceId = useDeviceId();
  const now = useNow();
  const left = royaleTimeToday() - now;
  const eggs = useQuery(api.monsters.listToday, { since });
  const myEntries = useQuery(api.monsters.listMine, { deviceId });
  const myEgg = myEntries?.find((m) => m.status === 'egg' && m._creationTime >= since);
  const lastLine = placeLine(mine);
  const shown = eggs?.slice(0, GRID_MAX) ?? [];

  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.titleRow}>
        <Text style={Type.display}>Royale</Text>
        <Text style={[Type.label, styles.titleSide]}>Today 5:00 PM</Text>
      </View>

      <View style={styles.countRow}>
        <View style={styles.shrink}>
          <Text style={[Type.label, styles.muted]}>{left > 0 ? 'Starts in' : 'Starting'}</Text>
          <Text style={[styles.countdown, left <= 0 && styles.countdownSoon]} numberOfLines={1}>
            {left > 0 ? clock(left) : 'Any minute'}
          </Text>
        </View>
        <View style={styles.entered}>
          <Text style={styles.enteredCount}>{eggs ? eggs.length.toLocaleString('en-US') : ' '}</Text>
          <Text style={styles.enteredLabel}>{eggs?.length === 1 ? 'egg waiting' : 'eggs waiting'}</Text>
        </View>
      </View>

      <View style={styles.grid}>
        {shown.map((e) => (
          <StageBlock key={e._id} radius={Radii.tile} style={styles.eggTile}>
            <EggArt width={46} golden={e.status === 'egg' && e.golden} />
            {e.status === 'egg' && e.photoUrl ? (
              <View style={styles.eggPhoto}>
                <Polaroid uri={e.photoUrl} size={28} rotate={8} shadow={2} />
              </View>
            ) : null}
          </StageBlock>
        ))}
        {eggs && eggs.length > GRID_MAX ? (
          <View style={[styles.eggTile, styles.moreTile]}>
            <Text style={styles.moreText}>+{(eggs.length - GRID_MAX).toLocaleString('en-US')}</Text>
          </View>
        ) : null}
      </View>
      {eggs?.length === 0 ? <Text style={[Type.muted, styles.empty]}>No eggs yet today. Be the first.</Text> : null}

      <Pressable
        accessibilityRole="button"
        onPress={() => (myEgg ? router.push({ pathname: '/egg/[id]', params: { id: myEgg._id } }) : router.navigate('/'))}
        style={styles.mineRow}>
        <StageBlock radius={18} style={styles.mineThumb}>
          {myEgg ? <EggArt width={32} golden={myEgg.status === 'egg' && myEgg.golden} /> : null}
        </StageBlock>
        <View style={styles.mineText}>
          <Text style={styles.mineName} numberOfLines={1}>
            {myEgg ? 'Your egg' : 'No egg yet'}
          </Text>
          <Text style={styles.mineSub}>{myEgg ? 'hatches and fights at 5 PM' : 'Snap something to enter'}</Text>
        </View>
        {myEgg ? <InkSticker label="You" rotate={4} /> : null}
      </Pressable>

      {last ? (
        <View style={styles.last}>
          <View style={styles.hairline} />
          <Text style={[Type.label, styles.muted, styles.lastLabel]}>Last royale · {clockTime(last.startsAt)}</Text>
          <View style={styles.lastRow}>
            <Text style={styles.lastText} numberOfLines={2}>
              {lastLine ? lastLine.title : `${last.champion?.name ?? 'Nobody'} won`}
            </Text>
            <OutlineButton small label="Watch replay" onPress={() => router.push({ pathname: '/arena/replay', params: { round: replayRound(mine) } })} />
          </View>
        </View>
      ) : null}
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
          <View style={styles.eggTilt}>
            <EggArt width={72} />
          </View>
          <EggArt width={96} />
          <View style={styles.eggTiltRight}>
            <EggArt width={72} />
          </View>
        </View>
      </Appear>
      <View style={styles.placeBlock}>
        <Text style={styles.place}>{where ? `Your egg hatched in ${where}` : 'Watch them hatch and fight'}</Text>
        <Text style={Type.muted}>{where ? 'See what came out, and how far it got.' : 'Every egg from today, one arena.'}</Text>
      </View>
      <View style={styles.resultActions}>
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
  const line = placeLine(mine);
  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
      <View style={styles.resultTop}>
        <Text style={Type.label}>Royale · today {clockTime(summary.startsAt)}</Text>
        <Text style={[Type.label, styles.muted]}>{summary.entrantCount} fought</Text>
      </View>
      <Appear style={styles.resultTitle}>
        <Text style={styles.winner} numberOfLines={1} adjustsFontSizeToFit>
          {champ?.name ?? 'Nobody'}
        </Text>
        <Text style={styles.winner}>wins.</Text>
      </Appear>
      {champ ? (
        <Appear delay={100} style={styles.resultStageLane}>
          <View style={styles.resultStage}>
            <MonsterView genome={champ.genome as Record<string, unknown>} dom={{ scrollEnabled: false, style: { flex: 1 } }} />
            <InkSticker label="Champion" fontSize={15} rotate={-7} style={styles.championTag} />
            {champ.photoUrl ? (
              <View style={styles.born}>
                <Polaroid uri={champ.photoUrl} size={50} rotate={6} caption="Born" />
              </View>
            ) : null}
          </View>
        </Appear>
      ) : null}
      {champ?.ownerName ? (
        <Text style={styles.trainer}>
          trainer <Text style={styles.trainerName}>{champ.ownerName}</Text>
        </Text>
      ) : null}
      <View style={styles.placeBlock}>
        <View style={styles.hairline} />
        <Text style={styles.place}>{line ? line.title : "You weren't in this one"}</Text>
        <Text style={Type.muted}>{line ? line.quip : 'Hatch a monster before 5 PM to enter the next royale.'}</Text>
      </View>
      <View style={styles.resultActions}>
        <PrimaryButton label="Watch the replay" onPress={() => router.push({ pathname: '/arena/replay', params: { round: '-1' } })} />
        {mine?.entered ? (
          <ShareButton
            id={mine.monsterId}
            name={mine.monsterName}
            label="Share your monster"
            variant="outline"
            style={styles.shareButton}
            labelStyle={styles.shareLabel}
          />
        ) : null}
      </View>
      <Text style={styles.next}>Next royale tomorrow, 5 PM</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.ground },
  loading: { marginTop: 80 },
  container: { paddingBottom: 28, width: '100%', maxWidth: 560, alignSelf: 'center' },
  muted: { color: Palette.muted },
  shrink: { flexShrink: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 4 },
  titleSide: { paddingBottom: 7 },
  countRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, paddingHorizontal: 24, paddingTop: 14 },
  countdown: { fontFamily: Fonts.black, fontSize: 46, lineHeight: 48, letterSpacing: -1.4, color: Palette.ink, fontVariant: ['tabular-nums'] },
  countdownSoon: { fontSize: 34 },
  entered: { alignItems: 'flex-end', paddingBottom: 6 },
  enteredCount: { fontFamily: Fonts.extrabold, fontSize: 22, lineHeight: 26, color: Palette.ink },
  enteredLabel: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 18, color: Palette.muted },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingHorizontal: 20, paddingTop: 16 },
  eggTile: { width: '30.9%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  eggPhoto: { position: 'absolute', right: 8, bottom: 8 },
  moreTile: { backgroundColor: Palette.ink, borderRadius: Radii.tile },
  moreText: { fontFamily: Fonts.extrabold, fontSize: 22, lineHeight: 26, color: Palette.ground },
  empty: { paddingHorizontal: 24, paddingTop: 8 },
  eggRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 14, paddingBottom: 26 },
  eggTilt: { transform: [{ rotate: '-10deg' }] },
  eggTiltRight: { transform: [{ rotate: '9deg' }] },
  skip: { alignSelf: 'center', paddingTop: 2 },
  skipText: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.muted, textDecorationLine: 'underline' },
  liveDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Palette.ink },
  mineRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 24, paddingTop: 22 },
  mineThumb: { width: 56, height: 56, alignItems: 'center', justifyContent: 'center' },
  mineText: { flex: 1, gap: 1 },
  mineName: { fontFamily: Fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.2, color: Palette.ink },
  mineSub: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 20, color: Palette.muted },
  last: { gap: 10, paddingHorizontal: 24, paddingTop: 20 },
  hairline: { height: 2, backgroundColor: Palette.hairline },
  lastLabel: { paddingTop: 6 },
  lastRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  lastText: { flex: 1, fontFamily: Fonts.extrabold, fontSize: 18, lineHeight: 22, letterSpacing: -0.2, color: Palette.ink },
  resultTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 24, paddingTop: 4 },
  resultTitle: { paddingHorizontal: 24, paddingTop: 10 },
  winner: { fontFamily: Fonts.black, fontSize: 54, lineHeight: 52, letterSpacing: -2.1, color: Palette.ink },
  resultStageLane: { paddingHorizontal: 20, paddingTop: 14 },
  resultStage: { height: 186, borderRadius: Radii.stage, overflow: 'hidden', backgroundColor: Palette.stage },
  championTag: { position: 'absolute', top: 16, left: 14 },
  born: { position: 'absolute', right: 12, bottom: 12 },
  trainer: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 22, color: Palette.muted, paddingHorizontal: 24, paddingTop: 12 },
  trainerName: { fontFamily: Fonts.extrabold, color: Palette.ink },
  placeBlock: { gap: 2, paddingHorizontal: 24, paddingTop: 18 },
  place: { fontFamily: Fonts.black, fontSize: 28, lineHeight: 32, letterSpacing: -0.56, color: Palette.ink, paddingTop: 14 },
  resultActions: { gap: 12, paddingHorizontal: 20, paddingTop: 18 },
  shareButton: { height: 52 },
  shareLabel: { fontSize: 17, lineHeight: 20 },
  next: { fontFamily: Fonts.medium, fontSize: 15, lineHeight: 20, color: Palette.muted, textAlign: 'center', paddingTop: 14 },
});
