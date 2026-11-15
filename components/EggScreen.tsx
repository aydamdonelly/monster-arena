import { useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { type ReactNode, useEffect, useState } from 'react';
import { Image } from 'expo-image';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { HatchNowButton } from '@/components/DemoMode';
import Egg from '@/components/Egg';
import GoldenEggSheet from '@/components/GoldenEggSheet';
import { useLiveRoyale } from '@/components/RoyaleTakeover';
import SourceChips, { useSource } from '@/components/SourceChips';
import ShareButton from '@/components/ShareButton';
import TrainerRow from '@/components/TrainerRow';
import { Appear, InkSticker, OutlineButton, PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import type { Id } from '@/convex/_generated/dataModel';
import { clock, royaleHour, royaleLocalNote, royaleTimeToday, useNow } from '@/lib/arena';
import { useDemoKey } from '@/lib/demo';
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
  const { source, pick, loaded } = useSource();
  const [answered, setAnswered] = useState(false);
  const [now] = useState(() => Date.now());
  const me = useQuery(api.players.me, { deviceId, now });
  const [sheet, setSheet] = useState(false);
  const demoKey = useDemoKey();
  const offer = !demoKey && !!me && me.hatchesLeft === 0 && me.canGolden && me.goldenEggs === 0;

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
        <EggStage seed={eggId} photo={photo} golden={golden} />
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

  if (!loaded || !source) {
    return (
      <Shell sticker={golden ? 'Your golden egg is in' : 'Your egg is in'}>
        <EggStage seed={eggId || 'new'} photo={photo} golden={golden} layIn={layIn} />
        {loaded ? (
          <Appear delay={layIn ? 900 : 0} style={styles.gate}>
            <Text style={styles.gateTitle}>One tap to finish: how did you get here?</Text>
            <SourceChips
              value={null}
              label={false}
              onPick={(s) => {
                setAnswered(true);
                pick(s);
              }}
            />
          </Appear>
        ) : null}
      </Shell>
    );
  }

  return (
    <Shell onClose={onClose} sticker={golden ? 'Your golden egg is in' : 'Your egg is in'}>
      <EggStage seed={eggId || 'new'} photo={photo} golden={golden} layIn={layIn && !answered} />
      <Appear delay={layIn ? 900 : 0} style={styles.copy}>
        <Text style={styles.headline}>It hatches at {royaleHour()} sharp.</Text>
        <Countdown />
        <Text style={Type.muted}>
          {royaleLocalNote() ? `That is ${royaleLocalNote()}. ` : ''}Come back to watch it fight.
        </Text>
      </Appear>
      {offer ? (
        <Appear delay={layIn ? 1000 : 80} style={styles.offerLane}>
          <GoldenOffer onPress={() => setSheet(true)} />
        </Appear>
      ) : null}
      <Appear delay={layIn ? 1050 : 120} style={styles.trainer}>
        <TrainerRow />
      </Appear>
      <Appear delay={layIn ? 1100 : 160} style={styles.actions}>
        {demoKey ? <HatchNowButton /> : SMS_NUMBER ? <TextMe deviceId={deviceId} quiet={offer} /> : null}
        <ShareButton
          variant={demoKey || SMS_NUMBER || offer ? 'outline' : 'primary'}
          style={demoKey || SMS_NUMBER || offer ? styles.share : undefined}
          labelStyle={demoKey || SMS_NUMBER || offer ? styles.shareLabel : undefined}
        />
      </Appear>
      <GoldenEggSheet visible={sheet} from="egg" onClose={() => setSheet(false)} />
    </Shell>
  );
}

function GoldenOffer({ onPress }: { onPress: () => void }) {
  return (
    <View style={styles.offer}>
      <View style={styles.offerTop}>
        <Image source={require('@/assets/images/renders/bp-golden-capyboogey.png')} style={styles.offerRender} contentFit="contain" />
        <View style={styles.offerText}>
          <Text style={styles.offerTitle}>Golden Egg</Text>
          <Text style={styles.offerLine}>A second egg in the fight. Hatches golden.</Text>
        </View>
      </View>
      <PrimaryButton
        label="Golden Egg · $1"
        icon={
          <Svg width={18} height={22} viewBox="0 0 18 22">
            <Path d="M9 1.5C5 1.5 1.5 8.5 1.5 13.2c0 4.3 3.3 7.3 7.5 7.3s7.5-3 7.5-7.3C16.5 8.5 13 1.5 9 1.5z" fill={Palette.ground} stroke={Palette.ink} strokeWidth={2.2} />
          </Svg>
        }
        onPress={onPress}
      />
    </View>
  );
}

function TextMe({ deviceId, quiet }: { deviceId: string; quiet: boolean }) {
  const [asked, setAsked] = useState(false);
  const icon = (
    <Svg width={20} height={20} viewBox="0 0 24 24">
      <Path
        d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-5 4v-4a3 3 0 0 1-2-3z"
        fill="none"
        stroke={Palette.ink}
        strokeWidth={2.2}
        strokeLinejoin="round"
      />
    </Svg>
  );
  if (asked) return <OutlineButton label={`We'll text you at ${royaleHour()}`} icon={icon} onPress={() => {}} disabled />;
  const Button = quiet ? OutlineButton : PrimaryButton;
  return (
    <Button
      label="Text me when it hatches"
      icon={icon}
      onPress={() => {
        setAsked(true);
        Linking.openURL(`sms:${SMS_NUMBER}&body=${encodeURIComponent(`ROYALE ${deviceId.slice(0, 6)}`)}`);
      }}
    />
  );
}

function Shell({ sticker, onClose, children }: { sticker: string; onClose?: () => void; children: ReactNode }) {
  return (
    <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={styles.top}>
        <InkSticker label={sticker} fontSize={14} />
        {onClose ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={onClose} hitSlop={12}>
            <Svg width={28} height={28} viewBox="0 0 28 28">
              <Path d="M7 7l14 14M21 7L7 21" fill="none" stroke={Palette.ink} strokeWidth={2.8} strokeLinecap="round" />
            </Svg>
          </Pressable>
        ) : null}
      </View>
      {children}
    </ScrollView>
  );
}

function Countdown() {
  const now = useNow();
  const left = royaleTimeToday() - now;
  const { live, watch } = useLiveRoyale();
  return (
    <View style={styles.countdown}>
      <Text style={styles.clock} numberOfLines={1} adjustsFontSizeToFit>
        {left > 0 ? clock(left) : live ? 'LIVE NOW' : 'HATCHING…'}
      </Text>
      {left <= 0 && live ? (
        <OutlineButton small label="Watch live" onPress={watch} />
      ) : (
        <Text style={[Type.label, styles.muted, styles.toGo]}>{left > 0 ? 'to go' : 'in the arena'}</Text>
      )}
    </View>
  );
}

function EggStage({ seed, photo, golden, layIn }: { seed: string; photo: string | null; golden: boolean; layIn?: boolean }) {
  const now = useNow();
  const left = royaleTimeToday() - now;
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
        <Svg width={300} height={120} viewBox="0 0 300 120" style={styles.arcs}>
          <Path d="M34 30c-8 10-8 22 0 32M22 20c-13 16-13 36 0 52" fill="none" stroke={Palette.ink} strokeWidth={3} strokeLinecap="round" />
          <Path d="M262 22c8 9 8 20 0 29" fill="none" stroke={Palette.ink} strokeWidth={3} strokeLinecap="round" />
        </Svg>
        <Animated.View
          style={{
            transformOrigin: 'bottom',
            transform: [
              { scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.55, 1] }) },
              { rotate: wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-5deg', '5deg'] }) },
            ],
          }}>
          <Egg
            seed={seed}
            width={168}
            golden={golden}
            photoUrl={layIn ? null : photo}
            caption="Your snap"
            crack={left > 0 && left < 60_000 ? 'middle' : 'top'}
            rotate={0}
          />
          {layIn && photo ? (
            <Animated.View style={[styles.landed, { opacity: pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, 0, 1] }) }]}>
              <Egg seed={seed} width={168} golden={golden} photoUrl={photo} caption="Your snap" crack="none" rotate={0} />
            </Animated.View>
          ) : null}
        </Animated.View>
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
            <View style={styles.flyingPhoto}>
              <Image source={{ uri: photo }} style={{ width: 120, height: 120, borderRadius: 3 }} contentFit="cover" />
            </View>
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
  stage: { height: 250, borderRadius: Radii.stage, backgroundColor: Palette.stage, alignItems: 'center', justifyContent: 'center' },
  arcs: { position: 'absolute', left: '50%', top: 44, marginLeft: -150 },
  landed: { position: 'absolute', left: 0, top: 0 },
  flying: { position: 'absolute' },
  flyingPhoto: { backgroundColor: Palette.ground, borderWidth: 2, borderColor: Palette.ink, borderRadius: 6, padding: 5, paddingBottom: 14 },
  copy: { gap: 8, paddingHorizontal: 24, paddingTop: 16 },
  headline: { fontFamily: Fonts.black, fontSize: 38, lineHeight: 38, letterSpacing: -1.33, color: Palette.ink },
  countdown: { flexDirection: 'row', alignItems: 'flex-end', gap: 12, paddingTop: 2 },
  muted: { color: Palette.muted },
  toGo: { paddingBottom: 9 },
  clock: { fontFamily: Fonts.black, fontSize: 56, lineHeight: 54, letterSpacing: -1.7, color: Palette.ink, fontVariant: ['tabular-nums'] },
  offerLane: { paddingHorizontal: 20, paddingTop: 18 },
  offer: { gap: 14, borderWidth: 2, borderColor: Palette.ink, borderRadius: Radii.card, padding: 16 },
  offerTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  offerRender: { width: 84, height: 84, marginVertical: -6 },
  offerText: { flex: 1, gap: 2 },
  offerTitle: { fontFamily: Fonts.black, fontSize: 26, lineHeight: 28, letterSpacing: -0.8, color: Palette.ink },
  offerLine: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 21, color: Palette.ink },
  trainer: { paddingHorizontal: 24, paddingTop: 16 },
  gate: { gap: 16, paddingHorizontal: 24, paddingTop: 18 },
  gateTitle: { fontFamily: Fonts.black, fontSize: 30, lineHeight: 32, letterSpacing: -1, color: Palette.ink },
  actions: { gap: 12, paddingHorizontal: 20, paddingTop: 18 },
  share: { height: 52 },
  shareLabel: { fontSize: 17, lineHeight: 20 },
});
