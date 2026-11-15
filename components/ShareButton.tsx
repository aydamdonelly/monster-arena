import { useState } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';

import { OutlineButton, PrimaryButton } from '@/components/ui';
import { shareEgg, shareMonster } from '@/lib/share';

export default function ShareButton({
  id,
  name,
  label: idleLabel = 'Share',
  variant = 'primary',
  style,
  labelStyle,
}: {
  id?: string;
  name?: string;
  label?: string;
  variant?: 'primary' | 'outline';
  style?: StyleProp<ViewStyle>;
  labelStyle?: StyleProp<TextStyle>;
}) {
  const [label, setLabel] = useState(idleLabel);
  const onPress = async () => {
    const outcome = id && name ? await shareMonster(id, name) : await shareEgg();
    if (outcome === 'shared') return;
    setLabel(outcome === 'copied' ? 'Link copied!' : 'Could not share');
    setTimeout(() => setLabel(idleLabel), 2000);
  };
  const Button = variant === 'primary' ? PrimaryButton : OutlineButton;
  return <Button label={label} onPress={onPress} style={style} labelStyle={labelStyle} />;
}
