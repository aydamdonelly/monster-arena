import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Ellipse, Path } from 'react-native-svg';

import { HardShadow } from '@/components/ui';
import { Fonts, Palette } from '@/lib/theme';

const EGG = 'M100 12C52 12 14 96 14 152c0 54 38 90 86 90s86-36 86-90C186 96 148 12 100 12z';
const TOP_CRACK = 'M92 20l9 15-11 11 13 12-5 11';
const MIDDLE_CRACK = 'M30 146l24-16 20 20 24-22 22 22 24-20 26 18';
const CROWN = 'M70 34l14-26 16 22 16-22 14 26z';
const SPOTS = [
  [62, 96, 9, 12],
  [136, 76, 7, 9],
  [150, 182, 10, 8],
  [58, 196, 6, 8],
  [104, 52, 5, 6],
];
const TINTS = [
  ['#F4F2EB', '#9B6545'],
  ['#DCEBF7', '#3D9DF3'],
  ['#F9E1EE', '#E98BC4'],
  ['#FFE3D6', '#FF6B4A'],
  ['#DDF0DC', '#4CB867'],
  ['#E9E1FB', '#9A7BF0'],
  ['#E9ECEF', '#8C97A6'],
];
const GOLDEN = ['#FFE9A6', '#E0A800'];

function hash(seed: string) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export default function Egg({
  seed,
  width,
  golden,
  photoUrl,
  caption,
  crack,
  rotate = -4,
}: {
  seed: string;
  width: number;
  golden?: boolean;
  photoUrl?: string | null;
  caption?: string;
  crack?: 'top' | 'middle' | 'none';
  rotate?: number;
}) {
  const h = hash(seed);
  const [fill, spot] = golden ? GOLDEN : TINTS[h % TINTS.length];
  const crackPath = (crack ?? (h % 2 ? 'top' : 'none')) === 'none' ? null : crack === 'middle' ? MIDDLE_CRACK : TOP_CRACK;
  const height = (width * 262) / 212;
  const photo = Math.max(22, Math.round(width * 0.36));
  const stroke = Math.max(3, 424 / width);
  return (
    <View style={{ width, height }}>
      <Svg width={width} height={height} viewBox="0 0 212 262" style={{ transform: [{ rotate: `${rotate}deg` }] }}>
        <Path d={EGG} transform="translate(9 9)" fill={Palette.ink} />
        <Path d={EGG} fill={fill} stroke={Palette.ink} strokeWidth={stroke} />
        {SPOTS.map(([cx, cy, rx, ry]) => (
          <Ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} fill={spot} />
        ))}
        {crackPath ? (
          <Path d={crackPath} fill="none" stroke={Palette.ink} strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" />
        ) : null}
        {golden ? <Path d={CROWN} fill={spot} stroke={Palette.ink} strokeWidth={stroke} strokeLinejoin="round" /> : null}
      </Svg>
      {photoUrl ? (
        <View style={[styles.snap, { left: width * 0.56, top: height * 0.5 }]}>
          <HardShadow offset={width < 80 ? 2 : 3} radius={6} rotate={8}>
            <View style={[styles.polaroid, { padding: width < 80 ? 2 : 4, paddingBottom: caption ? 5 : width < 80 ? 4 : 6 }]}>
              <Image source={{ uri: photoUrl }} style={{ width: photo, height: photo, borderRadius: 2 }} contentFit="cover" />
              {caption ? <Text style={styles.caption}>{caption}</Text> : null}
            </View>
          </HardShadow>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  snap: { position: 'absolute' },
  polaroid: { backgroundColor: Palette.ground, borderWidth: 2, borderColor: Palette.ink, borderRadius: 6, gap: 3 },
  caption: {
    fontFamily: Fonts.semibold,
    fontSize: 12,
    lineHeight: 12,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    textAlign: 'center',
    color: Palette.ink,
  },
});
