import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import TabBar from '@/components/TabBar';
import { useOnboarding } from '@/lib/device';
import { Fonts, Palette } from '@/lib/theme';

export default function TabLayout() {
  const { onboarded } = useOnboarding();
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerStyle: { backgroundColor: Palette.ground },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: Fonts.black, color: Palette.ink },
        sceneStyle: { backgroundColor: Palette.ground },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Catch', headerShown: false }} />
      <Tabs.Screen name="arena" options={{ title: 'Arena' }} />
      <Tabs.Screen name="collection" options={{ title: 'Collection', headerShown: false }} />
    </Tabs>
  );
}
