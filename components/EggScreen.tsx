import { useMutation } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import EggArt from '@/components/EggArt';
import ShareButton from '@/components/ShareButton';
import TrainerRow from '@/components/TrainerRow';
import { Appear, InkSticker, OutlineButton, Polaroid, PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { clock, royaleTimeToday, useNow } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

export type Entry = FunctionReturnType<typeof api.monsters.listMine>[number];

const native = Platform.OS !== 'web';
const SMS_NUMBER = process.env.EXPO_PUBLIC_SMS_NUMBER;

export default function EggScreen({
  eggId,
  entry,
  photoUri,
  layIn,
  onClose,
}: {
  eggId: string;
  entry: Entry | undefined;
  photoUri?: string | null;
  layIn?: boolean;
  onClose: () => void;
}) {
  const deviceId = useDeviceId();
  const remove = useMutation(api.eggs.remove);
  const photo = photoUri ?? (entry && 'photoUrl' in entry ? entry.photoUrl : null) ?? null;
  const golden = !!entry && 'golden' in entry && !!entry.golden;

  if (entry?.status === 'rejected') {
    return (
      <Shell onClose={onClose} sticker="No egg">
        <Appear style={styles.copy}>
          <Text style={Type.display}>{"This one can't hatch."}</Text>
          <Text style={Type.muted}>No people or private stuff. Snap something else.</Text>
        </Appear>
        <Appear delay={120} style={styles.actions}>
          <OutlineButton
            label="Remove"
            onPress={async () => {
              await remove({ deviceId, eggId: eggId as Id<'monsters'> }).catch((e) => console.warn('remove failed', e));
              onClose();
            }}
          />
        </Appear>
      </Shell>
    );
  }

  if (entry?.status === 'hatched') {
    return (
      <Shell onClose={onClose} sticker="It hatched!">
        <EggStage photo={photo} golden={golden} />
        <Appear style={styles.copy}>
          <Text style={Type.display}>It hatched.</Text>
          <Text style={Type.muted}>Meet the monster that came out of your snap.</Text>
        </Appear>
        <Appear delay={120} style={styles.actions}>
          <PrimaryButton label={`Meet ${entry.name}`} onPress={() => router.push({ pathname: '/monster/[id]', params: { id: entry._id } })} />
        </Appear>
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose} sticker={golden ? 'Golden egg' : 'Egg laid'}>
      <EggStage photo={photo} golden={golden} layIn={layIn} />
      <Appear delay={layIn ? 900 : 0} style={styles.copy}>
        <Text style={Type.display}>Your egg is in.</Text>
        <Countdown />
        <Text style={Type.muted}>It hatches at 5 PM sharp, live in the royale. Come back to watch.</Text>
      </Appear>
      <Appear delay={layIn ? 1000 : 80} style={styles.trainer}>
        <TrainerRow />
      </Appear>
      <Appear delay={layIn ? 1100 : 160} style={styles.actions}>
        <ShareButton />
        {SMS_NUMBER ? (
          <OutlineButton
            label="Text me when it hatches"
            icon={
              <Svg width={20} height={20} viewBox="0 0 24 24">
                <Path
                  d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-5 4v-4a3 3 0 0 1-2-3z"
                  fill="none"
                  stroke={Palette.ink}
                  strokeWidth={2.2}
                  strokeLinejoin="round"
                />
              </Svg>
            }
            onPress={() => Linking.openURL(`sms:${SMS_NUMBER}&body=${encodeURIComponent(`ROYALE ${deviceId.slice(0, 6)}`)}`)}
          />
        ) : null}
      </Appear>
    </Shell>
  );
}

function Shell({ sticker, onClose, children }: { sticker: string; onClose: () => void; children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <InkSticker label={sticker} fontSize={14} />
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
          <Svg width={28} height={28} viewBox="0 0 28 28">
            <Path d="M7 7l14 14M21 7L7 21" fill="none" stroke={Palette.ink} strokeWidth={2.8} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>
      {children}
    </ScrollView>
  );
}

function Countdown() {
  const now = useNow();
  const left = royaleTimeToday() - now;
  return (
    <View style={styles.countdown}>
      <Text style={[Type.label, styles.muted]}>{left > 0 ? 'Hatches in' : 'Hatching now'}</Text>
      {left > 0 ? <Text style={styles.clock}>{clock(left)}</Text> : null}
    </View>
  );
}

function EggStage({ photo, golden, layIn }: { photo: string | null; golden: boolean; layIn?: boolean }) {
  const [fly] = useState(() => new Animated.Value(layIn ? 0 : 1));
  const [pop] = useState(() => new Animated.Value(layIn ? 0 : 1));
  const [wobble] = useState(() => new Animated.Value(0));

  useEffect(() => {
    Animated.sequence([
      Animated.timing(fly, { toValue: 1, duration: 650, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
      Animated.spring(pop, { toValue: 1, damping: 8, stiffness: 170, useNativeDriver: native }),
    ]).start();
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(wobble, { toValue: -1, duration: 1800, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(wobble, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.delay(700),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [fly, pop, wobble]);

  return (
    <View style={styles.stageLane}>
      <View style={styles.stage}>
        <Animated.View
          style={{
            transformOrigin: 'bottom',
            transform: [
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
              { rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] }) },
            ],
          }}>
          <EggArt width={150} golden={golden} />
        </Animated.View>
        {photo ? (
          <Animated.View
            style={[
              styles.snap,
              {
                opacity: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }),
                transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
              },
            ]}>
            <Polaroid uri={photo} size={64} rotate={9} shadow={3} caption="Your snap" />
          </Animated.View>
        ) : null}
        {photo && layIn ? (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.flying,
              {
                opacity: fly.interpolate({ inputRange: [0, 0.85, 1], outputRange: [1, 1, 0] }),
                transform: [
                  { translateY: fly.interpolate({ inputRange: [0, 1], outputRange: [-40, 40] }) },
                  { scale: fly.interpolate({ inputRange: [0, 1], outputRange: [1.5, 0.15] }) },
                  { rotate: fly.interpolate({ inputRange: [0, 1], outputRange: ['-6deg', '20deg'] }) },
                ],
              },
            ]}>
            <Polaroid uri={photo} size={120} rotate={0} shadow={4} />
          </Animated.View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { paddingBottom: 28, width: '100%', maxWidth: 560, alignSelf: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 22, paddingRight: 20, paddingTop: 8 },
  stageLane: { paddingHorizontal: 20, paddingTop: 12 },
  stage: { height: 248, borderRadius: Radii.stage, backgroundColor: Palette.stage, alignItems: 'center', justifyContent: 'center' },
  snap: { position: 'absolute', top: 18, right: 22 },
  flying: { position: 'absolute' },
  copy: { gap: 10, paddingHorizontal: 24, paddingTop: 18 },
  countdown: { paddingTop: 2 },
  muted: { color: Palette.muted },
  clock: { fontFamily: Fonts.black, fontSize: 46, lineHeight: 48, letterSpacing: -1.4, color: Palette.ink, fontVariant: ['tabular-nums'] },
  trainer: { paddingHorizontal: 24, paddingTop: 18 },
  actions: { gap: 12, paddingHorizontal: 20, paddingTop: 20 },
});
