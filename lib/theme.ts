import { StyleSheet } from 'react-native';

export const Palette = {
  ground: '#FFFFFF',
  ink: '#111111',
  muted: '#6B6B6B',
  hairline: '#E6E6E6',
  primary: '#FFD60A',
  stage: '#E8F1EC',
  bg: '#FFFFFF',
  card: '#FFFFFF',
  accent: '#FFD60A', // Alias für ältere Screens (Arena, /tv), gleich primary
} as const;

export const Fonts = {
  regular: 'Rubik_500Medium', // Alias für ältere Screens
  medium: 'Rubik_500Medium',
  semibold: 'Rubik_600SemiBold',
  bold: 'Rubik_700Bold',
  extrabold: 'Rubik_800ExtraBold',
  black: 'Rubik_900Black',
} as const;

export const Radii = { chip: 8, sticker: 10, button: 16, tile: 20, card: 24, stage: 28, pill: 999 } as const;

export const Type = StyleSheet.create({
  display: { fontFamily: Fonts.black, fontSize: 44, lineHeight: 44, letterSpacing: -1.5, color: Palette.ink },
  headline: { fontFamily: Fonts.black, fontSize: 40, lineHeight: 40, letterSpacing: -1.4, color: Palette.ink },
  heading: { fontFamily: Fonts.extrabold, fontSize: 22, lineHeight: 26, letterSpacing: -0.4, color: Palette.ink },
  body: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 22, color: Palette.ink },
  muted: { fontFamily: Fonts.medium, fontSize: 16, lineHeight: 22, color: Palette.muted },
  label: { fontFamily: Fonts.semibold, fontSize: 13, lineHeight: 16, letterSpacing: 1, textTransform: 'uppercase', color: Palette.ink },
  caps: { fontFamily: Fonts.bold, fontSize: 12, lineHeight: 14, letterSpacing: 1, textTransform: 'uppercase', color: Palette.ink },
});

export const ElementColors: Record<string, string> = {
  fire: '#FF6B4A',
  water: '#3D9DF3',
  plant: '#4CB867',
  metal: '#8C97A6',
  fluff: '#E98BC4',
  spirit: '#9A7BF0',
  leaf: '#4CB867',
  spark: '#F5C542',
  rock: '#A08A6A',
  normal: '#B0B6B3',
};

export function elementColor(element: string) {
  return ElementColors[element] ?? ElementColors.normal;
}

export const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://snappymon.com';
