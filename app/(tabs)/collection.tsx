import { useQuery } from 'convex/react';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import MonsterSnapshots from '@/components/MonsterSnapshots';
import Egg from '@/components/Egg';
import { Appear, HardShadow, InkSticker, MonsterPicture, StageBlock } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { clock, royaleHour, royaleIsToday, royaleTimeToday, useNow } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { useSnapshots } from '@/lib/snapshots';
import { elementColor, Fonts, Palette, Radii, Type } from '@/lib/theme';

export default function CollectionScreen() {
  const deviceId = useDeviceId();
  const monsters = useQuery(api.monsters.listMine, { deviceId });
  const hatched = monsters?.filter((m) => m.status === 'hatched').length ?? 0;
  const eggs = monsters?.filter((m) => m.status === 'egg').length ?? 0;
  const { pending, onSnapshot, snapshot } = useSnapshots(monsters?.flatMap((m) => (m.status === 'hatched' && !m.snapUrl ? [m] : [])));

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
                  {hatched} {hatched === 1 ? 'monster' : 'monsters'} · {eggs} {eggs === 1 ? 'egg' : 'eggs'}
                </Text>
              ) : null}
            </View>
            {monsters?.length === 0 ? <Text style={Type.muted}>{`Nothing here yet. Your first snap lays an egg that hatches ${royaleIsToday() ? `at ${royaleHour()}` : "in tomorrow's royale"}.`}</Text> : null}
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
          ) : item.status === 'hatched' ? (
            <Appear delay={Math.min(index, 8) * 50} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.name}
                onPress={() => router.push({ pathname: '/monster/[id]', params: { id: item._id } })}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
                <StageBlock radius={Radii.tile} style={styles.thumb}>
                  <MonsterPicture uri={item.snapUrl ?? snapshot(item._id)} photoUrl={item.photoUrl} imageStyle={styles.render} photoSize={64} />
                  {item.golden ? (
                    <HardShadow offset={2} radius={Radii.chip} rotate={-6} style={styles.newTag}>
                      <View style={styles.newTagBody}>
                        <Text style={Type.caps}>Golden</Text>
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
          ) : (
            <Appear delay={Math.min(index, 8) * 50} style={styles.cell}>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={item.status === 'rejected' ? "Egg that can't hatch" : 'Your egg'}
                onPress={() => router.push({ pathname: '/egg/[id]', params: { id: item._id } })}
                style={({ pressed }) => [styles.tile, pressed && styles.tilePressed]}>
                <StageBlock radius={Radii.tile} style={styles.thumb}>
                  <View style={item.status === 'rejected' && styles.rejected}>
                    <Egg seed={item._id} width={72} golden={item.golden} rotate={-4} />
                  </View>
                  {item.photoUrl ? (
                    <View style={styles.eggPhoto}>
                      <HardShadow offset={2} radius={6} rotate={8}>
                        <View style={styles.polaroid}>
                          <Image source={{ uri: item.photoUrl }} style={styles.photo} contentFit="cover" />
                        </View>
                      </HardShadow>
                    </View>
                  ) : null}
                  <InkSticker
                    label={item.status === 'rejected' ? "Can't hatch" : royaleIsToday() ? royaleHour() : 'Tomorrow'}
                    light={item.status === 'rejected'}
                    fontSize={12}
                    rotate={-5}
                    style={styles.eggTag}
                  />
                </StageBlock>
                <View style={styles.eggMeta}>
                  <Text style={[styles.name, item.status === 'rejected' && styles.mutedName]} numberOfLines={1}>
                    {item.status === 'rejected' ? 'No egg' : 'Mystery egg'}
                  </Text>
                  {item.status === 'egg' ? <EggClock /> : null}
                </View>
              </Pressable>
            </Appear>
          )
        }
      />
    </SafeAreaView>
  );
}

function EggClock() {
  const left = royaleTimeToday() - useNow();
  if (!royaleIsToday()) return <Text style={styles.eggClock}>TOMORROW · the time is a surprise</Text>;
  return <Text style={styles.eggClock}>{left > 0 ? clock(left) : 'hatching now'}</Text>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Palette.ground },
  snapshotter: { position: 'absolute', width: 1, height: 1, opacity: 0 },
  grid: { paddingHorizontal: 20, paddingBottom: 24, rowGap: 18, width: '100%', maxWidth: 560, alignSelf: 'center', flexGrow: 1 },
  column: { gap: 14 },
  headerWrap: { gap: 8, paddingTop: 14, paddingHorizontal: 4, paddingBottom: 2 },
  header: { gap: 2 },
  count: { color: Palette.muted },
  loading: { marginTop: 60 },
  cell: { flex: 1, maxWidth: '50%' },
  tile: { gap: 8 },
  tilePressed: { transform: [{ scale: 0.97 }] },
  thumb: { aspectRatio: 168 / 156, alignItems: 'center', justifyContent: 'center', paddingTop: 14 },
  render: { width: '98%', aspectRatio: 1 },
  newTag: { position: 'absolute', top: 10, left: 10 },
  eggTag: { position: 'absolute', top: 10, left: 10 },
  eggPhoto: { position: 'absolute', right: 22, bottom: 16 },
  polaroid: { backgroundColor: Palette.ground, borderWidth: 2, borderColor: Palette.ink, borderRadius: 6, padding: 3, paddingBottom: 6 },
  photo: { width: 30, height: 30, borderRadius: 2 },
  eggMeta: { gap: 1, paddingHorizontal: 4 },
  eggClock: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 16, color: Palette.muted, fontVariant: ['tabular-nums'] },
  rejected: { opacity: 0.35 },
  mutedName: { color: Palette.muted },
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
