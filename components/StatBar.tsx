import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { Doc } from '@/convex/_generated/dataModel';
import { Fonts, Palette, Type } from '@/lib/theme';

export { ElementChip as ElementTag } from '@/components/ui';

type Stats = Doc<'monsters'>['stats'];
const STAT_KEYS = ['hp', 'atk', 'def', 'spd'] as const;
const STAT_MAX = 110;

export function StatLine({ stats }: { stats: Stats }) {
  return (
    <View style={styles.row}>
      {STAT_KEYS.map((k) => (
        <View key={k} style={styles.stat}>
          <Text style={styles.label}>{k.toUpperCase()}</Text>
          <Text style={styles.value}>{stats[k]}</Text>
        </View>
      ))}
    </View>
  );
}

export function StatBars({ stats, color }: { stats: Stats; color: string }) {
  return (
    <View style={styles.bars}>
      {STAT_KEYS.map((k, i) => (
        <StatBar key={k} label={k} value={stats[k]} delay={i * 90} color={color} />
      ))}
    </View>
  );
}

export function StatBar({ label, value, delay = 0, color }: { label: string; value: number; delay?: number; color: string }) {
  const fill = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.timing(fill, {
      toValue: Math.min(1, value / STAT_MAX),
      duration: 700,
      delay,
      useNativeDriver: false,
    }).start();
  }, [fill, value, delay]);
  return (
    <View style={styles.barRow}>
      <Text style={[Type.label, styles.barLabel]}>{label}</Text>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { backgroundColor: color, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  stat: { alignItems: 'center', minWidth: 44 },
  label: { fontSize: 12, fontFamily: Fonts.semibold, letterSpacing: 1, color: Palette.muted },
  value: { fontSize: 17, fontFamily: Fonts.extrabold, color: Palette.ink },
  bars: { gap: 8 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 38 },
  track: {
    flex: 1,
    height: 14,
    borderRadius: 7,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.ground,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRightWidth: 2, borderRightColor: Palette.ink },
  barValue: {
    width: 26,
    textAlign: 'right',
    fontSize: 15,
    lineHeight: 18,
    fontFamily: Fonts.bold,
    color: Palette.ink,
    fontVariant: ['tabular-nums'],
  },
});
