import { useMutation, useQuery } from 'convex/react';
import { useState } from 'react';
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { api } from '@/convex/_generated/api';
import { useDeviceId } from '@/lib/device';
import { Fonts, Palette, Type } from '@/lib/theme';

export default function TrainerRow({ onFocus, onBlur }: { onFocus?: () => void; onBlur?: () => void }) {
  const deviceId = useDeviceId();
  const [now] = useState(() => Date.now());
  const me = useQuery(api.players.me, { deviceId, now });
  const setProfile = useMutation(api.players.setProfile);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [entered, setEntered] = useState(false);

  const enter = async () => {
    Keyboard.dismiss();
    if (busy || !name.trim()) return;
    setBusy(true);
    try {
      await setProfile({ deviceId, name: name.trim() });
      setEntered(true);
    } catch (e) {
      console.warn('setProfile failed', e);
    } finally {
      setBusy(false);
    }
  };

  if (me === undefined) return null;
  if (entered || me?.name) return <Text style={styles.line}>{`You're in as ${me?.name ?? name.trim()}.`}</Text>;

  return (
    <View style={styles.wrap}>
      <Text style={Type.label}>{"What's your name?"}</Text>
      <View style={styles.field}>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={Palette.muted}
          accessibilityLabel="Your name"
          maxLength={20}
          autoCapitalize="words"
          autoCorrect={false}
          returnKeyType="done"
          onSubmitEditing={enter}
          onFocus={onFocus}
          onBlur={onBlur}
          style={styles.input}
        />
        <Pressable
          accessibilityRole="button"
          onPress={enter}
          disabled={busy || !name.trim()}
          style={({ pressed }) => [styles.enter, pressed && styles.enterPressed]}>
          <Text style={styles.enterLabel}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  line: { fontFamily: Fonts.semibold, fontSize: 15, lineHeight: 20, color: Palette.ink },
  field: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  input: {
    flex: 1,
    minWidth: 0,
    height: 50,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Palette.ink,
    paddingHorizontal: 16,
    fontFamily: Fonts.medium,
    fontSize: 17,
    color: Palette.ink,
    backgroundColor: Palette.ground,
  },
  enter: { height: 50, borderRadius: 14, paddingHorizontal: 20, backgroundColor: Palette.ink, alignItems: 'center', justifyContent: 'center' },
  enterPressed: { transform: [{ scale: 0.97 }] },
  enterLabel: { fontFamily: Fonts.extrabold, fontSize: 16, lineHeight: 20, color: Palette.ground },
});
