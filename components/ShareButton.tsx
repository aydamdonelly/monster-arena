import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';

import { Button } from '@/components/ui';
import { shareMonster } from '@/lib/share';

export default function ShareButton({
  id,
  name,
  variant = 'primary',
  style,
}: {
  id: string;
  name: string;
  variant?: 'primary' | 'secondary';
  style?: StyleProp<ViewStyle>;
}) {
  const [label, setLabel] = useState('Share');
  const onPress = async () => {
    const outcome = await shareMonster(id, name);
    if (outcome === 'shared') return;
    setLabel(outcome === 'copied' ? 'Link copied!' : 'Could not share');
    setTimeout(() => setLabel('Share'), 2000);
  };
  return <Button label={label} icon="share-outline" variant={variant} onPress={onPress} style={style} />;
}
