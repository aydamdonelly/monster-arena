import { ConvexError } from 'convex/values';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { api } from '@/convex/_generated/api';
import { convex } from '@/lib/convex';

// Web leaves the page for Whop and Whop sends it back to /?golden=1. Whop only redirects to https, so native opens
// checkout in the in-app browser and shows the confirming state at /?golden=1 once that browser closes.
export async function buyGoldenEgg(deviceId: string) {
  const returnUrl =
    Platform.OS === 'web' ? `${window.location.origin}/?golden=1` : Linking.createURL('/', { queryParams: { golden: '1' } });
  const { purchaseUrl } = await convex.action(api.whop.checkout, { deviceId, returnUrl });
  if (Platform.OS === 'web') {
    window.location.href = purchaseUrl;
    return;
  }
  await WebBrowser.openBrowserAsync(purchaseUrl);
  router.replace({ pathname: '/', params: { golden: '1' } });
}

export function checkoutMessage(e: unknown) {
  const data = e instanceof ConvexError ? (e.data as { message?: unknown }) : null;
  return typeof data?.message === 'string' ? data.message : 'The egg shop is jammed. Try again in a moment!';
}
