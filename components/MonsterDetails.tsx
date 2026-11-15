import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import MonsterView from '@/components/MonsterView';
import { AttackChip, ElementTag, StatBars } from '@/components/StatBar';
import { Appear, Card, SectionLabel } from '@/components/ui';
import type { Doc } from '@/convex/_generated/dataModel';
import { elementColor, Fonts, Palette } from '@/lib/theme';

type Move = { name: string; kind?: string; element: string };
type Genome = { lore?: string; object?: string; moves?: Move[] };

export type MonsterLike = Pick<Doc<'monsters'>, 'name' | 'element' | 'stats' | 'genome'> & {
  photoUrl?: string | null;
  ownerName?: string | null;
};

export default function MonsterDetails({ monster, photoUri }: { monster: MonsterLike; photoUri?: string | null }) {
  const genome = monster.genome as Genome;
  const photo = photoUri ?? monster.photoUrl ?? null;
  const moves = genome.moves ?? [];

  return (
    <View style={styles.wrap}>
      <Appear>
        <View style={styles.stage}>
          <MonsterView genome={monster.genome} dom={{ scrollEnabled: false, style: { flex: 1 } }} />
        </View>
      </Appear>

      <Appear delay={120} style={styles.head}>
        <Text style={styles.name} numberOfLines={2} adjustsFontSizeToFit>
          {monster.name}
        </Text>
        <View style={styles.headRow}>
          <ElementTag element={monster.element} size="lg" />
          {monster.ownerName ? <Text style={styles.owner}>caught by {monster.ownerName}</Text> : null}
        </View>
        {genome.lore ? <Text style={styles.lore}>{genome.lore}</Text> : null}
      </Appear>

      {moves.length ? (
        <Appear delay={220}>
          <Card style={styles.section}>
            <SectionLabel>Attacks</SectionLabel>
            <View style={styles.attacks}>
              {moves.map((m) => (
                <AttackChip key={m.name} name={m.name} element={m.element} />
              ))}
            </View>
          </Card>
        </Appear>
      ) : null}

      <Appear delay={300}>
        <Card style={styles.section}>
          <SectionLabel>Stats</SectionLabel>
          <StatBars stats={monster.stats} color={elementColor(monster.element)} />
        </Card>
      </Appear>

      {photo ? (
        <Appear delay={380}>
          <Card style={styles.born}>
            <Image source={{ uri: photo }} style={styles.thumb} contentFit="cover" transition={200} />
            <View style={styles.bornText}>
              <SectionLabel>Born from</SectionLabel>
              <Text style={styles.bornObject} numberOfLines={2}>
                {genome.object || 'A real photo'}
              </Text>
            </View>
          </Card>
        </Appear>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 14 },
  stage: { height: 300, borderRadius: 32, overflow: 'hidden', backgroundColor: Palette.faint },
  head: { gap: 10, paddingHorizontal: 4 },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  name: { fontFamily: Fonts.black, fontSize: 40, lineHeight: 44, color: Palette.ink, letterSpacing: -0.5 },
  owner: { fontFamily: Fonts.bold, fontSize: 14, color: Palette.muted },
  lore: { fontFamily: Fonts.regular, fontSize: 17, lineHeight: 24, color: Palette.ink },
  section: { gap: 14 },
  attacks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  born: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  thumb: { width: 72, height: 72, borderRadius: 18, backgroundColor: Palette.bg },
  bornText: { flex: 1, gap: 4 },
  bornObject: { fontFamily: Fonts.bold, fontSize: 16, color: Palette.ink },
});
