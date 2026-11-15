import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import Head from 'expo-router/head';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MonsterDetails from '@/components/MonsterDetails';
import ShareButton from '@/components/ShareButton';
import { Appear, Button } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Fonts, Palette } from '@/lib/theme';

export default function MonsterPage({ id, mode }: { id: string; mode: 'owner' | 'public' }) {
  const monster = useQuery(api.monsters.get, { id: id as Id<'monsters'> });
  const catchOwn = () => router.replace('/');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/collection'));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Head>
        <title>{monster ? `${monster.name} · Snappymon` : 'Snappymon'}</title>
      </Head>
      <View style={styles.bar}>
        {mode === 'owner' ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={back} hitSlop={12} style={styles.back}>
            <Ionicons name="chevron-back" size={24} color={Palette.ink} />
          </Pressable>
        ) : (
          <View style={styles.back} />
        )}
        <Text style={styles.wordmark}>Snappymon</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {monster === undefined ? <ActivityIndicator color={Palette.ink} style={styles.loading} /> : null}
        {monster === null ? <MonsterMissing /> : null}
        {monster ? (
          <>
            <MonsterDetails monster={monster} />
            {mode === 'public' ? (
              <Appear delay={460} style={styles.cta}>
                <Text style={styles.tagline}>Snap anything. Hatch a monster. Battle in the daily royale.</Text>
                <Button label="Catch your own" icon="camera" onPress={catchOwn} style={styles.full} />
                <ShareButton id={monster._id} name={monster.name} variant="secondary" style={styles.full} />
              </Appear>
            ) : (
              <Appear delay={460} style={styles.cta}>
                <ShareButton id={monster._id} name={monster.name} style={styles.full} />
              </Appear>
            )}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

export function MonsterMissing() {
  return (
    <View style={styles.missing}>
      <Text style={styles.missingTitle}>This monster wandered off</Text>
      <Text style={styles.missingText}>The link might be broken. Hatch your own instead!</Text>
      <Button label="Catch your own" icon="camera" onPress={() => router.replace('/')} style={styles.full} />
    </View>
  );
}

export function MonsterErrorBoundary() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <MonsterMissing />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.bg },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  back: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'transparent' },
  wordmark: { fontFamily: Fonts.black, fontSize: 22, color: Palette.ink, letterSpacing: -0.5 },
  container: { padding: 20, paddingTop: 8, paddingBottom: 40, gap: 14, width: '100%', maxWidth: 560, alignSelf: 'center' },
  loading: { marginTop: 80 },
  missing: { alignItems: 'center', gap: 12, marginTop: 60 },
  missingTitle: { fontFamily: Fonts.black, fontSize: 26, color: Palette.ink, textAlign: 'center' },
  missingText: { fontFamily: Fonts.regular, fontSize: 16, color: Palette.muted, textAlign: 'center' },
  cta: { gap: 12, marginTop: 8 },
  tagline: { fontFamily: Fonts.bold, fontSize: 17, lineHeight: 23, color: Palette.ink, textAlign: 'center', paddingHorizontal: 12 },
  full: { alignSelf: 'stretch' },
});
