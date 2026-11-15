import { useQuery } from 'convex/react';
import { router } from 'expo-router';
import Head from 'expo-router/head';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import MonsterDetails, { hatchedAt, MonsterTopBar } from '@/components/MonsterDetails';
import ShareButton from '@/components/ShareButton';
import { Appear, OutlineButton, PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { Palette, Type } from '@/lib/theme';

export default function MonsterPage({ id, mode }: { id: string; mode: 'owner' | 'public' }) {
  const monster = useQuery(api.monsters.get, { id: id as Id<'monsters'> });
  const catchOwn = () => router.replace('/');
  const back = () => (router.canGoBack() ? router.back() : router.replace('/collection'));
  const label = !monster
    ? 'Snappymon'
    : mode === 'public' && monster.ownerName
      ? `Caught by ${monster.ownerName}`
      : `Hatched ${hatchedAt(monster._creationTime)}`;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <Head>
        <title>{monster ? `${monster.name} · Snappymon` : 'Snappymon'}</title>
      </Head>
      <MonsterTopBar label={label} onBack={mode === 'owner' ? back : undefined} />
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {monster === undefined ? <ActivityIndicator color={Palette.ink} style={styles.loading} /> : null}
        {monster === null ? <MonsterMissing /> : null}
        {monster ? (
          <>
            <MonsterDetails monster={monster} />
            {mode === 'public' ? (
              <Appear delay={460} style={styles.cta}>
                <Text style={styles.tagline}>Snap anything. Hatch a monster. Battle in the daily royale.</Text>
                <PrimaryButton label="Catch your own" onPress={catchOwn} />
                <ShareButton id={monster._id} name={monster.name} variant="outline" />
              </Appear>
            ) : (
              <Appear delay={460} style={[styles.cta, styles.row]}>
                <ShareButton id={monster._id} name={monster.name} style={styles.share} />
                <OutlineButton label="Catch another" onPress={() => router.navigate('/')} style={styles.another} />
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
      <Text style={[Type.heading, styles.center]}>This monster wandered off</Text>
      <Text style={[Type.muted, styles.center]}>The link might be broken. Hatch your own instead!</Text>
      <PrimaryButton label="Catch your own" onPress={() => router.replace('/')} style={styles.full} />
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
  safe: { flex: 1, backgroundColor: Palette.ground },
  container: { paddingHorizontal: 20, paddingBottom: 32, gap: 16, width: '100%', maxWidth: 560, alignSelf: 'center' },
  loading: { marginTop: 80 },
  missing: { alignItems: 'center', gap: 12, marginTop: 60 },
  center: { textAlign: 'center' },
  cta: { gap: 12, marginTop: 8 },
  row: { flexDirection: 'row' },
  share: { flex: 1 },
  another: { flex: 1.3 },
  tagline: { ...Type.muted, textAlign: 'center', paddingHorizontal: 12 },
  full: { alignSelf: 'stretch', marginTop: 8 },
});
