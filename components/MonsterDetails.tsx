import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import MonsterView from '@/components/MonsterView';
import { StatBars } from '@/components/StatBar';
import { Appear, ElementChip, Polaroid, StageBlock, StickerTag } from '@/components/ui';
import type { Doc } from '@/convex/_generated/dataModel';
import { elementColor, Fonts, Palette, Type } from '@/lib/theme';

type Move = { name: string; kind?: string; element: string };
type Genome = { lore?: string; object?: string; moves?: Move[] };

export type MonsterLike = Pick<Doc<'monsters'>, 'name' | 'element' | 'stats' | 'genome' | '_creationTime'> & {
  photoUrl?: string | null;
  ownerName?: string | null;
};

export function hatchedAt(time: number) {
  const date = new Date(time);
  const clock = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  if (date.toDateString() === new Date().toDateString()) return `today ${clock}`;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function MonsterTopBar({ label, onBack }: { label: string; onBack?: () => void }) {
  return (
    <View style={styles.bar}>
      {onBack ? (
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={onBack} hitSlop={12}>
          <Svg width={28} height={28} viewBox="0 0 28 28">
            <Path d="M17 6l-8 8 8 8" fill="none" stroke={Palette.ink} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      ) : (
        <View style={styles.barSide} />
      )}
      <Text style={[Type.label, styles.barLabel]} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.barSide} />
    </View>
  );
}

export default function MonsterDetails({ monster, photoUri }: { monster: MonsterLike; photoUri?: string | null }) {
  const genome = monster.genome as Genome;
  const photo = photoUri ?? monster.photoUrl ?? null;
  const moves = genome.moves ?? [];

  return (
    <View style={styles.wrap}>
      <Appear>
        <StageBlock style={styles.stage}>
          <MonsterView genome={monster.genome} dom={{ scrollEnabled: false, style: { flex: 1 } }} />
          <ElementChip element={monster.element} rotate={-4} style={styles.stageChip} />
        </StageBlock>
      </Appear>

      <Appear delay={120} style={styles.head}>
        <Text style={Type.display} numberOfLines={2} adjustsFontSizeToFit>
          {monster.name}
        </Text>
        {genome.lore ? <Text style={Type.muted}>{genome.lore}</Text> : null}
      </Appear>

      {moves.length ? (
        <Appear delay={220} style={styles.section}>
          <Text style={Type.label}>Attacks</Text>
          <View style={styles.attacks}>
            {moves.map((m, i) => (
              <StickerTag key={m.name} name={m.name} kind={m.kind} element={m.element} special={i > 0} />
            ))}
          </View>
        </Appear>
      ) : null}

      <Appear delay={300} style={styles.lane}>
        <StatBars stats={monster.stats} color={elementColor(monster.element)} />
      </Appear>

      {photo ? (
        <Appear delay={380} style={styles.born}>
          <Polaroid uri={photo} />
          <View style={styles.bornText}>
            <Text style={Type.label}>Born from</Text>
            <Text style={styles.bornObject} numberOfLines={2}>
              {genome.object || 'a real photo'}
            </Text>
            <Text style={styles.bornTime}>{hatchedAt(monster._creationTime)}</Text>
          </View>
        </Appear>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 10,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  barSide: { width: 28, height: 28 },
  barLabel: { flexShrink: 1, color: Palette.muted, textAlign: 'center' },
  wrap: { gap: 16 },
  stage: { aspectRatio: 350 / 226 },
  stageChip: { position: 'absolute', top: 16, left: 16 },
  head: { gap: 6, paddingHorizontal: 4 },
  section: { gap: 12, paddingHorizontal: 4 },
  attacks: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', columnGap: 14, rowGap: 10 },
  lane: { paddingHorizontal: 4, paddingTop: 4 },
  born: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: 4 },
  bornText: { flex: 1, gap: 2 },
  bornObject: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 20, color: Palette.ink },
  bornTime: { fontFamily: Fonts.medium, fontSize: 14, lineHeight: 18, color: Palette.muted },
});
