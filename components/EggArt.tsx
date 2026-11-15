import Svg, { Ellipse, Path } from 'react-native-svg';

import { Palette } from '@/lib/theme';

const EGG = 'M100 12C52 12 14 96 14 152c0 54 38 90 86 90s86-36 86-90C186 96 148 12 100 12z';
const SPOTS = [
  [62, 96, 9, 12],
  [136, 76, 7, 9],
  [150, 182, 10, 8],
  [58, 196, 6, 8],
  [104, 52, 5, 6],
];

export default function EggArt({ width, golden }: { width: number; golden?: boolean }) {
  return (
    <Svg width={width} height={(width * 262) / 212} viewBox="0 0 212 262">
      <Path d={EGG} transform="translate(9 9)" fill={Palette.ink} />
      <Path d={EGG} fill={golden ? '#F7C531' : '#F4F2EB'} stroke={Palette.ink} strokeWidth={3} />
      {SPOTS.map(([cx, cy, rx, ry]) => (
        <Ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} fill={golden ? '#C98A12' : '#9B6545'} />
      ))}
    </Svg>
  );
}
