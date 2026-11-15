import { useQuery } from 'convex/react';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { ElementTag, StatLine } from '@/components/StatBar';
import { api } from '@/convex/_generated/api';
import { Palette } from '@/lib/theme';

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export default function ArenaScreen() {
  const [since] = useState(startOfToday);
  const monsters = useQuery(api.monsters.listToday, { since });

  return (
    <FlatList
      data={monsters ?? []}
      keyExtractor={(m) => m._id}
      contentContainerStyle={styles.list}
      ListHeaderComponent={
        <Text style={styles.header}>{monsters ? `${monsters.length} monsters entered today` : 'Loading…'}</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.row}>
          <View style={styles.info}>
            <Text style={styles.name}>{item.name}</Text>
            <ElementTag element={item.element} />
          </View>
          <StatLine stats={item.stats} />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, gap: 10 },
  header: { fontSize: 14, fontWeight: '700', color: Palette.muted, marginBottom: 4 },
  row: {
    backgroundColor: Palette.card,
    borderRadius: 18,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  info: { gap: 6, flexShrink: 1 },
  name: { fontSize: 17, fontWeight: '800', color: Palette.ink },
});
