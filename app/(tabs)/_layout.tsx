import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router/js-tabs';

import { Palette } from '@/lib/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: Palette.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '800', color: Palette.ink },
        sceneStyle: { backgroundColor: Palette.bg },
        tabBarStyle: { backgroundColor: '#ffffff' },
        tabBarActiveTintColor: Palette.ink,
        tabBarInactiveTintColor: Palette.muted,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Catch',
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
          tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color as string} size={size} />,
        }}
      />
    </Tabs>
  );
}
