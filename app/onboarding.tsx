import { useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Appear, HardShadow, PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { useDeviceId, useOnboarding } from '@/lib/device';
import { tap } from '@/lib/haptics';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

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
          <View style={styles.hero}>
            <Image source={require('@/assets/images/bananaconda.png')} style={styles.mascot} contentFit="contain" />
            <Appear style={styles.heroText}>
              <Text style={styles.title}>Pick a trainer name</Text>
              <Text style={styles.subtitle}>Your monsters need someone to blame.</Text>
            </Appear>
          </View>

          <Appear delay={120} style={styles.field}>
            <HardShadow offset={4} radius={Radii.button}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. Captain Toast"
                placeholderTextColor={Palette.muted}
                accessibilityLabel="Trainer name"
                maxLength={20}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                style={styles.input}
              />
            </HardShadow>
          </Appear>

          <Appear delay={220} style={styles.block}>
            <Text style={Type.label}>Where did you find us?</Text>
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
            <PrimaryButton label="Let's go" onPress={submit} busy={busy} disabled={!name.trim() && !source} style={styles.go} />
            <Pressable accessibilityRole="button" onPress={done} hitSlop={12}>
              <Text style={styles.skip}>skip</Text>
            </Pressable>
          </Appear>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.ground },
  flex: { flex: 1 },
  container: { paddingBottom: 16, flexGrow: 1, width: '100%', maxWidth: 520, alignSelf: 'center', overflow: 'hidden' },
  hero: { paddingHorizontal: 24, paddingTop: 120 },
  heroText: { gap: 10 },
  mascot: { position: 'absolute', width: 176, height: 176, right: -30, top: 22, transform: [{ rotate: '12deg' }] },
  title: { ...Type.headline, fontSize: 46, lineHeight: 44, letterSpacing: -1.6, width: 300 },
  subtitle: { fontFamily: Fonts.medium, fontSize: 17, lineHeight: 24, color: Palette.muted },
  field: { paddingHorizontal: 24, paddingTop: 22 },
  input: {
    position: 'relative',
    height: 60,
    backgroundColor: Palette.ground,
    borderRadius: Radii.button,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 18,
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Palette.ink,
  },
  block: { gap: 12, paddingHorizontal: 24, paddingTop: 30 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 10 },
  chip: {
    height: 42,
    justifyContent: 'center',
    borderRadius: Radii.pill,
    paddingHorizontal: 16,
    backgroundColor: Palette.ground,
    borderWidth: 2,
    borderColor: Palette.ink,
  },
  chipActive: { backgroundColor: Palette.ink },
  chipText: { fontFamily: Fonts.semibold, fontSize: 16, lineHeight: 20, color: Palette.ink },
  chipTextActive: { color: Palette.ground },
  footer: { marginTop: 'auto', paddingTop: 32, paddingHorizontal: 20, gap: 16, alignItems: 'center' },
  go: { alignSelf: 'stretch' },
  skip: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.muted, textDecorationLine: 'underline' },
});
