import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

import { Fonts, Palette } from '@/lib/theme';

function TabIcon({ name, color }: { name: string; color: string }) {
  const stroke = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinejoin: 'round' as const };
  return (
    <Svg width={26} height={26} viewBox="0 0 26 26">
      {name === 'index' ? (
        <>
          <Path d="M3 9a2 2 0 0 1 2-2h3l1.5-2.5h7L18 7h3a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" {...stroke} />
          <Circle cx={13} cy={13.5} r={3.8} {...stroke} />
        </>
      ) : name === 'arena' ? (
        <Path d="M14.5 3 6 14.5h6L10.5 23 20 11h-6z" {...stroke} />
      ) : name === 'profile' ? (
        <>
          <Circle cx={13} cy={9} r={4.5} {...stroke} />
          <Path d="M4.5 22.5c0-4.7 3.8-8 8.5-8s8.5 3.3 8.5 8" {...stroke} strokeLinecap="round" />
        </>
      ) : (
        <>
          <Rect x={4} y={4} width={7.5} height={7.5} rx={2} {...stroke} />
          <Rect x={14.5} y={4} width={7.5} height={7.5} rx={2} {...stroke} />
          <Rect x={4} y={14.5} width={7.5} height={7.5} rx={2} {...stroke} />
          <Rect x={14.5} y={14.5} width={7.5} height={7.5} rx={2} {...stroke} />
        </>
      )}
    </Svg>
  );
}

export default function TabBar({ state, descriptors, emitter, navigateToTab, insets }: BottomTabBarProps) {
  if (StyleSheet.flatten(descriptors[state.routes[state.index].key].options.tabBarStyle)?.display === 'none') return null;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const focused = index === state.index;
        const title = descriptors[route.key].options.title ?? route.name;
        const color = focused ? Palette.ink : Palette.muted;
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        return (
          <Pressable
            key={route.key}
            role="tab"
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={title}
            onPress={onPress}
            style={styles.tab}>
            <TabIcon name={route.name} color={color} />
            <Text style={[styles.label, { color, fontFamily: focused ? Fonts.bold : Fonts.semibold }]}>{title}</Text>
            <View style={[styles.indicator, focused && styles.indicatorActive]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: Palette.ground,
    borderTopWidth: 2,
    borderTopColor: Palette.ink,
    paddingTop: 12,
    paddingHorizontal: 6,
  },
  tab: { flex: 1, alignItems: 'center', gap: 5 },
  label: { fontSize: 12, lineHeight: 14, letterSpacing: 0.4, textTransform: 'uppercase' },
  indicator: { width: 22, height: 4, borderRadius: 2 },
  indicatorActive: { backgroundColor: Palette.ink },
});
