import { useMutation } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import SourceChips, { useSource } from '@/components/SourceChips';
import { Appear, HardShadow, PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { useDeviceId, useOnboarding } from '@/lib/device';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

export default function OnboardingScreen() {
  const deviceId = useDeviceId();
  const { finishOnboarding } = useOnboarding();
  const setProfile = useMutation(api.players.setProfile);
  const [name, setName] = useState('');
  const { source, pick } = useSource();
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
            <Image source={require('@/assets/images/renders/bananaconda.png')} style={styles.mascot} contentFit="contain" />
            <Appear style={styles.heroText}>
              <Text style={styles.title}>{"What's your name?"}</Text>
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
                accessibilityLabel="Your name"
                maxLength={20}
                autoCapitalize="words"
                autoCorrect={false}
                returnKeyType="done"
                style={styles.input}
              />
            </HardShadow>
          </Appear>

          <Appear delay={220} style={styles.block}>
            <SourceChips value={source} onPick={pick} />
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
  footer: { marginTop: 'auto', paddingTop: 32, paddingHorizontal: 20, gap: 16, alignItems: 'center' },
  go: { alignSelf: 'stretch' },
  skip: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.muted, textDecorationLine: 'underline' },
});
