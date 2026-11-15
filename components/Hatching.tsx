import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, Text, View } from 'react-native';
import Svg, { ClipPath, Defs, Ellipse, G, Path } from 'react-native-svg';

import { Fonts, Palette } from '@/lib/theme';

const native = Platform.OS !== 'web';
const EGG = 'M100 6 C158 6 194 108 194 160 C194 214 152 244 100 244 C48 244 6 214 6 160 C6 108 42 6 100 6 Z';
const ZIGZAG = 'L180 114 L156 136 L130 110 L104 138 L78 112 L54 136 L30 114 L0 132';
const TOP_CLIP = `M0 0 H200 V130 ${ZIGZAG} Z`;
const BOTTOM_CLIP = `M0 250 H200 V130 ${ZIGZAG} Z`;
const CRACK = 'M194 130 L180 114 L156 136 L130 110 L104 138 L78 112 L54 136 L30 114 L6 132';
const MESSAGES = ['Reading your photo…', 'Mixing monster DNA…', 'Picking a name…', 'Teaching it two attacks…', 'Almost hatched…'];

function EggHalf({ part, cracked }: { part: 'top' | 'bottom'; cracked: boolean }) {
  const id = `egg-${part}`;
  return (
    <Svg width={170} height={212} viewBox="0 0 200 250" style={StyleSheet.absoluteFill}>
      <Defs>
        <ClipPath id={id}>
          <Path d={part === 'top' ? TOP_CLIP : BOTTOM_CLIP} />
        </ClipPath>
      </Defs>
      <G clipPath={`url(#${id})`}>
        <Path d={EGG} fill="#fffaf0" stroke={Palette.ink} strokeWidth={6} />
        <Ellipse cx={62} cy={78} rx={16} ry={20} fill="#b8e0c8" />
        <Ellipse cx={132} cy={58} rx={10} ry={12} fill={Palette.sun} />
        <Ellipse cx={142} cy={170} rx={20} ry={16} fill="#b8e0c8" />
        <Ellipse cx={58} cy={196} rx={12} ry={10} fill={Palette.sun} />
        {cracked ? <Path d={CRACK} fill="none" stroke={Palette.ink} strokeWidth={6} strokeLinejoin="round" /> : null}
      </G>
    </Svg>
  );
}

export default function Hatching({ photoUri, ready, onCracked }: { photoUri: string; ready: boolean; onCracked: () => void }) {
  const photo = useState(() => new Animated.Value(0))[0];
  const egg = useState(() => new Animated.Value(0))[0];
  const wobble = useState(() => new Animated.Value(0))[0];
  const split = useState(() => new Animated.Value(0))[0];
  const loop = useRef<Animated.CompositeAnimation | null>(null);
  const [introDone, setIntroDone] = useState(false);
  const [cracked, setCracked] = useState(false);
  const [message, setMessage] = useState(0);

  useEffect(() => {
    Animated.sequence([
      Animated.delay(250),
      Animated.parallel([
        Animated.timing(photo, { toValue: 1, duration: 650, easing: Easing.in(Easing.cubic), useNativeDriver: native }),
        Animated.sequence([
          Animated.delay(420),
          Animated.spring(egg, { toValue: 1, damping: 9, stiffness: 160, useNativeDriver: native }),
        ]),
      ]),
      Animated.delay(900),
    ]).start(() => setIntroDone(true));
    loop.current = Animated.loop(
      Animated.sequence([
        Animated.timing(wobble, { toValue: 1, duration: 180, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(wobble, { toValue: -1, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.timing(wobble, { toValue: 0, duration: 180, easing: Easing.inOut(Easing.quad), useNativeDriver: native }),
        Animated.delay(700),
      ]),
    );
    loop.current.start();
    const timer = setInterval(() => setMessage((m) => Math.min(m + 1, MESSAGES.length - 1)), 1500);
    return () => {
      loop.current?.stop();
      clearInterval(timer);
    };
  }, [photo, egg, wobble]);

  useEffect(() => {
    if (!ready || !introDone) return;
    loop.current?.stop();
    const shake = (to: number) =>
      Animated.timing(wobble, { toValue: to, duration: 70, easing: Easing.linear, useNativeDriver: native });
    Animated.sequence([shake(1.4), shake(-1.4), shake(1.4), shake(-1.4), shake(0)]).start(() => {
      setCracked(true);
      Animated.timing(split, {
        toValue: 1,
        duration: 520,
        delay: 260,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: native,
      }).start(onCracked);
    });
  }, [ready, introDone, wobble, split, onCracked]);

  const rotate = wobble.interpolate({ inputRange: [-1, 1], outputRange: ['-9deg', '9deg'] });
  const fade = split.interpolate({ inputRange: [0, 0.6, 1], outputRange: [1, 1, 0] });

  return (
    <View style={styles.wrap}>
      <View style={styles.stage}>
        <Animated.View
          style={[
            styles.flash,
            {
              opacity: split.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.9, 0] }),
              transform: [{ scale: split.interpolate({ inputRange: [0, 1], outputRange: [0.4, 2.2] }) }],
            },
          ]}
        />
        <Animated.View
          style={[
            styles.egg,
            {
              opacity: egg.interpolate({ inputRange: [0, 0.2], outputRange: [0, 1], extrapolate: 'clamp' }),
              transform: [{ scale: egg }, { rotate }],
            },
          ]}>
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
            <EggHalf part="top" cracked={cracked} />
          </Animated.View>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: fade,
                transform: [{ translateY: split.interpolate({ inputRange: [0, 1], outputRange: [0, 60] }) }],
              },
            ]}>
            <EggHalf part="bottom" cracked={cracked} />
          </Animated.View>
        </Animated.View>
        <Animated.View
          pointerEvents="none"
          style={[
            styles.photo,
            {
              opacity: photo.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 1, 0] }),
              transform: [
                { scale: photo.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] }) },
                { rotate: photo.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '200deg'] }) },
              ],
            },
          ]}>
          <Image source={{ uri: photoUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
        </Animated.View>
      </View>
      <Text style={styles.title}>{cracked ? 'Here it comes!' : 'Your egg is hatching'}</Text>
      <Text style={styles.message}>{cracked ? ' ' : MESSAGES[message]}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: 10, paddingVertical: 24 },
  stage: { width: 280, height: 300, alignItems: 'center', justifyContent: 'center' },
  flash: { position: 'absolute', width: 200, height: 200, borderRadius: 100, backgroundColor: Palette.sun },
  egg: { width: 170, height: 212, transformOrigin: 'bottom' },
  photo: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    overflow: 'hidden',
    borderWidth: 6,
    borderColor: '#fff',
    backgroundColor: Palette.faint,
  },
  title: { fontFamily: Fonts.black, fontSize: 28, color: Palette.ink, textAlign: 'center' },
  message: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.muted, textAlign: 'center' },
});
