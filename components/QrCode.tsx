import QRCode from 'qrcode';
import { useMemo } from 'react';
import { View } from 'react-native';

export default function QrCode({ value, size, color = '#2b2523' }: { value: string; size: number; color?: string }) {
  const qr = useMemo(() => QRCode.create(value, { errorCorrectionLevel: 'M' }), [value]);
  const n = qr.modules.size;
  const cell = size / (n + 2);
  return (
    <View style={{ width: size, height: size, padding: cell, backgroundColor: '#fff' }}>
      {Array.from({ length: n }, (_, y) => (
        <View key={y} style={{ flexDirection: 'row', height: cell }}>
          {Array.from({ length: n }, (_, x) => (
            <View key={x} style={{ width: cell, height: cell, backgroundColor: qr.modules.get(y, x) ? color : 'transparent' }} />
          ))}
        </View>
      ))}
    </View>
  );
}
