import { Image, type ImageStyle } from 'expo-image';
import { useEffect, useState, type ReactNode } from 'react';
import {
  ActivityIndicator,
  Animated,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';

import { elementColor, Fonts, Palette, Radii, Type } from '@/lib/theme';

export function HardShadow({
  offset = 4,
  radius = Radii.button,
  rotate,
  style,
  children,
}: {
  offset?: number;
  radius?: number;
  rotate?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
}) {
  return (
    <View style={[{ paddingRight: offset, paddingBottom: offset }, rotate ? { transform: [{ rotate: `${rotate}deg` }] } : null, style]}>
      <View style={[styles.shadow, { left: offset, top: offset, borderRadius: radius }]} />
      {children}
    </View>
  );
}

type ButtonProps = {
  label: string;
  onPress: () => void;
  busy?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  buttonStyle?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
};

export function PrimaryButton({ label, onPress, busy, disabled, icon, style, buttonStyle, labelStyle }: ButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || busy}
      style={[style, disabled && styles.disabled]}>
      {({ pressed }) => (
        <HardShadow offset={4} radius={Radii.button}>
          <View style={[styles.button, styles.primary, buttonStyle, pressed && styles.pressedPrimary]}>
            {busy ? (
              <ActivityIndicator color={Palette.ink} />
            ) : (
              <>
                {icon}
                <Text style={[styles.primaryLabel, labelStyle]} numberOfLines={1}>
                  {label}
                </Text>
              </>
            )}
          </View>
        </HardShadow>
      )}
    </Pressable>
  );
}

export function OutlineButton({ label, onPress, busy, disabled, small, icon, style, labelStyle }: ButtonProps & { small?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled || busy}
      style={({ pressed }) => [
        styles.button,
        styles.outline,
        small && styles.small,
        pressed && styles.pressedOutline,
        disabled && styles.disabled,
        style,
      ]}>
      {busy ? (
        <ActivityIndicator color={Palette.ink} />
      ) : (
        <>
          {icon}
          <Text style={[styles.outlineLabel, small && styles.smallLabel, labelStyle]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

export function ElementChip({ element, rotate = -3, style }: { element: string; rotate?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <HardShadow offset={2} radius={Radii.chip} rotate={rotate} style={[styles.selfStart, style]}>
      <View style={[styles.chip, { backgroundColor: elementColor(element) }]}>
        <Text style={styles.chipLabel}>{element}</Text>
      </View>
    </HardShadow>
  );
}

export function InkSticker({
  label,
  rotate = -3,
  light,
  fontSize = 13,
  style,
}: {
  label: string;
  rotate?: number;
  light?: boolean;
  fontSize?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <HardShadow offset={2} radius={Radii.chip} rotate={rotate} style={[styles.selfStart, style]}>
      <View style={[styles.chip, { backgroundColor: light ? Palette.ground : Palette.ink }]}>
        <Text style={[styles.chipLabel, { fontSize, color: light ? Palette.ink : Palette.ground }]}>{label}</Text>
      </View>
    </HardShadow>
  );
}

export function StickerTag({ name, kind, element, special }: { name: string; kind?: string; element: string; special?: boolean }) {
  return (
    <HardShadow offset={3} radius={Radii.sticker} rotate={special ? 2 : -2} style={styles.sticker}>
      <View style={[styles.stickerBody, { backgroundColor: special ? elementColor(element) : Palette.ground }]}>
        <Text style={styles.stickerName} numberOfLines={2}>
          {name}
        </Text>
        <Text style={[Type.caps, styles.stickerKind, !special && { color: Palette.muted }]}>
          {special ? `Special${kind ? ` · ${kind}` : ''}` : (kind ?? 'Basic')}
        </Text>
      </View>
    </HardShadow>
  );
}

export function StageBlock({ radius = Radii.stage, style, children }: { radius?: number; style?: StyleProp<ViewStyle>; children?: ReactNode }) {
  return <View style={[styles.stage, { borderRadius: radius }, style]}>{children}</View>;
}

export function Polaroid({
  uri,
  size = 44,
  rotate = -5,
  shadow = 3,
  caption,
}: {
  uri: string;
  size?: number;
  rotate?: number;
  shadow?: number;
  caption?: string;
}) {
  const big = !!caption;
  return (
    <HardShadow offset={shadow} radius={big ? 8 : 6} rotate={rotate}>
      <View style={[styles.polaroid, big && styles.polaroidBig]}>
        <Image source={{ uri }} style={{ width: size, height: size, borderRadius: big ? 3 : 2 }} contentFit="cover" transition={150} />
        {caption ? <Text style={[Type.caps, styles.polaroidCaption]}>{caption}</Text> : null}
      </View>
    </HardShadow>
  );
}

export function MonsterPicture({
  uri,
  photoUrl,
  imageStyle,
  photoSize = 44,
}: {
  uri?: string | null;
  photoUrl?: string | null;
  imageStyle?: StyleProp<ImageStyle>;
  photoSize?: number;
}) {
  if (uri) return <Image source={{ uri }} style={imageStyle} contentFit="contain" transition={200} />;
  if (photoUrl) return <Polaroid uri={photoUrl} size={photoSize} rotate={-6} />;
  return null;
}

export function Appear({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const progress = useState(() => new Animated.Value(0))[0];
  useEffect(() => {
    Animated.spring(progress, {
      toValue: 1,
      delay,
      damping: 14,
      stiffness: 140,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [progress, delay]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1] }),
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
        },
      ]}>
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', right: 0, bottom: 0, backgroundColor: Palette.ink },
  selfStart: { alignSelf: 'flex-start' },
  button: {
    height: 56,
    borderRadius: Radii.button,
    borderWidth: 2,
    borderColor: Palette.ink,
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
  },
  primary: { backgroundColor: Palette.primary },
  pressedPrimary: { transform: [{ translateX: 3 }, { translateY: 3 }] },
  outline: { backgroundColor: Palette.ground },
  pressedOutline: { backgroundColor: Palette.hairline },
  small: { height: 42, borderRadius: 12, paddingHorizontal: 14 },
  disabled: { opacity: 0.45 },
  primaryLabel: { fontFamily: Fonts.extrabold, fontSize: 18, lineHeight: 22, color: Palette.ink },
  outlineLabel: { fontFamily: Fonts.bold, fontSize: 18, lineHeight: 22, color: Palette.ink },
  smallLabel: { fontSize: 15, lineHeight: 20 },
  chip: { borderWidth: 2, borderColor: Palette.ink, borderRadius: Radii.chip, paddingHorizontal: 10, paddingVertical: 4 },
  chipLabel: { fontFamily: Fonts.bold, fontSize: 13, lineHeight: 16, letterSpacing: 0.8, textTransform: 'uppercase', color: Palette.ink },
  sticker: { flexShrink: 1 },
  stickerBody: {
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.sticker,
    paddingHorizontal: 12,
    paddingTop: 7,
    paddingBottom: 8,
    gap: 1,
  },
  stickerName: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 20, color: Palette.ink },
  stickerKind: { fontFamily: Fonts.semibold },
  stage: { backgroundColor: Palette.stage, overflow: 'hidden' },
  polaroid: {
    backgroundColor: Palette.ground,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: 6,
    paddingTop: 4,
    paddingHorizontal: 4,
    paddingBottom: 10,
  },
  polaroidBig: { borderRadius: 8, paddingTop: 6, paddingHorizontal: 6, paddingBottom: 8, gap: 5 },
  polaroidCaption: { fontFamily: Fonts.semibold, textAlign: 'center' },
});
