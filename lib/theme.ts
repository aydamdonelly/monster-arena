import type Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps } from 'react';

export const Palette = {
  bg: '#e8f1ec',
  card: '#ffffff',
  ink: '#2b2523',
  muted: '#6f6763',
  faint: '#d5e3db',
  accent: '#e5503f',
  sun: '#ffd84d',
} as const;

export const Fonts = {
  regular: 'Nunito_600SemiBold',
  bold: 'Nunito_800ExtraBold',
  black: 'Nunito_900Black',
} as const;

export const ElementColors: Record<string, string> = {
  fire: '#ff7a59',
  water: '#4aa3df',
  plant: '#5fae6e',
  metal: '#8b98a5',
  fluff: '#f08dbb',
  spirit: '#9a7be2',
  leaf: '#5fae6e',
  spark: '#f2c53d',
  rock: '#a08c7a',
  normal: '#b9b2ad',
};

export const ElementIcons: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  fire: 'flame',
  water: 'water',
  plant: 'leaf',
  leaf: 'leaf',
  metal: 'cog',
  fluff: 'cloud',
  spirit: 'sparkles',
  spark: 'flash',
  rock: 'diamond',
  normal: 'ellipse',
};

export function elementColor(element: string) {
  return ElementColors[element] ?? ElementColors.normal;
}

export const webUrl = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://snappymon.com';
