import { useMutation } from 'convex/react';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { useDeviceId } from '@/lib/device';
import { tap } from '@/lib/haptics';
import { getItem, setItem } from '@/lib/kv';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

export const SOURCES = [
  'TikTok',
  'Instagram',
  'YouTube',
  'A friend',
  "I'm attending the hackathon",
  'Some guy approached me on the street about it',
  'Other',
];

const KEY = 'snappymon.source';

export function useSource() {
  const deviceId = useDeviceId();
  const setProfile = useMutation(api.players.setProfile);
  const [source, setSource] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    getItem(KEY)
      .then((v) => v && setSource(v))
      .finally(() => setLoaded(true));
  }, []);

  const pick = (s: string) => {
    tap();
    setSource(s);
    setItem(KEY, s);
    setProfile({ deviceId, source: s }).catch((e) => console.warn('setProfile failed', e));
  };

  return { source, pick, loaded };
}

export default function SourceChips({ value, onPick, label = true }: { value: string | null; onPick: (s: string) => void; label?: boolean }) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={Type.label}>How did you get here?</Text> : null}
      <View style={styles.chips}>
        {SOURCES.map((s) => {
          const active = s === value;
          return (
            <Pressable
              key={s}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => onPick(s)}
              style={({ pressed }) => [styles.chip, active && styles.chipActive, pressed && styles.pressed]}>
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{s}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 8, rowGap: 8 },
  chip: {
    maxWidth: '100%',
    minHeight: 38,
    justifyContent: 'center',
    borderRadius: Radii.pill,
    paddingHorizontal: 14,
    paddingVertical: 8,
    backgroundColor: Palette.ground,
    borderWidth: 2,
    borderColor: Palette.ink,
  },
  chipActive: { backgroundColor: Palette.ink },
  pressed: { transform: [{ scale: 0.95 }] },
  chipText: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 19, color: Palette.ink },
  chipTextActive: { color: Palette.ground },
});
