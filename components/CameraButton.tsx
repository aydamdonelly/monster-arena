import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import { Palette } from '@/lib/theme';

export default function CameraButton({ size, yellow, onPress }: { size: number; yellow?: boolean; onPress: () => void }) {
  const icon = Math.round(size * (yellow ? 0.44 : 0.42));
  const stroke = yellow ? Palette.ink : Palette.ground;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel="Take a photo" onPress={onPress} style={{ width: size + 10, height: size + 10 }}>
      {({ pressed }) => (
        <>
          <View style={[yellow ? styles.shadow : styles.ring, { width: size, height: size, borderRadius: size / 2 }]} />
          <View
            style={[
              yellow ? styles.yellow : styles.ink,
              { width: size, height: size, borderRadius: size / 2 },
              pressed && { transform: [{ translateX: 5 }, { translateY: 5 }] },
            ]}>
            <Svg width={icon} height={icon} viewBox="0 0 76 76">
              <Path
                d="M10 26a6 6 0 0 1 6-6h8l4-7h20l4 7h8a6 6 0 0 1 6 6v28a6 6 0 0 1-6 6H16a6 6 0 0 1-6-6z"
                fill="none"
                stroke={stroke}
                strokeWidth={5}
                strokeLinejoin="round"
              />
              <Circle cx={38} cy={40} r={11} fill="none" stroke={stroke} strokeWidth={5} />
            </Svg>
          </View>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: { position: 'absolute', left: 10, top: 10, backgroundColor: Palette.ground, borderWidth: 2, borderColor: Palette.ink },
  shadow: { position: 'absolute', left: 10, top: 10, backgroundColor: Palette.ink },
  ink: { backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
  yellow: { backgroundColor: Palette.primary, borderWidth: 2, borderColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
});
