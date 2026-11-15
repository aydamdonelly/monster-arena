import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { ConvexError } from 'convex/values';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import ArenaView from '@/components/ArenaView';
import MonsterView from '@/components/MonsterView';
import QrCode from '@/components/QrCode';
import { api } from '@/convex/_generated/api';
import { bornFrom, formatCountdown, royaleTimeToday, startOfToday, useNow } from '@/lib/arena';
import { ElementColors, Palette } from '@/lib/theme';

const WEB_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://snappymon.com';
const HOLD_AFTER_ROUND_MS = 6000;

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

  return (
    <View style={[styles.root, { flexDirection: 'row', padding: 56 * u, gap: 56 * u }]}>
      <View style={{ width: 720 * u, justifyContent: 'space-between' }}>
        <View style={{ gap: 10 * u }}>
          <Text style={[styles.title, { fontSize: 92 * u, lineHeight: 96 * u }]} numberOfLines={2}>
            SNAPPYMON{'\n'}ROYALE
          </Text>
          <Text style={[styles.kicker, { fontSize: 26 * u, marginTop: 12 * u }]}>TODAY · 4:00 PM</Text>
          <Text style={[styles.countdown, { fontSize: (startsAt > now ? 112 : 64) * u }]} numberOfLines={1}>
            {formatCountdown(startsAt - now)}
          </Text>
          <Text style={[styles.big, { fontSize: 40 * u }]}>{monsters ? `${monsters.length} ${monsters.length === 1 ? 'monster' : 'monsters'} entered` : '…'}</Text>
        </View>
        <View style={{ gap: 24 * u }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28 * u }}>
            <View style={{ borderRadius: 20 * u, overflow: 'hidden' }}>
              <QrCode value={WEB_URL} size={200 * u} />
            </View>
            <Text style={[styles.big, { fontSize: 36 * u, flex: 1 }]}>snap an object at {WEB_URL.replace(/^https?:\/\//, '')} to enter</Text>
          </View>
          {adminKey ? <AdminStart adminKey={adminKey} includeTest={includeTest} u={u} /> : null}
        </View>
      </View>
      <View style={[styles.grid, { gap: 16 * u }]}>
        {(monsters ?? []).slice(0, 40).map((m) => (
          <View key={m._id} style={[styles.tile, { width: 176 * u, borderRadius: 24 * u, padding: 10 * u, gap: 8 * u }]}>
            {m.photoUrl ? (
              <Image source={{ uri: m.photoUrl }} style={{ width: '100%', aspectRatio: 1, borderRadius: 16 * u }} contentFit="cover" />
            ) : (
              <View style={[styles.placeholder, { borderRadius: 16 * u, backgroundColor: ElementColors[m.element] ?? ElementColors.normal }]}>
                <Text style={[styles.title, { fontSize: 72 * u, color: '#fff' }]}>{m.name.slice(0, 1)}</Text>
              </View>
            )}
            <Text numberOfLines={1} style={[styles.tileName, { fontSize: 22 * u }]}>{m.name}</Text>
            {m.ownerName ? <Text numberOfLines={1} style={[styles.tileOwner, { fontSize: 18 * u }]}>{m.ownerName}</Text> : null}
          </View>
        ))}
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
      {error ? <Text style={{ color: Palette.accent, fontSize: 20 * u, fontWeight: '700' }}>{error}</Text> : null}
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
    <View style={[styles.root, { backgroundColor: '#cfeaf0' }]}>
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
    <View style={[styles.root, { flexDirection: 'row', alignItems: 'center', padding: 72 * u, gap: 64 * u }]}>
      <View style={{ flex: 1, gap: 20 * u }}>
        <Text style={[styles.kicker, { fontSize: 32 * u }]}>{summary.title.toUpperCase()} · CHAMPION</Text>
        <Text style={[styles.title, { fontSize: 150 * u, lineHeight: 160 * u }]} numberOfLines={2}>
          {champ?.name ?? 'Nobody'}
        </Text>
        {champ?.ownerName ? <Text style={[styles.big, { fontSize: 52 * u }]}>trainer {champ.ownerName}</Text> : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 28 * u }}>
          {champ?.photoUrl ? (
            <Image source={{ uri: champ.photoUrl }} style={{ width: 220 * u, height: 220 * u, borderRadius: 24 * u, transform: [{ rotate: '-4deg' }] }} contentFit="cover" />
          ) : null}
          {born ? <Text style={[styles.big, { fontSize: 40 * u, flex: 1, color: Palette.muted }]}>{born}</Text> : null}
        </View>
        <View style={{ flexDirection: 'row', gap: 20 * u, marginTop: 16 * u, alignItems: 'flex-start' }}>
          <Pressable accessibilityRole="button" onPress={onReplay} style={[styles.admin, { paddingHorizontal: 36 * u, paddingVertical: 18 * u }]}>
            <Text style={[styles.adminText, { fontSize: 30 * u }]}>Replay final</Text>
          </Pressable>
          {adminKey ? <AdminStart adminKey={adminKey} includeTest={includeTest} u={u} /> : null}
        </View>
      </View>
      {champ ? (
        <View style={{ width: 760 * u, height: 860 * u, borderRadius: 40 * u, overflow: 'hidden' }}>
          <MonsterView genome={champ.genome as Record<string, unknown>} dom={{ scrollEnabled: false, style: { flex: 1 } }} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.bg },
  center: { alignItems: 'center', justifyContent: 'center' },
  title: { fontWeight: '900', color: Palette.ink, letterSpacing: 1 },
  kicker: { fontWeight: '800', letterSpacing: 3, color: Palette.muted },
  countdown: { fontWeight: '900', color: Palette.accent, fontVariant: ['tabular-nums'] },
  big: { fontWeight: '800', color: Palette.ink },
  grid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', overflow: 'hidden' },
  tile: { backgroundColor: Palette.card },
  placeholder: { width: '100%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  tileName: { fontWeight: '800', color: Palette.ink },
  tileOwner: { fontWeight: '600', color: Palette.muted },
  admin: { backgroundColor: Palette.ink, borderRadius: 999 },
  adminText: { color: '#fff', fontWeight: '800' },
});
