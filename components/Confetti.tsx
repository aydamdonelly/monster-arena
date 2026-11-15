import { useEffect, useMemo, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, useWindowDimensions, View } from 'react-native';

import { ElementColors, Palette } from '@/lib/theme';

const COLORS = [ElementColors.fire, ElementColors.water, ElementColors.plant, ElementColors.fluff, ElementColors.spirit, Palette.primary];

export default function Confetti({ count = 44 }: { count?: number }) {
  const { width, height } = useWindowDimensions();
  const progress = useState(() => new Animated.Value(0))[0];
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => {
        const r = (k: number) => {
          const x = Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453;
          return x - Math.floor(x);
        };
        return {
          x: r(1) * width,
          drift: (r(2) - 0.5) * 160,
          delay: r(3) * 0.25,
          spin: (r(4) > 0.5 ? 1 : -1) * (360 + r(5) * 540),
          size: 7 + r(6) * 7,
          round: r(7) > 0.6,
          color: COLORS[i % COLORS.length],
        };
      }),
    [count, width],
  );

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 2600,
      easing: Easing.out(Easing.quad),
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [progress]);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((p, i) => {
        const t = progress.interpolate({ inputRange: [p.delay, 1], outputRange: [0, 1], extrapolate: 'clamp' });
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute',
              left: p.x,
              top: -20,
              width: p.size,
              height: p.round ? p.size : p.size * 1.6,
              borderRadius: p.round ? p.size / 2 : 2,
              backgroundColor: p.color,
              opacity: t.interpolate({ inputRange: [0, 0.05, 0.8, 1], outputRange: [0, 1, 1, 0] }),
              transform: [
                { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, height * 0.85] }) },
                { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
                { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.spin}deg`] }) },
              ],
            }}
          />
        );
      })}
    </View>
  );
}
