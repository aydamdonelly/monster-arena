import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import ArenaView from '@/components/ArenaView';
import { HardShadow, InkSticker, OutlineButton, PrimaryButton } from '@/components/ui';
import type { ArenaResult, Entrant } from '@/lib/arena';
import { Palette, Radii, Type } from '@/lib/theme';

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
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.top}>
        {label ? <InkSticker label={label} /> : <View />}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={closeArena}
          hitSlop={8}
          style={({ pressed }) => [styles.close, pressed && styles.closePressed]}>
          <Svg width={22} height={22} viewBox="0 0 28 28">
            <Path d="M7 7l14 14M21 7L7 21" fill="none" stroke={Palette.ink} strokeWidth={3} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>
      <View style={[styles.stage, { marginBottom: insets.bottom + 12 }]}>
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
        <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
          {children}
        </View>
      ) : null}
    </View>
  );
}

export function ResultPanel({ headline, detail, actions }: { headline: string; detail?: string; actions: { label: string; onPress: () => void; primary?: boolean }[] }) {
  return (
    <HardShadow offset={5} radius={Radii.card}>
      <View style={styles.panel}>
        <Text style={Type.heading}>{headline}</Text>
        {detail ? <Text style={Type.muted}>{detail}</Text> : null}
        <View style={styles.actions}>
          {actions.map((a) =>
            a.primary ? (
              <PrimaryButton key={a.label} label={a.label} onPress={a.onPress} style={styles.action} />
            ) : (
              <OutlineButton key={a.label} label={a.label} onPress={a.onPress} style={styles.action} />
            ),
          )}
        </View>
      </View>
    </HardShadow>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Palette.ground },
  top: { paddingHorizontal: 20, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: Palette.ink,
    backgroundColor: Palette.ground,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closePressed: { backgroundColor: Palette.hairline },
  stage: {
    flex: 1,
    marginHorizontal: 12,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.card,
    overflow: 'hidden',
    backgroundColor: Palette.stage,
  },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 24 },
  panel: {
    backgroundColor: Palette.ground,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.card,
    padding: 18,
    gap: 6,
  },
  actions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  action: { flex: 1 },
});
