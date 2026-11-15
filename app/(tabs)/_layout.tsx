import { Tabs } from 'expo-router/js-tabs';

import TabBar from '@/components/TabBar';
import { Palette } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: Palette.ground } }}>
      <Tabs.Screen name="index" options={{ title: 'Catch' }} />
      <Tabs.Screen name="arena" options={{ title: 'Arena' }} />
      <Tabs.Screen name="collection" options={{ title: 'Collection' }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
