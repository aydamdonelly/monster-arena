import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import MonsterView from '@/components/MonsterView';
import { ElementTag } from '@/components/StatBar';
import { api } from '@/convex/_generated/api';
import { bornFrom, formatCountdown, royaleTimeToday, startOfToday, useNow } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { Fonts, Palette } from '@/lib/theme';

export default function ArenaScreen() {
  const deviceId = useDeviceId();
  const [since] = useState(startOfToday);
  const now = useNow();
  const monsters = useQuery(api.monsters.listToday, { since });
  const summary = useQuery(api.royale.summary, {});
  const mine = useQuery(api.royale.mine, { deviceId });
  const startsAt = royaleTimeToday();

  const myLine = !mine
    ? null
    : !mine.entered
      ? "You weren't in this royale."
      : mine.champion
        ? 'Your monster is the champion!'
        : mine.inFinal
          ? `You made the final: #${mine.finalPlace} of ${mine.finalSize}`
          : `You finished #${mine.heatPlace} of ${mine.heatSize} in heat ${(mine.heatIndex ?? 0) + 1}`;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.next}>
        <Text style={styles.kicker}>NEXT ROYALE · 4:00 PM</Text>
        <Text style={[styles.countdown, startsAt <= now && { fontSize: 30 }]}>{formatCountdown(startsAt - now)}</Text>
        <Text style={styles.entered}>{monsters ? `${monsters.length} ${monsters.length === 1 ? 'monster' : 'monsters'} entered` : '…'}</Text>
      </View>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Practice arena"
        onPress={() => router.push('/arena/practice')}
        style={({ pressed }) => [styles.practice, pressed && { transform: [{ scale: 0.97 }] }]}>
        <Text style={styles.practiceTitle}>Practice arena</Text>
        <Text style={styles.practiceSub}>{"Your newest monster vs. today's crowd · does not count"}</Text>
      </Pressable>

      {summary ? (
        <View style={styles.card}>
          <Text style={styles.kicker}>{summary.title.toUpperCase()} · CHAMPION</Text>
          {summary.champion ? (
            <>
              <View style={styles.stage}>
                <MonsterView genome={summary.champion.genome as Record<string, unknown>} dom={{ scrollEnabled: false, style: { flex: 1 } }} />
              </View>
              <View style={styles.champRow}>
                <View style={styles.champInfo}>
                  <View style={styles.nameRow}>
                    <Text style={styles.champName}>{summary.champion.name}</Text>
                    <ElementTag element={summary.champion.element} />
                  </View>
                  {summary.champion.ownerName ? <Text style={styles.meta}>trainer {summary.champion.ownerName}</Text> : null}
                  {bornFrom(summary.champion.genome) ? <Text style={styles.meta}>{bornFrom(summary.champion.genome)}</Text> : null}
                </View>
                {summary.champion.photoUrl ? <Image source={{ uri: summary.champion.photoUrl }} style={styles.photo} contentFit="cover" /> : null}
              </View>
            </>
          ) : (
            <Text style={styles.meta}>No champion this time.</Text>
          )}
          {myLine ? <Text style={styles.mine}>{myLine}</Text> : null}
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/arena/replay', params: { round: '-1' } })}
              style={({ pressed }) => [styles.action, styles.primary, pressed && { transform: [{ scale: 0.97 }] }]}>
              <Text style={[styles.actionText, { color: '#fff' }]}>Watch the final</Text>
            </Pressable>
            {mine?.entered && mine.heatIndex !== null ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push({ pathname: '/arena/replay', params: { round: String(mine.heatIndex) } })}
                style={({ pressed }) => [styles.action, pressed && { transform: [{ scale: 0.97 }] }]}>
                <Text style={styles.actionText}>Watch your heat</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 16 },
  next: { gap: 4 },
  kicker: { fontSize: 12, fontFamily: Fonts.bold, letterSpacing: 1.2, color: Palette.muted },
  countdown: { fontSize: 44, fontFamily: Fonts.bold, color: Palette.ink, fontVariant: ['tabular-nums'] },
  entered: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.muted },
  practice: { backgroundColor: Palette.ink, borderRadius: 24, paddingVertical: 22, paddingHorizontal: 20, gap: 4 },
  practiceTitle: { color: '#fff', fontSize: 24, fontFamily: Fonts.bold },
  practiceSub: { color: 'rgba(255,255,255,0.75)', fontSize: 14, fontFamily: Fonts.regular },
  card: { backgroundColor: Palette.card, borderRadius: 24, padding: 16, gap: 12 },
  stage: { height: 220, borderRadius: 18, overflow: 'hidden', backgroundColor: Palette.bg },
  champRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  champInfo: { flex: 1, gap: 4 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  champName: { fontSize: 24, fontFamily: Fonts.bold, color: Palette.ink },
  meta: { fontSize: 14, fontFamily: Fonts.regular, color: Palette.muted },
  photo: { width: 72, height: 72, borderRadius: 14, transform: [{ rotate: '-4deg' }], backgroundColor: Palette.bg },
  mine: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.ink },
  actions: { flexDirection: 'row', gap: 10 },
  action: { flex: 1, borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: Palette.bg },
  primary: { backgroundColor: Palette.ink },
  actionText: { fontSize: 15, fontFamily: Fonts.bold, color: Palette.ink },
});
