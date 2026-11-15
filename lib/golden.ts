import { anyApi } from 'convex/server';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { convex } from '@/lib/convex';

// whop:checkout is added by the payments PR, so it is called through an untyped reference.
export async function buyGoldenEgg(deviceId: string) {
  const returnUrl = Platform.OS === 'web' ? `${window.location.origin}/` : Linking.createURL('/');
  const result = (await convex.action(anyApi.whop.checkout, { deviceId, returnUrl })) as { purchaseUrl?: string } | null;
  if (!result?.purchaseUrl) throw new Error('No purchase URL');
  if (Platform.OS === 'web') window.location.href = result.purchaseUrl;
  else await WebBrowser.openBrowserAsync(result.purchaseUrl);
}
