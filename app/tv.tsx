import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import ArenaView from '@/components/ArenaView';
import EggArt from '@/components/EggArt';
import { HardShadow } from '@/components/ui';
import MonsterView from '@/components/MonsterView';
import QrCode from '@/components/QrCode';
import { api } from '@/convex/_generated/api';
import { bornFrom, formatCountdown, royaleTimeToday, startOfToday, useNow } from '@/lib/arena';
import { Fonts, Palette, webUrl } from '@/lib/theme';

const HOLD_AFTER_ROUND_MS = 6000;
const TV_EGGS = 24;

function useUnit() {
  const { width, height } = useWindowDimensions();
  return Math.max(0.4, Math.min(width / 1920, height / 1080));
}

export default function TvScreen() {
  const params = useLocalSearchParams<{ key?: string; test?: string }>();
  const includeTest = params.test === '1';
  const [since] = useState(startOfToday);
  const summary = useQuery(api.royale.summary, {});

  if (summary === undefined) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Palette.ink} size="large" />
      </View>
    );
  }
  if (!summary || summary.startsAt < since) return <Lobby since={since} includeTest={includeTest} adminKey={params.key} />;
  return <Show key={summary._id} summary={summary} adminKey={params.key} includeTest={includeTest} />;
}

function Lobby({ since, includeTest, adminKey }: { since: number; includeTest: boolean; adminKey?: string }) {
  const u = useUnit();
  const now = useNow();
  const monsters = useQuery(api.monsters.listToday, { since, includeTest });
  const startsAt = royaleTimeToday();
  const left = startsAt - now;

  return (
    <View style={[styles.root, { flexDirection: 'row' }]}>
      <View style={{ width: 960 * u, paddingVertical: 72 * u, paddingLeft: 96 * u, paddingRight: 40 * u, justifyContent: 'space-between' }}>
        <View style={{ gap: 18 * u }}>
          <Text style={[styles.black, { fontSize: 40 * u, lineHeight: 44 * u, letterSpacing: -1.6 * u }]}>snappymon</Text>
          <Text style={[styles.black, { fontSize: 128 * u, lineHeight: 112 * u, letterSpacing: -5.76 * u, paddingTop: 12 * u }]}>
            SNAPPYMON{'\n'}ROYALE
          </Text>
          <Text style={[styles.extrabold, { fontSize: 44 * u, lineHeight: 50 * u, letterSpacing: -0.88 * u, paddingTop: 6 * u }]}>
            {monsters ? `${monsters.length.toLocaleString('en-US')} ${monsters.length === 1 ? 'egg' : 'eggs'} entered` : ' '}
          </Text>
        </View>
        <HardShadow offset={10 * u} radius={36 * u} style={{ alignSelf: 'flex-start' }}>
          <View style={[styles.countdownBlock, { borderWidth: 4 * u, borderRadius: 36 * u, paddingTop: 22 * u, paddingBottom: 26 * u, paddingHorizontal: 40 * u }]}>
            <Text style={[styles.caps, { fontSize: 28 * u, lineHeight: 32 * u, letterSpacing: 2.24 * u }]}>{left > 0 ? 'Starts in' : 'Today 5:00 PM'}</Text>
            <Text style={[styles.black, styles.tnum, { fontSize: (left > 0 ? (left >= 3600000 ? 150 : 190) : 96) * u, lineHeight: (left > 0 ? (left >= 3600000 ? 150 : 176) : 104) * u, letterSpacing: -7.6 * u }]}>
              {formatCountdown(left).replace('any moment now', 'Any minute')}
            </Text>
          </View>
        </HardShadow>
        <View style={{ gap: 24 * u }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 36 * u }}>
            <HardShadow offset={8 * u} radius={24 * u}>
              <View style={[styles.qr, { borderWidth: 4 * u, borderRadius: 24 * u, padding: 10 * u }]}>
                <QrCode value={webUrl} size={220 * u} color={Palette.ink} />
              </View>
            </HardShadow>
            <View style={{ gap: 4 * u, flexShrink: 1 }}>
              <Text style={[styles.semibold, { fontSize: 34 * u, lineHeight: 40 * u }]}>snap an object at</Text>
              <Text style={[styles.black, { fontSize: 66 * u, lineHeight: 66 * u, letterSpacing: -2.3 * u }]} numberOfLines={1}>
                {webUrl.replace(/^https?:\/\//, '')}
              </Text>
              <Text style={[styles.semibold, { fontSize: 34 * u, lineHeight: 40 * u }]}>to enter</Text>
            </View>
          </View>
          {adminKey ? <AdminStart adminKey={adminKey} includeTest={includeTest} u={u} /> : null}
        </View>
      </View>
      <View style={{ flex: 1, paddingVertical: 72 * u, paddingLeft: 24 * u, paddingRight: 96 * u }}>
        <View style={[styles.arena, { borderWidth: 4 * u, borderRadius: 48 * u }]}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 20 * u, padding: 28 * u }}>
            {(monsters ?? []).slice(0, TV_EGGS).map((m) => (
              <View key={m._id} style={{ width: 140 * u, height: 150 * u, alignItems: 'center', justifyContent: 'flex-end' }}>
                <EggArt width={100 * u} golden={m.status === 'egg' && m.golden} />
                {m.status === 'egg' && m.photoUrl ? (
                  <View style={{ position: 'absolute', right: 0, bottom: 0 }}>
                    <HardShadow offset={4 * u} radius={6 * u} rotate={8}>
                      <View style={[styles.qr, { borderWidth: 3 * u, borderRadius: 6 * u, padding: 4 * u }]}>
                        <Image source={{ uri: m.photoUrl }} style={{ width: 56 * u, height: 56 * u, borderRadius: 2 * u }} contentFit="cover" />
                      </View>
                    </HardShadow>
                  </View>
                ) : null}
              </View>
            ))}
            {monsters && monsters.length > TV_EGGS ? (
              <View style={[styles.more, { width: 140 * u, height: 150 * u, borderRadius: 28 * u }]}>
                <Text style={[styles.black, { color: Palette.ground, fontSize: 44 * u }]}>+{(monsters.length - TV_EGGS).toLocaleString('en-US')}</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

function AdminStart({ adminKey, includeTest, u }: { adminKey: string; includeTest: boolean; u: number }) {
  const start = useMutation(api.royale.start);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onPress = async () => {
    setBusy(true);
    setError(null);
    try {
      await start({ key: adminKey, title: 'Royale', ...(includeTest ? { includeTest } : {}) });
    } catch (e) {
      setError(e instanceof ConvexError ? String((e.data as { message?: string }).message ?? e.data) : String(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={{ gap: 8 * u, flexDirection: 'row', alignItems: 'center' }}>
      <Pressable accessibilityRole="button" onPress={onPress} disabled={busy} style={[styles.admin, { paddingHorizontal: 32 * u, paddingVertical: 16 * u }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={[styles.adminText, { fontSize: 28 * u }]}>Start royale</Text>}
      </Pressable>
      {error ? <Text style={{ color: Palette.ink, fontSize: 20 * u, fontFamily: Fonts.bold }}>{error}</Text> : null}
    </View>
  );
}

type Summary = NonNullable<FunctionReturnType<typeof api.royale.summary>>;

function Show({ summary, adminKey, includeTest }: { summary: Summary; adminKey?: string; includeTest: boolean }) {
  const [step, setStep] = useState(0);
  const [ended, setEnded] = useState(false);
  const heats = summary.heatCount;
  const isFinal = step === heats;
  const round = useQuery(api.royale.round, step > heats ? 'skip' : { index: isFinal ? -1 : step });

  useEffect(() => {
    if (!ended) return;
    const t = setTimeout(() => {
      setEnded(false);
      setStep((s) => s + 1);
    }, HOLD_AFTER_ROUND_MS);
    return () => clearTimeout(t);
  }, [ended]);

  if (step > heats) return <Champion summary={summary} adminKey={adminKey} includeTest={includeTest} onReplay={() => setStep(heats)} />;
  if (!round) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={Palette.ink} size="large" />
      </View>
    );
  }
  return (
    <View style={styles.root}>
      <ArenaView
        key={step}
        entrants={round.entrants}
        seed={round.seed}
        dayElement={round.dayElement}
        speed={isFinal ? 1 : 2}
        title={isFinal ? 'FINAL' : `HEAT ${step + 1}/${heats}`}
        controls={false}
        onEnd={async () => setEnded(true)}
        dom={{ scrollEnabled: false, style: { flex: 1 } }}
      />
    </View>
  );
}

function Champion({ summary, adminKey, includeTest, onReplay }: { summary: Summary; adminKey?: string; includeTest: boolean; onReplay: () => void }) {
  const u = useUnit();
  const champ = summary.champion;
  const born = champ ? bornFrom(champ.genome) : null;
  return (
    <View style={[styles.root, { flexDirection: 'row', alignItems: 'center', paddingVertical: 72 * u, paddingHorizontal: 96 * u, gap: 64 * u }]}>
      <View style={{ flex: 1, gap: 20 * u }}>
        <Text style={[styles.caps, { fontSize: 32 * u, lineHeight: 36 * u, letterSpacing: 2.56 * u }]}>{summary.title} · champion</Text>
        <Text style={[styles.black, { fontSize: 150 * u, lineHeight: 140 * u, letterSpacing: -6 * u }]} numberOfLines={2}>
          {champ?.name ?? 'Nobody'}
        </Text>
        {champ?.ownerName ? (
          <Text style={[styles.medium, { fontSize: 52 * u, lineHeight: 60 * u, color: Palette.muted }]}>
            trainer <Text style={styles.extrabold}>{champ.ownerName}</Text>
          </Text>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 32 * u, paddingTop: 8 * u }}>
          {champ?.photoUrl ? (
            <HardShadow offset={8 * u} radius={12 * u} rotate={-5}>
              <View style={[styles.qr, { borderWidth: 4 * u, borderRadius: 12 * u, padding: 10 * u }]}>
                <Image source={{ uri: champ.photoUrl }} style={{ width: 200 * u, height: 200 * u, borderRadius: 4 * u }} contentFit="cover" />
              </View>
            </HardShadow>
          ) : null}
          {born ? <Text style={[styles.medium, { fontSize: 40 * u, lineHeight: 48 * u, flex: 1, color: Palette.muted }]}>{born}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 24 * u, marginTop: 24 * u, alignItems: 'center' }}>
          <HardShadow offset={8 * u} radius={24 * u}>
            <Pressable accessibilityRole="button" onPress={onReplay} style={[styles.replay, { borderWidth: 4 * u, borderRadius: 24 * u, paddingHorizontal: 40 * u, paddingVertical: 20 * u }]}>
              <Text style={[styles.extrabold, { fontSize: 34 * u }]}>Replay final</Text>
            </Pressable>
          </HardShadow>
          {adminKey ? <AdminStart adminKey={adminKey} includeTest={includeTest} u={u} /> : null}
        </View>
      </View>
      {champ ? (
        <View style={{ width: 760 * u, height: 860 * u, borderRadius: 48 * u, borderWidth: 4 * u, borderColor: Palette.ink, overflow: 'hidden', backgroundColor: Palette.stage }}>
          <MonsterView genome={champ.genome as Record<string, unknown>} dom={{ scrollEnabled: false, style: { flex: 1 } }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.ground },
  center: { alignItems: 'center', justifyContent: 'center' },
  black: { fontFamily: Fonts.black, color: Palette.ink },
  extrabold: { fontFamily: Fonts.extrabold, color: Palette.ink },
  semibold: { fontFamily: Fonts.semibold, color: Palette.ink },
  medium: { fontFamily: Fonts.medium, color: Palette.ink },
  caps: { fontFamily: Fonts.semibold, color: Palette.ink, textTransform: 'uppercase' },
  tnum: { fontVariant: ['tabular-nums'] },
  countdownBlock: { backgroundColor: Palette.primary, borderColor: Palette.ink },
  qr: { backgroundColor: Palette.ground, borderColor: Palette.ink },
  arena: { flex: 1, borderColor: Palette.ink, overflow: 'hidden', backgroundColor: Palette.stage },
  more: { backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
  replay: { backgroundColor: Palette.primary, borderColor: Palette.ink },
  admin: { backgroundColor: Palette.ink, borderRadius: 999 },
  adminText: { color: Palette.ground, fontFamily: Fonts.bold },
});
