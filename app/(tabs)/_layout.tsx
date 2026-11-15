import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';

import { useOnboarding } from '@/lib/device';
import { Fonts, Palette } from '@/lib/theme';

export default function TabLayout() {
  const { onboarded } = useOnboarding();
  if (!onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Palette.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: Fonts.black, color: Palette.ink },
        sceneStyle: { backgroundColor: Palette.bg },
        tabBarStyle: { backgroundColor: '#ffffff', borderTopWidth: 0 },
        tabBarLabelStyle: { fontFamily: Fonts.bold, fontSize: 12 },
        tabBarActiveTintColor: Palette.ink,
        tabBarInactiveTintColor: Palette.muted,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Catch',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="camera" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="arena"
        options={{
          title: 'Arena',
          tabBarIcon: ({ color, size }) => <Ionicons name="flash" color={color as string} size={size} />,
        }}
      />
      <Tabs.Screen
        name="collection"
        options={{
          title: 'Collection',
          headerShown: false,
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
