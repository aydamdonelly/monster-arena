import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import MonsterView from '@/components/MonsterView';
import { ElementTag, StatLine } from '@/components/StatBar';
import { api } from '@/convex/_generated/api';
import type { Doc } from '@/convex/_generated/dataModel';
import { useDeviceId } from '@/lib/device';
import { Palette } from '@/lib/theme';
import { randomGenome } from '@/monster-kit/monster.js';

export default function CatchScreen() {
  const deviceId = useDeviceId();
  const [now] = useState(() => Date.now());
  const drop = useQuery(api.drops.current, { now });
  const create = useMutation(api.monsters.create);
  const [monster, setMonster] = useState<Doc<'monsters'> | null>(null);
  const [busy, setBusy] = useState(false);

  const onCatch = async () => {
    setBusy(true);
    try {
      const genome = randomGenome(Math.floor(Math.random() * 1_000_000_000));
      setMonster(await create({ deviceId, genome }));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.drop}>
        <Text style={styles.dropLabel}>TODAY'S DROP</Text>
        <Text style={styles.dropTitle}>
          {drop === undefined ? '…' : drop ? drop.title : 'Anything goes: catch whatever is in front of you'}
        </Text>
        {drop ? <ElementTag element={drop.element} /> : null}
      </View>

      {monster ? (
        <View style={styles.card}>
          <View style={styles.stage}>
            <MonsterView genome={monster.genome} dom={{ scrollEnabled: false, style: { flex: 1 } }} />
          </View>
          <View style={styles.meta}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{monster.name}</Text>
              <ElementTag element={monster.element} />
            </View>
            <StatLine stats={monster.stats} />
          </View>
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Catch"
        onPress={onCatch}
        disabled={busy}
        style={({ pressed }) => [styles.button, pressed && { transform: [{ scale: 0.97 }] }]}>
        {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.buttonText}>Catch</Text>}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 20, flexGrow: 1, justifyContent: 'center' },
  drop: { gap: 6 },
  dropLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: Palette.muted },
  dropTitle: { fontSize: 24, fontWeight: '800', color: Palette.ink },
  card: { backgroundColor: Palette.card, borderRadius: 24, overflow: 'hidden' },
  stage: { height: 320, backgroundColor: Palette.bg },
  meta: { padding: 16, gap: 12 },
  nameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  name: { fontSize: 22, fontWeight: '800', color: Palette.ink },
  button: {
    backgroundColor: Palette.ink,
    borderRadius: 999,
    paddingVertical: 22,
    alignItems: 'center',
  },
  buttonText: { color: '#fff', fontSize: 24, fontWeight: '900', letterSpacing: 0.5 },
});
