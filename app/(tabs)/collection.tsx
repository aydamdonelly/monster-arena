import { useQuery } from 'convex/react';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import MonsterView from '@/components/MonsterView';
import { ElementTag } from '@/components/StatBar';
import { api } from '@/convex/_generated/api';
import { useDeviceId } from '@/lib/device';
import { Palette } from '@/lib/theme';

export default function CollectionScreen() {
  const deviceId = useDeviceId();
  const monsters = useQuery(api.monsters.listMine, { deviceId });

  return (
    <FlatList
      data={monsters ?? []}
      numColumns={2}
      keyExtractor={(m) => m._id}
      contentContainerStyle={styles.grid}
      columnWrapperStyle={styles.column}
      ListEmptyComponent={
        <Text style={styles.empty}>{monsters ? 'No monsters yet. Go catch one!' : 'Loading…'}</Text>
      }
      renderItem={({ item }) => (
        <View style={styles.cell}>
          <View style={styles.stage}>
            <MonsterView genome={item.genome} dom={{ scrollEnabled: false, style: { flex: 1 } }} />
          </View>
          <View style={styles.meta}>
            <Text style={styles.name} numberOfLines={1}>
              {item.name}
            </Text>
            <ElementTag element={item.element} />
          </View>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  grid: { padding: 12, gap: 12 },
  column: { gap: 12 },
  cell: { flex: 1, maxWidth: '50%', backgroundColor: Palette.card, borderRadius: 18, overflow: 'hidden' },
  stage: { height: 160, backgroundColor: Palette.bg },
  meta: { padding: 10, gap: 6 },
  name: { fontSize: 15, fontWeight: '800', color: Palette.ink },
  empty: { textAlign: 'center', marginTop: 40, color: Palette.muted, fontWeight: '600' },
});
