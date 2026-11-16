import { useMutation } from 'convex/react';
import { ConvexError } from 'convex/values';
import { useState } from 'react';
import { Linking, Platform, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import QrCode from '@/components/QrCode';
import { OutlineButton, PrimaryButton } from '@/components/ui';
import { api } from '@/convex/_generated/api';
import { royaleHour, royaleIsToday } from '@/lib/arena';
import { useDeviceId } from '@/lib/device';
import { Fonts, Palette, Radii, Type } from '@/lib/theme';

type Link = { number: string; body: string };

function isDesktopWeb() {
  if (Platform.OS !== 'web' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  return !/iPhone|iPad|iPod|Android/i.test(ua) && !(/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
}

function smsUrl({ number, body }: Link) {
  const android = Platform.OS === 'android' || (Platform.OS === 'web' && /Android/i.test(navigator.userAgent));
  return `sms:${number}${android ? '?' : '&'}body=${encodeURIComponent(body)}`;
}

const icon = (
  <Svg width={20} height={20} viewBox="0 0 24 24">
    <Path
      d="M4 6a3 3 0 0 1 3-3h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-6l-5 4v-4a3 3 0 0 1-2-3z"
      fill="none"
      stroke={Palette.ink}
      strokeWidth={2.2}
      strokeLinejoin="round"
    />
  </Svg>
);

// Öffnet Nachrichten mit Keikis geteilter iMessage-Nummer und einem vorbereiteten Text (SNAP-Code + Join-Code unseres Agenten).
// Auf dem Desktop zeigt er dasselbe als QR-Code zum Scannen mit dem Handy. primary = der gelbe Knopf auf dem Ei-Screen (13 Egg).
export default function TextMeButton({
  label = 'Text me the royale result',
  primary,
  style,
}: {
  label?: string;
  primary?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const deviceId = useDeviceId();
  const getLinkCode = useMutation(api.keiki.linkCode);
  const [busy, setBusy] = useState(false);
  const [asked, setAsked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [qr, setQr] = useState<Link | null>(null);

  const onPress = async () => {
    if (qr) return setQr(null);
    setBusy(true);
    setError(null);
    try {
      const { code, number, joinCode } = await getLinkCode({ deviceId });
      const link = { number, body: `Text me when my egg hatches! ${code} (${joinCode})` };
      if (isDesktopWeb()) setQr(link);
      else {
        await Linking.openURL(smsUrl(link));
        setAsked(true);
      }
    } catch (e) {
      setError(e instanceof ConvexError ? ((e.data as { message?: string }).message ?? 'Could not open Messages.') : 'Could not open Messages.');
    } finally {
      setBusy(false);
    }
  };

  const shown = qr ? 'Hide the code' : asked ? royaleIsToday() ? `We'll text you at ${royaleHour()}` : "We'll text you tomorrow" : label;
  return (
    <View style={[styles.wrap, style]}>
      {primary && !asked && !qr ? (
        <PrimaryButton label={shown} icon={icon} onPress={onPress} busy={busy} />
      ) : (
        <OutlineButton label={shown} icon={icon} onPress={onPress} busy={busy} style={styles.outline} labelStyle={styles.outlineLabel} />
      )}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {qr ? (
        <View style={styles.qrCard}>
          <QrCode value={`SMSTO:${qr.number}:${qr.body}`} size={168} color={Palette.ink} />
          <View style={styles.qrText}>
            <Text style={Type.label}>Scan with your phone</Text>
            <Text style={Type.muted}>
              Or text <Text style={styles.strong}>{qr.body}</Text> to <Text style={styles.strong}>{qr.number}</Text>
            </Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 10 },
  outline: { height: 48, gap: 8, paddingHorizontal: 12 },
  outlineLabel: { fontSize: 15, lineHeight: 20 },
  error: { ...Type.muted, fontSize: 14, textAlign: 'center' },
  qrCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: 16,
    padding: 14,
    borderWidth: 2,
    borderColor: Palette.ink,
    borderRadius: Radii.button,
  },
  qrText: { flex: 1, minWidth: 160, gap: 6 },
  strong: { fontFamily: Fonts.bold, color: Palette.ink },
});
