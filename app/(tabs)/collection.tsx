import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import MonsterSnapshots from '@/components/MonsterSnapshots';
import { Appear, HardShadow, StageBlock } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { useDeviceId } from '@/lib/device';
import { elementColor, Fonts, Palette, Radii, Type } from '@/lib/theme';

const snapshots = new Map<string, string>();

export default function CollectionScreen() {
  const deviceId = useDeviceId();
  const monsters = useQuery(api.monsters.listMine, { deviceId });
  const [, setVersion] = useState(0);
  const pending = useMemo(
    () => (monsters ?? []).filter((m) => !snapshots.has(m._id)).map((m) => ({ id: m._id, genome: m.genome })),
    [monsters],
  );
  const onSnapshot = async (id: string, uri: string) => {
    snapshots.set(id, uri);
    setVersion((v) => v + 1);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <MonsterSnapshots items={pending} onSnapshot={onSnapshot} dom={{ style: styles.snapshotter }} />
      <FlatList
        data={monsters ? [...monsters, null] : []}
        numColumns={2}
        keyExtractor={(m) => m?._id ?? 'new'}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.column}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.headerWrap}>
            <View style={styles.header}>
              <Text style={Type.display}>Collection</Text>
              {monsters?.length ? (
                <Text style={[Type.label, styles.count]}>
                  {monsters.length} {monsters.length === 1 ? 'monster' : 'monsters'}
                </Text>
              ) : null}
            </View>
            {monsters?.length === 0 ? <Text style={Type.muted}>Nothing here yet. Your first snap hatches in 5 seconds.</Text> : null}
          </View>
        }
        ListEmptyComponent={<ActivityIndicator color={Palette.ink} style={styles.loading} />}
        renderItem={({ item, index }) =>
          item === null ? (
            <Appear delay={Math.min(index, 8) * 50} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Snap something new"
                onPress={() => router.navigate('/')}
                style={({ pressed }) => [styles.newSlot, pressed && styles.newSlotPressed]}>
                <Svg width={30} height={30} viewBox="0 0 30 30">
                  <Path d="M15 4v22M4 15h22" stroke={Palette.ink} strokeWidth={3} strokeLinecap="round" />
                </Svg>
                <Text style={styles.newText}>Snap something new</Text>
              </Pressable>
            </Appear>
          ) : (
            <Appear delay={Math.min(index, 8) * 50} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.name}
                onPress={() => router.push({ pathname: '/monster/[id]', params: { id: item._id } })}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
                <StageBlock radius={Radii.tile} style={styles.thumb}>
                  {snapshots.has(item._id) ? (
                    <Image source={{ uri: snapshots.get(item._id) }} style={styles.render} contentFit="cover" transition={200} />
                  ) : null}
                  {index === 0 ? (
                    <HardShadow offset={2} radius={Radii.chip} rotate={-6} style={styles.newTag}>
                      <View style={styles.newTagBody}>
                        <Text style={Type.caps}>New</Text>
                      </View>
                    </HardShadow>
                  ) : null}
                </StageBlock>
                <View style={styles.meta}>
                  <Text style={styles.name} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <View style={[styles.dot, { backgroundColor: elementColor(item.element) }]} />
                </View>
              </Pressable>
            </Appear>
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.ground },
  snapshotter: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  grid: { paddingHorizontal: 20, paddingBottom: 24, rowGap: 18, width: '100%', maxWidth: 560, alignSelf: 'center', flexGrow: 1 },
  column: { gap: 14 },
  headerWrap: { gap: 8, paddingTop: 14, paddingHorizontal: 4, paddingBottom: 2 },
  header: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: 8 },
  count: { paddingBottom: 7 },
  loading: { marginTop: 60 },
  cell: { flex: 1, maxWidth: '50%' },
  tile: { gap: 8 },
  tilePressed: { transform: [{ scale: 0.97 }] },
  thumb: { aspectRatio: 168 / 156, alignItems: 'center', justifyContent: 'center' },
  render: { width: '98%', aspectRatio: 1 },
  newTag: { position: 'absolute', top: 10, left: 10 },
  newTagBody: {
    backgroundColor: Palette.primary,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.chip,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  meta: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingHorizontal: 4 },
  name: { flexShrink: 1, fontFamily: Fonts.extrabold, fontSize: 17, lineHeight: 20, letterSpacing: -0.2, color: Palette.ink },
  dot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: Palette.ink },
  newSlot: {
    aspectRatio: 168 / 156,
    borderRadius: Radii.tile,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  newSlotPressed: { backgroundColor: Palette.hairline },
  newText: { width: 130, fontFamily: Fonts.bold, fontSize: 15, lineHeight: 18, color: Palette.ink, textAlign: 'center' },
});
