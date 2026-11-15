import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { useState } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import CameraButton from '@/components/CameraButton';
import { Appear, InkSticker } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { startOfToday } from '@/lib/arena';
import { Fonts, Palette } from '@/lib/theme';

const PEEKERS = [
  { source: require('@/assets/images/renders/bananaconda.png'), size: 116, left: -30, top: 6, rotate: -16 },
  { source: require('@/assets/images/renders/bp-scootgremlin.png'), size: 150, right: -50, top: 26, rotate: -10 },
  { source: require('@/assets/images/renders/bp-parkgoyle.png'), size: 128, right: -34, bottom: 22, rotate: 8 },
  { source: require('@/assets/images/renders/bp-capyboogey.png'), size: 176, left: -66, bottom: 10, rotate: 12 },
];

const DESIGN_STAGE = 560;

export default function Landing({ onCatch }: { onCatch: () => void }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const [since] = useState(startOfToday);
  const today = useQuery(api.monsters.listToday, { since });
  const [stage, setStage] = useState(DESIGN_STAGE);
  const k = Math.max(0.6, Math.min(1, stage / DESIGN_STAGE));
  const button = Math.round(Math.min(182, Math.max(140, height * 0.216)));

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.header}>
        <Text style={styles.wordmark}>snappymon</Text>
        <InkSticker label="Royale today 5 PM" rotate={4} />
      </View>
      <Appear style={styles.pitch}>
        <Text style={styles.pitchLine}>Snap anything.</Text>
        <Text style={styles.pitchLine}>Get an egg.</Text>
        <Text style={styles.pitchLine}>It hatches at 5 PM.</Text>
      </Appear>
      <View style={styles.stage} onLayout={(e) => setStage(e.nativeEvent.layout.height)}>
        {PEEKERS.map(({ source, size, rotate, ...edge }, i) => (
          <Image
            key={i}
            source={source}
            contentFit="contain"
            style={[
              styles.peeker,
              Object.fromEntries(Object.entries(edge).map(([side, v]) => [side, v * k])),
              { width: size * k, height: size * k, transform: [{ rotate: `${rotate}deg` }] },
            ]}
          />
        ))}
        <Appear delay={120} style={styles.cta}>
          <CameraButton size={button} yellow onPress={onCatch} />
          <Text style={styles.promise}>No app. No signup. Five seconds.</Text>
        </Appear>
      </View>
      <View style={styles.proof}>
        {today ? (
          <>
            <View style={styles.dot} />
            <Text style={styles.proofText}>
              {today.length >= 10 ? `${today.length.toLocaleString('en-US')} eggs waiting for 5 PM` : 'Be one of the first eggs today'}
            </Text>
          </>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.ground, overflow: 'hidden', width: '100%', maxWidth: 560, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  wordmark: { fontFamily: Fonts.black, fontSize: 28, lineHeight: 32, letterSpacing: -1.1, color: Palette.ink },
  pitch: { paddingLeft: 24, paddingRight: 12, paddingTop: 26, zIndex: 1 },
  pitchLine: { fontFamily: Fonts.black, fontSize: 35, lineHeight: 37, letterSpacing: -1.4, color: Palette.ink },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  peeker: { position: 'absolute' },
  cta: { alignItems: 'center', gap: 20 },
  promise: { fontFamily: Fonts.bold, fontSize: 17, lineHeight: 22, color: Palette.ink, textAlign: 'center' },
  proof: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 24, minHeight: 20 },
  dot: { width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: Palette.ink, backgroundColor: '#4CB867' },
  proofText: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.ink },
});
