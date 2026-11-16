import { useMutation, useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HardShadow, InkSticker, OutlineButton, Polaroid, PrimaryButton, StageBlock } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { royaleHour } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { testArgs, useTestMode } from '@/lib/test-mode';
import { elementColor, Fonts, Palette, Radii, Type } from '@/lib/theme';

function royaleDate(t: number) {
  const d = new Date(t);
  return `${d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })} · ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
}

const RESET_PROMPT = 'Reset today? Your eggs and monsters from today are removed.';

export default function ProfileScreen() {
  const deviceId = useDeviceId();
  const profile = useQuery(api.royale.profile, { deviceId, ...testArgs(useTestMode()) });
  const mine = useQuery(api.monsters.listMine, { deviceId });
  const [now] = useState(() => Date.now());
  const me = useQuery(api.players.me, { deviceId, now });
  const setProfile = useMutation(api.players.setProfile);
  const adminReset = useMutation(api.players.adminReset);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [resetting, setResetting] = useState(false);

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
  const pictures = new Map((mine ?? []).map((m) => [m._id as string, m]));

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

  const reset = async () => {
    setResetting(true);
    try {
      await adminReset({ deviceId });
    } catch (e) {
      console.warn('adminReset failed', e);
    } finally {
      setResetting(false);
    }
  };

  const confirmReset = () => {
    if (Platform.OS === 'web') {
      if (window.confirm(RESET_PROMPT)) reset();
      return;
    }
    Alert.alert('Reset today?', 'Your eggs and monsters from today are removed.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset', style: 'destructive', onPress: reset },
    ]);
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
            <Text style={[Type.caps, styles.mutedText]}>{`Playing since ${new Date(profile.since).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}</Text>
          ) : null}
        </View>

        <HardShadow offset={5} radius={Radii.card}>
          <View style={styles.hero}>
            <View style={styles.heroGrid}>
              {(
                [
                  ['Monsters', stats.monsters],
                  ['Eggs waiting', stats.eggs],
                  ['Royales', stats.royales],
                  ['Wins', stats.wins],
                ] as const
              ).map(([label, value]) => (
                <View key={label} style={styles.heroCell}>
                  <Text style={styles.heroValue}>{value}</Text>
                  <Text style={styles.heroLabel}>{label}</Text>
                </View>
              ))}
            </View>
            {stats.best ? <InkSticker label={`Best finish · ${stats.best}`} rotate={-2} fontSize={13} style={styles.best} /> : null}
          </View>
        </HardShadow>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Your royales</Text>
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
            history.map((h) => {
              const own = h as typeof h & { photoUrl?: string | null; snapUrl?: string | null };
              const pic = pictures.get(h.monsterId);
              const snapUrl = own.snapUrl ?? pic?.snapUrl ?? null;
              const photoUrl = own.photoUrl ?? pic?.photoUrl ?? null;
              const element = h.element ?? pic?.element ?? 'normal';
              const openMonster = () => router.push({ pathname: '/monster/[id]', params: { id: h.monsterId } });
              return (
                <HardShadow key={h.royaleId} offset={4} radius={Radii.tile}>
                  <View style={styles.card}>
                    <Pressable
                      accessibilityRole="link"
                      accessibilityLabel={h.monsterName}
                      onPress={openMonster}
                      style={({ pressed }) => [styles.picture, pressed && styles.pressed]}>
                      <StageBlock radius={18} style={styles.stage}>
                        {snapUrl ? (
                          <Image source={{ uri: snapUrl }} style={styles.render} contentFit="contain" transition={200} />
                        ) : photoUrl ? (
                          <Image source={{ uri: photoUrl }} style={styles.photoFill} contentFit="cover" transition={200} />
                        ) : null}
                      </StageBlock>
                      {snapUrl && photoUrl ? (
                        <View style={styles.cornerPhoto}>
                          <Polaroid uri={photoUrl} size={30} rotate={9} shadow={2} />
                        </View>
                      ) : null}
                    </Pressable>
                    <View style={styles.info}>
                      <Text style={[Type.caps, styles.date]}>{royaleDate(h.startsAt)}</Text>
                      <Pressable accessibilityRole="link" accessibilityLabel={h.monsterName} onPress={openMonster} style={({ pressed }) => [styles.monster, pressed && styles.pressed]}>
                        <View style={[styles.dot, { backgroundColor: elementColor(element) }]} />
                        <Text style={styles.monsterName} numberOfLines={1}>
                          {h.monsterName}
                        </Text>
                      </Pressable>
                      {h.champion ? (
                        <HardShadow offset={2} radius={Radii.chip} rotate={-3} style={styles.badgeWrap}>
                          <View style={[styles.badge, styles.championBadge]}>
                            <Text style={styles.badgeLabel}>{h.result}</Text>
                          </View>
                        </HardShadow>
                      ) : (
                        <View style={[styles.badge, styles.badgeWrap]}>
                          <Text style={styles.badgeLabel}>{h.result}</Text>
                        </View>
                      )}
                      <Text style={styles.cardMuted}>
                        {h.championName ? `Champion: ${h.championName} · ${h.entrants} monsters` : `${h.entrants} monsters`}
                      </Text>
                      <PrimaryButton
                        label="Watch replay"
                        onPress={() => router.push({ pathname: '/arena/replay', params: { royale: h.royaleId, round: String(h.round) } })}
                        buttonStyle={styles.replay}
                        labelStyle={styles.replayLabel}
                        style={styles.replayWrap}
                      />
                    </View>
                  </View>
                </HardShadow>
              );
            })
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>How it works</Text>
          <View style={styles.steps}>
            {['Snap anything. You get an egg.', 'Once a day every egg hatches live and all monsters fight.', 'Your monster joins your collection. New royale every day.'].map(
              (line, i) => (
                <View key={line} style={styles.step}>
                  <View style={styles.stepNo}>
                    <Text style={styles.stepNoLabel}>{i + 1}</Text>
                  </View>
                  <Text style={[Type.body, styles.stepText]}>{line}</Text>
                </View>
              ),
            )}
          </View>
        </View>

        {me?.admin ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Admin: reset my day" onPress={confirmReset} disabled={resetting} style={({ pressed }) => [styles.admin, pressed && styles.pressed]}>
            {resetting ? <ActivityIndicator color={Palette.muted} /> : <Text style={styles.adminLabel}>Admin: reset my day</Text>}
          </Pressable>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.ground },
  center: { alignItems: 'center', justifyContent: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 40, gap: 28, width: '100%', maxWidth: 560, alignSelf: 'center' },
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
  mutedText: { color: Palette.muted },
  hero: { backgroundColor: Palette.primary, borderWidth: 2, borderColor: Palette.ink, borderRadius: Radii.card, padding: 18, gap: 16 },
  heroGrid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 14 },
  heroCell: { width: '50%', gap: 2 },
  heroValue: { fontFamily: Fonts.black, fontSize: 48, lineHeight: 50, letterSpacing: -1.5, color: Palette.ink, fontVariant: ['tabular-nums'] },
  heroLabel: { fontFamily: Fonts.bold, fontSize: 12, lineHeight: 14, letterSpacing: 1, textTransform: 'uppercase', color: Palette.ink },
  best: { maxWidth: '100%' },
  section: { gap: 16 },
  sectionTitle: { fontFamily: Fonts.black, fontSize: 18, lineHeight: 22, letterSpacing: 1, textTransform: 'uppercase', color: Palette.ink },
  empty: { gap: 16 },
  card: { flexDirection: 'row', gap: 14, backgroundColor: Palette.ground, borderWidth: 2, borderColor: Palette.ink, borderRadius: Radii.tile, padding: 12 },
  picture: { width: 96, height: 96, marginBottom: 10 },
  pressed: { opacity: 0.6 },
  stage: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center' },
  render: { width: 88, height: 88 },
  photoFill: { width: '100%', height: '100%' },
  cornerPhoto: { position: 'absolute', right: -10, bottom: -12 },
  info: { flex: 1, minWidth: 0, gap: 6 },
  date: { color: Palette.muted, fontSize: 11, lineHeight: 13 },
  monster: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Palette.ink },
  monsterName: { flexShrink: 1, fontFamily: Fonts.extrabold, fontSize: 19, lineHeight: 23, letterSpacing: -0.3, color: Palette.ink },
  badgeWrap: { alignSelf: 'flex-start', maxWidth: '100%' },
  badge: { borderWidth: 2, borderColor: Palette.ink, borderRadius: Radii.chip, paddingHorizontal: 9, paddingVertical: 3, backgroundColor: Palette.ground },
  championBadge: { backgroundColor: Palette.primary },
  badgeLabel: { fontFamily: Fonts.extrabold, fontSize: 13, lineHeight: 16, letterSpacing: 0.4, color: Palette.ink },
  cardMuted: { fontFamily: Fonts.medium, fontSize: 13, lineHeight: 17, color: Palette.muted },
  replayWrap: { alignSelf: 'flex-start', marginTop: 2 },
  replay: { height: 40, borderRadius: 12, paddingHorizontal: 14 },
  replayLabel: { fontSize: 15, lineHeight: 19 },
  steps: { backgroundColor: Palette.stage, borderRadius: Radii.tile, padding: 16, gap: 14 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepNo: { width: 30, height: 30, borderRadius: 15, borderWidth: 2, borderColor: Palette.ink, backgroundColor: Palette.primary, alignItems: 'center', justifyContent: 'center' },
  stepNoLabel: { fontFamily: Fonts.black, fontSize: 14, lineHeight: 17, color: Palette.ink },
  stepText: { flex: 1 },
  admin: { alignSelf: 'center', paddingVertical: 10, paddingHorizontal: 12 },
  adminLabel: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 16, color: Palette.muted, textDecorationLine: 'underline' },
});
