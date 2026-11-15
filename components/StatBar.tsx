import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';

import type { Doc } from '@/convex/_generated/dataModel';
import { elementColor, ElementIcons, Fonts, Palette } from '@/lib/theme';

type Stats = Doc<'monsters'>['stats'];
const STAT_KEYS = ['hp', 'atk', 'def', 'spd'] as const;
const STAT_MAX = 150;

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

export function StatBars({ stats, color = Palette.ink }: { stats: Stats; color?: string }) {
  return (
    <View style={styles.bars}>
      {STAT_KEYS.map((k, i) => (
        <StatBarRow key={k} label={k.toUpperCase()} value={stats[k]} delay={i * 90} color={color} />
      ))}
    </View>
  );
}

function StatBarRow({ label, value, delay, color }: { label: string; value: number; delay: number; color: string }) {
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
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.track}>
        <Animated.View
          style={[styles.fill, { backgroundColor: color, width: fill.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }) }]}
        />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

export function ElementTag({ element, size = 'sm' }: { element: string; size?: 'sm' | 'lg' }) {
  const lg = size === 'lg';
  return (
    <View style={[styles.tag, lg && styles.tagLg, { backgroundColor: elementColor(element) }]}>
      <Ionicons name={ElementIcons[element] ?? 'ellipse'} size={lg ? 14 : 11} color="#fff" />
      <Text style={[styles.tagText, lg && styles.tagTextLg]}>{element}</Text>
    </View>
  );
}

export function AttackChip({ name, element }: { name: string; element: string }) {
  return (
    <View style={[styles.attack, { borderColor: elementColor(element) }]}>
      <View style={[styles.attackDot, { backgroundColor: elementColor(element) }]}>
        <Ionicons name={ElementIcons[element] ?? 'flash'} size={12} color="#fff" />
      </View>
      <Text style={styles.attackText} numberOfLines={1}>
        {name}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  stat: { alignItems: 'center', minWidth: 44 },
  label: { fontSize: 11, fontFamily: Fonts.bold, color: Palette.muted },
  value: { fontSize: 17, fontFamily: Fonts.black, color: Palette.ink },
  bars: { gap: 10 },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  barLabel: { width: 34, fontSize: 12, fontFamily: Fonts.black, color: Palette.muted, letterSpacing: 0.5 },
  track: { flex: 1, height: 12, borderRadius: 999, backgroundColor: Palette.bg, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 999 },
  barValue: {
    width: 34,
    textAlign: 'right',
    fontSize: 15,
    fontFamily: Fonts.black,
    color: Palette.ink,
    fontVariant: ['tabular-nums'],
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 3,
    alignSelf: 'flex-start',
  },
  tagLg: { paddingHorizontal: 12, paddingVertical: 6, gap: 6 },
  tagText: { color: '#fff', fontFamily: Fonts.black, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.6 },
  tagTextLg: { fontSize: 13 },
  attack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: 2,
    borderRadius: 999,
    paddingLeft: 4,
    paddingRight: 14,
    paddingVertical: 4,
    backgroundColor: '#fff',
    maxWidth: '100%',
  },
  attackDot: { width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  attackText: { fontFamily: Fonts.black, fontSize: 15, color: Palette.ink, flexShrink: 1 },
});
