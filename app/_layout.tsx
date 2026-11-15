import { Rubik_500Medium } from '@expo-google-fonts/rubik/500Medium';
import { Rubik_600SemiBold } from '@expo-google-fonts/rubik/600SemiBold';
import { Rubik_700Bold } from '@expo-google-fonts/rubik/700Bold';
import { Rubik_800ExtraBold } from '@expo-google-fonts/rubik/800ExtraBold';
import { Rubik_900Black } from '@expo-google-fonts/rubik/900Black';
import { ConvexProvider } from 'convex/react';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { DemoEntry } from '@/components/DemoMode';
import RoyaleTakeover from '@/components/RoyaleTakeover';
import { convex } from '@/lib/convex';
import { DeviceProvider } from '@/lib/device';
import { Palette } from '@/lib/theme';

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    Rubik_500Medium,
    Rubik_600SemiBold,
    Rubik_700Bold,
    Rubik_800ExtraBold,
    Rubik_900Black,
  });
  if (!fontsLoaded && !fontError) return null;

  return (
    <ConvexProvider client={convex}>
      <DeviceProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Palette.bg } }}>
          <Stack.Screen name="onboarding" options={{ animation: 'fade' }} />
        </Stack>
        <DemoEntry />
        <RoyaleTakeover />
      </DeviceProvider>
    </ConvexProvider>
  );
}
