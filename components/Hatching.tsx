import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, Path, Polygon } from 'react-native-svg';

import { Polaroid } from '@/components/ui';
import { Palette, Type } from '@/lib/theme';

const native = Platform.OS !== 'web';
const EGG = 'M100 12C52 12 14 96 14 152c0 54 38 90 86 90s86-36 86-90C186 96 148 12 100 12z';
const CRACK = 'M30 146l24-16 20 20 24-22 22 22 24-20 26 18';
const SEAM = 'L170 148 L144 130 L120 150 L98 128 L74 150 L54 130 L30 146 L0 146 Z';
const TOP_CLIP = `M0 0 H212 V148 ${SEAM}`;
const BOTTOM_CLIP = `M0 262 H212 V148 ${SEAM}`;
const BURST =
  '170.0,10.0 198.5,45.2 239.4,25.8 249.8,69.9 295.1,70.2 285.3,114.5 326.0,134.4 298.0,170.0 326.0,205.6 285.3,225.5 295.1,269.8 249.8,270.1 239.4,314.2 198.5,294.8 170.0,330.0 141.5,294.8 100.6,314.2 90.2,270.1 44.9,269.8 54.7,225.5 14.0,205.6 42.0,170.0 14.0,134.4 54.7,114.5 44.9,70.2 90.2,69.9 100.6,25.8 141.5,45.2';
const SPOTS = [
  [62, 96, 9, 12],
  [136, 76, 7, 9],
  [150, 182, 10, 8],
  [58, 196, 6, 8],
  [104, 52, 5, 6],
];
const QUIPS = ['Counting its teeth.', 'Polishing the horns.', 'Teaching it to wave.'];

function EggHalf({ part, size }: { part: 'top' | 'bottom'; size: number }) {
  const id = `egg-${part}`;
  return (
    <Svg width={size} height={(size * 262) / 212} viewBox="0 0 212 262" style={StyleSheet.absoluteFill}>
      <Defs>
        <ClipPath id={id}>
          <Path d={part === 'top' ? TOP_CLIP : BOTTOM_CLIP} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <Path d={EGG} transform="translate(9 9)" fill={Palette.ink} />
        <Path d={EGG} fill="#F4F2EB" stroke={Palette.ink} strokeWidth={3} />
        {SPOTS.map(([cx, cy, rx, ry]) => (
          <Ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} fill="#9B6545" />
        ))}
        <Path d={CRACK} fill="none" stroke={Palette.ink} strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}

export default function Hatching({ photoUri, ready, onCracked }: { photoUri: string; ready: boolean; onCracked: () => void }) {
  const { width } = useWindowDimensions();
  const k = Math.min(1, Math.min(width, 560) / 390);
  const burst = 340 * k;
  const eggW = 212 * k;
  const egg = useState(() => new Animated.Value(0))[0];
  const wobble = useState(() => new Animated.Value(0))[0];
  const split = useState(() => new Animated.Value(0))[0];
  const progress = useState(() => new Animated.Value(0))[0];
  const loop = useRef<Animated.CompositeAnimation | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [cracked, setCracked] = useState(false);
  const [quip, setQuip] = useState(0);

  useEffect(() => {
    Animated.sequence([
      Animated.spring(egg, { toValue: 1, damping: 9, stiffness: 160, useNativeDriver: native }),
      Animated.delay(900),
    ]).start(() => setIntroDone(true));
    Animated.timing(progress, { toValue: 0.9, duration: 5500, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
    loop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(wobble, { toValue: -1, duration: 520, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(wobble, { toValue: 0, duration: 260, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.delay(400),
      ]),
    );
    loop.current.start();
    const timer = setInterval(() => setQuip((q) => (q + 1) % QUIPS.length), 1500);
    return () => {
      loop.current?.stop();
      clearInterval(timer);
    };
  }, [egg, wobble, progress]);

  useEffect(() => {
    if (!ready || !introDone) return;
    loop.current?.stop();
    Animated.timing(progress, { toValue: 1, duration: 300, useNativeDriver: false }).start();
    const shake = (to: number) =>
      Animated.timing(wobble, { toValue: to, duration: 70, easing: Easing.linear, useNativeDriver: native });
    Animated.sequence([shake(1.4), shake(-1.4), shake(1.4), shake(-1.4), shake(0)]).start(() => {
      setCracked(true);
      Animated.timing(split, {
        toValue: 1,
        duration: 520,
        delay: 160,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      }).start(onCracked);
    });
  }, [ready, introDone, wobble, split, progress, onCracked]);

  const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-7deg', '7deg'] });
  const fade = split.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });

  return (
    <View style={styles.wrap}>
      <View style={[styles.art, { height: 430 * k }]}>
        <Animated.View
          style={[
            styles.center,
            {
              opacity: split.interpolate({ inputRange: [0, 0.4, 1], outputRange: [1, 1, 0] }),
              transform: [
                { scale: Animated.multiply(egg, split.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] })) },
              ],
            },
          ]}>
          <Svg width={burst} height={burst} viewBox="0 0 340 340">
            <Polygon points={BURST} fill={Palette.primary} stroke={Palette.ink} strokeWidth={2.5} strokeLinejoin="round" />
          </Svg>
        </Animated.View>
        <View style={styles.center}>
          <Animated.View
            style={{
              width: eggW,
              height: (eggW * 262) / 212,
              transformOrigin: 'bottom',
              opacity: egg.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ scale: egg }, { rotate }],
            }}>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  opacity: fade,
                  transform: [
                    { translateY: split.interpolate({ inputRange: [0, 1], outputRange: [0, -150] }) },
                    { translateX: split.interpolate({ inputRange: [0, 1], outputRange: [0, -40] }) },
                    { rotate: split.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '-40deg'] }) },
                  ],
                },
              ]}>
              <EggHalf part="top" size={eggW} />
            </Animated.View>
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                { opacity: fade, transform: [{ translateY: split.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) }] },
              ]}>
              <EggHalf part="bottom" size={eggW} />
            </Animated.View>
          </Animated.View>
        </View>
        <View style={[styles.snap, { top: 40 * k, right: 26 * k }]}>
          <Polaroid uri={photoUri} size={84 * k} rotate={9} shadow={4} caption="Your snap" />
        </View>
      </View>
      <View style={styles.copy}>
        <Text style={Type.headline}>{cracked ? 'Here it comes!' : 'Something is hatching…'}</Text>
        <Text style={styles.quip}>{cracked ? ' ' : QUIPS[quip]}</Text>
      </View>
      <View style={styles.progressBlock}>
        <View style={styles.track}>
          <Animated.View
            style={[styles.fill, { width: progress.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
          />
        </View>
        <Text style={Type.label}>About 5 seconds</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  art: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  center: { position: 'absolute', left: 0, right: 0, bottom: 0, top: 12, alignItems: 'center', justifyContent: 'center' },
  snap: { position: 'absolute' },
  copy: { gap: 8, paddingHorizontal: 28, paddingTop: 28 },
  quip: { fontFamily: Type.muted.fontFamily, fontSize: 17, lineHeight: 24, color: Palette.muted },
  progressBlock: { gap: 10, paddingHorizontal: 28, paddingTop: 26 },
  track: {
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.ground,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: Palette.ink },
});
