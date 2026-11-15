import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import ArenaView from '@/components/ArenaView';
import type { ArenaResult, Entrant } from '@/lib/arena';
import { Fonts, Palette } from '@/lib/theme';

type Props = {
  entrants: Entrant[];
  seed: number;
  dayElement?: string | null;
  followId?: string | null;
  title: string;
  label?: string;
  onEnd: (result: ArenaResult) => void;
  children?: ReactNode;
};

export function closeArena() {
  if (router.canGoBack()) router.back();
  else router.replace('/arena');
}

export default function ArenaStage({ entrants, seed, dayElement, followId, title, label, onEnd, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
        {label ? <Text style={styles.label}>{label}</Text> : <View />}
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closeArena} style={styles.close}>
          <Ionicons name="close" size={22} color={Palette.ink} />
        </Pressable>
      </View>
      <View style={styles.stage}>
        <ArenaView
        entrants={entrants}
        seed={seed}
        dayElement={dayElement}
        followId={followId}
        camera={followId ? 'follow' : 'auto'}
        title={title}
        onEnd={async (r) => onEnd(r)}
        dom={{ scrollEnabled: false, bounces: false, style: { flex: 1 } }}
        />
      </View>
      {children ? (
        <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: insets.bottom + 16 }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function ResultPanel({ headline, detail, actions }: { headline: string; detail?: string; actions: { label: string; onPress: () => void; primary?: boolean }[] }) {
  return (
    <View style={styles.panel}>
      <Text style={styles.headline}>{headline}</Text>
      {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      <View style={styles.actions}>
        {actions.map((a) => (
          <Pressable
            key={a.label}
            accessibilityRole="button"
            onPress={a.onPress}
            style={({ pressed }) => [styles.action, a.primary && styles.primary, pressed && { transform: [{ scale: 0.97 }] }]}>
            <Text style={[styles.actionText, a.primary && { color: '#fff' }]}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#cfeaf0' },
  stage: { flex: 1, overflow: 'hidden' },
  top: { paddingHorizontal: 12, paddingBottom: 4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { backgroundColor: 'rgba(43,37,35,0.78)', color: '#fff', fontFamily: Fonts.bold, fontSize: 13, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, overflow: 'hidden' },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16 },
  panel: { backgroundColor: Palette.card, borderRadius: 24, padding: 18, gap: 8 },
  headline: { fontSize: 22, fontFamily: Fonts.bold, color: Palette.ink },
  detail: { fontSize: 15, fontFamily: Fonts.regular, color: Palette.muted },
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  action: { flex: 1, borderRadius: 999, paddingVertical: 14, alignItems: 'center', backgroundColor: Palette.bg },
  primary: { backgroundColor: Palette.ink },
  actionText: { fontSize: 16, fontFamily: Fonts.bold, color: Palette.ink },
});
