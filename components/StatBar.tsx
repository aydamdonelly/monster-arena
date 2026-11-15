import { StyleSheet, Text, View } from 'react-native';

import type { Doc } from '@/convex/_generated/dataModel';
import { ElementColors, Palette } from '@/lib/theme';

export function StatLine({ stats }: { stats: Doc<'monsters'>['stats'] }) {
  return (
    <View style={styles.row}>
      {(['hp', 'atk', 'def', 'spd'] as const).map((k) => (
        <View key={k} style={styles.stat}>
          <Text style={styles.label}>{k.toUpperCase()}</Text>
          <Text style={styles.value}>{stats[k]}</Text>
        </View>
      ))}
    </View>
  );
}

export function ElementTag({ element }: { element: string }) {
  return (
    <View style={[styles.tag, { backgroundColor: ElementColors[element] ?? ElementColors.normal }]}>
      <Text style={styles.tagText}>{element}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  stat: { alignItems: 'center', minWidth: 44 },
  label: { fontSize: 11, fontWeight: '700', color: Palette.muted },
  value: { fontSize: 17, fontWeight: '800', color: Palette.ink },
  tag: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  tagText: { color: '#fff', fontWeight: '800', fontSize: 12, textTransform: 'uppercase' },
});
