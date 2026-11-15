import { useMutation, useQuery } from 'convex/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HardShadow, OutlineButton, PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { royaleHour } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { testArgs, useTestMode } from '@/lib/test-mode';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

function royaleDate(t: number) {
  const d = new Date(t);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

export default function ProfileScreen() {
  const deviceId = useDeviceId();
  const profile = useQuery(api.royale.profile, { deviceId, ...testArgs(useTestMode()) });
  const setProfile = useMutation(api.players.setProfile);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);

  if (profile === undefined) {
    return (
      <SafeAreaView style={[styles.safe, styles.center]} edges={['top']}>
        <ActivityIndicator color={Palette.ink} />
      </SafeAreaView>
    );
  }

  const name = profile?.name ?? null;
  const stats = profile?.stats ?? { monsters: 0, eggs: 0, royales: 0, wins: 0, best: null };
  const history = profile?.history ?? [];
  const showInput = editing || !name;

  const save = async () => {
    const next = draft.trim();
    if (!next) return;
    setBusy(true);
    try {
      await setProfile({ deviceId, name: next });
      setEditing(false);
    } catch (e) {
      console.warn('setProfile failed', e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        contentContainerStyle={styles.content}
        automaticallyAdjustKeyboardInsets
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          {showInput ? (
            <View style={styles.nameForm}>
              <Text style={Type.label}>{name ? 'Your name' : "What's your name?"}</Text>
              <View style={styles.field}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  placeholder="Your name"
                  placeholderTextColor={Palette.muted}
                  accessibilityLabel="Your name"
                  maxLength={20}
                  autoCapitalize="words"
                  autoCorrect={false}
                  autoFocus={editing}
                  returnKeyType="done"
                  onSubmitEditing={save}
                  style={styles.input}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Save"
                  onPress={save}
                  disabled={busy || !draft.trim()}
                  style={({ pressed }) => [styles.save, pressed && styles.savePressed, (busy || !draft.trim()) && styles.disabled]}>
                  {busy ? <ActivityIndicator color={Palette.ground} /> : <Text style={styles.saveLabel}>Save</Text>}
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.nameRow}>
              <Text style={[Type.display, styles.name]} numberOfLines={2}>
                {name}
              </Text>
              <OutlineButton
                label="Edit"
                small
                onPress={() => {
                  setDraft(name ?? '');
                  setEditing(true);
                }}
                style={styles.edit}
              />
            </View>
          )}
          {profile ? (
            <Text style={Type.muted}>{`Playing since ${new Date(profile.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</Text>
          ) : null}
        </View>

        <View style={styles.section}>
          <View style={styles.tiles}>
            {[
              ['Monsters', stats.monsters],
              ['Eggs waiting', stats.eggs],
              ['Royales', stats.royales],
              ['Wins', stats.wins],
            ].map(([label, value]) => (
              <View key={label} style={styles.tile}>
                <Text style={styles.tileValue}>{value}</Text>
                <Text style={styles.tileLabel}>{label}</Text>
              </View>
            ))}
          </View>
          {stats.best ? <Text style={styles.best}>{`Best finish: ${stats.best}`}</Text> : null}
        </View>

        <View style={styles.section}>
          <Text style={Type.label}>Your royales</Text>
          {history.length === 0 ? (
            <View style={styles.empty}>
              {stats.eggs > 0 ? (
                <Text style={Type.muted}>{`Your egg hatches in today's royale at ${royaleHour()}. Your fights will show up here.`}</Text>
              ) : (
                <>
                  <Text style={Type.muted}>Snap something to enter your first royale.</Text>
                  <PrimaryButton label="Snap something" onPress={() => router.navigate('/')} />
                </>
              )}
            </View>
          ) : (
            history.map((h) => (
              <HardShadow key={h.royaleId} offset={3} radius={Radii.tile}>
                <View style={styles.card}>
                  <Text style={[Type.label, styles.mutedText]}>{royaleDate(h.startsAt)}</Text>
                  <View style={styles.cardRow}>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={h.monsterName}
                      onPress={() => router.push({ pathname: '/monster/[id]', params: { id: h.monsterId } })}
                      style={({ pressed }) => [styles.monster, pressed && styles.monsterPressed]}>
                      <Text style={styles.monsterName} numberOfLines={1}>
                        {h.monsterName}
                      </Text>
                      {h.golden ? <View style={styles.goldDot} /> : null}
                    </Pressable>
                    <Text style={[styles.result, h.champion && styles.champion]}>{h.result}</Text>
                  </View>
                  <Text style={styles.cardMuted}>
                    {h.championName ? `Champion: ${h.championName} · ${h.entrants} monsters` : `${h.entrants} monsters`}
                  </Text>
                  <OutlineButton
                    label="Watch replay"
                    small
                    onPress={() => router.push({ pathname: '/arena/replay', params: { royale: h.royaleId, round: String(h.round) } })}
                  />
                </View>
              </HardShadow>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={Type.label}>How it works</Text>
          {['Snap anything. You get an egg.', 'Once a day every egg hatches live and all monsters fight.', 'Your monster joins your collection. New royale every day.'].map(
            (line, i) => (
              <View key={line} style={styles.step}>
                <Text style={styles.stepNo}>{i + 1}</Text>
                <Text style={[Type.body, styles.stepText]}>{line}</Text>
              </View>
            ),
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.ground },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 24, paddingTop: 14, paddingBottom: 40, gap: 32, width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { flexShrink: 1 },
  edit: { marginLeft: 'auto' },
  nameForm: { gap: 8 },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 50,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 16,
    fontFamily: Fonts.medium,
    fontSize: 17,
    color: Palette.ink,
    backgroundColor: Palette.ground,
  },
  save: { height: 50, minWidth: 80, borderRadius: 14, paddingHorizontal: 20, backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
  savePressed: { transform: [{ scale: 0.97 }] },
  saveLabel: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 20, color: Palette.ground },
  disabled: { opacity: 0.45 },
  section: { gap: 14 },
  tiles: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    minWidth: 0,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.sticker,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 4,
  },
  tileValue: { fontFamily: Fonts.black, fontSize: 26, lineHeight: 30, color: Palette.ink, fontVariant: ['tabular-nums'] },
  tileLabel: { fontFamily: Fonts.bold, fontSize: 10, lineHeight: 12, letterSpacing: 0.6, textTransform: 'uppercase', color: Palette.muted, textAlign: 'center' },
  best: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.ink },
  empty: { gap: 16 },
  card: { backgroundColor: Palette.ground, borderWidth: 2, borderColor: Palette.ink, borderRadius: Radii.tile, padding: 16, gap: 8 },
  mutedText: { color: Palette.muted },
  cardRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  monster: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  monsterPressed: { opacity: 0.6 },
  monsterName: { flexShrink: 1, fontFamily: Fonts.extrabold, fontSize: 20, lineHeight: 24, letterSpacing: -0.3, color: Palette.ink, textDecorationLine: 'underline' },
  goldDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.primary },
  result: { fontFamily: Fonts.bold, fontSize: 15, lineHeight: 20, color: Palette.ink, textAlign: 'right' },
  champion: { fontFamily: Fonts.black },
  cardMuted: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 19, color: Palette.muted, marginBottom: 4 },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  stepNo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: Palette.ink,
    textAlign: 'center',
    lineHeight: 22,
    fontFamily: Fonts.extrabold,
    fontSize: 13,
    color: Palette.ink,
    overflow: 'hidden',
  },
  stepText: { flex: 1 },
});
