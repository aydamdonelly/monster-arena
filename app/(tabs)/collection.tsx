import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ElementTag } from '@/components/StatBar';
import { Appear, Button } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { useDeviceId } from '@/lib/device';
import { elementColor, ElementIcons, Fonts, Palette } from '@/lib/theme';

export default function CollectionScreen() {
  const deviceId = useDeviceId();
  const monsters = useQuery(api.monsters.listMine, { deviceId });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <FlatList
        data={monsters ?? []}
        numColumns={2}
        keyExtractor={(m) => m._id}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.column}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={styles.title}>Collection</Text>
            {monsters?.length ? <Text style={styles.count}>{monsters.length} caught</Text> : null}
          </View>
        }
        ListEmptyComponent={
          monsters ? (
            <Appear style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Ionicons name="egg-outline" size={40} color={Palette.ink} />
              </View>
              <Text style={styles.emptyTitle}>No monsters yet</Text>
              <Text style={styles.emptyText}>Snap your first photo and watch it hatch.</Text>
              <Button label="Catch one" icon="camera" onPress={() => router.navigate('/')} style={styles.emptyButton} />
            </Appear>
          ) : (
            <ActivityIndicator color={Palette.ink} style={{ marginTop: 60 }} />
          )
        }
        renderItem={({ item, index }) => (
          <Appear delay={Math.min(index, 8) * 50} style={styles.cellWrap}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.name}
              onPress={() => router.push({ pathname: '/monster/[id]', params: { id: item._id } })}
              style={({ pressed }) => [styles.cell, pressed && { transform: [{ scale: 0.97 }] }]}>
              <View style={[styles.photo, { backgroundColor: elementColor(item.element) }]}>
                {item.photoUrl ? (
                  <Image source={{ uri: item.photoUrl }} style={StyleSheet.absoluteFill} contentFit="cover" transition={200} />
                ) : (
                  <Ionicons name={ElementIcons[item.element] ?? 'egg'} size={44} color="rgba(255,255,255,0.9)" />
                )}
              </View>
              <View style={styles.meta}>
                <Text style={styles.name} numberOfLines={1}>
                  {item.name}
                </Text>
                <ElementTag element={item.element} />
              </View>
            </Pressable>
          </Appear>
        )}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.bg },
  grid: { padding: 16, paddingBottom: 32, gap: 12, width: '100%', maxWidth: 560, alignSelf: 'center', flexGrow: 1 },
  column: { gap: 12 },
  header: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', paddingHorizontal: 4, paddingBottom: 4 },
  title: { fontFamily: Fonts.black, fontSize: 34, color: Palette.ink, letterSpacing: -0.5 },
  count: { fontFamily: Fonts.bold, fontSize: 15, color: Palette.muted },
  cellWrap: { flex: 1, maxWidth: '50%' },
  cell: {
    backgroundColor: Palette.card,
    borderRadius: 24,
    overflow: 'hidden',
    shadowColor: Palette.ink,
    shadowOpacity: 0.07,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
  photo: { aspectRatio: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  meta: { padding: 12, gap: 6 },
  name: { fontSize: 17, fontFamily: Fonts.black, color: Palette.ink },
  empty: { alignItems: 'center', gap: 10, marginTop: 60, paddingHorizontal: 20 },
  emptyIcon: { width: 84, height: 84, borderRadius: 42, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: Fonts.black, fontSize: 24, color: Palette.ink },
  emptyText: { fontFamily: Fonts.regular, fontSize: 16, color: Palette.muted, textAlign: 'center' },
  emptyButton: { marginTop: 8, alignSelf: 'stretch' },
});
