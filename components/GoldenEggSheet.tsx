import { Image } from 'expo-image';
import { useEffect, useState } from 'react';
import { Animated, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InkSticker, PrimaryButton } from '@/components/ui';
import { useDeviceId } from '@/lib/device';
import { buyGoldenEgg } from '@/lib/golden';
import { Fonts, Palette } from '@/lib/theme';

const PERKS = ['One more egg today', 'Hatches golden, crown included', 'Same stats. Just fancier.'];

export default function GoldenEggSheet({ visible, onClose: close }: { visible: boolean; onClose: () => void }) {
  const deviceId = useDeviceId();
  const insets = useSafeAreaInsets();
  const rise = useState(() => new Animated.Value(0))[0];
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!visible) return;
    rise.setValue(0);
    Animated.spring(rise, { toValue: 1, damping: 18, stiffness: 160, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [visible, rise]);

  const onClose = () => {
    setFailed(false);
    close();
  };

  const buy = async () => {
    setBusy(true);
    setFailed(false);
    try {
      await buyGoldenEgg(deviceId);
    } catch (e) {
      console.warn('golden egg checkout failed', e);
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable accessibilityLabel="Close" style={styles.dim} onPress={onClose} />
      <Animated.View
        style={[
          styles.sheet,
          { paddingBottom: insets.bottom + 14, transform: [{ translateY: rise.interpolate({ inputRange: [0, 1], outputRange: [520, 0] }) }] },
        ]}>
        <View style={styles.grabber} />
        <View style={styles.stageLane}>
          <View style={styles.stage}>
            <Image source={require('@/assets/images/renders/bp-golden-capyboogey.png')} style={styles.render} contentFit="contain" />
            <InkSticker label="+1 egg" rotate={-5} style={styles.plus} />
            <InkSticker label="Crown included" light rotate={4} style={styles.crown} />
          </View>
        </View>
        <View style={styles.title}>
          <Text style={styles.titleText}>Golden Egg</Text>
          <Text style={styles.titleText}>$0.99</Text>
        </View>
        <View style={styles.perks}>
          {PERKS.map((p) => (
            <View key={p} style={styles.perk}>
              <View style={styles.bullet} />
              <Text style={styles.perkText}>{p}</Text>
            </View>
          ))}
        </View>
        <View style={styles.actions}>
          <PrimaryButton label="Crack one open · $0.99" onPress={buy} busy={busy} style={styles.buy} buttonStyle={styles.buyButton} />
          {failed ? <Text style={styles.failed}>The egg shop opens in a few minutes.</Text> : null}
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={12}>
            <Text style={styles.later}>Maybe tomorrow</Text>
          </Pressable>
        </View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(17,17,17,0.55)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: Palette.ground,
    borderTopWidth: 2,
    borderColor: Palette.ink,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: '#CCCCCC', marginTop: 10 },
  stageLane: { paddingHorizontal: 20, paddingTop: 72 },
  stage: { height: 138, borderRadius: 24, backgroundColor: Palette.stage, alignItems: 'center' },
  render: { position: 'absolute', top: -78, width: 214, height: 214 },
  plus: { position: 'absolute', top: 14, left: 14 },
  crown: { position: 'absolute', bottom: 14, right: 14 },
  title: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', paddingHorizontal: 24, paddingTop: 18 },
  titleText: { fontFamily: Fonts.black, fontSize: 36, lineHeight: 38, letterSpacing: -1.26, color: Palette.ink },
  perks: { gap: 4, paddingHorizontal: 24, paddingTop: 14 },
  perk: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bullet: {
    width: 10,
    height: 13,
    backgroundColor: Palette.ink,
    borderTopLeftRadius: 5,
    borderTopRightRadius: 5,
    borderBottomLeftRadius: 6,
    borderBottomRightRadius: 6,
  },
  perkText: { fontFamily: Fonts.medium, fontSize: 17, lineHeight: 24, color: Palette.ink },
  actions: { alignItems: 'center', gap: 14, paddingHorizontal: 20, paddingTop: 22 },
  buy: { alignSelf: 'stretch' },
  buyButton: { height: 58 },
  failed: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.ink, textAlign: 'center' },
  later: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.muted, textDecorationLine: 'underline' },
});
