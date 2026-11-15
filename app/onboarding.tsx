import { useMutation } from 'convex/react';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Appear, Button, SectionLabel } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { useDeviceId, useOnboarding } from '@/lib/device';
import { tap } from '@/lib/haptics';
import { Fonts, Palette } from '@/lib/theme';

const SOURCES = ['TikTok', 'Instagram', 'YouTube', 'Friend', 'Hackathon', 'Other'];

export default function OnboardingScreen() {
  const deviceId = useDeviceId();
  const { finishOnboarding } = useOnboarding();
  const setProfile = useMutation(api.players.setProfile);
  const [name, setName] = useState('');
  const [source, setSource] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const done = () => {
    finishOnboarding();
    router.replace('/');
  };

  const submit = async () => {
    setBusy(true);
    try {
      await setProfile({
        deviceId,
        name: name.trim() || undefined,
        source: source?.toLowerCase(),
      });
    } catch (e) {
      console.warn('setProfile failed', e);
    }
    done();
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <Text style={styles.wordmark}>Snappymon</Text>
            <Pressable accessibilityRole="button" onPress={done} hitSlop={12}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          </View>

          <Appear style={styles.hero}>
            <Text style={styles.title}>Snap anything.{'\n'}Hatch a monster.</Text>
            <Text style={styles.subtitle}>Battle in the daily royale.</Text>
          </Appear>

          <Appear delay={120} style={styles.block}>
            <SectionLabel>Pick a trainer name</SectionLabel>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Captain Toast"
              placeholderTextColor="#a59d99"
              maxLength={20}
              autoCapitalize="words"
              autoCorrect={false}
              returnKeyType="done"
              style={styles.input}
            />
          </Appear>

          <Appear delay={220} style={styles.block}>
            <SectionLabel>Where did you find us?</SectionLabel>
            <View style={styles.chips}>
              {SOURCES.map((s) => {
                const active = s === source;
                return (
                  <Pressable
                    key={s}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      tap();
                      setSource(active ? null : s);
                    }}
                    style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && { transform: [{ scale: 0.95 }] }]}>
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Appear>

          <Appear delay={320} style={styles.footer}>
            <Button label="Let's go" icon="arrow-forward" onPress={submit} busy={busy} disabled={!name.trim() && !source} />
          </Appear>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.bg },
  flex: { flex: 1 },
  container: { padding: 24, gap: 28, flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  wordmark: { fontFamily: Fonts.black, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 },
  skip: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.muted, textDecorationLine: 'underline' },
  hero: { gap: 8, marginTop: 12 },
  title: { fontFamily: Fonts.black, fontSize: 40, lineHeight: 44, color: Palette.ink, letterSpacing: -0.8 },
  subtitle: { fontFamily: Fonts.bold, fontSize: 19, color: Palette.muted },
  block: { gap: 12 },
  input: {
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Palette.ink,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: { borderRadius: 999, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: '#fff', borderWidth: 2, borderColor: '#fff' },
  chipActive: { backgroundColor: Palette.ink, borderColor: Palette.ink },
  chipText: { fontFamily: Fonts.black, fontSize: 16, color: Palette.ink },
  chipTextActive: { color: '#fff' },
  footer: { marginTop: 'auto' },
});
