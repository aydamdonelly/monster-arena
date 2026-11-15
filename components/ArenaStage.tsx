import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';

import ArenaView from '@/components/ArenaView';
import { HardShadow, InkSticker, OutlineButton, PrimaryButton } from '@/components/ui';
import type { ArenaResult, Entrant } from '@/lib/arena';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

type Props = {
  entrants: Entrant[];
  seed: number;
  dayElement?: string | null;
  followId?: string | null;
  title: string;
  label?: string;
  live?: boolean;
  caption?: string | null;
  onEnd: (result: ArenaResult) => void;
  children?: ReactNode;
};

export function closeArena() {
  if (router.canGoBack()) router.back();
  else router.replace('/arena');
}

export default function ArenaStage({ entrants, seed, dayElement, followId, title, label, live, caption, onEnd, children }: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <View pointerEvents="box-none" style={[styles.top, { paddingTop: insets.top + 8 }]}>
        <View style={styles.topLeft}>
          {live ? (
            <HardShadow offset={2} radius={8} rotate={-4}>
              <View style={styles.live}>
                <Text style={styles.liveText}>Live</Text>
              </View>
            </HardShadow>
          ) : (
            <InkSticker label="Replay" rotate={-4} />
          )}
          {label ? <Text style={Type.label}>{label}</Text> : null}
        </View>
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
        <View pointerEvents="box-none" style={[styles.bottom, { paddingBottom: insets.bottom + 28 }]}>
          {children}
        </View>
      ) : caption ? (
        <View pointerEvents="none" style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
          <HardShadow offset={4} radius={Radii.tile}>
            <View style={styles.caption}>
              <Text style={styles.captionText} numberOfLines={1}>
                Your egg: <Text style={styles.captionName}>{caption}</Text>
              </Text>
              <InkSticker label="You" fontSize={12} rotate={4} />
            </View>
          </HardShadow>
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
  root: { flex: 1, backgroundColor: '#CFEAF0' },
  top: { paddingHorizontal: 20, paddingBottom: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  live: { backgroundColor: '#FF5A4A', borderWidth: 2, borderColor: Palette.ink, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  liveText: { fontFamily: Fonts.extrabold, fontSize: 14, lineHeight: 16, letterSpacing: 1.1, textTransform: 'uppercase', color: Palette.ground },
  caption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: Palette.ground,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.tile,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  captionText: { flexShrink: 1, fontFamily: Fonts.medium, fontSize: 17, lineHeight: 22, color: Palette.ink },
  captionName: { fontFamily: Fonts.extrabold },
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
  stage: { flex: 1 },
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
